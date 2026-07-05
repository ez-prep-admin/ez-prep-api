import { splitRepeatedInlineNumbering } from './inline-duplicate-split.util';

describe('splitRepeatedInlineNumbering', () => {
  it('splits a repeated 1..N cycle into questions and solutions', () => {
    const result = splitRepeatedInlineNumbering([
      { number: 1, content: 'Q1' },
      { number: 2, content: 'Q2' },
      { number: 3, content: 'Q3' },
      { number: 1, content: 'A1' },
      { number: 2, content: 'A2' },
      { number: 3, content: 'A3' },
    ]);

    expect(result.split).toBe(true);
    expect(result.questions).toEqual([
      { number: 1, content: 'Q1' },
      { number: 2, content: 'Q2' },
      { number: 3, content: 'Q3' },
    ]);
    expect(result.solutions).toEqual([
      { number: 1, content: 'A1' },
      { number: 2, content: 'A2' },
      { number: 3, content: 'A3' },
    ]);
  });

  it('does not split non-repeated numbering', () => {
    const parsed = [
      { number: 1, content: 'Q1' },
      { number: 2, content: 'Q2' },
      { number: 3, content: 'Q3' },
    ];

    const result = splitRepeatedInlineNumbering(parsed);

    expect(result.split).toBe(false);
    expect(result.questions).toBe(parsed);
    expect(result.solutions).toEqual([]);
  });

  it('does not split when repeated numbers are not a full matching cycle', () => {
    const parsed = [
      { number: 1, content: 'Q1' },
      { number: 2, content: 'Q2' },
      { number: 1, content: 'Another Q1' },
      { number: 3, content: 'Q3' },
    ];

    const result = splitRepeatedInlineNumbering(parsed);

    expect(result.split).toBe(false);
    expect(result.questions).toBe(parsed);
  });
});
