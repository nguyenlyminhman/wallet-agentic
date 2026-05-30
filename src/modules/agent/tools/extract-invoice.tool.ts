// agent/tools/extract-invoice.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { parseAmount, parseDateToISO, validateTaxId } from '../../utils/number-parser.util';
import { CountryCode, getProfile } from 'src/modules/invoice/config/country-profiles.config';

export function createExtractInvoiceTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'extractInvoice',
    description: 'Đọc và trích xuất thông tin hóa đơn, tự động adapt theo quốc gia.',
    schema: z.object({
      countryCode: z.string().default('UNKNOWN'),
      readability: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
    }),
    func: async ({ countryCode, readability }) => {
      const cleanBase64 = rawBase64.replace(/\s+/g, '').replace(/^data:image\/\w+;base64,/, '');
      const formattedDataUrl = `data:image/jpeg;base64,${cleanBase64}`;

      const profile = getProfile(countryCode as CountryCode);
      const fm = profile.fieldMapping;

      const qualityHint = readability === 'LOW'
        ? 'Ảnh chất lượng thấp — đọc từng vùng rõ nhất, đánh dấu trường không chắc bằng "?".'
        : '';

      const prompt = `${qualityHint}
Đây là hóa đơn từ ${profile.name}.
Tiền tệ: ${profile.currency}. Dấu phân cách hàng nghìn: "${profile.thousandSeparator}", thập phân: "${profile.decimalSeparator}".
Tên trường VAT trên hóa đơn này: ${profile.vatNames.join(' / ')}.
Tên trường mã số thuế: ${profile.taxIdLabel}.
Format ngày: ${profile.dateFormats.join(' hoặc ')}.

Field mapping cần nhận diện:
- Số hóa đơn: ${fm.invoiceNo.join(' / ')}
- Ngày hóa đơn: ${fm.invoiceDate.join(' / ')}
- Ngày đến hạn: ${fm.dueDate.join(' / ')}
- Người bán: ${fm.sellerName.join(' / ')}
- Người mua: ${fm.buyerName.join(' / ')}
- Tổng trước thuế: ${fm.subtotal.join(' / ')}
- Thuế: ${fm.vat.join(' / ')}
- Tổng cộng: ${fm.total.join(' / ')}
${fm.amountInWords.length ? `- Số tiền bằng chữ: ${fm.amountInWords.join(' / ')}` : ''}

Trả về JSON (giữ NGUYÊN số tiền như in trên hóa đơn, không convert):
{
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
Chỉ trả về JSON.`;

      const response = await model.invoke([
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: formattedDataUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ]);

      // Parse raw strings → numbers theo country profile
      let extracted: any;
      try {
        extracted = JSON.parse(response.content as string);
      } catch {
        return response.content as string;
      }

      // Normalize số tiền
      extracted.items = (extracted.items ?? []).map((item: any) => ({
        ...item,
        unitPrice: parseAmount(item.unitPrice, profile),
        amount: parseAmount(item.amount, profile),
        qty: Number(item.qty) || 0,
      }));
      extracted.subtotal = parseAmount(extracted.subtotal, profile);
      extracted.vat = parseAmount(extracted.vat, profile);
      extracted.totalDue = parseAmount(extracted.totalDue, profile);

      // Normalize ngày
      extracted.invoiceDate = parseDateToISO(extracted.invoiceDate, profile);
      extracted.dueDate = parseDateToISO(extracted.dueDate, profile);

      // Validate tax ID
      const sellerTaxValid = validateTaxId(extracted.seller?.taxId ?? '', profile);
      const buyerTaxValid = validateTaxId(extracted.buyer?.taxId ?? '', profile);
      if (!sellerTaxValid) {
        extracted.uncertainFields = [...(extracted.uncertainFields ?? []), `seller.taxId format không khớp pattern ${profile.code}`];
      }
      if (!buyerTaxValid) {
        extracted.uncertainFields = [...(extracted.uncertainFields ?? []), `buyer.taxId format không khớp pattern ${profile.code}`];
      }

      // Đính kèm country info
      extracted._countryCode = profile.code;
      extracted._countryName = profile.name;
      extracted._currency = profile.currency;
      extracted._roundingUnit = profile.roundingUnit;

      console.log('\n\n createExtractInvoiceTool: \n', {...extracted});
      return JSON.stringify(extracted);
    },
  });
}