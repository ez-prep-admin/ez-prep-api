export function duplicateField(error: unknown): string | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code: number }).code !== 11000
  ) {
    return undefined;
  }

  const keyPattern = (error as { keyPattern?: Record<string, unknown> })
    .keyPattern;
  if (!keyPattern) {
    return undefined;
  }
  return Object.keys(keyPattern)[0];
}
