import { DynamicStructuredTool } from '@langchain/core/tools';
import { NotificationService } from 'src/modules/invoice/notification/notification.service';
import { z } from 'zod';

export function createSendNotificationTool(notificationService: NotificationService) {
  return new DynamicStructuredTool({
    name: 'sendNotification',
    description: 'Send a notification when an error or suspected fraud is detected.',
    schema: z.object({
      type: z.enum(['AMOUNT_MISMATCH', 'SUSPECTED_FRAUD', 'LOW_QUALITY']),
      invoiceNo: z.string(),
      details: z.string(),
      recipientEmail: z.string().optional(),
    }),
    func: async ({ type, invoiceNo, details, recipientEmail }) => {
      await notificationService.sendAlert({
        type,
        invoiceNo,
        details,
        recipientEmail: recipientEmail || process.env.DEFAULT_REVIEWER_EMAIL,
      });
            
      return JSON.stringify({ sent: true, type, invoiceNo });
    },
  });
}
