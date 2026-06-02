import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { parseDateToISO, parsePrice, validateTaxId } from '../../utils/number-parser.util';
import { CountryCode, getProfile, COUNTRY_PROFILES } from 'src/modules/invoice/config/country-profiles.config';

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as any[])
      .filter(p => p.type === 'text')
      .map(p => p.text ?? '')
      .join('');
  }
  return String(content ?? '');
}


// Gom đống hints từ detect-country trong extract invoice sang đây để LLM tham khảo khi tự nhận diện
const COUNTRY_HINTS = Object.values(COUNTRY_PROFILES)
  .filter(p => p.code !== 'UNKNOWN')
  .map(p => `${p.code}: keywords=[${p.invoiceKeywords.slice(0, 3).join(', ')}], currency=${p.currency}, taxIdLabel="${p.taxIdLabel}"`)
  .join('\n');

export function createExtractInvoiceTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'extractInvoice',
    description: 'Automatically detect the invoice country and extract all invoice information according to that country-specific format.',
    // Schema đơn giản lại, chỉ cần nhận vào độ rõ nét (readability) thu được từ bước check quality
    schema: z.object({
      readability: z.string().default('HIGH'),
    }),
    func: async ({ readability: readabilityRaw }) => {
      // Agent có thể truyền vào JSON string nguyên từ checkImageQuality output — parse defensive
      let readability: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
      try {
        if (readabilityRaw.startsWith('{')) {
          const parsed = JSON.parse(readabilityRaw);
          readability = parsed.readability ?? 'HIGH';
        } else if (['HIGH', 'MEDIUM', 'LOW'].includes(readabilityRaw.toUpperCase())) {
          readability = readabilityRaw.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW';
        }
      } catch { /* fallback to HIGH */ }
      const cleanBase64 = rawBase64.replace(/\s+/g, '').replace(/^data:image\/\w+;base64,/, '');
      const formattedDataUrl = `data:image/jpeg;base64,${cleanBase64}`;

      const qualityHint = readability === 'LOW'
        ? 'The image quality is low — try to read the clearest regions and mark uncertain fields with "?".'
        : '';

      // Prompt hai giai đoạn trong cùng 1 lần gọi (Single-shot Chain of Thought):
      // Bước 1: Bắt LLM nhìn ảnh chọn quốc gia.
      // Bước 2: Bắt LLM dùng quy tắc quốc gia đó để bóc tách dữ liệu JSON.
      const prompt = `${qualityHint}
                        You are an AI expert for multi-country invoice extraction. Process this invoice image in 2 steps:

                        [STEP 1: DETECT THE COUNTRY]
                        Based on the language, currency symbols (¥, $, ₩, đ, €, £...), date format, tax ID labels, and other clues, compare the invoice against the country rules below to determine the issuing country:
                        ${COUNTRY_HINTS}

                        [STEP 2: EXTRACT INVOICE INFORMATION]
                        After detecting the country, apply that country's specific rules to map the data fields:
                        - Invoice number (Invoice No, 請求書番号...)
                        - Invoice date and due date
                        - Seller and buyer information (name, tax ID, address...)
                        - Amount fields: subtotal, tax (VAT/Tax), and total

                        Return exactly one raw JSON Object only (do not wrap it in markdown \`\`\`json), following this structure:
                        {
                          "detectedCountry": {
                            "countryCode": "VN" | "US" | "JP" | "CN" | "SG" | "TH" | "KR" | "MY" | "ID" | "PH" | "DE" | "FR" | "GB" | "AU" | "IN" | "UNKNOWN",
                            "confidence": 0-100,
                            "detectedLanguage": "vi" | "en" | "ja" | "zh" | "th" | "ko" | "de" | "fr" | "id" | "ms" | "other",
                            "detectedCurrency": "VND" | "USD" | "JPY" | "EUR" | "GBP" | "SGD" | "THB" | "KRW" | "MYR" | "IDR" | "PHP" | "AUD" | "INR" | "CNY" | "UNKNOWN"
                          },
                          "invoiceNo": "",
                          "invoiceDate": "",
                          "dueDate": "",
                          "seller": { "name": "", "taxId": "", "address": "", "email": "", "phone": "" },
                          "buyer": { "name": "", "taxId": "", "address": "" },
                          "items": [
                            { "no": 1, "description": "", "unit": "", "qty": 0, "unitPrice": "RAW_STRING", "amount": "RAW_STRING" }
                          ],
                          "subtotal": "RAW_STRING",
                          "vatRate": 0,
                          "vat": "RAW_STRING",
                          "totalDue": "RAW_STRING",
                          "amountInWords": "",
                          "bankAccount": { "bank": "", "accountNo": "", "accountName": "" },
                          "uncertainFields": []
                        }
                        ⚠️ MANDATORY RULES FOR ITEM AMOUNTS:
                        1. DO NOT arbitrarily shorten monetary values. If the unit price on the invoice is 25 million (written briefly as 25 or 25.000), you MUST infer and fill the missing zeros in the JSON as a full digit string: "25,000,000" or "25000000".
                        2. Make sure the "amount" value is mathematically equal to "unitPrice" multiplied by "qty" before formatting it as a string.
                        3. Preserve the original separator characters (dots/commas) from the invoice when present. Do not arbitrarily convert number formats.
                      `;

      const response = await model.invoke([
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: formattedDataUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ]);

      let extracted: any;
      try {
        // Loại bỏ markdown block nếu model vô tình trả về
        const rawText = extractTextContent(response.content);
        const cleanContent = rawText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        extracted = JSON.parse(cleanContent);
      } catch {
        return extractTextContent(response.content);
      }

      // Lấy profile dựa trên quốc gia mà LLM vừa tự động nhận diện được ở Bước 1
      const detectedCountryCode = extracted.detectedCountry?.countryCode ?? 'UNKNOWN';
      const profile = getProfile(detectedCountryCode as CountryCode);

      // Tiến hành Normalize các chuỗi tiền tệ thô dựa theo định dạng của profile quốc gia đó
      extracted.items = (extracted.items ?? []).map((item: any) => ({
        ...item,
        unitPrice: parsePrice(item.unitPrice, profile),
        amount: parsePrice(item.amount, profile),
        qty: Number(item.qty) || 0,
      }));
      extracted.subtotal = parsePrice(extracted.subtotal, profile);
      extracted.vat = parsePrice(extracted.vat, profile);
      extracted.totalDue = parsePrice(extracted.totalDue, profile);

      // Normalize định dạng ngày tháng
      extracted.invoiceDate = parseDateToISO(extracted.invoiceDate, profile);
      extracted.dueDate = parseDateToISO(extracted.dueDate, profile);

      // Kiểm tra tính hợp lệ của Tax ID theo quốc gia
      const sellerTaxValid = validateTaxId(extracted.seller?.taxId ?? '', profile);
      const buyerTaxValid = validateTaxId(extracted.buyer?.taxId ?? '', profile);
      if (!sellerTaxValid && extracted.seller?.taxId) {
        extracted.uncertainFields = [...(extracted.uncertainFields ?? []), `seller.taxId format không khớp pattern ${profile.code}`];
      }
      if (!buyerTaxValid && extracted.buyer?.taxId) {
        extracted.uncertainFields = [...(extracted.uncertainFields ?? []), `buyer.taxId format không khớp pattern ${profile.code}`];
      }

      // Đóng gói metadata chuẩn chỉnh trả ra cho hệ thống
      extracted._countryCode = profile.code;
      extracted._countryName = profile.name;
      extracted._currency = profile.currency;
      extracted._roundingUnit = profile.roundingUnit;

      return JSON.stringify(extracted);
    },
  });
}
