// tools/check-quality.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';


export function createCheckQualityTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'checkImageQuality',
    description: 'Phân tích chất lượng hình ảnh hóa đơn. Phát hiện các vấn đề: mờ (blurry), nhàu nát (crumpled), rách (torn).',
    schema: z.object({}),
    func: async ({ imageBase64 }) => {
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
Chỉ trả về JSON, không thêm bất kỳ văn bản nào khác ngoài khối JSON.`,
              },
            ],
          },
        ]);

        console.log(` \n\n createCheckQualityTool output: ${response.content}`, );
        return response.content as string;

      } catch (error) {
        console.error("Error in createCheckQualityTool:", error);
        throw error;
      }
    },
  });
}