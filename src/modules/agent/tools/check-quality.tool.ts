// tools/check-quality.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export function createCheckQualityTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'checkImageQuality',
    description: 'Phân tích chất lượng hình ảnh hóa đơn. Phát hiện các vấn đề: mờ (blurry), nhàu nát (crumpled), rách (torn).',
    // Schema rỗng vì ta dùng ảnh từ closure rawBase64
    schema: z.object({}),
    // Sửa chỗ này: Để trống tham số đầu vào (), không destructure imageBase64 nữa
    func: async () => {
      const cleanBase64 = rawBase64.replace(/\s+/g, '').replace(/^data:image\/\w+;base64,/, '');

      try {
        const response = await model.invoke([
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${cleanBase64}`,
                },
              },
              {
                type: 'text',
                text: `Phân tích chất lượng hình ảnh hóa đơn này và trả về JSON theo format:
          {
            "qualities": ["CLEAR", "BLURRY", "CRUMPLED", "TORN"],
            "confidence": 0-100,
            "details": "mô tả chi tiết vấn đề nếu có",
            "readability": "HIGH", "MEDIUM", "LOW"
          }
          Lưu ý: Chỉ trả về chuỗi JSON thuần, không bọc trong block \`\`\`json, không thêm bất kỳ văn bản giải thích nào khác.`,
              },
            ],
          },
        ]);

        // Làm sạch chuỗi kết quả phòng trường hợp model vẫn nhét markdown vào
        const cleanContent = (response.content as string)
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        console.log(` \n\n createCheckQualityTool output:`, cleanContent);
        return cleanContent;

      } catch (error) {
        console.error("Error in createCheckQualityTool:", error);
        throw error;
      }
    },
  });
}