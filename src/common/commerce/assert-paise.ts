/**
 * Assert value is a non-negative integer paise amount.
 * Returns the value for chaining; throws Error with message if invalid.
 */
export function assertPaise(value: number, fieldName = 'amount'): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer (paise)`);
  }
  return value;
}

export function isValidPaise(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
