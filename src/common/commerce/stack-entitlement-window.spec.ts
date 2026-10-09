import { DurationPreset } from '../enums/duration-preset.enum';
import { stackEntitlementWindow } from './stack-entitlement-window';

describe('stackEntitlementWindow', () => {
  const now = new Date('2026-06-15T10:00:00.000Z');

  it('starts at now when nothing overlaps', () => {
    const window = stackEntitlementWindow(DurationPreset.ONE_MONTH, now, []);

    expect(window.startsAt.toISOString()).toBe('2026-06-15T10:00:00.000Z');
    expect(window.expiresAt?.toISOString()).toBe('2026-07-15T10:00:00.000Z');
  });

  it('extends a finite window from the current expiresAt', () => {
    const currentEnd = new Date('2026-08-01T00:00:00.000Z');
    const window = stackEntitlementWindow(DurationPreset.ONE_MONTH, now, [
      { expiresAt: currentEnd },
    ]);

    expect(window.startsAt.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(window.expiresAt?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('uses the latest future expiresAt when several rows overlap', () => {
    const window = stackEntitlementWindow(DurationPreset.THREE_MONTHS, now, [
      { expiresAt: new Date('2026-07-01T00:00:00.000Z') },
      { expiresAt: new Date('2026-12-01T00:00:00.000Z') },
    ]);

    expect(window.startsAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(window.expiresAt?.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });

  it('ignores an expiresAt that is already past', () => {
    const window = stackEntitlementWindow(DurationPreset.ONE_MONTH, now, [
      { expiresAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);

    expect(window.startsAt.toISOString()).toBe(now.toISOString());
    expect(window.expiresAt?.toISOString()).toBe('2026-07-15T10:00:00.000Z');
  });

  it('returns a lifetime window for a LIFETIME preset', () => {
    const window = stackEntitlementWindow(DurationPreset.LIFETIME, now, [
      { expiresAt: new Date('2026-08-01T00:00:00.000Z') },
    ]);

    expect(window.startsAt.toISOString()).toBe(now.toISOString());
    expect(window.expiresAt).toBeNull();
  });

  it('keeps lifetime when an overlapping row never expires', () => {
    const window = stackEntitlementWindow(DurationPreset.ONE_MONTH, now, [
      { expiresAt: null },
      { expiresAt: new Date('2026-08-01T00:00:00.000Z') },
    ]);

    expect(window.expiresAt).toBeNull();
    expect(window.startsAt.toISOString()).toBe(now.toISOString());
  });

  it('documents UTC month-end overflow for 31 Jan + 1M', () => {
    const jan31 = new Date('2026-01-31T10:00:00.000Z');
    const window = stackEntitlementWindow(DurationPreset.ONE_MONTH, jan31, []);

    expect(window.startsAt.toISOString()).toBe('2026-01-31T10:00:00.000Z');
    expect(window.expiresAt?.toISOString()).toBe('2026-03-03T10:00:00.000Z');
  });
});
