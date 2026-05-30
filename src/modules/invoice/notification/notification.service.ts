// notification/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';

interface AlertPayload {
  type: 'AMOUNT_MISMATCH' | 'SUSPECTED_FRAUD' | 'LOW_QUALITY';
  invoiceNo: string;
  details: string;
  recipientEmail?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendAlert(payload: AlertPayload): Promise<void> {
    const subject = this.getSubject(payload.type);
    const body = this.buildBody(payload);

    this.logger.warn(`[INVOICE ALERT] ${subject} - Invoice: ${payload.invoiceNo}`);

    // Gửi email (dùng Nodemailer hoặc @nestjs-modules/mailer)
    // await this.mailerService.sendMail({ to: payload.recipientEmail, subject, html: body });

    // Gửi Slack webhook
    // await this.httpService.post(process.env.SLACK_WEBHOOK_URL, { text: `${subject}\n${body}` });

    // insert vào table: notifications
  }

  private getSubject(type: string): string {
    const map: Record<string, string> = {
      AMOUNT_MISMATCH: '⚠️ Sai thông tin tiền - Cần kiểm tra lại',
      SUSPECTED_FRAUD: '🚨 Nghi ngờ gian lận hóa đơn - Cần kiểm tra lại',
      LOW_QUALITY: '📷 Chất lượng hóa đơn thấp - Cần scan lại',
    };
    return map[type] ?? 'Cảnh báo hóa đơn';
  }

  private buildBody(payload: AlertPayload): string {
    return `
      <h2>${this.getSubject(payload.type)}</h2>
      <p><strong>Số hóa đơn:</strong> ${payload.invoiceNo}</p>
      <p><strong>Chi tiết:</strong></p>
      <pre>${payload.details}</pre>
      <p>Vui lòng đăng nhập hệ thống để xem xét và xác nhận.</p>
    `;
  }
}