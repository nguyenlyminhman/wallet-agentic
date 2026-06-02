import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createCheckQualityTool } from './tools/check-quality.tool';
import { createExtractInvoiceTool } from './tools/extract-invoice.tool';
import { createValidateAmountsTool } from './tools/validate-amounts.tool';
import { createDetectFraudTool } from './tools/detect-fraud.tool';
import { createSendNotificationTool } from './tools/send-notification.tool';
import { NotificationService } from '../invoice/notification/notification.service';
import { ImageQuality, InvoiceResultDto, InvoiceStatus } from '../invoice/dto/invoice-result.dto';

@Injectable()
export class InvoiceAgentPipeline {
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
    const checkQualityTool = createCheckQualityTool(this.model, imageBase64);
    const extractInvoiceTool = createExtractInvoiceTool(this.model, imageBase64);
    const validateAmountsTool = createValidateAmountsTool();
    const detectFraudTool = createDetectFraudTool(this.model, imageBase64);
    const sendNotificationTool = createSendNotificationTool(this.notificationService);

    // ── Bước 1: Kiểm tra chất lượng ảnh ──────────────────────────────────
    const qualityRaw = await checkQualityTool.invoke({});
    const quality = JSON.parse(qualityRaw);
    console.log('checkImageQuality output:', quality);

    // ── Bước 2: Trích xuất hóa đơn (tự detect country bên trong) ─────────
    const extractRaw = await extractInvoiceTool.invoke({
      readability: quality.readability ?? 'HIGH',
    });
    const invoiceData = JSON.parse(extractRaw);
    console.log('extractInvoice output:', invoiceData);

    // ── Bước 3: Validate số tiền ──────────────────────────────────────────
    const validateRaw = await validateAmountsTool.invoke({
      invoiceData: JSON.stringify(invoiceData),
    });
    const validation = JSON.parse(validateRaw);


    // ── Bước 4: Phát hiện gian lận ────────────────────────────────────────
    const fraudRaw = await detectFraudTool.invoke({
      invoiceData: JSON.stringify(invoiceData),
      validationResult: JSON.stringify(validation),
    });
    const fraud = JSON.parse(fraudRaw);
    console.log('detectFraud output:', fraud);

    // ── Bước 5-7: Gửi notification nếu cần ───────────────────────────────
    if (!validation.isValid) {
      await sendNotificationTool.invoke({
        type: 'AMOUNT_MISMATCH',
        invoiceNo: invoiceData.invoiceNo ?? '',
        details: validation.errors?.join(', ') ?? 'Amount mismatch detected',
      });
    }
    if (fraud.hasFraud) {
      await sendNotificationTool.invoke({
        type: 'SUSPECTED_FRAUD',
        invoiceNo: invoiceData.invoiceNo ?? '',
        details: fraud.fraudFlags?.join(', ') ?? 'Fraud suspected',
      });
    }
    if ((quality.qualities as string[]).includes('LOW')) {
      await sendNotificationTool.invoke({
        type: 'LOW_QUALITY',
        invoiceNo: invoiceData.invoiceNo ?? '',
        details: 'Image quality is LOW',
      });
    }

    // ── Bước 8: Tổng hợp kết quả ─────────────────────────────────────────
    let status = InvoiceStatus.VALID;
    if (fraud.hasFraud) status = InvoiceStatus.SUSPECTED_FRAUD;
    else if (!validation.isValid) status = InvoiceStatus.AMOUNT_MISMATCH;

    const result: InvoiceResultDto = {
      ...invoiceData,
      countryCode: invoiceData._countryCode,
      countryConfidence: invoiceData.detectedCountry?.confidence,
      imageQuality: quality.qualities as ImageQuality[],
      status,
      fraudFlags: fraud.fraudFlags ?? [],
    };

    console.log('processInvoice result:', result);
    return result;
  }
}