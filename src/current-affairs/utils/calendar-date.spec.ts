import {
  CALENDAR_DATE_PATTERN,
  IsCalendarDate,
  IsCalendarDateConstraint,
  isCalendarDate,
} from './calendar-date';

describe('isCalendarDate', () => {
  it('accepts a real YYYY-MM-DD date', () => {
    expect(isCalendarDate('2026-08-14')).toBe(true);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2000-01-01')).toBe(true);
  });

  it('rejects non-strings and empty values', () => {
    expect(isCalendarDate(undefined)).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
    expect(isCalendarDate(20260814)).toBe(false);
    expect(isCalendarDate('')).toBe(false);
    expect(isCalendarDate(' 2026-08-14 ')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isCalendarDate('2026/08/14')).toBe(false);
    expect(isCalendarDate('26-08-14')).toBe(false);
    expect(isCalendarDate('2026-8-14')).toBe(false);
    expect(isCalendarDate('2026-08-14T00:00:00Z')).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    expect(isCalendarDate('2026-02-31')).toBe(false);
    expect(isCalendarDate('2025-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-00-10')).toBe(false);
    expect(isCalendarDate('2026-04-31')).toBe(false);
    expect(isCalendarDate('2026-08-00')).toBe(false);
  });

  it('exposes the YYYY-MM-DD pattern', () => {
    expect(CALENDAR_DATE_PATTERN.test('2026-08-14')).toBe(true);
    expect(CALENDAR_DATE_PATTERN.test('2026-2-1')).toBe(false);
  });
});

describe('IsCalendarDateConstraint', () => {
  const constraint = new IsCalendarDateConstraint();

  it('delegates to isCalendarDate', () => {
    expect(constraint.validate('2026-08-14')).toBe(true);
    expect(constraint.validate('2026-02-31')).toBe(false);
  });

  it('provides a default message', () => {
    expect(constraint.defaultMessage()).toBe(
      'date must be a valid calendar date in YYYY-MM-DD format',
    );
  });

  it('registers the decorator', () => {
    class Sample {
      @IsCalendarDate()
      date: string;
    }
    expect(new Sample()).toBeDefined();
  });

  it('accepts validation options', () => {
    class Sample {
      @IsCalendarDate({ message: 'bad date' })
      date: string;
    }
    expect(new Sample()).toBeDefined();
  });
});
