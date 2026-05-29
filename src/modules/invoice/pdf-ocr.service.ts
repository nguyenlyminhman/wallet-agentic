import { Injectable, Logger } from '@nestjs/common';
import { fromBuffer } from 'pdf2pic';
import Tesseract from 'tesseract.js';
import * as fs from 'fs';

@Injectable()
export class PdfOcrService {
    private readonly logger = new Logger(PdfOcrService.name);
    constructor() { }

    async extractTextFromScannedPdf(
        buffer: Buffer,
        language = 'vie+eng', // tiếng Việt + tiếng Anh + ( n + 1 ) thứ tiếng ở đây 
    ): Promise<string[]> {
        // Bước 1: Convert từng page PDF → ảnh JPEG
        const convert = fromBuffer(buffer, {
            density: 300, // DPI 
            saveFilename: 'page',
            savePath: '/tmp/ocr-pages',
            format: 'jpeg',
        });

        // TODO: detect tự động - để làm sau
        const pageCount = 1; 
        const pages: any = await convert.bulk(pageCount);

        // OCR từng trang
        const results: string[] = [];
        for (const page of pages) {
            const { data } = await Tesseract.recognize(page.path, language);
            results.push(data.text);
            fs.unlinkSync(page.path); // thằng nào xong thì del thằng đó
        }

        return results; // array text theo từng trang
    }
}
