import { extractMarkdownSample } from './structure-detection.prompt';

describe('extractMarkdownSample', () => {
  it('includes a symmetric tail sample when no solution marker exists', () => {
    const head = Array.from({ length: 12 }, (_, index) =>
      index % 3 === 0
        ? `${index / 3 + 1}. Question ${index / 3 + 1}`
        : `line ${index}`,
    );
    const middle = Array.from({ length: 30 }, (_, index) => `middle ${index}`);
    const tail = Array.from({ length: 12 }, (_, index) =>
      index % 3 === 0
        ? `${index / 3 + 1}. Answer ${index / 3 + 1}`
        : `answer line ${index}`,
    );
    const markdown = [...head, ...middle, ...tail].join('\n');

    const sample = extractMarkdownSample(markdown, {
      targetQuestions: 3,
      maxLines: 200,
      maxChars: 10000,
    });

    expect(sample).toContain('[Document tail sample]');
    expect(sample).toContain('1. Question 1');
    expect(sample).toContain('3. Answer 3');
    expect(sample).not.toContain('middle 15');
  });

  it('treats Q.N lines as question starts for head sampling', () => {
    const markdown = [
      'Q.48. First question',
      '(a) 1',
      'Q.49. Second question',
      '(a) 1',
      'Q.50. Third question',
      '(a) 1',
      ...'filler'.repeat(40).split(''),
      'Sol.48.(d) answer',
      'Sol.49.(c) answer',
    ].join('\n');

    const sample = extractMarkdownSample(markdown, {
      targetQuestions: 2,
      maxLines: 200,
      maxChars: 10000,
    });

    expect(sample).toContain('Q.48.');
    expect(sample).toContain('Q.49.');
    expect(sample).toContain('[Document tail sample]');
    expect(sample).toContain('Sol.48.(d)');
  });

  it('prefers a known solutions marker snippet over the tail sample', () => {
    const markdown = [
      '1. Question one',
      '2. Question two',
      '## SOLUTIONS',
      '1. Answer one',
      '2. Answer two',
    ].join('\n');

    const sample = extractMarkdownSample(markdown, { targetQuestions: 2 });

    expect(sample).toContain('[Solutions section sample]');
    expect(sample).toContain('## SOLUTIONS');
    expect(sample).not.toContain('[Document tail sample]');
  });

  it('skips the tail sample when the document is too short to avoid overlap', () => {
    const markdown = [
      '1. Question one',
      '2. Question two',
      '3. Question three',
    ].join('\n');

    const sample = extractMarkdownSample(markdown, { targetQuestions: 3 });

    expect(sample).not.toContain('[Document tail sample]');
  });
});
