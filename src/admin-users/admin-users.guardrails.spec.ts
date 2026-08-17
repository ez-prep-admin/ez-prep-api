import { UserRole } from '../common/enums/user-role.enum';
import {
  APP_USER_ROLE,
  buildAppUserFilter,
  clampLimit,
  clampPage,
  escapeRegex,
  excludeNonAppUsers,
  isAppUserRole,
  maskEmail,
  maskPhoneNumber,
} from './admin-users.guardrails';

describe('admin-users guardrails', () => {
  describe('APP_USER_ROLE', () => {
    it('is hardcoded to learner, never admin', () => {
      expect(APP_USER_ROLE).toBe(UserRole.USER);
      expect(APP_USER_ROLE).not.toBe(UserRole.ADMIN);
    });
  });

  describe('escapeRegex', () => {
    it('escapes special characters so search cannot become a regex injection', () => {
      expect(escapeRegex('a+b?c')).toBe('a\\+b\\?c');
      expect(escapeRegex('file.txt')).toBe('file\\.txt');
    });
  });

  describe('buildAppUserFilter', () => {
    it('always pins role to user and excludes deleted documents', () => {
      expect(buildAppUserFilter()).toEqual({
        role: UserRole.USER,
        isDeleted: { $ne: true },
      });
    });

    it('ignores any attempt to override role to admin', () => {
      const filter = buildAppUserFilter(undefined, {
        role: UserRole.ADMIN,
        extra: true,
      });
      expect(filter.role).toBe(UserRole.USER);
      expect(filter.role).not.toBe(UserRole.ADMIN);
      expect(filter.extra).toBe(true);
    });

    it('adds a case-insensitive search across name, email, and phone', () => {
      const filter = buildAppUserFilter('  Anita+  ');
      expect(filter.role).toBe(UserRole.USER);
      expect(filter.$or).toEqual([
        { name: { $regex: 'Anita\\+', $options: 'i' } },
        { email: { $regex: 'Anita\\+', $options: 'i' } },
        { phoneNumber: { $regex: 'Anita\\+', $options: 'i' } },
      ]);
    });

    it('ignores blank search strings', () => {
      expect(buildAppUserFilter('   ')).not.toHaveProperty('$or');
      expect(buildAppUserFilter('')).not.toHaveProperty('$or');
    });
  });

  describe('isAppUserRole / excludeNonAppUsers', () => {
    it('accepts only the exact learner role', () => {
      expect(isAppUserRole(UserRole.USER)).toBe(true);
      expect(isAppUserRole(UserRole.ADMIN)).toBe(false);
      expect(isAppUserRole('ADMIN')).toBe(false);
      expect(isAppUserRole(undefined)).toBe(false);
      expect(isAppUserRole(null)).toBe(false);
    });

    it('drops admin rows and rows with a missing role', () => {
      const kept = excludeNonAppUsers([
        { id: '1', role: UserRole.USER },
        { id: '2', role: UserRole.ADMIN },
        { id: '3' },
        { id: '4', role: 'admin' },
      ]);
      expect(kept).toEqual([{ id: '1', role: UserRole.USER }]);
    });
  });

  describe('clampPage / clampLimit', () => {
    it('clamps page to a positive integer', () => {
      expect(clampPage(0)).toBe(1);
      expect(clampPage(-4)).toBe(1);
      expect(clampPage(2.9)).toBe(2);
      expect(clampPage(Number.NaN)).toBe(1);
    });

    it('clamps limit between 1 and 100', () => {
      expect(clampLimit(0)).toBe(1);
      expect(clampLimit(12)).toBe(12);
      expect(clampLimit(250)).toBe(100);
      expect(clampLimit(Number.NaN)).toBe(10);
    });
  });

  describe('maskEmail', () => {
    it('keeps the first letter and the full domain', () => {
      expect(maskEmail('anita@example.com')).toBe('a***@example.com');
      expect(maskEmail('Anita.Sharma@Gmail.COM')).toBe('A***@Gmail.COM');
      expect(maskEmail('ab@x.io')).toBe('a***@x.io');
      expect(maskEmail('a@b.co')).toBe('a***@b.co');
    });

    it('never returns the original local part', () => {
      const original = 'anita.sharma@gmail.com';
      const masked = maskEmail(original);
      expect(masked).toBe('a***@gmail.com');
      expect(masked).not.toBe(original);
      expect(masked).not.toContain('anita.sharma');
    });

    it('handles missing, blank, and malformed values', () => {
      expect(maskEmail(undefined)).toBe('');
      expect(maskEmail(null)).toBe('');
      expect(maskEmail(1)).toBe('');
      expect(maskEmail('   ')).toBe('');
      expect(maskEmail('no-at-sign')).toBe('n***');
      expect(maskEmail('@nodomain.com')).toBe('@***');
      expect(maskEmail('local@')).toBe('l***');
    });

    it('does not remask an already masked email', () => {
      expect(maskEmail('a***@gmail.com')).toBe('a***@gmail.com');
    });
  });

  describe('maskPhoneNumber', () => {
    it('keeps the country code and masks the subscriber digits', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+91**********');
      expect(maskPhoneNumber('9876543210')).toBe('**********');
      expect(maskPhoneNumber('+1 (415) 555-0199')).toBe('+1**********');
    });

    it('never returns the original subscriber number', () => {
      const original = '+919876543210';
      const masked = maskPhoneNumber(original);
      expect(masked).toBe('+91**********');
      expect(masked).not.toBe(original);
      expect(masked).not.toContain('9876543210');
    });

    it('handles missing, blank, and very short values', () => {
      expect(maskPhoneNumber(undefined)).toBeUndefined();
      expect(maskPhoneNumber(null)).toBeUndefined();
      expect(maskPhoneNumber('')).toBeUndefined();
      expect(maskPhoneNumber('   ')).toBeUndefined();
      expect(maskPhoneNumber('+')).toBe('+****');
      expect(maskPhoneNumber('12')).toBe('**');
      expect(maskPhoneNumber('+9')).toBe('+9');
    });

    it('does not remask an already masked phone', () => {
      expect(maskPhoneNumber('+91**********')).toBe('+91**********');
    });
  });
});
