import { Injectable, Logger  } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

import * as fs from 'fs';

@Injectable()
export class InvoiceService {
    private readonly logger = new Logger(InvoiceService.name);

    constructor() {}

    async processInvoice(pdfPath: string) {

    // Đọc PDF text trước khi đẩy vào agent
    const rawText = await this.extractTextFromPdf(pdfPath);
    console.log('rawText', rawText);
    
    // Cleanup file sau khi xử lý xong
    fs.unlink(pdfPath, (err) => {
      if (err) this.logger.warn(`Could not delete temp file: ${pdfPath}`);
    });

    
    return rawText;

  }

  private async extractTextFromPdf(pdfPath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(pdfPath);
      const parser = new PDFParse({ url: pdfPath });
const result = await parser.getText();
      
      return result.text;
    } catch (err: any) {
      this.logger.error(`Invoice parse error: ${err.message}`);
      throw new Error(`Cannot read invoice: ${pdfPath}`);
    }
  }
}
