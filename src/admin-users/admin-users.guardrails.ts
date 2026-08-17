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
