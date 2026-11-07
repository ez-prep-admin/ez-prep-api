import { AdaptiveBoundaryStrategy } from './boundaries/adaptive-boundary.strategy';
import {
  inferQuestionNumberingPattern,
  shouldPreferItemizeOverPrimary,
} from './infer-question-numbering';
import { parseNumberedBlocks } from './numbered-block.parser';

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

  it('prefers Mathpix \\item[N.] over sparse plain N. lines (OBJECTIVE sections)', () => {
    const markdown = [
      '\\section*{OBJECTIVE - I}',
      '\\begin{itemize}',
      '\\item[1.] First wrapped stem',
      '\\end{itemize}',
      'Sol. A',
      '\\begin{itemize}',
      '\\item[2.] Second wrapped stem',
      '\\end{itemize}',
      'Sol. B',
      '\\begin{itemize}',
      '\\item[3.] Third wrapped stem',
      '\\end{itemize}',
      'Sol. C',
      '4. Plain numbered stem that escaped itemize',
      'Sol. D',
      '5. Another plain numbered stem',
      'Sol. A',
      '\\begin{itemize}',
      '\\item[6.] Sixth wrapped stem',
      '\\end{itemize}',
      'Sol. B',
      '\\begin{itemize}',
      '\\item[7.] Seventh wrapped stem',
      '\\end{itemize}',
      'Sol. C',
      '\\begin{itemize}',
      '\\item[8.] Eighth wrapped stem',
      '\\end{itemize}',
      'Sol. D',
      '\\begin{itemize}',
      '\\item[9.] Ninth wrapped stem',
      '\\end{itemize}',
      'Sol. A',
      '\\begin{itemize}',
      '\\item[10.] Tenth wrapped stem',
      '\\end{itemize}',
      'Sol. B',
      '\\begin{itemize}',
      '\\item[11.] Eleventh wrapped stem',
      '\\end{itemize}',
      'Sol. C',
      '\\begin{itemize}',
      '\\item[12.] Twelfth wrapped stem',
      '\\end{itemize}',
      'Sol. D',
      '\\section*{OBJECTIVE - II}',
      '\\begin{itemize}',
      '\\item[1.] Restarted numbering in next section',
      '\\end{itemize}',
      'Sol. AD',
      '\\begin{itemize}',
      '\\item[2.] Second of section II',
      '\\end{itemize}',
      'Sol. BC',
    ].join('\n');

    const inferred = inferQuestionNumberingPattern(markdown);
    expect(inferred?.regex).toBe('^(?:\\\\item\\[(\\d+)\\.\\]|(\\d+)\\.\\s)');
    expect(inferred?.matchCount).toBeGreaterThanOrEqual(14);
  });

  it('detects period-inside-brackets itemize as the sole pattern', () => {
    const markdown = [
      '\\item[1.] First stem',
      '\\item[(a)] one',
      '\\item[2.] Second stem',
      '\\item[(b)] two',
    ].join('\n');

    expect(inferQuestionNumberingPattern(markdown)?.regex).toBe(
      '^\\\\item\\[(\\d+)\\.\\]',
    );
  });
});

describe('shouldPreferItemizeOverPrimary', () => {
  it('keeps sparse nested itemize from beating two real numbered questions', () => {
    expect(
      shouldPreferItemizeOverPrimary(
        {
          regex: '^(\\d+)\\.\\s',
          type: 'numbered',
          matchCount: 2,
          exampleLine: '1. First',
        },
        {
          regex: '^\\\\item\\[(\\d+)\\]',
          type: 'numbered',
          matchCount: 5,
          exampleLine: '\\item[1] statement',
        },
      ),
    ).toBe(false);
  });

  it('prefers dominant itemize when plain numbering only catches a few stems', () => {
    expect(
      shouldPreferItemizeOverPrimary(
        {
          regex: '^(\\d+)\\.\\s',
          type: 'numbered',
          matchCount: 4,
          exampleLine: '4. Plain',
        },
        {
          regex: '^\\\\item\\[(\\d+)\\.\\]',
          type: 'numbered',
          matchCount: 19,
          exampleLine: '\\item[1.] Stem',
        },
      ),
    ).toBe(true);
  });

  it('never flips a full plain-numbered paper just because nested itemize is denser', () => {
    expect(
      shouldPreferItemizeOverPrimary(
        {
          regex: '^(\\d+)\\.\\s',
          type: 'numbered',
          matchCount: 20,
          exampleLine: '1. First',
        },
        {
          regex: '^\\\\item\\[(\\d+)\\.\\]',
          type: 'numbered',
          matchCount: 60,
          exampleLine: '\\item[1.] statement',
        },
      ),
    ).toBe(false);
  });

  it('keeps small plain papers with ~3 nested statement items per stem', () => {
    expect(
      shouldPreferItemizeOverPrimary(
        {
          regex: '^(\\d+)\\.\\s',
          type: 'numbered',
          matchCount: 6,
          exampleLine: '1. First',
        },
        {
          regex: '^\\\\item\\[(\\d+)\\.\\]',
          type: 'numbered',
          matchCount: 18,
          exampleLine: '\\item[1.] statement',
        },
      ),
    ).toBe(false);
  });
});

describe('combined itemize|plain boundary parsing', () => {
  it('keeps full stem text for escaped plain N. lines', () => {
    const inferred = inferQuestionNumberingPattern(
      [
        '\\begin{itemize}',
        '\\item[1.] Wrapped stem one',
        '\\end{itemize}',
        'Sol. A',
        '\\begin{itemize}',
        '\\item[2.] Wrapped stem two',
        '\\end{itemize}',
        'Sol. B',
        '\\begin{itemize}',
        '\\item[3.] Wrapped stem three',
        '\\end{itemize}',
        'Sol. C',
        '4. Escaped plain stem that must keep its full text',
        'Sol. D',
        '\\begin{itemize}',
        '\\item[5.] Wrapped stem five',
        '\\end{itemize}',
        'Sol. A',
        '\\begin{itemize}',
        '\\item[6.] Wrapped stem six',
        '\\end{itemize}',
        'Sol. B',
        '\\begin{itemize}',
        '\\item[7.] Wrapped stem seven',
        '\\end{itemize}',
        'Sol. C',
        '\\begin{itemize}',
        '\\item[8.] Wrapped stem eight',
        '\\end{itemize}',
        'Sol. D',
        '\\begin{itemize}',
        '\\item[9.] Wrapped stem nine',
        '\\end{itemize}',
        'Sol. A',
        '\\begin{itemize}',
        '\\item[10.] Wrapped stem ten',
        '\\end{itemize}',
        'Sol. B',
      ].join('\n'),
    );

    expect(inferred?.regex).toContain('\\\\item\\[(\\d+)\\.\\]');

    const boundary = new AdaptiveBoundaryStrategy();
    boundary.initialize({
      questionPattern: {
        type: 'numbered',
        regex: inferred!.regex,
        exampleMatch: inferred!.exampleLine,
      },
      solutionPattern: { location: 'inline', matchesQuestionNumbering: true },
      delimiter: { type: 'blank-line', value: '', confidence: 1 },
      metadata: {},
      detectedFormat: 'test',
      confidence: 1,
      warnings: [],
    } as never);

    const blocks = parseNumberedBlocks(
      [
        '\\begin{itemize}',
        '\\item[1.] Wrapped stem one',
        '\\end{itemize}',
        '4. Escaped plain stem that must keep its full text',
      ].join('\n'),
      boundary,
    );

    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 1,
          content: expect.stringContaining('Wrapped stem one'),
        }),
        expect.objectContaining({
          number: 4,
          content: 'Escaped plain stem that must keep its full text',
        }),
      ]),
    );
  });

  it('keeps plain numbering for NEET-style papers with nested statement itemize', () => {
    const lines: string[] = [];
    for (let n = 1; n <= 20; n++) {
      lines.push(`${n}. Question stem ${n}`);
      lines.push('\\begin{itemize}');
      lines.push('\\item[1.] Statement one');
      lines.push('\\item[2.] Statement two');
      lines.push('\\item[3.] Statement three');
      lines.push('\\end{itemize}');
      lines.push(`Sol. A`);
    }
    lines.push('## SOLUTIONS');
    lines.push('1. (a)');

    expect(inferQuestionNumberingPattern(lines.join('\n'))?.regex).toBe(
      '^(\\d+)\\.\\s',
    );
  });
});
