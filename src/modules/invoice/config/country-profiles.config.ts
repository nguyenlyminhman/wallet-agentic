// config/country-profiles.config.ts

export type CountryCode =
  | 'VN' | 'US' | 'JP' | 'CN' | 'SG' | 'TH' | 'KR' | 'MY' | 'ID' | 'PH'
  | 'DE' | 'FR' | 'GB' | 'AU' | 'IN' | 'UNKNOWN';

export interface CountryProfile {
  code: CountryCode;
  name: string;
  currency: string;
  currencySymbols: string[];       // ký hiệu tiền tệ có thể xuất hiện trên hóa đơn
  thousandSeparator: '.' | ',' | ' ' | '';
  decimalSeparator: '.' | ',';
  dateFormats: string[];           // để hint cho Gemini
  vatNames: string[];              // tên trường VAT trên hóa đơn nước đó
  taxIdPattern: RegExp | null;     // regex validate mã số thuế
  taxIdLabel: string;              // tên trường tax id
  invoiceKeywords: string[];       // từ khóa nhận diện loại hóa đơn
  roundingUnit: number;            // đơn vị làm tròn (VN=1000, JP=1, US=0.01)
  fraudRules: {
    suspiciousRoundAmount: number; // ngưỡng "số chẵn đáng ngờ"
    workingDayOnly: boolean;       // có check ngày lễ/cuối tuần không
    maxItemUnitPriceDriftPct: number; // % chênh lệch đơn giá cho phép
  };
  fieldMapping: {
    invoiceNo: string[];
    invoiceDate: string[];
    dueDate: string[];
    sellerName: string[];
    buyerName: string[];
    subtotal: string[];
    vat: string[];
    total: string[];
    amountInWords: string[];
  };
}

export const COUNTRY_PROFILES: Record<CountryCode, CountryProfile> = {
  VN: {
    code: 'VN',
    name: 'Việt Nam',
    currency: 'VND',
    currencySymbols: ['đ', 'VND', 'VNĐ'],
    thousandSeparator: '.',
    decimalSeparator: ',',
    dateFormats: ['DD/MM/YYYY', 'ngày DD tháng MM năm YYYY'],
    vatNames: ['Thuế GTGT', 'Tiền thuế GTGT', 'VAT', 'Thuế suất GTGT'],
    taxIdPattern: /^\d{10}(-\d{3})?$/,
    taxIdLabel: 'Mã số thuế',
    invoiceKeywords: [
      'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'HÓA ĐƠN BÁN HÀNG',
      'PHIẾU XUẤT KHO', 'Mã số thuế', 'Thành tiền',
    ],
    roundingUnit: 1,
    fraudRules: {
      suspiciousRoundAmount: 1_000_000,
      workingDayOnly: true,
      maxItemUnitPriceDriftPct: 5,
    },
    fieldMapping: {
      invoiceNo:      ['Số hóa đơn', 'Ký hiệu', 'Số'],
      invoiceDate:    ['Ngày', 'Ngày tháng năm'],
      dueDate:        ['Ngày đến hạn', 'Hạn thanh toán'],
      sellerName:     ['Đơn vị bán hàng', 'Người bán'],
      buyerName:      ['Đơn vị mua hàng', 'Người mua', 'Khách hàng'],
      subtotal:       ['Cộng tiền hàng', 'Tổng cộng', 'Thành tiền'],
      vat:            ['Tiền thuế GTGT', 'Thuế GTGT'],
      total:          ['Tổng tiền thanh toán', 'Tổng cộng tiền thanh toán'],
      amountInWords:  ['Số tiền bằng chữ'],
    },
  },

  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    currencySymbols: ['$', 'USD'],
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormats: ['MM/DD/YYYY', 'MMMM DD, YYYY'],
    vatNames: ['Tax', 'Sales Tax', 'State Tax'],
    taxIdPattern: /^\d{2}-\d{7}$/,   // EIN format
    taxIdLabel: 'EIN / Tax ID',
    invoiceKeywords: ['INVOICE', 'Bill To', 'Ship To', 'Invoice #', 'Due Date'],
    roundingUnit: 0.01,
    fraudRules: {
      suspiciousRoundAmount: 1_000,
      workingDayOnly: false,
      maxItemUnitPriceDriftPct: 1,
    },
    fieldMapping: {
      invoiceNo:      ['Invoice #', 'Invoice No', 'Invoice Number'],
      invoiceDate:    ['Invoice Date', 'Date'],
      dueDate:        ['Due Date', 'Payment Due'],
      sellerName:     ['From', 'Vendor', 'Seller'],
      buyerName:      ['Bill To', 'Client', 'Customer'],
      subtotal:       ['Subtotal', 'Sub Total'],
      vat:            ['Tax', 'Sales Tax'],
      total:          ['Total', 'Amount Due', 'Balance Due'],
      amountInWords:  [],
    },
  },

  JP: {
    code: 'JP',
    name: '日本',
    currency: 'JPY',
    currencySymbols: ['¥', 'JPY', '円'],
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormats: ['YYYY年MM月DD日', 'YYYY/MM/DD', 'R年MM月DD日'], // R = Reiwa era
    vatNames: ['消費税', '税額', '内消費税'],
    taxIdPattern: /^[TT]?\d{13}$/,  // インボイス登録番号
    taxIdLabel: '登録番号 / 法人番号',
    invoiceKeywords: ['請求書', '領収書', '納品書', '消費税', '税込', '税抜', '合計'],
    roundingUnit: 1,
    fraudRules: {
      suspiciousRoundAmount: 10_000,
      workingDayOnly: true,
      maxItemUnitPriceDriftPct: 1,
    },
    fieldMapping: {
      invoiceNo:      ['請求書番号', '伝票番号', 'No.'],
      invoiceDate:    ['請求日', '発行日', '日付'],
      dueDate:        ['支払期日', '振込期限'],
      sellerName:     ['請求元', '販売者', '会社名'],
      buyerName:      ['請求先', '宛先'],
      subtotal:       ['小計', '合計金額（税抜）'],
      vat:            ['消費税額', '消費税'],
      total:          ['合計', 'ご請求金額', '税込合計'],
      amountInWords:  [],
    },
  },

  CN: {
    code: 'CN',
    name: '中国',
    currency: 'CNY',
    currencySymbols: ['¥', 'CNY', '元', '人民币'],
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormats: ['YYYY年MM月DD日', 'YYYY/MM/DD'],
    vatNames: ['增值税', '税额', '税率'],
    taxIdPattern: /^[0-9A-Z]{18}$/,  // 统一社会信用代码
    taxIdLabel: '纳税人识别号 / 统一社会信用代码',
    invoiceKeywords: ['增值税专用发票', '增值税普通发票', '发票号码', '购买方', '销售方', '合计'],
    roundingUnit: 0.01,
    fraudRules: {
      suspiciousRoundAmount: 10_000,
      workingDayOnly: true,
      maxItemUnitPriceDriftPct: 2,
    },
    fieldMapping: {
      invoiceNo:      ['发票号码', '发票代码'],
      invoiceDate:    ['开票日期', '日期'],
      dueDate:        ['付款期限'],
      sellerName:     ['销售方', '销售方名称', '开票单位'],
      buyerName:      ['购买方', '购买方名称'],
      subtotal:       ['合计金额', '不含税金额'],
      vat:            ['合计税额', '增值税税额'],
      total:          ['价税合计', '合计', '总金额'],
      amountInWords:  ['价税合计（大写）', '合计（大写）'],
    },
  },

  SG: {
    code: 'SG',
    name: 'Singapore',
    currency: 'SGD',
    currencySymbols: ['S$', 'SGD', '$'],
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormats: ['DD/MM/YYYY', 'DD MMM YYYY'],
    vatNames: ['GST', 'Goods and Services Tax'],
    taxIdPattern: /^\d{9}[A-Z]$/,   // UEN format
    taxIdLabel: 'UEN / GST Reg No.',
    invoiceKeywords: ['TAX INVOICE', 'GST', 'UEN', 'Reg No', 'Invoice No'],
    roundingUnit: 0.01,
    fraudRules: {
      suspiciousRoundAmount: 1_000,
      workingDayOnly: false,
      maxItemUnitPriceDriftPct: 1,
    },
    fieldMapping: {
      invoiceNo:      ['Invoice No', 'Invoice Number', 'Invoice #'],
      invoiceDate:    ['Invoice Date', 'Date'],
      dueDate:        ['Due Date', 'Payment Terms'],
      sellerName:     ['From', 'Vendor'],
      buyerName:      ['Bill To', 'To'],
      subtotal:       ['Subtotal', 'Amount Before GST'],
      vat:            ['GST', 'GST Amount'],
      total:          ['Total (Inc. GST)', 'Total Amount Due'],
      amountInWords:  [],
    },
  },

  TH: {
    code: 'TH',
    name: 'ประเทศไทย',
    currency: 'THB',
    currencySymbols: ['฿', 'THB', 'บาท'],
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormats: ['DD/MM/YYYY', 'DD เดือน พ.ศ.YYYY'], // Buddhist era
    vatNames: ['ภาษีมูลค่าเพิ่ม', 'VAT', 'ภาษี'],
    taxIdPattern: /^\d{13}$/,
    taxIdLabel: 'เลขประจำตัวผู้เสียภาษี',
    invoiceKeywords: ['ใบกำกับภาษี', 'ใบแจ้งหนี้', 'ใบเสร็จรับเงิน', 'มูลค่าเพิ่ม'],
    roundingUnit: 0.01,
    fraudRules: {
      suspiciousRoundAmount: 10_000,
      workingDayOnly: true,
      maxItemUnitPriceDriftPct: 3,
    },
    fieldMapping: {
      invoiceNo:      ['เลขที่ใบกำกับภาษี', 'เลขที่', 'Invoice No'],
      invoiceDate:    ['วันที่', 'Date'],
      dueDate:        ['วันครบกำหนด', 'Due Date'],
      sellerName:     ['ผู้ขาย', 'ชื่อกิจการ'],
      buyerName:      ['ผู้ซื้อ', 'ลูกค้า'],
      subtotal:       ['ยอดรวมก่อนภาษี', 'มูลค่าสินค้า'],
      vat:            ['ภาษีมูลค่าเพิ่ม', 'VAT'],
      total:          ['ยอดรวมทั้งสิ้น', 'จำนวนเงินรวมทั้งสิ้น'],
      amountInWords:  ['จำนวนเงิน (ตัวอักษร)'],
    },
  },

  KR: {
    code: 'KR',
    name: '대한민국',
    currency: 'KRW',
    currencySymbols: ['₩', 'KRW', '원'],
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormats: ['YYYY년 MM월 DD일', 'YYYY-MM-DD'],
    vatNames: ['부가세', '부가가치세', 'VAT'],
    taxIdPattern: /^\d{3}-\d{2}-\d{5}$/,
    taxIdLabel: '사업자등록번호',
    invoiceKeywords: ['세금계산서', '거래명세서', '영수증', '부가가치세', '공급가액'],
    roundingUnit: 1,
    fraudRules: {
      suspiciousRoundAmount: 10_000,
      workingDayOnly: true,
      maxItemUnitPriceDriftPct: 1,
    },
    fieldMapping: {
      invoiceNo:      ['문서번호', '세금계산서번호'],
      invoiceDate:    ['작성일자', '발행일'],
      dueDate:        ['지급기한', '결제기한'],
      sellerName:     ['공급자', '상호'],
      buyerName:      ['공급받는자', '거래처'],
      subtotal:       ['공급가액', '소계'],
      vat:            ['세액', '부가세'],
      total:          ['합계금액', '총금액'],
      amountInWords:  [],
    },
  },

  // EU hóa đơn (DE, FR, GB dùng chung profile)
  DE: {
    code: 'DE',
    name: 'Deutschland / EU',
    currency: 'EUR',
    currencySymbols: ['€', 'EUR'],
    thousandSeparator: '.',
    decimalSeparator: ',',
    dateFormats: ['DD.MM.YYYY'],
    vatNames: ['MwSt', 'Mehrwertsteuer', 'USt', 'VAT'],
    taxIdPattern: /^DE\d{9}$/,
    taxIdLabel: 'USt-IdNr. / Steuernummer',
    invoiceKeywords: ['Rechnung', 'Rechnungsnummer', 'MwSt', 'Steuer', 'Betrag'],
    roundingUnit: 0.01,
    fraudRules: {
      suspiciousRoundAmount: 1_000,
      workingDayOnly: false,
      maxItemUnitPriceDriftPct: 1,
    },
    fieldMapping: {
      invoiceNo:      ['Rechnungsnummer', 'Beleg-Nr', 'Invoice No'],
      invoiceDate:    ['Rechnungsdatum', 'Datum'],
      dueDate:        ['Fälligkeitsdatum', 'Zahlungsziel'],
      sellerName:     ['Absender', 'Lieferant', 'Von'],
      buyerName:      ['Rechnungsempfänger', 'Kunde', 'An'],
      subtotal:       ['Zwischensumme', 'Nettobetrag'],
      vat:            ['MwSt-Betrag', 'Umsatzsteuer'],
      total:          ['Gesamtbetrag', 'Rechnungsbetrag', 'Zu zahlen'],
      amountInWords:  [],
    },
  },

  // fallback còn lại
  FR: { code: 'FR', name: 'France', currency: 'EUR', currencySymbols: ['€', 'EUR'], thousandSeparator: ' ', decimalSeparator: ',', dateFormats: ['DD/MM/YYYY'], vatNames: ['TVA'], taxIdPattern: /^FR[A-Z0-9]{2}\d{9}$/, taxIdLabel: 'Numéro TVA', invoiceKeywords: ['FACTURE', 'TVA', 'HT', 'TTC'], roundingUnit: 0.01, fraudRules: { suspiciousRoundAmount: 1000, workingDayOnly: false, maxItemUnitPriceDriftPct: 1 }, fieldMapping: { invoiceNo: ['N° Facture'], invoiceDate: ['Date'], dueDate: ['Échéance'], sellerName: ['Vendeur'], buyerName: ['Client'], subtotal: ['Total HT'], vat: ['TVA'], total: ['Total TTC'], amountInWords: [] } },
  GB: { code: 'GB', name: 'United Kingdom', currency: 'GBP', currencySymbols: ['£', 'GBP'], thousandSeparator: ',', decimalSeparator: '.', dateFormats: ['DD/MM/YYYY'], vatNames: ['VAT'], taxIdPattern: /^GB\d{9}$/, taxIdLabel: 'VAT Reg No', invoiceKeywords: ['VAT INVOICE', 'VAT No', 'Invoice No'], roundingUnit: 0.01, fraudRules: { suspiciousRoundAmount: 1000, workingDayOnly: false, maxItemUnitPriceDriftPct: 1 }, fieldMapping: { invoiceNo: ['Invoice No'], invoiceDate: ['Date'], dueDate: ['Due Date'], sellerName: ['From'], buyerName: ['To'], subtotal: ['Subtotal'], vat: ['VAT'], total: ['Total'], amountInWords: [] } },
  AU: { code: 'AU', name: 'Australia', currency: 'AUD', currencySymbols: ['A$', 'AUD', '$'], thousandSeparator: ',', decimalSeparator: '.', dateFormats: ['DD/MM/YYYY'], vatNames: ['GST'], taxIdPattern: /^\d{11}$/, taxIdLabel: 'ABN', invoiceKeywords: ['TAX INVOICE', 'GST', 'ABN'], roundingUnit: 0.01, fraudRules: { suspiciousRoundAmount: 1000, workingDayOnly: false, maxItemUnitPriceDriftPct: 1 }, fieldMapping: { invoiceNo: ['Invoice No'], invoiceDate: ['Date'], dueDate: ['Due Date'], sellerName: ['From'], buyerName: ['To'], subtotal: ['Subtotal'], vat: ['GST'], total: ['Total'], amountInWords: [] } },
  IN: { code: 'IN', name: 'India', currency: 'INR', currencySymbols: ['₹', 'INR', 'Rs'], thousandSeparator: ',', decimalSeparator: '.', dateFormats: ['DD/MM/YYYY', 'DD-MM-YYYY'], vatNames: ['GST', 'CGST', 'SGST', 'IGST'], taxIdPattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/, taxIdLabel: 'GSTIN / PAN', invoiceKeywords: ['TAX INVOICE', 'GSTIN', 'CGST', 'SGST', 'HSN'], roundingUnit: 0.01, fraudRules: { suspiciousRoundAmount: 10000, workingDayOnly: false, maxItemUnitPriceDriftPct: 2 }, fieldMapping: { invoiceNo: ['Invoice No', 'Invoice Number'], invoiceDate: ['Invoice Date', 'Date'], dueDate: ['Due Date'], sellerName: ['Seller', 'Vendor'], buyerName: ['Buyer', 'Bill To'], subtotal: ['Taxable Amount', 'Subtotal'], vat: ['Total GST', 'Tax Amount'], total: ['Grand Total', 'Total Amount'], amountInWords: ['Amount in Words'] } },
  MY: { code: 'MY', name: 'Malaysia', currency: 'MYR', currencySymbols: ['RM', 'MYR'], thousandSeparator: ',', decimalSeparator: '.', dateFormats: ['DD/MM/YYYY'], vatNames: ['SST', 'GST', 'Service Tax'], taxIdPattern: /^\d{12}$/, taxIdLabel: 'SST Reg No / Company No', invoiceKeywords: ['TAX INVOICE', 'SST', 'No. Akaun'], roundingUnit: 0.01, fraudRules: { suspiciousRoundAmount: 1000, workingDayOnly: false, maxItemUnitPriceDriftPct: 2 }, fieldMapping: { invoiceNo: ['Invoice No'], invoiceDate: ['Date'], dueDate: ['Due Date'], sellerName: ['Vendor'], buyerName: ['Bill To'], subtotal: ['Subtotal'], vat: ['SST'], total: ['Total'], amountInWords: [] } },
  ID: { code: 'ID', name: 'Indonesia', currency: 'IDR', currencySymbols: ['Rp', 'IDR'], thousandSeparator: '.', decimalSeparator: ',', dateFormats: ['DD/MM/YYYY', 'DD MMMM YYYY'], vatNames: ['PPN', 'Pajak'], taxIdPattern: /^\d{15}$/, taxIdLabel: 'NPWP', invoiceKeywords: ['FAKTUR PAJAK', 'NPWP', 'PPN', 'Harga Satuan'], roundingUnit: 1, fraudRules: { suspiciousRoundAmount: 100_000, workingDayOnly: true, maxItemUnitPriceDriftPct: 3 }, fieldMapping: { invoiceNo: ['Nomor Faktur', 'No. Faktur'], invoiceDate: ['Tanggal'], dueDate: ['Jatuh Tempo'], sellerName: ['Penjual', 'Nama Perusahaan'], buyerName: ['Pembeli', 'Pelanggan'], subtotal: ['DPP', 'Jumlah'], vat: ['PPN', 'Pajak'], total: ['Total', 'Jumlah Tagihan'], amountInWords: ['Terbilang'] } },
  PH: { code: 'PH', name: 'Philippines', currency: 'PHP', currencySymbols: ['₱', 'PHP'], thousandSeparator: ',', decimalSeparator: '.', dateFormats: ['MM/DD/YYYY'], vatNames: ['VAT', 'EVAT'], taxIdPattern: /^\d{3}-\d{3}-\d{3}-\d{3}$/, taxIdLabel: 'TIN', invoiceKeywords: ['OFFICIAL RECEIPT', 'INVOICE', 'TIN', 'VAT'], roundingUnit: 0.01, fraudRules: { suspiciousRoundAmount: 1000, workingDayOnly: false, maxItemUnitPriceDriftPct: 2 }, fieldMapping: { invoiceNo: ['Invoice No', 'OR No'], invoiceDate: ['Date'], dueDate: ['Due Date'], sellerName: ['Seller'], buyerName: ['Sold To'], subtotal: ['Subtotal'], vat: ['VAT'], total: ['Total Amount Due'], amountInWords: ['Amount in Words'] } },
  UNKNOWN: {
    code: 'UNKNOWN',
    name: 'Unknown',
    currency: 'UNKNOWN',
    currencySymbols: [],
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormats: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'],
    vatNames: ['VAT', 'Tax', 'GST'],
    taxIdPattern: null,
    taxIdLabel: 'Tax ID',
    invoiceKeywords: ['invoice', 'total', 'tax'],
    roundingUnit: 0.01,
    fraudRules: { suspiciousRoundAmount: 1000, workingDayOnly: false, maxItemUnitPriceDriftPct: 5 },
    fieldMapping: { invoiceNo: ['Invoice No', 'Invoice Number'], invoiceDate: ['Date', 'Invoice Date'], dueDate: ['Due Date'], sellerName: ['From', 'Seller'], buyerName: ['To', 'Bill To'], subtotal: ['Subtotal'], vat: ['Tax', 'VAT'], total: ['Total'], amountInWords: [] },
  },
};

export function getProfile(code: CountryCode): CountryProfile {
  return COUNTRY_PROFILES[code] ?? COUNTRY_PROFILES['UNKNOWN'];
}