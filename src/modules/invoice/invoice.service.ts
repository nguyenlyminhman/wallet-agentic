import { Injectable } from '@nestjs/common';
import { InvoiceResultDto, InvoiceStatus } from './dto/invoice-result.dto';
import sharp from 'sharp';
import { InvoiceAgent } from '../agent/invoice.agent';
import * as fs from 'fs';
import { pdfToImageBuffer } from '../utils/pdf-to-image.util';

@Injectable()
export class InvoiceService {
  constructor(private readonly invoiceAgent: InvoiceAgent) {}

  async processUploadedInvoice(file: Express.Multer.File): Promise<InvoiceResultDto> {
    // Convert PDF page 1 → JPEG base64, nếu là file ảnh thì khỏi convert
    const imageBase64 = await this.fileToBase64(file);

    // Chạy agent loop
    const result = await this.invoiceAgent.processInvoice(imageBase64);

    // Persist kết quả
    await this.saveToDatabase(result);

    return result;
  }

  private async fileToBase64(file: Express.Multer.File): Promise<string> {
  
  const filePath = file.path;

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại tại path: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error(`Đọc file rỗng tại: ${filePath}`);
  }

  let imageBuffer: Buffer;

  if (file.mimetype === 'application/pdf') {
    imageBuffer = await pdfToImageBuffer(filePath)
  } else {
    imageBuffer = fileBuffer;
  }

  const optimized = await sharp(imageBuffer)
    .resize({ width: 2000, withoutEnlargement: true })
    .sharpen()
    .jpeg({ quality: 90 })
    .toBuffer();

  return optimized.toString('base64');
}

  private async saveToDatabase(result: InvoiceResultDto): Promise<void> {
    // insert vào table: invoices
    // insert vào table: invoice_items (mỗi dòng 1 record)
    // insert vào table: invoice_fraud_flags (nếu có flags)
    // insert vào table: invoice_processing_logs (agentReasoning)

    if (result.status === InvoiceStatus.SUSPECTED_FRAUD) {
      // insert vào table: invoice_review_queue với priority = HIGH
    }

    if (result.status === InvoiceStatus.AMOUNT_MISMATCH) {
      // insert vào table: invoice_review_queue với priority = MEDIUM
    }
  }
}
