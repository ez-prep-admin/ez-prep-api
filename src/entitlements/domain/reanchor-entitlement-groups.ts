import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { expiresAtFromDurationPreset } from '../../common/commerce/duration-preset';

export type ReanchorGroup = {
  orderId: string;
  startsAt: Date;
  expiresAt: Date | null;
  durationPreset: DurationPreset;
};

export type ReanchorPlan = {
  orderId: string;
  previousStartsAt: Date;
  startsAt: Date;
  expiresAt: Date | null;
};

/**
 * Move later stacked purchases earlier after an earlier purchase is removed.
 * A start only moves earlier. A group that has already started stays put.
 */
export function reanchorEntitlementGroups(
  groups: ReanchorGroup[],
  now: Date,
): ReanchorPlan[] {
  const ordered = [...groups].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );
  let cursor = new Date(now.getTime());
  const plans: ReanchorPlan[] = [];

  for (const group of ordered) {
    if (group.startsAt.getTime() <= now.getTime()) {
      if (group.expiresAt == null) {
        break;
      }
      if (group.expiresAt.getTime() > cursor.getTime()) {
        cursor = new Date(group.expiresAt.getTime());
      }
      continue;
    }

    const startsAt = new Date(cursor.getTime());
    if (startsAt.getTime() >= group.startsAt.getTime()) {
      if (group.expiresAt == null) {
        break;
      }
      cursor = new Date(group.expiresAt.getTime());
      continue;
    }

    if (group.durationPreset === DurationPreset.LIFETIME) {
      plans.push({
        orderId: group.orderId,
        previousStartsAt: group.startsAt,
        startsAt,
        expiresAt: null,
      });
      break;
    }

    const expiresAt = expiresAtFromDurationPreset(
      group.durationPreset,
      startsAt,
    );
    plans.push({
      orderId: group.orderId,
      previousStartsAt: group.startsAt,
      startsAt,
      expiresAt,
    });
    if (expiresAt == null) {
      break;
    }
    cursor = new Date(expiresAt.getTime());
  }

  return plans;
}
