export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Redis key prefixes are compared in lowercase. */
export function trimLowerString({ value }: { value: unknown }): unknown {
  const trimmed = trimString({ value });
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
}

/** Blank strings clear an optional URL. Non-strings are left for validation. */
export function normalizeOptionalUrl({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
