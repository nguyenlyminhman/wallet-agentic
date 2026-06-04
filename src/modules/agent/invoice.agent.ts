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

  private createToolModel(): ChatGoogleGenerativeAI {
    // Mỗi tool sẽ cần model instance riêng — Gemini không cho phép 1 instance gọi đồng thời bởi agent loop và tool execution (trả về content: [])
    return new ChatGoogleGenerativeAI({
      model: 'gemini-3.5-flash',  // Flash cho tools: nhanh hơn, ít bị conflict hơn Pro
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      temperature: 0,
      maxOutputTokens: 8192,
    });
  }

  async processInvoice(imageBase64: string): Promise<InvoiceResultDto> {
    const tools = [
      createCheckQualityTool(this.createToolModel(), imageBase64),
      createExtractInvoiceTool(this.createToolModel(), imageBase64),
      createValidateAmountsTool(),
      createDetectFraudTool(this.createToolModel(), imageBase64),
      createSendNotificationTool(this.notificationService),
    ];

    const agent = createReactAgent({
      llm: this.model,
      tools,
      messageModifier: `You are an invoice processing assistant for an enterprise payment system.
                        You have access to tools to analyze invoice images.

                        Your goal: determine if the invoice is valid, has amount mismatches, or suspected fraud.

                        You MUST call ALL of these tools before finishing — do NOT output JSON until every step below is complete:

                        STEP 1: Call checkImageQuality
                        STEP 2: Call extractInvoice (regardless of quality result)
                        STEP 3: If extraction succeeded, call validateAmounts AND detectFraud (you may call these in parallel)
                        STEP 4: Call sendNotification for EVERY issue found:
                          - LOW_QUALITY if image readability is LOW or MEDIUM
                          - AMOUNT_MISMATCH if validateAmounts returned isValid=false
                          - SUSPECTED_FRAUD if detectFraud returned hasFraud=true
                        STEP 5 (FINAL): Only after ALL tools above have returned results, output ONLY a raw JSON object with no markdown fences, no explanation, no extra text — just the JSON:
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
                          "imageQuality": { "qualities": [], "confidence": 0, "details": "", "readability": "" },
                          "fraudFlags": [],
                          "_countryCode": "",
                          "_countryName": "",
                          "_currency": ""
                        }

                        IMPORTANT: Do NOT output the JSON after STEP 1 or STEP 2. You must wait until ALL steps are done.`,
    });

    // Không pass image vào đây — mỗi tool tự nhận image qua closure
    // Pass image trong HumanMessage khiến Gemini confused (duplicate context) → response.content = []
    const result = await agent.invoke({
      messages: [
        new HumanMessage(
          'Analyze this invoice image and determine its status. Follow the steps in order: checkImageQuality → extractInvoice → validateAmounts → detectFraud → sendNotification (if needed). Then output the final JSON.'
        ),
      ],
    });

    // Lấy message cuối từ agent
    const lastMessage = result.messages[result.messages.length - 1];
    const agentReasoning = result.messages
      .map((m: any) => m.content)
      .filter(Boolean)
      .join('\n---\n');

    try {
      const raw = lastMessage.content as string;
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const finalJson = JSON.parse(cleaned);
      return { ...finalJson, agentReasoning };
    } catch {
      // Nếu agent không trả về JSON thuần, parse từ tool calls
      return this.buildResultFromMessages(result.messages, agentReasoning);
    }
  }

  // Strip markdown code fences nếu tool trả về ```json ... ```
  private parseToolContent(content: string): any {
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  }

  private buildResultFromMessages(messages: any[], agentReasoning: string): InvoiceResultDto {
    let invoiceData: any = {};
    let validation: any = { isValid: true, errors: [] };
    let fraud: any = { hasFraud: false, fraudFlags: [] };
    let quality: ImageQualityResult = {
      qualities: [ImageQuality.CLEAR],
      confidence: 0,
      details: '',
      readability: 'LOW',
    };

    for (const msg of messages) {
      // Chỉ xử lý ToolMessage — LangGraph dùng _getType() === 'tool'
      const msgType = msg._getType?.();
      console.log('msgType', msgType);
      if (msgType !== 'tool') continue;

      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

      switch (msg.name) {
        case 'checkImageQuality':
          try {
            const parsed = this.parseToolContent(content);
            quality = {
              qualities: (parsed.qualities ?? []).map((q: string) => q as ImageQuality),
              confidence: parsed.confidence ?? 0,
              details: parsed.details ?? '',
              readability: parsed.readability ?? 'LOW',
            };
          } catch (e) {
            console.warn('Failed to parse checkImageQuality result:', e);
          }
          break;
        case 'extractInvoice':
          try { invoiceData = this.parseToolContent(content); } catch (e) {
            console.warn('Failed to parse extractInvoice result:', e);
          }
          break;
        case 'validateAmounts':
          try { validation = this.parseToolContent(content); } catch (e) {
            console.warn('Failed to parse validateAmounts result:', e);
          }
          break;
        case 'detectFraud':
          try { fraud = this.parseToolContent(content); } catch (e) {
            console.warn('Failed to parse detectFraud result:', e);
          }
          break;
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
    console.info('\n\n buildResultFromMessages', { ...result })
    return result;
  }
}
