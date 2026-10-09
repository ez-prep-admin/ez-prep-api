import { createHash, createHmac, timingSafeEqual } from 'crypto';

export function hmacSha256Hex(
  secret: string,
  message: string | Buffer,
): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

/** Compare hex digests without leaking timing or throwing on length mismatch. */
export function signaturesMatch(
  expectedHex: string,
  provided: string,
): boolean {
  const left = Buffer.from(expectedHex.trim().toLowerCase(), 'utf8');
  const right = Buffer.from(provided.trim().toLowerCase(), 'utf8');
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function payloadSha256(raw: Buffer | string): string {
  const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  return createHash('sha256').update(body).digest('hex');
}

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}
