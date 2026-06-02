import { CountryCode } from "../config/country-profiles.config";

export interface InvoiceItem {
  no: number;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export enum InvoiceStatus {
  VALID = 'VALID',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',    // sai số tiền
  SUSPECTED_FRAUD = 'SUSPECTED_FRAUD',    // nghi gian lận
}

export enum ImageQuality {
  CLEAR = 'CLEAR',
  BLURRY = 'BLURRY',       // mờ
  CRUMPLED = 'CRUMPLED',   // nhàu nát
  TORN = 'TORN',           // rách
}

/** Full output từ checkImageQuality tool */
export interface ImageQualityResult {
  qualities: ImageQuality[];
  confidence: number;       // 0-100
  details: string;          // mô tả chi tiết từ Gemini
  readability: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DetectedCountry {
  countryCode: CountryCode;
  confidence: number;           // 0-100
  detectedLanguage: string;
  detectedCurrency: string;
}

export interface BankAccount {
  bank: string;
  accountNo: string;
  accountName: string;
}

export interface Party {
  name: string;
  taxId: string;
  address: string;
  email?: string;
  phone?: string;
}

export interface InvoiceResultDto {
  // Country detection
  detectedCountry: DetectedCountry;
  countryCode: CountryCode;
  countryName: string;
  countryConfidence: number;    // 0-100

  // Invoice info
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;

  // Parties
  seller: Party;
  buyer: Party;

  // Line items
  items: InvoiceItem[];

  // Amounts
  subtotal: number;
  vatRate: number;
  vat: number;
  totalDue: number;
  amountInWords: string;
  currency: string;

  // Payment
  bankAccount?: BankAccount;

  // Validation
  imageQuality: ImageQualityResult;  // full object thay vì chỉ string[]
  status: InvoiceStatus;
  fraudFlags: string[];
  uncertainFields?: string[];
  taxIdValidation: {
    sellerValid: boolean;
    buyerValid: boolean;
  };
}