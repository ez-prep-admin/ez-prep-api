import { renderTaxInvoicePdf } from './render-tax-invoice-pdf';
import { TaxInvoicePdfModel } from './tax-invoice-pdf.model';

describe('renderTaxInvoicePdf', () => {
  const model: TaxInvoicePdfModel = {
    invoiceNumber: 'SERIES/2026-27/0001',
    issuedAt: new Date('2026-10-09T12:00:00.000Z'),
    orderNumber: 'ORD-1001',
    billing: {
      name: 'Ada Buyer',
      state: 'Karnataka',
      stateCode: '29',
      addressLine1: '12 Residency Road',
      city: 'Bengaluru',
      pincode: '560001',
    },
    seller: {
      legalName: 'Snapshot Seller LLP',
      gstin: '11PLAINTEXTGSTIN',
      registeredAddress: '1 Harbour Lane',
      state: 'Kerala',
      stateCode: '32',
      signatoryName: 'A Signer',
      signatoryDesignation: 'Proprietor',
    },
    sacCode: '424242',
    sacDescription: 'Test coaching services',
    lineItems: [{ description: 'Pack (1M)', amount: 99900 }],
    tax: {
      grossAmount: 99900,
      taxableAmount: 84661,
      taxAmount: 15239,
      cgst: 7619,
      sgst: 7620,
      igst: 0,
      taxRate: 18,
    },
  };

  it('prints the Rule 46 fields from the snapshot', async () => {
    const pdf = await renderTaxInvoicePdf(model);
    const text = visibleText(pdf);

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeLessThan(20_000);
    expect(text).toContain('Snapshot Seller LLP');
    expect(text).toContain('11PLAINTEXTGSTIN');
    expect(text).toContain('424242');
    expect(text).toContain('Place of supply');
    expect(text).toContain('Karnataka');
    expect(text).toContain('Reverse charge');
    expect(text).toContain('No');
    expect(text).toContain('12 Residency Road');
    expect(text).toContain('846.61');
    expect(text).toContain('76.19');
    expect(text).toContain('76.20');
    expect(text).toContain('999.00');
    expect(text).not.toContain('INR');
    expect(text).toContain('Computer-generated invoice');
    expect(text).toContain('A Signer');
  });

  it('prints the supply type from the snapshot, including the old-invoice fallback', async () => {
    const fallback = await renderTaxInvoicePdf(model);
    expect(visibleText(fallback)).toContain('Supply type');
    expect(visibleText(fallback)).toContain('Intra-state');
    expect(visibleText(fallback)).toContain('76.20');

    const intra = await renderTaxInvoicePdf({
      ...model,
      tax: {
        grossAmount: 99900,
        taxableAmount: 84662,
        taxAmount: 15238,
        cgst: 7619,
        sgst: 7619,
        igst: 0,
        taxRate: 18,
        supplyType: 'INTRA_STATE',
      },
    });
    const intraText = visibleText(intra);
    expect(intraText).toContain('Intra-state');
    expect(intraText).toContain('846.62');
    expect(intraText).toContain('CGST @ 9%');
    expect(intraText).toContain('SGST @ 9%');
    expect(intraText).not.toContain('IGST');

    const inter = await renderTaxInvoicePdf({
      ...model,
      tax: {
        ...model.tax,
        cgst: 0,
        sgst: 0,
        igst: 15239,
        supplyType: 'INTER_STATE',
      },
    });
    const interText = visibleText(inter);
    expect(interText).toContain('Inter-state');
    expect(interText).toContain('IGST @ 18%');

    const derivedInter = await renderTaxInvoicePdf({
      ...model,
      tax: {
        ...model.tax,
        cgst: 0,
        sgst: 0,
        igst: 15239,
      },
    });
    expect(visibleText(derivedInter)).toContain('Inter-state');
  });

  it('prints IGST for an interstate snapshot', async () => {
    const pdf = await renderTaxInvoicePdf({
      ...model,
      tax: {
        ...model.tax,
        cgst: 0,
        sgst: 0,
        igst: 15239,
      },
    });
    const text = visibleText(pdf);
    expect(text).toContain('152.39');
    expect(text).toContain('IGST');
  });
});

function visibleText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const parts: string[] = [];
  const hex = /<([0-9A-Fa-f]+)>/g;
  for (const match of raw.matchAll(hex)) {
    parts.push(Buffer.from(match[1], 'hex').toString('latin1'));
  }
  return parts.join('');
}
