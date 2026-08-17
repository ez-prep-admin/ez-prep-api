import { UserRole } from '../common/enums/user-role.enum';

/** Learner role that this module is allowed to return. Never `admin`. */
export const APP_USER_ROLE = UserRole.USER;

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(value: string): string {
  return value.replace(REGEX_SPECIAL_CHARS, '\\$&');
}

/**
 * Mongo filter for the admin learners directory.
 *
 * `role` is hardcoded to `user`. Callers cannot pass a role override — any
 * extra `role` on `overrides` is ignored so admins cannot leak into this list.
 */
export function buildAppUserFilter(
  search?: string,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ...(overrides ?? {}),
    role: APP_USER_ROLE,
    isDeleted: { $ne: true },
  };

  const term = search?.trim();
  if (term) {
    const regex = { $regex: escapeRegex(term), $options: 'i' };
    filter.$or = [{ name: regex }, { email: regex }, { phoneNumber: regex }];
  }

  return filter;
}

export function isAppUserRole(role: unknown): role is UserRole.USER {
  return role === UserRole.USER;
}

export function excludeNonAppUsers<T extends { role?: unknown }>(
  users: T[],
): T[] {
  return users.filter(user => isAppUserRole(user.role));
}

export function clampPage(page: number): number {
  if (!Number.isFinite(page)) {
    return 1;
  }
  return Math.max(1, Math.trunc(page));
}

export function clampLimit(limit: number, max = 100): number {
  if (!Number.isFinite(limit)) {
    return 10;
  }
  return Math.min(Math.max(1, Math.trunc(limit)), max);
}

/**
 * Masks an email so the local part is never returned in full.
 * `anita.sharma@gmail.com` → `a***@gmail.com`
 *
 * Keeps the first character of the local part and the full domain.
 * Search still matches the stored value in Mongo; only the response is masked.
 * Values that are already masked (contain `*`) are returned unchanged.
 */
export function maskEmail(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const email = value.trim();
  if (!email) {
    return '';
  }
  if (email.includes('*')) {
    return email;
  }

  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return `${email[0]}***`;
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const lead = local[0] && /[a-z0-9]/i.test(local[0]) ? local[0] : '*';

  return `${lead}***@${domain}`;
}

function countryCodeDigitCount(digits: string, hadPlus: boolean): number {
  if (digits.startsWith('91') && digits.length >= 12) {
    return 2;
  }
  if (!hadPlus) {
    return 0;
  }
  if (digits.startsWith('1') && digits.length === 11) {
    return 1;
  }
  if (digits.length >= 13) {
    return 3;
  }
  if (digits.length === 12) {
    return 2;
  }
  if (digits.length === 11) {
    return 1;
  }
  return Math.min(digits.length, 2);
}

/**
 * Masks a phone number so the subscriber digits never leave the API.
 * `+919876543210` → `+91**********`
 *
 * Keeps a leading `+` and the country code (e.g. `91`), then masks the rest.
 * Values that are already masked (contain `*`) are returned unchanged.
 */
export function maskPhoneNumber(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const phone = value.trim();
  if (!phone) {
    return undefined;
  }
  if (phone.includes('*')) {
    return phone;
  }

  const plus = phone.startsWith('+') ? '+' : '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) {
    return `${plus}****`;
  }

  const ccLen = countryCodeDigitCount(digits, plus === '+');
  const country = digits.slice(0, ccLen);
  const rest = digits.slice(ccLen);
  const maskedLocal =
    rest.length === 0 ? '' : '*'.repeat(Math.max(rest.length, 2));

  if (!country && !maskedLocal) {
    return `${plus}**`;
  }

  return `${plus}${country}${maskedLocal}`;
}
