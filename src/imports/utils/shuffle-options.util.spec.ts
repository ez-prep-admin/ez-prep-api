import { ImportQuestionOption } from '../types/import-question';
import { shuffleImportOptions } from './shuffle-options.util';

function option(id: string, en: string): ImportQuestionOption {
  return { id, type: 'text', en, ml: null };
}

describe('shuffleImportOptions', () => {
  const options = [
    option('id-a', 'alpha'),
    option('id-b', 'beta'),
    option('id-c', 'gamma'),
    option('id-d', 'delta'),
  ];

  it('keeps every option and its id, and only changes order', () => {
    const shuffled = shuffleImportOptions(options, () => 0);

    expect(shuffled).toHaveLength(4);
    expect(shuffled.map(item => item.id).sort()).toEqual([
      'id-a',
      'id-b',
      'id-c',
      'id-d',
    ]);
    expect(shuffled.map(item => item.id)).not.toEqual([
      'id-a',
      'id-b',
      'id-c',
      'id-d',
    ]);
    expect(shuffled.find(item => item.id === 'id-c')?.en).toBe('gamma');
  });

  it('leaves a single option in place', () => {
    const only = [option('id-a', 'alpha')];
    expect(shuffleImportOptions(only, () => 0)).toEqual(only);
  });

  it('spreads the correct option across positions', () => {
    const counts = [0, 0, 0, 0];
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let trial = 0; trial < 400; trial += 1) {
      const shuffled = shuffleImportOptions(options, random);
      const index = shuffled.findIndex(item => item.id === 'id-a');
      counts[index] += 1;
    }

    for (const count of counts) {
      expect(count).toBeGreaterThan(60);
    }
  });
});
