import { QuestionMatcherService } from './question-matcher.service';

describe('QuestionMatcherService', () => {
  const service = new QuestionMatcherService();

  const questions = [
    { number: 1, content: 'Q1' },
    { number: 2, content: 'Q2' },
  ];

  it('pairs questions with solutions by number', () => {
    const matched = service.match(questions, [
      { number: 1, content: 'A1' },
      { number: 2, content: 'A2' },
    ]);

    expect(matched).toEqual([
      { number: 1, question: 'Q1', solution: 'A1' },
      { number: 2, question: 'Q2', solution: 'A2' },
    ]);
  });

  it('pairs a second numbering cycle with the second solution cycle', () => {
    const matched = service.match(
      [
        { number: 1, content: 'Session 1 Q1' },
        { number: 2, content: 'Session 1 Q2' },
        { number: 1, content: 'Session 2 Q1' },
      ],
      [
        { number: 1, content: 'Hint 1a' },
        { number: 2, content: 'Hint 2a' },
        { number: 1, content: 'Hint 1b' },
      ],
    );

    expect(matched).toEqual([
      { number: 1, question: 'Session 1 Q1', solution: 'Hint 1a' },
      { number: 2, question: 'Session 1 Q2', solution: 'Hint 2a' },
      { number: 1, question: 'Session 2 Q1', solution: 'Hint 1b' },
    ]);
  });

  it('keeps the last solution when question numbers are unique', () => {
    const matched = service.match(questions, [
      { number: 1, content: 'short key' },
      { number: 2, content: 'A2' },
      { number: 1, content: 'full explanation' },
    ]);

    expect(matched).toEqual([
      { number: 1, question: 'Q1', solution: 'full explanation' },
      { number: 2, question: 'Q2', solution: 'A2' },
    ]);
  });

  it('warns on missing solutions and orphan solutions', () => {
    const result = service.matchWithWarnings(questions, [
      { number: 1, content: 'A1' },
      { number: 9, content: 'orphan' },
    ]);

    expect(result.matched[1].solution).toBeUndefined();
    expect(result.warnings.map(w => w.code)).toEqual(
      expect.arrayContaining(['ORPHAN_SOLUTION', 'MISSING_SOLUTION']),
    );
  });
});
