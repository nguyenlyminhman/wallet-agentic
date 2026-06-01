import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InvoiceAgent } from '../agent/invoice.agent';
import { NotificationService } from './notification/notification.service';

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
        const isPdf = file.mimetype === 'application/pdf';
        const isImage = file.mimetype.startsWith('image/');

        if (!isPdf && !isImage) {
          return cb(
            new Error('Only PDF and image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceAgent, NotificationService]
})
export class InvoiceModule { }
