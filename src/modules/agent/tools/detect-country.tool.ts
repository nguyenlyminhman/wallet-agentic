// agent/tools/detect-country.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { COUNTRY_PROFILES } from 'src/modules/invoice/config/country-profiles.config';

const COUNTRY_HINTS = Object.values(COUNTRY_PROFILES)
  .filter(p => p.code !== 'UNKNOWN')
  .map(p => `${p.code}: keywords=[${p.invoiceKeywords.slice(0, 3).join(', ')}], currency=${p.currency}, taxIdLabel="${p.taxIdLabel}"`)
  .join('\n');

export function createDetectCountryTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'detectCountry',
    description: `Phân tích hóa đơn để xác định quốc gia phát hành.
      Hỗ trợ các nước: VN, US, JP, CN, SG, TH, KR, MY, ID, PH, DE, FR, GB, AU, IN.
      Trả về countryCode và confidence.`,
    // Khai báo schema rỗng vì ảnh được lấy trực tiếp từ closure rawBase64, tránh Agent làm hỏng chuỗi
    schema: z.object({}),
    func: async () => {
      try {
        // Làm sạch chuỗi Base64
        const cleanBase64 = rawBase64.replace(/\s+/g, '').replace(/^data:image\/\w+;base64,/, '');

        const response = await model.invoke([
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { // ← Đã sửa cấu trúc chuẩn của LangChain
                  url: `data:image/jpeg;base64,${cleanBase64}`,
                },
              },
              {
                type: 'text',
                text: `Phân tích hóa đơn này và xác định quốc gia phát hành.

                  Dấu hiệu nhận biết theo quốc gia để bạn tham khảo:
                  ${COUNTRY_HINTS}

                  Hãy phân tích kỹ các yếu tố sau trên ảnh:
                  1. Ngôn ngữ chính xuất hiện trên hóa đơn
                  2. Ký hiệu tiền tệ (¥, $, ₩, ₹, ฿, ₱, Rp, RM, đ, €, £, ...)
                  3. Từ khóa đặc trưng tiêu đề (발행일, 請求書, Rechnung, FACTURE, INVOICE, RECEIPT, ...)
                  4. Định dạng và nhãn của Mã số thuế (Tax ID, MST, UEN, ABN, EIN...)
                  5. Định dạng ngày tháng năm (DD/MM/YYYY, YYYY/MM/DD, MM/DD/YYYY...)

                  Trả về kết quả dưới dạng JSON theo format bắt buộc sau:
                  {
                    "countryCode": "VN" | "US" | "JP" | "CN" | "SG" | "TH" | "KR" | "MY" | "ID" | "PH" | "DE" | "FR" | "GB" | "AU" | "IN" | "UNKNOWN",
                    "confidence": 0-100,
                    "detectedLanguage": "vi" | "en" | "ja" | "zh" | "th" | "ko" | "de" | "fr" | "id" | "ms" | "other",
                    "detectedCurrency": "VND" | "USD" | "JPY" | "EUR" | "GBP" | "SGD" | "THB" | "KRW" | "MYR" | "IDR" | "PHP" | "AUD" | "INR" | "CNY" | "UNKNOWN",
                    "clues": ["lý do phát hiện 1", "lý do phát hiện 2"]
                  }
                  Chỉ trả về JSON thuần, không bọc trong markdown block, không thêm text giải thích ngoài JSON.`,
              },
            ],
          },
        ]);

        console.log('\n\n createDetectCountryTool Response: \n', response.content);
        return response.content as string;

      } catch (error) {
        console.error('Lỗi tại createDetectCountryTool:', error);
        throw error;
      }
    },
  });
}