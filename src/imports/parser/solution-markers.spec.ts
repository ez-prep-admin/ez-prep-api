import { findSolutionMarker } from './solution-markers';

describe('findSolutionMarker', () => {
  it('splits at the answers heading instead of a later hints heading', () => {
    const markdown = [
      '\\item[1] Question',
      '\\section*{ANSWERS}',
      '1 (b)',
      '\\section*{Hints and Explanations}',
      '\\item[1] Hint',
    ].join('\n');

    expect(findSolutionMarker(markdown)).toBe('\\section*{ANSWERS}');
  });

  it('keeps the longer heading when a shorter prefix starts at the same place', () => {
    const markdown = 'body\n\\section*{ANSWERS AND SOLUTIONS}\n1. (a)';

    expect(findSolutionMarker(markdown)).toBe(
      '\\section*{ANSWERS AND SOLUTIONS}',
    );
  });

  it('ignores Answers: inside a question when a section heading exists later', () => {
    const markdown = [
      '1. The word Answers: appears in the stem',
      '2. Next',
      '## SOLUTIONS',
      '1. Because',
    ].join('\n');

    expect(findSolutionMarker(markdown)).toBe('## SOLUTIONS');
  });

  it('keeps ## SOLUTIONS when an earlier ## ANSWERS heading is also present', () => {
    const markdown = [
      '1. Question one',
      '## ANSWERS',
      '1. This block is still part of the paper',
      '2. Question two',
      '## SOLUTIONS',
      '1. Real answer',
    ].join('\n');

    expect(findSolutionMarker(markdown)).toBe('## SOLUTIONS');
  });

  it('keeps the longer markdown heading over its shorter prefix', () => {
    const markdown = 'body\n## ANSWERS AND SOLUTIONS\n1. (a)';

    expect(findSolutionMarker(markdown)).toBe('## ANSWERS AND SOLUTIONS');
  });
});
