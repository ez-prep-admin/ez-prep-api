import { DurationPreset } from '../enums/duration-preset.enum';
import { expiresAtFromDurationPreset } from './duration-preset';

export type StackingCoverageRow = {
  /** null or undefined means lifetime coverage. */
  expiresAt?: Date | null;
};

export type StackingWindow = {
  startsAt: Date;
  expiresAt: Date | null;
};

/**
 * Duration stacking for a paid entitlement (D-09).
 *
 * Clock: UTC calendar months, same as `expiresAtFromDurationPreset` / admin grants.
 * This does not use IST. IST is only for invoice financial-year numbering (phase 10).
 *
 * `Date.setUTCMonth` overflow is intentional and shared with admin grants (R-11).
 * Example: 31 Jan 2026 + 1 month is 3 Mar 2026, because February has no 31st.
 *
 * Anchor: the latest `expiresAt` still after `now`. A missing `expiresAt` on any
 * overlapping row, or a LIFETIME preset, makes the new window lifetime
 * (`expiresAt = null`) starting at `now`. Otherwise a finite window starts at
 * that anchor, or at `now` when nothing overlaps.
 */
export function stackEntitlementWindow(
  durationPreset: DurationPreset,
  now: Date,
  overlapping: StackingCoverageRow[],
): StackingWindow {
  const startsAt = new Date(now.getTime());
  const lifetime =
    durationPreset === DurationPreset.LIFETIME ||
    overlapping.some(row => row.expiresAt == null);

  if (lifetime) {
    return { startsAt, expiresAt: null };
  }

  let anchor: Date | null = null;
  for (const row of overlapping) {
    const expiresAt = row.expiresAt;
    if (!(expiresAt instanceof Date)) {
      continue;
    }
    if (expiresAt.getTime() <= now.getTime()) {
      continue;
    }
    if (!anchor || expiresAt.getTime() > anchor.getTime()) {
      anchor = expiresAt;
    }
  }

  if (!anchor) {
    return {
      startsAt,
      expiresAt: expiresAtFromDurationPreset(durationPreset, startsAt),
    };
  }

  const stackedStart = new Date(anchor.getTime());
  return {
    startsAt: stackedStart,
    expiresAt: expiresAtFromDurationPreset(durationPreset, stackedStart),
  };
}
