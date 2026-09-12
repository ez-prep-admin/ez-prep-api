import {
  DESCRIPTION_MAX_POINTS,
  normalizeDescriptionForStorage,
  normalizeDescriptionFromDb,
  sanitizeDescriptionPoints,
} from './description-points';

describe('description-points', () => {
  it('sanitizes string input for legacy records', () => {
    expect(sanitizeDescriptionPoints('  One point  ')).toEqual(['One point']);
    expect(sanitizeDescriptionPoints('   ')).toEqual([]);
  });

  it('trims, removes empty entries, and caps the number of points', () => {
    const input = [
      '  first  ',
      '',
      '   ',
      'second',
      ...Array(12).fill('extra'),
    ];
    expect(sanitizeDescriptionPoints(input)).toEqual([
      'first',
      'second',
      ...Array(DESCRIPTION_MAX_POINTS - 2).fill('extra'),
    ]);
  });

  it('returns undefined when there are no points to store', () => {
    expect(normalizeDescriptionForStorage([])).toBeUndefined();
    expect(normalizeDescriptionForStorage(['   '])).toBeUndefined();
  });

  it('normalizes legacy string data from the database', () => {
    expect(normalizeDescriptionFromDb('Legacy paragraph')).toEqual([
      'Legacy paragraph',
    ]);
    expect(normalizeDescriptionFromDb(['  kept  ', ''])).toEqual(['kept']);
    expect(normalizeDescriptionFromDb(null)).toBeUndefined();
    expect(normalizeDescriptionFromDb(42)).toBeUndefined();
  });
});
