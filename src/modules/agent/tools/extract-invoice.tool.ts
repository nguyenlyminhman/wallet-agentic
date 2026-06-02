// agent/tools/extract-invoice.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { parseAmount, parseDateToISO, parsePrice, validateTaxId } from '../../utils/number-parser.util';
import { CountryCode, getProfile, COUNTRY_PROFILES } from 'src/modules/invoice/config/country-profiles.config';

/** Gemini trả về content dạng string hoặc MessageContentComplex[] — normalize về string */
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


// Gom đống hints từ detect-country cũ sang đây để LLM tham khảo khi tự nhận diện
const COUNTRY_HINTS = Object.values(COUNTRY_PROFILES)
  .filter(p => p.code !== 'UNKNOWN')
  .map(p => `${p.code}: keywords=[${p.invoiceKeywords.slice(0, 3).join(', ')}], currency=${p.currency}, taxIdLabel="${p.taxIdLabel}"`)
  .join('\n');

export function createExtractInvoiceTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'extractInvoice',
    description: 'Tự động nhận diện quốc gia và trích xuất toàn bộ thông tin hóa đơn phù hợp theo định dạng quốc gia đó.',
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
        ? 'Ảnh chất lượng thấp — hãy cố gắng đọc từng vùng rõ nhất, đánh dấu trường không chắc bằng "?".'
        : '';

      // Thiết kế Prompt hai giai đoạn trong cùng 1 lần gọi (Single-shot Chain of Thought):
      // Bước 1: Bắt LLM nhìn ảnh chọn quốc gia.
      // Bước 2: Bắt LLM dùng quy tắc quốc gia đó để bóc tách dữ liệu JSON.
      const prompt = `${qualityHint}
Bạn là chuyên gia AI trích xuất hóa đơn đa quốc gia. Hãy thực hiện xử lý ảnh hóa đơn này theo 2 bước:

[BƯỚC 1: NHẬN DIỆN QUỐC GIA]
Dựa vào ngôn ngữ, ký hiệu tiền tệ (¥, $, ₩, đ, €, £...), định dạng ngày tháng, nhãn mã số thuế... Hãy đối chiếu với danh sách quy tắc các nước sau để xác định quốc gia phát hành:
${COUNTRY_HINTS}

[BƯỚC 2: TRÍCH XẤU THÔNG TIN HÓA ĐƠN]
Sau khi xác định được quốc gia, hãy áp dụng quy tắc đặc thù của quốc gia đó để map các trường dữ liệu:
- Số hóa đơn (Invoice No, 請求書番号...)
- Ngày hóa đơn, Ngày đến hạn (Invoice Date, Due Date...)
- Thông tin Người bán, Người mua (Tên, Mã số thuế, Địa chỉ...)
- Các trường số tiền: Tổng trước thuế (Subtotal), Thuế (VAT/Tax), Tổng cộng (Total)

Trả về kết quả duy nhất dưới dạng một JSON Object thuần túy (không bọc trong markdown \`\`\`json), tuân thủ cấu trúc sau:
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
⚠️ QUY TẮC BẮT BUỘC CHO SỐ TIỀN TRONG ITEMS:
1. KHÔNG ĐƯỢC TỰ Ý RÚT GỌN SỐ TIỀN. Nếu đơn giá trên hóa đơn là 25 triệu (ghi tắt là 25 hay 25.000), bạn PHẢI TỰ BÙ ĐỦ SỐ 0 để điền vào JSON thành chuỗi đầy đủ chữ số: "25,000,000" hoặc "25000000".
2. Đảm bảo giá trị của "amount" phải bằng "unitPrice" nhân với "qty" về mặt toán học trước khi format thành chuỗi.
3. Giữ nguyên các ký tự phân cách gốc (chấm/phẩy) nếu có trên hóa đơn, không tự ý convert số.
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

      console.log('\n\n createExtractInvoiceTool thành công: \n', {...extracted});
      return JSON.stringify(extracted);
    },
  });
}