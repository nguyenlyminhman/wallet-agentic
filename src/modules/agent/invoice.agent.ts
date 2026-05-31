// agent/invoice.agent.ts
import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';
import { createCheckQualityTool } from './tools/check-quality.tool';
import { createExtractInvoiceTool } from './tools/extract-invoice.tool';
import { createValidateAmountsTool } from './tools/validate-amounts.tool';
import { createDetectFraudTool } from './tools/detect-fraud.tool';
import { createSendNotificationTool } from './tools/send-notification.tool';
import { NotificationService } from '../invoice/notification/notification.service';
import { ImageQuality, InvoiceResultDto, InvoiceStatus } from '../invoice/dto/invoice-result.dto';
import { createDetectCountryTool } from './tools/detect-country.tool';

@Injectable()
export class InvoiceAgent {
  private model: ChatGoogleGenerativeAI;

  constructor(private readonly notificationService: NotificationService) {
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-pro',
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      temperature: 0,
      maxOutputTokens: 8192,
    });
  }

  async processInvoice(imageBase64: string): Promise<InvoiceResultDto> {
    const tools = [
      createCheckQualityTool(this.model, imageBase64),
      createExtractInvoiceTool(this.model, imageBase64),      
      createValidateAmountsTool(),
      createDetectFraudTool(this.model, imageBase64),
      createSendNotificationTool(this.notificationService),
    ];

    const agent = createReactAgent({
      llm: this.model,
      tools,
    });

    const systemPrompt = `Bạn là hệ thống kiểm tra hóa đơn tự động. Với mỗi hóa đơn được upload:

                    LUÔN thực hiện theo đúng thứ tự sau:
                    1. Gọi checkImageQuality để kiểm tra chất lượng ảnh.
                    2. Gọi extractInvoice để tự động nhận diện quốc gia và trích xuất tất cả thông tin hóa đơn (truyền kết quả 'readability' từ bước 1 vào tham số đầu vào của tool).
                    3. Gọi validateAmounts để kiểm tra tổng tiền dựa trên dữ liệu đã trích xuất.
                    4. Gọi detectFraud để kiểm tra các dấu hiệu gian lận.
                    5. Nếu validateAmounts trả về isValid=false → gọi sendNotification với type=AMOUNT_MISMATCH.
                    6. Nếu detectFraud trả về hasFraud=true → gọi sendNotification với type=SUSPECTED_FRAUD.
                    7. Nếu chất lượng ảnh ở bước 1 là LOW → gọi sendNotification với type=LOW_QUALITY.
                    8. Tổng hợp toàn bộ dữ liệu (bao gồm cả thông tin quốc gia hệ thống tự nhận diện được) và trả về kết quả cuối dạng JSON InvoiceResultDto.

Không bỏ qua bất kỳ bước nào.`;
const cleanBase64 = imageBase64.replace(/\s+/g, '').replace(/^data:image\/\w+;base64,/, '');
    const result = await agent.invoke({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        new HumanMessage({
          content: [
            {
              type: 'text',
              text: 'Xử lý hóa đơn này theo đúng các bước yêu cầu trong hệ thống.',
            },
            {
              type: 'image_url',
              image_url: {
                // Đảm bảo bọc lót xóa khoảng trắng cho an toàn
                url: `data:image/jpeg;base64,${cleanBase64}`,
              },
            },
          ],
        }),
      ],
    });

    // Lấy message cuối từ agent
    const lastMessage = result.messages[result.messages.length - 1];
    const agentReasoning = result.messages
      .map((m: any) => m.content)
      .filter(Boolean)
      .join('\n---\n');

    try {
      const finalJson = JSON.parse(lastMessage.content as string);
      console.log('{ ...finalJson, agentReasoning }', { ...finalJson, agentReasoning });

      return { ...finalJson, agentReasoning };
    } catch {
      // Nếu agent không trả về JSON thuần, parse từ tool calls
      return this.buildResultFromMessages(result.messages, agentReasoning);
    }
  }

  private buildResultFromMessages(messages: any[], agentReasoning: string): InvoiceResultDto {
    // Collect tool results từ intermediate steps
    let invoiceData: any = {};
    let validation: any = { isValid: true, errors: [] };
    let fraud: any = { hasFraud: false, fraudFlags: [] };
    let quality: any = { qualities: ['CLEAR'] };
    let countryInfo: any = {};

    for (const msg of messages) {
      if (msg.name === 'checkImageQuality') {
        try { quality = JSON.parse(msg.content); } catch { }
      }
      if (msg.name === 'extractInvoice') {
        try { invoiceData = JSON.parse(msg.content); } catch { }
      }
      if (msg.name === 'validateAmounts') {
        try { validation = JSON.parse(msg.content); } catch { }
      }
      if (msg.name === 'detectFraud') {
        try { fraud = JSON.parse(msg.content); } catch { }
      }
    }

    let status = InvoiceStatus.VALID;
    if (fraud.hasFraud) status = InvoiceStatus.SUSPECTED_FRAUD;
    else if (!validation.isValid) status = InvoiceStatus.AMOUNT_MISMATCH;

    console.log('buildResultFromMessages', {
      ...invoiceData,
      countryCode: countryInfo.countryCode, // ← Đưa thông tin quốc gia vào DTO trả về
      countryConfidence: countryInfo.confidence,
      imageQuality: quality.qualities as ImageQuality[],
      status,
      fraudFlags: fraud.fraudFlags || [],
      // agentReasoning,
    })

    return {
      ...invoiceData,
      imageQuality: quality.qualities as ImageQuality[],
      status,
      fraudFlags: fraud.fraudFlags || [],
      // agentReasoning,
    };
  }
}