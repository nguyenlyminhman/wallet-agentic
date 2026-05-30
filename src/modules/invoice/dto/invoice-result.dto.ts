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

export interface InvoiceResultDto {
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  seller: { name: string; taxId: string; address: string };
  buyer: { name: string; taxId: string; address: string };
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  vatRate: number;
  totalDue: number;
  currency: string;
  imageQuality: ImageQuality[];  // có thể nhiều vấn đề cùng lúc
  status: InvoiceStatus;
  fraudFlags: string[];          // mô tả cụ thể các dấu hiệu gian lận
  agentReasoning: string;        // chuỗi suy luận của agent
  countryCode: CountryCode;
  countryName: string;
  countryDetectionConfidence: number;  // 0-100
  taxIdValidation: {
    sellerValid: boolean;
    buyerValid: boolean;
  };
}