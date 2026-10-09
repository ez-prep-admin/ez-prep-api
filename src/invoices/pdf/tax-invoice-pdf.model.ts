export interface TaxInvoicePdfParty {
  legalName: string;
  gstin: string;
  registeredAddress: string;
  state: string;
  stateCode: string;
  signatoryName?: string;
  signatoryDesignation?: string;
}

export interface TaxInvoicePdfBilling {
  name: string;
  state: string;
  stateCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  pincode: string;
}

export interface TaxInvoicePdfLine {
  description: string;
  /** Inclusive amount in paise. */
  amount: number;
}

export interface TaxInvoicePdfTax {
  grossAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Percent, copied from the order snapshot. */
  taxRate: number;
}

export interface TaxInvoicePdfModel {
  invoiceNumber: string;
  issuedAt: Date;
  orderNumber: string;
  billing: TaxInvoicePdfBilling;
  seller: TaxInvoicePdfParty;
  sacCode: string;
  sacDescription: string;
  lineItems: TaxInvoicePdfLine[];
  tax: TaxInvoicePdfTax;
}
