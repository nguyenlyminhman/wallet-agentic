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
    // Convert PDF page 1 → JPEG base64
    const imageBase64 = await this.fileToBase64(file);

    // Chạy agent loop
    const result = await this.invoiceAgent.processInvoice(imageBase64);

    // Persist kết quả
    await this.saveToDatabase(result);

    return result;
  }

  private async fileToBase64(file: Express.Multer.File): Promise<string> {
  // diskStorage → đọc từ file.path thay vì file.buffer
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

// private async convertPdfToImage(pdfPath: string): Promise<Buffer> {
//   const tmpDir = os.tmpdir();
//   const tmpImg = path.join(tmpDir, `inv_${Date.now()}`);

//   const converter = pdf2pic.fromPath(pdfPath, { // ← dùng thẳng path, không cần ghi lại
//     density: 200,
//     saveFilename: path.basename(tmpImg),
//     savePath: tmpDir,
//     format: 'jpeg',
//     width: 2480,
//     height: 3508,
//   });

//   const result = await converter(1, { responseType: 'buffer' });

//   if (!result?.buffer || result.buffer.length === 0) {
//     throw new Error('pdf2pic trả về buffer rỗng — kiểm tra ghostscript đã cài chưa');
//   }

//   return result.buffer;
// }

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
