const IST = 'Asia/Kolkata';

/**
 * Indian financial year label for an instant, evaluated in Asia/Kolkata.
 * 31 Mar 23:59 IST is the previous FY. 1 Apr 00:00 IST starts the next one.
 */
export function indianFinancialYearLabel(issuedAt: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(issuedAt);
  const year = Number(part(parts, 'year'));
  const month = Number(part(parts, 'month'));
  const startYear = month >= 4 ? year : year - 1;
  const endYear = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYear}`;
}

/** `PREFIX/YYYY-YY/0001`. Sequences past 9999 stay unpadded beyond 4 digits. */
export function formatInvoiceNumber(
  prefix: string,
  financialYear: string,
  sequence: number,
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Invoice sequence must be a positive integer');
  }
  return `${prefix}/${financialYear}/${String(sequence).padStart(4, '0')}`;
}

/** Integer paise to a rupee string. 84661 → `846.61`. */
export function formatPaiseAsRupees(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new Error('paise must be an integer');
  }
  const sign = paise < 0 ? '-' : '';
  const absolute = Math.abs(paise);
  const rupees = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${rupees}.${fraction}`;
}

export function formatIstDateTime(issuedAt: Date): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(issuedAt);
  return `${formatted} IST`;
}

export function invoicePdfFilename(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/\//g, '-')}.pdf`;
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const value = parts.find(item => item.type === type)?.value;
  if (!value) {
    throw new Error(`Missing ${type} in IST date parts`);
  }
  return value;
}
