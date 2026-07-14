export interface InferredQuestionPattern {
  regex: string;
  type: 'numbered' | 'labeled' | 'hierarchical';
  matchCount: number;
  exampleLine: string;
}

const CANDIDATE_PATTERNS: Array<{
  lineRegex: RegExp;
  source: string;
  type: 'numbered' | 'labeled' | 'hierarchical';
}> = [
  {
    lineRegex: /^\\section\*\{Q(\d+)\./gm,
    source: '^\\\\section\\*\\{Q(\\d+)\\.',
    type: 'labeled',
  },
  {
    lineRegex: /^## Q(\d+)\./gm,
    source: '^## Q(\\d+)\\.\\s',
    type: 'labeled',
  },
  {
    // "Q.48." (period after Q) — common in SSC / banking PDFs
    lineRegex: /^Q\.(\d+)\./gm,
    source: '^Q\\.(\\d+)\\.\\s',
    type: 'labeled',
  },
  {
    lineRegex: /^Q(\d+)\./gm,
    source: '^Q(\\d+)\\.\\s',
    type: 'labeled',
  },
  {
    lineRegex: /^(\d+)\.\s/gm,
    source: '^(\\d+)\\.\\s',
    type: 'numbered',
  },
  {
    lineRegex: /^Question\s+(\d+)[:.]?\s/gim,
    source: '^Question\\s+(\\d+)[:.]?\\s',
    type: 'labeled',
  },
];

/**
 * Score question-boundary patterns against the full markdown.
 * Used to correct stale LLM/cached structure when Mathpix output format changes.
 */
export function inferQuestionNumberingPattern(
  markdown: string,
): InferredQuestionPattern | null {
  const questionsPortion = extractQuestionsPortion(markdown);
  let best: InferredQuestionPattern | null = null;

  for (const candidate of CANDIDATE_PATTERNS) {
    const regex = new RegExp(
      candidate.lineRegex.source,
      candidate.lineRegex.flags,
    );
    let matchCount = 0;
    let exampleLine = '';

    for (const match of questionsPortion.matchAll(regex)) {
      matchCount++;
      if (!exampleLine && match.index !== undefined) {
        const lineStart = questionsPortion.lastIndexOf('\n', match.index) + 1;
        const lineEnd = questionsPortion.indexOf('\n', match.index);
        exampleLine = questionsPortion
          .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
          .trim();
      }
    }

    if (matchCount < 2) {
      continue;
    }

    if (!best || matchCount > best.matchCount) {
      best = {
        regex: candidate.source,
        type: candidate.type,
        matchCount,
        exampleLine,
      };
    }
  }

  return best;
}

export function countPatternMatches(markdown: string, pattern: string): number {
  try {
    const regex = new RegExp(pattern, 'gm');
    return [...markdown.matchAll(regex)].length;
  } catch {
    return 0;
  }
}

function extractQuestionsPortion(markdown: string): string {
  const markers = [
    '\\section*{ANSWERS AND SOLUTIONS}',
    '\\section*{Answers and Solutions}',
    '## ANSWERS AND SOLUTIONS',
    '## SOLUTIONS',
    '## ANSWERS',
  ];

  for (const marker of markers) {
    const index = markdown.indexOf(marker);
    if (index !== -1) {
      return markdown.slice(0, index);
    }
  }

  return markdown;
}
