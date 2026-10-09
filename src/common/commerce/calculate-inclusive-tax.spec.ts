import { calculateInclusiveTax } from './calculate-inclusive-tax';

describe('calculateInclusiveTax', () => {
  it('splits ₹999 at 18% into taxable 846.61 and tax 152.39 (paise)', () => {
    const sameState = calculateInclusiveTax({
      grossAmount: 99900,
      taxRate: 18,
      sellerStateCode: '32',
      buyerStateCode: '32',
    });

    expect(sameState).toEqual({
      grossAmount: 99900,
      taxableAmount: 84661,
      taxAmount: 15239,
      cgst: 7619,
      sgst: 7620,
      igst: 0,
      taxRate: 18,
    });
  });

  it('puts the full tax on IGST for an interstate buyer', () => {
    const interstate = calculateInclusiveTax({
      grossAmount: 99900,
      taxRate: 18,
      sellerStateCode: '32',
      buyerStateCode: '27',
    });

    expect(interstate.taxableAmount).toBe(84661);
    expect(interstate.taxAmount).toBe(15239);
    expect(interstate.cgst).toBe(0);
    expect(interstate.sgst).toBe(0);
    expect(interstate.igst).toBe(15239);
  });
});
