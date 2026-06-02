import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { CountryCode, getProfile } from 'src/modules/invoice/config/country-profiles.config';

function extractTextContent(c: unknown): string {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return (c as any[]).filter(p => p.type === 'text').map(p => p.text ?? '').join('');
  return String(c ?? '');
}

export function createDetectFraudTool(model: ChatGoogleGenerativeAI, rawBase64: string) {
  return new DynamicStructuredTool({
    name: 'detectFraud',
    description: 'Check for fraud using country-specific rule sets.',
    schema: z.object({
      invoiceData: z.string(),
      validationResult: z.string(),
    }),
    func: async ({ invoiceData, validationResult }) => {
      const invoice = typeof invoiceData === 'string' ? JSON.parse(invoiceData) : invoiceData;
      const validation = typeof validationResult === 'string' ? JSON.parse(validationResult) : validationResult;
      const profile = getProfile((invoice._countryCode ?? 'UNKNOWN') as CountryCode);
      const rules = profile.fraudRules;
      const flags: string[] = [];

      const cleanBase64 = rawBase64.replace(/\s+/g, '').replace(/^data:image\/\w+;base64,/, '');
      const formattedDataUrl = `data:image/jpeg;base64,${cleanBase64}`;


      // Case 1: Inflate đơn giá — áp dụng mọi quốc gia
      for (const item of invoice.items ?? []) {
        if (item.qty > 0 && item.unitPrice > 0) {
          const calculatedUnit = item.amount / item.qty;
          const drift = Math.abs(calculatedUnit - item.unitPrice) / item.unitPrice;
          if (drift > rules.maxItemUnitPriceDriftPct / 100) {
            flags.push(
              `[Inflate giá] Dòng ${item.no}: đơn giá khai ${item.unitPrice} nhưng tính ngược ra ${calculatedUnit.toFixed(2)}`
            );
          }
        }
      }

      // Case 2: Trùng hóa đơn - Vô DB check data
      // const dup = await checkDuplicate(invoice.invoiceNo, invoice.seller?.taxId);
      // if (dup) flags.push(`[Trùng hóa đơn] ${invoice.invoiceNo} đã tồn tại`);

      // Case 3: Ngày bất thường — chỉ áp dụng với quốc gia có workingDayOnly
      if (rules.workingDayOnly && invoice.invoiceDate) {
        const d = new Date(invoice.invoiceDate);
        if (!isNaN(d.getTime())) {
          const dow = d.getDay();
          if (dow === 0 || dow === 6) {
            flags.push(
              `[Ngày cuối tuần] Hóa đơn ${profile.name} ngày ${invoice.invoiceDate} là ${dow === 0 ? 'Chủ nhật / 日曜日 / 일요일' : 'Thứ 7 / 土曜日 / 토요일'}`
            );
          }
          if (d > new Date()) {
            flags.push(`[Ngày tương lai] ${invoice.invoiceDate} chưa đến`);
          }
        }
      }

      // Case 4: Số tiền quá tròn — ngưỡng theo quốc gia
      const allRound = (invoice.items ?? []).length > 2 &&
        (invoice.items as any[]).every(
          (item: any) => item.amount % rules.suspiciousRoundAmount === 0
        );
      if (allRound) {
        flags.push(
          `[Số tiền đáng ngờ] Tất cả dòng là bội số của ${rules.suspiciousRoundAmount.toLocaleString()} ${profile.currency}`
        );
      }

      // Case 5: Tax ID không đúng format quốc gia
      if (profile.taxIdPattern) {
        const sellerTax = (invoice.seller?.taxId ?? '').replace(/\s/g, '');
        if (sellerTax && !profile.taxIdPattern.test(sellerTax)) {
          flags.push(
            `[Tax ID không hợp lệ] ${profile.taxIdLabel} của người bán "${sellerTax}" không đúng format ${profile.code}`
          );
        }
      }

      // Case 6: Cross-check amountInWords — chỉ với quốc gia có trường này
      if (invoice.amountInWords && invoice.totalDue) {
        const crossCheckPrompt = `
                                Invoice country: ${profile.name}.
                                Amount in words: "${invoice.amountInWords}"
                                Numeric amount: ${invoice.totalDue} ${profile.currency}

                                Do these two values match?
                                Return JSON: { "match": true/false, "parsedFromWords": <number_or_null> }
                                JSON only.`;
        try {
          const crossCheck = await model.invoke([{ role: 'user', content: crossCheckPrompt }]);
          const result = JSON.parse(extractTextContent(crossCheck.content));
          if (result.match === false) {
            flags.push(
              `[Chữ-số không khớp] Số tiền bằng chữ "${invoice.amountInWords}" không khớp số ${invoice.totalDue} — dấu hiệu gian lận điển hình`
            );
          }
        } catch { 
          /* skip nếu parse lỗi - có thể ghi log vào DB để tracking */ 
        }
      }

      // Case 7: Gemini Vision phát hiện chỉnh sửa ảnh
      try {
        const visionRes = await model.invoke([
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: formattedDataUrl } },
              {
                type: 'text',
                text: `Check whether this invoice shows signs of forgery or image manipulation. Consider:
                      1. Inconsistent fonts, especially replaced numbers
                      2. Unusual blank areas or pixel artifacts
                      3. Numbers misaligned compared with other rows
                      4. Stamps or signatures that appear copy-pasted
                      Return JSON: { "manipulationDetected": true/false, "suspiciousAreas": [], "confidence": 0-100 }`,
              },
            ],
          },
        ]);
        const visionResult = JSON.parse(extractTextContent(visionRes.content));
        if (visionResult.manipulationDetected && visionResult.confidence > 60) {
          visionResult.suspiciousAreas.forEach((area: string) =>
            flags.push(`[Chỉnh sửa ảnh] ${area}`)
          );
        }
      } catch { /* skip nếu parse lỗi - có thể ghi log vào DB để tracking */  }

      return JSON.stringify({
        countryCode: profile.code,
        countryName: profile.name,
        hasFraud: flags.length > 0,
        fraudFlags: flags,
        amountMismatch: !validation.isValid,
        rulesApplied: {
          suspiciousRoundThreshold: rules.suspiciousRoundAmount,
          workingDayCheck: rules.workingDayOnly,
          unitPriceDriftPct: rules.maxItemUnitPriceDriftPct,
          taxIdValidation: !!profile.taxIdPattern,
          amountInWordsCheck: !!(invoice.amountInWords),
          visionManipulationCheck: true,
        },
      });
    },
  });
}
