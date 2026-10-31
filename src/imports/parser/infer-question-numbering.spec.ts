import { inferQuestionNumberingPattern } from './infer-question-numbering';

describe('inferQuestionNumberingPattern', () => {
  it('keeps 1. numbering when nested itemize lines are more numerous', () => {
    const markdown = [
      '1. First question',
      '\\item[1] statement',
      '\\item[2] statement',
      '\\item[3] statement',
      '2. Second question',
      '\\item[1] statement',
      '\\item[2] statement',
      '## SOLUTIONS',
      '1. Answer',
    ].join('\n');

    expect(inferQuestionNumberingPattern(markdown)?.regex).toBe(
      '^(\\d+)\\.\\s',
    );
  });

  it('uses itemize numbering when that is the only question pattern', () => {
    const markdown = [
      '\\item[1] First stem',
      '\\item[(a)] one',
      '\\item[2] Second stem',
      '\\item[(b)] two',
      '\\section*{ANSWERS}',
      '1 (b)',
    ].join('\n');

    expect(inferQuestionNumberingPattern(markdown)?.regex).toBe(
      '^\\\\item\\[(\\d+)\\]',
    );
  });
});
