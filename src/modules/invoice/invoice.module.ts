import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/invoices',
        filename: (req, file, cb) => {
          const now = new Date();
          const unique =  `${now.getFullYear()}-` +
                          `${String(now.getMonth() + 1).padStart(2, '0')}-` +
                          `${String(now.getDate()).padStart(2, '0')}-` +
                          `${String(now.getHours()).padStart(2, '0')}-` +
                          `${String(now.getMinutes()).padStart(2, '0')}-` +
                          `${String(now.getSeconds()).padStart(2, '0')}-` +
                          `${String(now.getMilliseconds()).padStart(3, '0')}`; // yyyy-mm-dd-hh-mm-ss-millisecond
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new Error('Only PDF files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService]
})
export class InvoiceModule { }
