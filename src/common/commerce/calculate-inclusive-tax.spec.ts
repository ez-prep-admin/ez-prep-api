import { calculateInclusiveTax } from './calculate-inclusive-tax';

describe('calculateInclusiveTax', () => {
  it('splits ₹999 intra-state into equal CGST and SGST', () => {
    expect(
      calculateInclusiveTax({
        grossAmount: 99900,
        taxRate: 18,
        sellerStateCode: '32',
        buyerStateCode: '32',
      }),
    ).toEqual({
      grossAmount: 99900,
      taxableAmount: 84662,
      taxAmount: 15238,
      cgst: 7619,
      sgst: 7619,
      igst: 0,
      taxRate: 18,
      supplyType: 'INTRA_STATE',
      sellerStateCode: '32',
      buyerStateCode: '32',
    });
  });

  it('puts the full tax on IGST for an interstate buyer', () => {
    const interstate = calculateInclusiveTax({
      grossAmount: 99900,
      taxRate: 18,
      sellerStateCode: '32',
      buyerStateCode: '33',
    });

    expect(interstate).toEqual({
      grossAmount: 99900,
      taxableAmount: 84661,
      taxAmount: 15239,
      cgst: 0,
      sgst: 0,
      igst: 15239,
      taxRate: 18,
      supplyType: 'INTER_STATE',
      sellerStateCode: '32',
      buyerStateCode: '33',
    });
  });

  it.each([
    [49900, 42288, 3806, 3806],
    [100, 84, 8, 8],
    [0, 0, 0, 0],
  ])(
    'splits intra-state gross %i into taxable %i and equal halves %i',
    (gross, taxable, cgst, sgst) => {
      const tax = calculateInclusiveTax({
        grossAmount: gross,
        taxRate: 18,
        sellerStateCode: '32',
        buyerStateCode: '32',
      });
      expect(tax.taxableAmount).toBe(taxable);
      expect(tax.cgst).toBe(cgst);
      expect(tax.sgst).toBe(sgst);
      expect(tax.igst).toBe(0);
    },
  );

  it('returns zeros for a zero gross on either supply type', () => {
    const inter = calculateInclusiveTax({
      grossAmount: 0,
      taxRate: 18,
      sellerStateCode: '32',
      buyerStateCode: '33',
    });
    expect(inter.taxableAmount).toBe(0);
    expect(inter.cgst).toBe(0);
    expect(inter.sgst).toBe(0);
    expect(inter.igst).toBe(0);
  });
});
