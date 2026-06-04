import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

/** Gemini thường trả content về dạng string hoặc MessageContentComplex[] — normalize về string để xử lý cho dễ */
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
    description: 'Analyze invoice image quality. Detect issues such as blurry, crumpled, and torn or missing areas.',
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
                text: `Look at this invoice image and evaluate the image quality.

                      Return JSON with the following fields:
                      - "qualities": an array containing the ACTUAL ISSUES YOU SEE in the image. Choose from: "CLEAR" (sharp/readable), "BLURRY", "CRUMPLED", "TORN" (torn/missing corner). If the image is clear and has no issue, return only ["CLEAR"].
                      - "confidence": a number from 0 to 100 indicating your certainty
                      - "details": a short description of the specific issue if any, or "Image is clear" if there is no issue
                      - "readability": "HIGH" if all text is easy to read, "MEDIUM" if most text is readable, "LOW" if it is difficult to read

                      Example output when the image is slightly blurry:
                      {"qualities":["BLURRY"],"confidence":80,"details":"The image is slightly blurry in the right corner","readability":"MEDIUM"}

                      Example output when the image is clear:
                      {"qualities":["CLEAR"],"confidence":95,"details":"Image is clear","readability":"HIGH"}

                      Return only raw JSON, with no markdown and no explanation.`,
              },
            ],
          },
        ]);

        console.info(`createCheckQualityTool response.content:`, response.content);
        
        const rawText = extractTextContent(response.content);
        const cleanContent = rawText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        console.info(`\n\n createCheckQualityTool output:`, cleanContent);
        return cleanContent;

      } catch (error) {
        console.error('Error in createCheckQualityTool:', error);
        // Trả về fallback thay vì throw để agent không bị crash loop
        return JSON.stringify({
          qualities: ['BLURRY'],
          confidence: 50,
          details: 'Could not analyze image quality',
          readability: 'LOW',
        });
      }
    },
  });
}