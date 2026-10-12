/** Fixed offsets from expiry. At most one provider read per offset. */
export const LATE_CAPTURE_OFFSETS_HOURS = [1, 3, 6, 12, 24, 48, 72] as const;

export type LateWatchSchedule = {
  lateWatchUntil: Date;
  nextReconAt: Date;
};

/**
 * Arms the watch when a provider-backed order expires.
 * `watchHours` of 0 disables it. Offsets past the window are not scheduled.
 */
export function initialLateWatch(
  expiredAt: Date,
  watchHours: number,
): LateWatchSchedule | null {
  if (!Number.isFinite(watchHours) || watchHours <= 0) {
    return null;
  }
  const first = LATE_CAPTURE_OFFSETS_HOURS.find(hours => hours <= watchHours);
  if (first == null) {
    return null;
  }
  return {
    lateWatchUntil: new Date(expiredAt.getTime() + watchHours * 60 * 60 * 1000),
    nextReconAt: new Date(expiredAt.getTime() + first * 60 * 60 * 1000),
  };
}

/**
 * Next check after `checksCompleted` provider reads.
 * Null means the schedule is finished and `nextReconAt` should be cleared.
 */
export function nextLateWatchAt(
  expiredAt: Date,
  checksCompleted: number,
  watchHours: number,
): Date | null {
  if (!Number.isFinite(watchHours) || watchHours <= 0) {
    return null;
  }
  const upcoming = LATE_CAPTURE_OFFSETS_HOURS.filter(
    hours => hours <= watchHours,
  );
  const next = upcoming[checksCompleted];
  if (next == null) {
    return null;
  }
  return new Date(expiredAt.getTime() + next * 60 * 60 * 1000);
}

/** Repair failures slow down and keep going: 2m, 10m, 30m, then 60m. */
const REPAIR_DELAYS_MS = [2, 10, 30, 60].map(minutes => minutes * 60 * 1000);

export function nextRepairDelayMs(attemptsAfterFailure: number): number {
  const index = Math.min(
    Math.max(attemptsAfterFailure, 1) - 1,
    REPAIR_DELAYS_MS.length - 1,
  );
  return REPAIR_DELAYS_MS[index];
}
