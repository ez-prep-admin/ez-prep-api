/**
 * Inclusive GST reverse calculation in integer paise (D-26).
 * Intra-state: CGST and SGST are equal. Inter-state: IGST is the full tax.
 * Never use floating-point division for the rounded amounts.
 */
export const GST_SUPPLY_TYPES = ['INTRA_STATE', 'INTER_STATE'] as const;
export type GstSupplyType = (typeof GST_SUPPLY_TYPES)[number];

export interface TaxBreakdown {
  grossAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Percent, e.g. 18. */
  taxRate: number;
  /** Set on new checkouts. Absent on orders priced before phase 14E. */
  supplyType?: GstSupplyType;
  sellerStateCode?: string;
  buyerStateCode?: string;
}

export interface CalculateInclusiveTaxInput {
  /** Inclusive amount in paise. */
  grossAmount: number;
  /** Percent, e.g. 18. */
  taxRate: number;
  sellerStateCode: string;
  buyerStateCode: string;
}

export function calculateInclusiveTax(
  input: CalculateInclusiveTaxInput,
): TaxBreakdown {
  const { grossAmount, taxRate, sellerStateCode, buyerStateCode } = input;

  if (!Number.isInteger(grossAmount) || grossAmount < 0) {
    throw new Error('grossAmount must be a non-negative integer (paise)');
  }
  if (!Number.isInteger(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new Error('taxRate must be an integer percent from 0 to 100');
  }
  if (!sellerStateCode || !buyerStateCode) {
    throw new Error('sellerStateCode and buyerStateCode are required');
  }

  const sameState = sellerStateCode === buyerStateCode;
  if (sameState) {
    const half = roundHalfUp(grossAmount * taxRate, 2 * (100 + taxRate));
    const taxAmount = half * 2;
    return {
      grossAmount,
      taxableAmount: grossAmount - taxAmount,
      taxAmount,
      cgst: half,
      sgst: half,
      igst: 0,
      taxRate,
      supplyType: 'INTRA_STATE',
      sellerStateCode,
      buyerStateCode,
    };
  }

  const taxableAmount = roundHalfUp(grossAmount * 100, 100 + taxRate);
  const taxAmount = grossAmount - taxableAmount;
  return {
    grossAmount,
    taxableAmount,
    taxAmount,
    cgst: 0,
    sgst: 0,
    igst: taxAmount,
    taxRate,
    supplyType: 'INTER_STATE',
    sellerStateCode,
    buyerStateCode,
  };
}

/** Old orders have no supplyType. Classify from the stored split, never from live config. */
export function supplyTypeFromSnapshot(tax: {
  supplyType?: string;
  igst: number;
}): GstSupplyType {
  if (tax.supplyType === 'INTRA_STATE' || tax.supplyType === 'INTER_STATE') {
    return tax.supplyType;
  }
  return tax.igst > 0 ? 'INTER_STATE' : 'INTRA_STATE';
}

export function supplyTypeLabel(supplyType: GstSupplyType): string {
  return supplyType === 'INTRA_STATE' ? 'Intra-state' : 'Inter-state';
}

/** Round half up. Numerator and denominator are non-negative integers. */
function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    throw new Error('tax denominator must be positive');
  }
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}
