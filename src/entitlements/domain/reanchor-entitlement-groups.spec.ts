import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { reanchorEntitlementGroups } from './reanchor-entitlement-groups';

describe('reanchorEntitlementGroups', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('moves one future group to now with its full duration when the anchor is gone', () => {
    const plans = reanchorEntitlementGroups(
      [
        {
          orderId: 'future',
          startsAt: new Date('2026-09-15T00:00:00.000Z'),
          expiresAt: new Date('2026-12-15T00:00:00.000Z'),
          durationPreset: DurationPreset.THREE_MONTHS,
        },
      ],
      now,
    );
    expect(plans).toEqual([
      {
        orderId: 'future',
        previousStartsAt: new Date('2026-09-15T00:00:00.000Z'),
        startsAt: now,
        expiresAt: new Date('2026-09-15T00:00:00.000Z'),
      },
    ]);
  });

  it('places a second future group directly after the first moved group', () => {
    const plans = reanchorEntitlementGroups(
      [
        {
          orderId: 'first',
          startsAt: new Date('2026-07-15T00:00:00.000Z'),
          expiresAt: new Date('2026-08-15T00:00:00.000Z'),
          durationPreset: DurationPreset.ONE_MONTH,
        },
        {
          orderId: 'second',
          startsAt: new Date('2026-08-15T00:00:00.000Z'),
          expiresAt: new Date('2026-09-15T00:00:00.000Z'),
          durationPreset: DurationPreset.ONE_MONTH,
        },
      ],
      now,
    );
    expect(plans.map(plan => plan.orderId)).toEqual(['first', 'second']);
    expect(plans[0].startsAt).toEqual(now);
    expect(plans[1].startsAt).toEqual(plans[0].expiresAt);
  });

  it('closes the gap when the middle group is gone', () => {
    const plans = reanchorEntitlementGroups(
      [
        {
          orderId: 'started',
          startsAt: new Date('2026-05-01T00:00:00.000Z'),
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
          durationPreset: DurationPreset.ONE_MONTH,
        },
        {
          orderId: 'later',
          startsAt: new Date('2026-09-01T00:00:00.000Z'),
          expiresAt: new Date('2026-10-01T00:00:00.000Z'),
          durationPreset: DurationPreset.ONE_MONTH,
        },
      ],
      now,
    );
    expect(plans).toHaveLength(1);
    expect(plans[0].orderId).toBe('later');
    expect(plans[0].startsAt).toEqual(new Date('2026-07-01T00:00:00.000Z'));
  });

  it('stops the walk on a lifetime group and does not move a started group', () => {
    const plans = reanchorEntitlementGroups(
      [
        {
          orderId: 'started',
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: new Date('2026-08-01T00:00:00.000Z'),
          durationPreset: DurationPreset.ONE_MONTH,
        },
        {
          orderId: 'life',
          startsAt: new Date('2026-10-01T00:00:00.000Z'),
          expiresAt: null,
          durationPreset: DurationPreset.LIFETIME,
        },
        {
          orderId: 'after-life',
          startsAt: new Date('2026-12-01T00:00:00.000Z'),
          expiresAt: new Date('2027-01-01T00:00:00.000Z'),
          durationPreset: DurationPreset.ONE_MONTH,
        },
      ],
      now,
    );
    expect(plans.map(plan => plan.orderId)).toEqual(['life']);
    expect(plans[0].expiresAt).toBeNull();
    expect(plans[0].startsAt).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  it('keeps month-end overflow from the shared duration helper', () => {
    const anchor = new Date('2026-01-31T00:00:00.000Z');
    const plans = reanchorEntitlementGroups(
      [
        {
          orderId: 'month',
          startsAt: new Date('2026-03-03T00:00:00.000Z'),
          expiresAt: new Date('2026-04-03T00:00:00.000Z'),
          durationPreset: DurationPreset.ONE_MONTH,
        },
      ],
      anchor,
    );
    expect(plans[0].startsAt).toEqual(anchor);
    expect(plans[0].expiresAt).toEqual(new Date('2026-03-03T00:00:00.000Z'));
  });
});
