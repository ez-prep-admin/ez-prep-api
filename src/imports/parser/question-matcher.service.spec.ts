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
