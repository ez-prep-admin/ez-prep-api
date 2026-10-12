import { calculateInclusiveTax } from './calculate-inclusive-tax';

describe('calculateInclusiveTax properties', () => {
  const rates = [0, 5, 12, 18, 28];

  it('holds for every gross from 0 to 500000 paise', () => {
    for (const taxRate of rates) {
      for (let grossAmount = 0; grossAmount <= 500_000; grossAmount += 1) {
        assertBreakdown(grossAmount, taxRate, '32', '32');
        assertBreakdown(grossAmount, taxRate, '32', '33');
      }
    }
  });
});

function assertBreakdown(
  grossAmount: number,
  taxRate: number,
  sellerStateCode: string,
  buyerStateCode: string,
): void {
  const tax = calculateInclusiveTax({
    grossAmount,
    taxRate,
    sellerStateCode,
    buyerStateCode,
  });
  const intra = sellerStateCode === buyerStateCode;
  if (tax.taxableAmount + tax.cgst + tax.sgst + tax.igst !== grossAmount) {
    throw new Error(`sum ${grossAmount} @ ${taxRate}`);
  }
  if (tax.cgst !== tax.sgst) {
    throw new Error(`unequal split ${grossAmount} @ ${taxRate}`);
  }
  if (tax.taxableAmount < 0 || tax.cgst < 0 || tax.sgst < 0 || tax.igst < 0) {
    throw new Error(`negative ${grossAmount} @ ${taxRate}`);
  }
  if (intra) {
    const exactHalf = (grossAmount * taxRate) / (2 * (100 + taxRate));
    const exactTaxable = grossAmount - 2 * exactHalf;
    if (Math.abs(tax.cgst - exactHalf) > 1) {
      throw new Error(`cgst ${grossAmount} @ ${taxRate}`);
    }
    if (Math.abs(tax.taxableAmount - exactTaxable) > 1) {
      throw new Error(`taxable ${grossAmount} @ ${taxRate}`);
    }
    return;
  }
  const exactTaxable = (grossAmount * 100) / (100 + taxRate);
  const exactIgst = grossAmount - exactTaxable;
  if (Math.abs(tax.taxableAmount - exactTaxable) > 1) {
    throw new Error(`inter taxable ${grossAmount} @ ${taxRate}`);
  }
  if (Math.abs(tax.igst - exactIgst) > 1) {
    throw new Error(`igst ${grossAmount} @ ${taxRate}`);
  }
}
