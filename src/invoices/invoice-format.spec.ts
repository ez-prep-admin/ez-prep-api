import {
  formatInvoiceNumber,
  formatIstDateTime,
  formatPaiseAsRupees,
  indianFinancialYearLabel,
  invoicePdfFilename,
} from './invoice-format';

describe('invoice format', () => {
  it('uses the Indian financial year in Asia/Kolkata', () => {
    expect(indianFinancialYearLabel(new Date('2026-03-31T18:29:59.000Z'))).toBe(
      '2025-26',
    );
    expect(indianFinancialYearLabel(new Date('2026-03-31T18:30:00.000Z'))).toBe(
      '2026-27',
    );
    expect(indianFinancialYearLabel(new Date('2026-10-09T12:00:00.000Z'))).toBe(
      '2026-27',
    );
  });

  it('formats the FY series and keeps sequences past 9999', () => {
    expect(formatInvoiceNumber('EZPREP', '2026-27', 1)).toBe(
      'EZPREP/2026-27/0001',
    );
    expect(formatInvoiceNumber('SERIES', '2025-26', 10000)).toBe(
      'SERIES/2025-26/10000',
    );
  });

  it('formats paise as rupees without binary fractions', () => {
    expect(formatPaiseAsRupees(84661)).toBe('846.61');
    expect(formatPaiseAsRupees(15239)).toBe('152.39');
    expect(formatPaiseAsRupees(7619)).toBe('76.19');
    expect(formatPaiseAsRupees(7620)).toBe('76.20');
    expect(formatPaiseAsRupees(99900)).toBe('999.00');
    expect(formatPaiseAsRupees(0)).toBe('0.00');
  });

  it('labels the issue time in IST and makes a safe filename', () => {
    expect(formatIstDateTime(new Date('2026-10-09T12:00:00.000Z'))).toContain(
      'IST',
    );
    expect(invoicePdfFilename('EZPREP/2026-27/0001')).toBe(
      'EZPREP-2026-27-0001.pdf',
    );
  });
});
