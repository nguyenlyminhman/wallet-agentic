// utils/number-parser.util.ts

import { CountryProfile } from "../invoice/config/country-profiles.config";

export function parseAmount(raw: string | number, profile: CountryProfile): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;

  let cleaned = String(raw).trim();

  // Bỏ ký hiệu tiền tệ
  for (const symbol of profile.currencySymbols) {
    cleaned = cleaned.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }
  cleaned = cleaned.trim();

  // Xử lý theo từng convention
  if (profile.thousandSeparator === '.' && profile.decimalSeparator === ',') {
    // VN, DE, ID: 1.234.567,89 → 1234567.89
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (profile.thousandSeparator === ',' && profile.decimalSeparator === '.') {
    // US, JP, KR: 1,234,567.89 → 1234567.89
    cleaned = cleaned.replace(/,/g, '');
  } else if (profile.thousandSeparator === ' ' && profile.decimalSeparator === ',') {
    // FR: 1 234 567,89 → 1234567.89
    cleaned = cleaned.replace(/\s/g, '').replace(',', '.');
  } else {
    // fallback: bỏ hết non-numeric trừ dấu chấm cuối
    const parts = cleaned.replace(/[^\d.,]/g, '').split(/[.,]/);
    if (parts.length > 1) {
      const last = parts.pop()!;
      cleaned = parts.join('') + '.' + last;
    } else {
      cleaned = parts[0] ?? '0';
    }
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

export function validateTaxId(taxId: string, profile: CountryProfile): boolean {
  if (!profile.taxIdPattern) return true; // UNKNOWN profile - skip
  return profile.taxIdPattern.test(taxId.replace(/\s/g, ''));
}

export function parseDateToISO(raw: string, profile: CountryProfile): string {
  if (!raw) return '';

  // Thử parse Buddhist era (Thái Lan): พ.ศ. 2567 = 2024
  if (profile.code === 'TH' && /\d{4}$/.test(raw)) {
    const buddhistYear = parseInt(raw.match(/\d{4}$/)?.[0] ?? '0');
    if (buddhistYear > 2400) {
      raw = raw.replace(/\d{4}$/, String(buddhistYear - 543));
    }
  }

  // Thử parse Japanese era: R6 = Reiwa 6 = 2024
  if (profile.code === 'JP') {
    const reiwaMatch = raw.match(/R(\d{1,2})年(\d{1,2})月(\d{1,2})日/);
    if (reiwaMatch) {
      const year = 2018 + parseInt(reiwaMatch[1]);
      return `${year}-${reiwaMatch[2].padStart(2, '0')}-${reiwaMatch[3].padStart(2, '0')}`;
    }
  }

  // Generic DD/MM/YYYY
  const dmyMatch = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    if (profile.dateFormats[0].startsWith('MM')) {
      // US: MM/DD/YYYY
      return `${dmyMatch[3]}-${dmyMatch[1].padStart(2, '0')}-${dmyMatch[2].padStart(2, '0')}`;
    }
    // DD/MM/YYYY (VN, SG, AU, GB, ...)
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = raw.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // CJK date: 2024年03月15日 / 2024년 03월 15일
  const cjkMatch = raw.match(/(\d{4})[年년]\s*(\d{1,2})[月월]\s*(\d{1,2})[日일]/);
  if (cjkMatch) {
    return `${cjkMatch[1]}-${cjkMatch[2].padStart(2, '0')}-${cjkMatch[3].padStart(2, '0')}`;
  }

  return raw; // fallback: trả nguyên
}