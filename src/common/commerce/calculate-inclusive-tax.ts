/**
 * Inclusive GST reverse calculation in integer paise.
 * taxable = round-half-up(gross * 100 / (100 + taxRate))
 * Same state: remainder of an odd tax amount goes to SGST.
 */
export interface TaxBreakdown {
  grossAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Percent, e.g. 18. */
  taxRate: number;
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

  const denominator = 100 + taxRate;
  const numerator = grossAmount * 100;
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  const taxableAmount = remainder * 2 >= denominator ? quotient + 1 : quotient;
  const taxAmount = grossAmount - taxableAmount;
  const sameState = sellerStateCode === buyerStateCode;
  const cgst = sameState ? Math.floor(taxAmount / 2) : 0;
  const sgst = sameState ? taxAmount - cgst : 0;
  const igst = sameState ? 0 : taxAmount;

  return {
    grossAmount,
    taxableAmount,
    taxAmount,
    cgst,
    sgst,
    igst,
    taxRate,
  };
}
