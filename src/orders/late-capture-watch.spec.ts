import {
  initialLateWatch,
  nextLateWatchAt,
  nextRepairDelayMs,
} from './late-capture-watch';

describe('late capture watch', () => {
  const expiredAt = new Date('2026-10-11T00:00:00.000Z');

  it('schedules the first offset inside the watch window', () => {
    const armed = initialLateWatch(expiredAt, 72);
    expect(armed?.nextReconAt.toISOString()).toBe('2026-10-11T01:00:00.000Z');
    expect(armed?.lateWatchUntil.toISOString()).toBe(
      '2026-10-14T00:00:00.000Z',
    );
  });

  it('disables the watch when hours are 0', () => {
    expect(initialLateWatch(expiredAt, 0)).toBeNull();
    expect(nextLateWatchAt(expiredAt, 0, 0)).toBeNull();
  });

  it('walks the offset ladder and then stops', () => {
    expect(nextLateWatchAt(expiredAt, 0, 72)?.toISOString()).toBe(
      '2026-10-11T01:00:00.000Z',
    );
    expect(nextLateWatchAt(expiredAt, 1, 72)?.toISOString()).toBe(
      '2026-10-11T03:00:00.000Z',
    );
    expect(nextLateWatchAt(expiredAt, 6, 72)?.toISOString()).toBe(
      '2026-10-14T00:00:00.000Z',
    );
    expect(nextLateWatchAt(expiredAt, 7, 72)).toBeNull();
  });

  it('drops offsets past a shorter window', () => {
    expect(nextLateWatchAt(expiredAt, 2, 6)?.toISOString()).toBe(
      '2026-10-11T06:00:00.000Z',
    );
    expect(nextLateWatchAt(expiredAt, 3, 6)).toBeNull();
  });

  it('slows repair retries and stays at one hour', () => {
    expect(nextRepairDelayMs(1)).toBe(2 * 60 * 1000);
    expect(nextRepairDelayMs(2)).toBe(10 * 60 * 1000);
    expect(nextRepairDelayMs(3)).toBe(30 * 60 * 1000);
    expect(nextRepairDelayMs(4)).toBe(60 * 60 * 1000);
    expect(nextRepairDelayMs(9)).toBe(60 * 60 * 1000);
  });
});
