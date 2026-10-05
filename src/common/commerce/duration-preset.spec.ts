import { DurationPreset } from '../enums/duration-preset.enum';
import { expiresAtFromDurationPreset } from './duration-preset';

describe('expiresAtFromDurationPreset', () => {
  const startsAt = new Date('2026-01-15T10:00:00.000Z');

  it('returns null for LIFETIME', () => {
    expect(
      expiresAtFromDurationPreset(DurationPreset.LIFETIME, startsAt),
    ).toBeNull();
  });

  it('adds 1 calendar month for 1M', () => {
    expect(
      expiresAtFromDurationPreset(DurationPreset.ONE_MONTH, startsAt)?.toISOString(),
    ).toBe('2026-02-15T10:00:00.000Z');
  });

  it('adds 3 calendar months for 3M', () => {
    expect(
      expiresAtFromDurationPreset(
        DurationPreset.THREE_MONTHS,
        startsAt,
      )?.toISOString(),
    ).toBe('2026-04-15T10:00:00.000Z');
  });

  it('adds 12 calendar months for 12M', () => {
    expect(
      expiresAtFromDurationPreset(
        DurationPreset.TWELVE_MONTHS,
        startsAt,
      )?.toISOString(),
    ).toBe('2027-01-15T10:00:00.000Z');
  });
});
