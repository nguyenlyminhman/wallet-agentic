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
import { ImageQuality, ImageQualityResult, InvoiceResultDto, InvoiceStatus } from '../invoice/dto/invoice-result.dto';
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
      messageModifier: `You are an invoice processing assistant for an enterprise payment system.
                        You have access to tools to analyze invoice images.

                        Your goal: determine if the invoice is valid, has amount mismatches, or suspected fraud.
                        Use the available tools as needed to reach a confident conclusion.

                        Rules:
                        - Always check image quality BEFORE attempting extraction
                        - If image quality is LOW, send a LOW_QUALITY notification immediately and still attempt extraction
                        - Only validate amounts if extraction succeeded
                        - Collect ALL issues first (run validateAmounts AND detectFraud in parallel if possible), then send notifications at the end
                        - Send a separate notification for every issue found (AMOUNT_MISMATCH, SUSPECTED_FRAUD, LOW_QUALITY)

                        MANDATORY FINAL STEP:
                        After all tools have been called and all notifications sent, you MUST output ONLY a raw JSON object (no markdown, no explanation) with this exact structure:
                        {
                          "invoiceNo": "",
                          "invoiceDate": "",
                          "dueDate": "",
                          "seller": { "name": "", "taxId": "", "address": "" },
                          "buyer": { "name": "", "taxId": "", "address": "" },
                          "items": [],
                          "subtotal": 0,
                          "vat": 0,
                          "totalDue": 0,
                          "status": "VALID" | "AMOUNT_MISMATCH" | "SUSPECTED_FRAUD",
                          "imageQuality": [],
                          "fraudFlags": [],
                          "_countryCode": "",
                          "_countryName": "",
                          "_currency": ""
                        }
                        Populate all fields from the tool results. Output ONLY this JSON — no other text.`,
    });

    const cleanBase64 = imageBase64.replace(/\s+/g, '').replace(/^data:image\/\w+;base64,/, '');
    const result = await agent.invoke({
      messages: [
        new HumanMessage({
          content: [
            {
              type: 'text',
              text: `Analyze this invoice and determine its status. 
                    Image is available to all tools via their context.`,
            },
            {
              type: 'image_url',
              image_url: {
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
    let quality: ImageQualityResult = {
      qualities: [ImageQuality.CLEAR],
      confidence: 0,
      details: '',
      readability: 'LOW', // set default - có gì cho user xử lý
    };

    for (const msg of messages) {
      if (msg.name === 'checkImageQuality') {
        try {
          const parsed = JSON.parse(msg.content);
          quality = {
            qualities: (parsed.qualities ?? []).map((q: string) => q as ImageQuality),
            confidence: parsed.confidence ?? 0,
            details: parsed.details ?? '',
            readability: parsed.readability ?? 'LOW',
          };
        } catch { }
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

    const result = {
      ...invoiceData,
      countryCode: invoiceData._countryCode ?? fraud.countryCode ?? 'UNKNOWN',
      countryConfidence: invoiceData.detectedCountry?.confidence ?? 0,
      imageQuality: quality,
      status,
      fraudFlags: fraud.fraudFlags || [],
    };

    return result;
  }
}