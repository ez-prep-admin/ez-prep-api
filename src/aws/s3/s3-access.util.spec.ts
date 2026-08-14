import { BadRequestException } from '@nestjs/common';
import {
  assertAllowedBucket,
  assertSafeImageKey,
  assertSafeS3Key,
  isSafeImageKey,
} from './s3-access.util';

describe('s3-access.util', () => {
  describe('assertSafeS3Key', () => {
    it('should return trimmed keys', () => {
      expect(assertSafeS3Key('  admin-images/a.jpg  ')).toBe(
        'admin-images/a.jpg',
      );
    });

    it('should reject empty, oversized, or unsafe keys', () => {
      expect(() => assertSafeS3Key('')).toThrow(BadRequestException);
      expect(() => assertSafeS3Key('   ')).toThrow(BadRequestException);
      expect(() => assertSafeS3Key('a'.repeat(1025))).toThrow(
        BadRequestException,
      );
      expect(() => assertSafeS3Key('foo/../bar')).toThrow(BadRequestException);
      expect(() => assertSafeS3Key('foo\\bar')).toThrow(BadRequestException);
      expect(() => assertSafeS3Key('foo\0bar')).toThrow(BadRequestException);
      expect(() => assertSafeS3Key('/leading')).toThrow(BadRequestException);
    });
  });

  describe('assertSafeImageKey', () => {
    it('should allow admin-images and question-imports prefixes', () => {
      expect(assertSafeImageKey('admin-images/x.png')).toBe(
        'admin-images/x.png',
      );
      expect(assertSafeImageKey('question-imports/u/id.jpg')).toBe(
        'question-imports/u/id.jpg',
      );
    });

    it('should reject other prefixes', () => {
      expect(() => assertSafeImageKey('other/x.png')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('isSafeImageKey', () => {
    it('should return true for allowed keys and false otherwise', () => {
      expect(isSafeImageKey('admin-images/a.jpg')).toBe(true);
      expect(isSafeImageKey('../hack')).toBe(false);
    });
  });

  describe('assertAllowedBucket', () => {
    it('should return the bucket when allowed', () => {
      expect(assertAllowedBucket('  img  ', ['img'])).toBe('img');
    });

    it('should reject unknown buckets', () => {
      expect(() => assertAllowedBucket('nope', ['img'])).toThrow(
        BadRequestException,
      );
      expect(() => assertAllowedBucket(undefined as any, [])).toThrow(
        BadRequestException,
      );
    });
  });
});
