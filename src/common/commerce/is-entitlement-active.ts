import { EntitlementStatus } from '../enums/entitlement-status.enum';

export type EntitlementActiveInput = {
  status: EntitlementStatus | string;
  expiresAt?: Date | null;
};

/**
 * Pure check: entitlement is currently usable for access decisions.
 * Lazy expiry: ACTIVE with expiresAt in the past is treated as inactive.
 * expiresAt null = lifetime.
 */
export function isEntitlementCurrentlyActive(
  entitlement: EntitlementActiveInput,
  now: Date = new Date(),
): boolean {
  if (entitlement.status !== EntitlementStatus.ACTIVE) {
    return false;
  }
  if (entitlement.expiresAt == null) {
    return true;
  }
  return entitlement.expiresAt.getTime() > now.getTime();
}
