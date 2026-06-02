// agent/tools/validate-amounts.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createValidateAmountsTool() {
  return new DynamicStructuredTool({
    name: 'validateAmounts',
    description: 'Kiểm tra tổng tiền, tự động dùng rounding unit theo quốc gia.',
    schema: z.object({
      invoiceData: z.string(),
    }),
    func: async ({ invoiceData }) => {
      // LLM đôi khi nó truyền object thay vì string thuần
      const invoice = typeof invoiceData === 'string' ? JSON.parse(invoiceData) : invoiceData;

      const tolerance = (invoice._roundingUnit ?? 1) * 2;

      const results: any = {
        isValid: true,
        errors: [],
        itemChecks: [],
        calculatedSubtotal: 0,
        calculatedVat: 0,
        calculatedTotal: 0,
        currency: invoice._currency ?? 'UNKNOWN',
        tolerance,
      };

      for (const item of invoice.items ?? []) {
        const expected = Math.round((item.qty * item.unitPrice) / tolerance) * tolerance;
        const diff = Math.abs(expected - item.amount);
        const isItemValid = diff <= tolerance;

        results.itemChecks.push({
          no: item.no,
          description: item.description,
          expected,
          actual: item.amount,
          isValid: isItemValid,
        });

        if (!isItemValid) {
          results.isValid = false;
          results.errors.push(
            `[${results.currency}] Dòng ${item.no}: ${item.qty} × ${item.unitPrice} = ${expected}, hóa đơn ghi ${item.amount}`
          );
        }
        results.calculatedSubtotal += Math.round(item.amount);
      }

      if (Math.abs(results.calculatedSubtotal - invoice.subtotal) > tolerance) {
        results.isValid = false;
        results.errors.push(
          `Subtotal: tính được ${results.calculatedSubtotal}, ghi ${invoice.subtotal}`
        );
      }

      results.calculatedVat = Math.round(
        results.calculatedSubtotal * (invoice.vatRate / 100) / tolerance
      ) * tolerance;

      if (Math.abs(results.calculatedVat - invoice.vat) > tolerance * 3) {
        results.isValid = false;
        results.errors.push(
          `VAT ${invoice.vatRate}%: tính được ${results.calculatedVat}, ghi ${invoice.vat}`
        );
      }

      results.calculatedTotal = results.calculatedSubtotal + results.calculatedVat;
      if (Math.abs(results.calculatedTotal - invoice.totalDue) > tolerance) {
        results.isValid = false;
        results.errors.push(
          `Total: tính được ${results.calculatedTotal}, ghi ${invoice.totalDue}`
        );
      }

      return JSON.stringify(results);
    },
  });
}
