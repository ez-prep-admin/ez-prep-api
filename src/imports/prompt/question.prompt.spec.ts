import {
  buildBatchQuestionUserPrompt,
  buildQuestionUserPrompt,
} from './question.prompt';

describe('question.prompt', () => {
  it('includes solution when present and a fallback when missing', () => {
    const withSolution = buildQuestionUserPrompt({
      number: 1,
      question: 'What is 2+2?',
      solution: '4',
    });
    expect(withSolution).toContain('SOLUTION BLOCK:\n4');

    const without = buildQuestionUserPrompt({
      number: 2,
      question: 'Q',
      solution: undefined,
    });
    expect(without).toContain('No solution provided');
  });

  it('builds a batch prompt with and without solutions', () => {
    const prompt = buildBatchQuestionUserPrompt([
      { number: 1, question: 'Q1', solution: 'S1' },
      { number: 2, question: 'Q2' },
    ]);
    expect(prompt).toContain('Question 1');
    expect(prompt).toContain('S1');
    expect(prompt).toContain('No solution provided.');
    expect(prompt).toContain('2 questions');
  });
});
