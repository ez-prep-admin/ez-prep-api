const SENSITIVE_KEY =
  /secret|signature|token|password|authorization|card|vpa|cvv/i;

/** Drops sensitive keys from audit before/after payloads. Nested objects are walked. */
export function redactAuditPayload(
  value: object | undefined,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }
  return redactValue(value) as Record<string, unknown>;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactValue(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      continue;
    }
    redacted[key] = redactValue(child);
  }
  return redacted;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}
