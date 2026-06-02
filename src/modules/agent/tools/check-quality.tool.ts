// tools/check-quality.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

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

export function createCheckQualityTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'checkImageQuality',
    description: 'Phân tích chất lượng hình ảnh hóa đơn. Phát hiện các vấn đề: mờ (blurry), nhàu nát (crumpled), rách (torn).',
    schema: z.object({}),
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
                text: `Nhìn vào ảnh hóa đơn này và đánh giá chất lượng hình ảnh.

Trả về JSON với các trường sau:
- "qualities": mảng chứa CÁC VẤN ĐỀ THỰC SỰ BẠN THẤY trong ảnh. Chọn từ: "CLEAR" (rõ nét), "BLURRY" (mờ), "CRUMPLED" (nhàu nát), "TORN" (rách/thiếu góc). Nếu ảnh rõ nét không có vấn đề thì chỉ ghi ["CLEAR"].
- "confidence": số từ 0 đến 100, mức độ chắc chắn của bạn
- "details": mô tả ngắn vấn đề cụ thể nếu có, hoặc "Ảnh rõ nét" nếu không có vấn đề
- "readability": "HIGH" nếu đọc toàn bộ text dễ dàng, "MEDIUM" nếu đọc được phần lớn, "LOW" nếu khó đọc

Ví dụ output khi ảnh bị mờ nhẹ:
{"qualities":["BLURRY"],"confidence":80,"details":"Ảnh hơi mờ ở góc phải","readability":"MEDIUM"}

Ví dụ output khi ảnh rõ nét:
{"qualities":["CLEAR"],"confidence":95,"details":"Ảnh rõ nét","readability":"HIGH"}

Chỉ trả về JSON thuần, không có markdown, không có giải thích.`,
              },
            ],
          },
        ]);

        console.log(`createCheckQualityTool response.content:`, response.content);
        
        const rawText = extractTextContent(response.content);
        const cleanContent = rawText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        console.log(`\n\n createCheckQualityTool output:`, cleanContent);
        return cleanContent;

      } catch (error) {
        console.error('Error in createCheckQualityTool:', error);
        // Trả về fallback thay vì throw để agent không bị crash loop
        return JSON.stringify({
          qualities: ['CLEAR'],
          confidence: 50,
          details: 'Could not analyze image quality',
          readability: 'HIGH',
        });
      }
    },
  });
}