import { DurationPreset } from '../enums/duration-preset.enum';

/**
 * Compute entitlement expiresAt from a duration preset and start anchor.
 * Calendar months from startsAt; LIFETIME → null.
 */
export function expiresAtFromDurationPreset(
  durationPreset: DurationPreset,
  startsAt: Date,
): Date | null {
  if (durationPreset === DurationPreset.LIFETIME) {
    return null;
  }

  const expires = new Date(startsAt.getTime());
  const monthsByPreset: Record<
    Exclude<DurationPreset, DurationPreset.LIFETIME>,
    number
  > = {
    [DurationPreset.ONE_MONTH]: 1,
    [DurationPreset.THREE_MONTHS]: 3,
    [DurationPreset.SIX_MONTHS]: 6,
    [DurationPreset.TWELVE_MONTHS]: 12,
  };

  expires.setUTCMonth(expires.getUTCMonth() + monthsByPreset[durationPreset]);
  return expires;
}
