import { BadRequestException } from '@nestjs/common';

const ALLOWED_IMAGE_KEY_PREFIXES = ['admin-images/', 'question-imports/'];

export function assertSafeS3Key(key: string): string {
  const trimmed = key?.trim() ?? '';
  if (!trimmed || trimmed.length > 1024) {
    throw new BadRequestException('Invalid object key');
  }
  if (
    trimmed.includes('..') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0') ||
    trimmed.startsWith('/')
  ) {
    throw new BadRequestException('Invalid object key');
  }
  return trimmed;
}

export function assertSafeImageKey(key: string): string {
  const safe = assertSafeS3Key(key);
  if (!ALLOWED_IMAGE_KEY_PREFIXES.some(prefix => safe.startsWith(prefix))) {
    throw new BadRequestException('Object key is not allowed');
  }
  return safe;
}

export function isSafeImageKey(key: string): boolean {
  try {
    assertSafeImageKey(key);
    return true;
  } catch {
    return false;
  }
}

export function assertAllowedBucket(
  bucket: string,
  allowedBuckets: string[],
): string {
  const trimmed = bucket?.trim() ?? '';
  if (!allowedBuckets.includes(trimmed)) {
    throw new BadRequestException('Bucket is not allowed');
  }
  return trimmed;
}
