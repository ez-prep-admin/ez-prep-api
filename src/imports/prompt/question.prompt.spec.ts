import {
  BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
  QUESTION_EXTRACTION_SYSTEM_PROMPT,
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

  it('builds a batch prompt with solution blocks and a closing label reminder', () => {
    const prompt = buildBatchQuestionUserPrompt([
      { number: 1, question: 'Q1', solution: 'S1' },
      { number: 2, question: 'Q2' },
    ]);
    expect(prompt).toContain('Question 1');
    expect(prompt).toContain('S1');
    expect(prompt).toContain('No solution provided.');
    expect(prompt).toContain('2 questions');
    expect(prompt.indexOf('Question 1')).toBeLessThan(
      prompt.indexOf('FINAL CHECK'),
    );
    expect(prompt).toContain('Do not mark every question as "a"');
  });

  it('puts answer-label rules at the start and end of system prompts', () => {
    for (const prompt of [
      QUESTION_EXTRACTION_SYSTEM_PROMPT,
      BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
    ]) {
      expect(prompt).toContain('CRITICAL — answer labels');
      expect(prompt).toContain('FINAL CHECK — before you output JSON');
      expect(prompt.indexOf('CRITICAL — answer labels')).toBeLessThan(
        prompt.indexOf('FINAL CHECK — before you output JSON'),
      );
      expect(prompt).toContain('Never move the correct choice onto (a)');
    }

    expect(buildQuestionUserPrompt({ number: 1, question: 'Q' })).toContain(
      'FINAL CHECK — before you output JSON',
    );
  });
});
