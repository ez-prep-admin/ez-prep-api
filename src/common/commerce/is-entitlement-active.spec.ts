import { EntitlementStatus } from '../enums/entitlement-status.enum';
import { isEntitlementCurrentlyActive } from './is-entitlement-active';

describe('isEntitlementCurrentlyActive', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('returns true for ACTIVE with null expiresAt (lifetime)', () => {
    expect(
      isEntitlementCurrentlyActive(
        { status: EntitlementStatus.ACTIVE, expiresAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('returns true for ACTIVE with future expiresAt', () => {
    expect(
      isEntitlementCurrentlyActive(
        {
          status: EntitlementStatus.ACTIVE,
          expiresAt: new Date('2026-12-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });

  it('returns false for ACTIVE with past expiresAt (lazy expiry)', () => {
    expect(
      isEntitlementCurrentlyActive(
        {
          status: EntitlementStatus.ACTIVE,
          expiresAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });

  it('returns false for REVOKED', () => {
    expect(
      isEntitlementCurrentlyActive(
        { status: EntitlementStatus.REVOKED, expiresAt: null },
        now,
      ),
    ).toBe(false);
  });

  it('returns false for EXPIRED', () => {
    expect(
      isEntitlementCurrentlyActive(
        { status: EntitlementStatus.EXPIRED, expiresAt: null },
        now,
      ),
    ).toBe(false);
  });
});
