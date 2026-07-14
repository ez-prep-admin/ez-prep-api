export interface InferredNumberingPattern {
  regex: string;
  type: 'numbered' | 'labeled';
  exampleLine: string;
}

const CANDIDATE_PATTERNS: Array<{
  regex: RegExp;
  source: string;
  type: 'numbered' | 'labeled';
}> = [
  { regex: /^Sol\.(\d+)\./i, source: '^Sol\\.(\\d+)\\.', type: 'labeled' },
  {
    regex: /^Sol\.?\s*(\d+)[.:)]\s/i,
    source: '^Sol\\.?\\s*(\\d+)[.:)]\\s',
    type: 'labeled',
  },
  {
    regex: /^Solution\s+(\d+)[.:)]\s/i,
    source: '^Solution\\s+(\\d+)[.:)]\\s',
    type: 'labeled',
  },
  {
    regex: /^Ans(?:wer)?\.?\s*(\d+)[.:)]\s/i,
    source: '^Ans(?:wer)?\\.?\\s*(\\d+)[.:)]\\s',
    type: 'labeled',
  },
  { regex: /^(\d+)\s*\.\s/, source: '^(\\d+)\\s*\\.\\s', type: 'numbered' },
  { regex: /^## Q(\d+)\.\s/i, source: '^## Q(\\d+)\\.\\s', type: 'labeled' },
  { regex: /^Q\.(\d+)\.\s/i, source: '^Q\\.(\\d+)\\.\\s', type: 'labeled' },
  { regex: /^Q(\d+)\.\s/i, source: '^Q(\\d+)\\.\\s', type: 'labeled' },
  {
    regex: /^Question\s+(\d+)[:.]?\s/i,
    source: '^Question\\s+(\\d+)[:.]?\\s',
    type: 'labeled',
  },
  { regex: /^(\d+)\)\s/, source: '^(\\d+)\\)\\s', type: 'numbered' },
];

/**
 * Infer how answers are numbered in a solutions section by scoring line matches.
 */
export function inferSolutionNumberingRegex(
  solutionsSection: string,
): InferredNumberingPattern | null {
  const lines = solutionsSection
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 80);

  if (lines.length === 0) {
    return null;
  }

  let best: {
    score: number;
    pattern: (typeof CANDIDATE_PATTERNS)[number];
    line: string;
  } | null = null;

  for (const pattern of CANDIDATE_PATTERNS) {
    let score = 0;
    let exampleLine = '';

    for (const line of lines) {
      if (pattern.regex.test(line)) {
        score++;
        if (!exampleLine) {
          exampleLine = line;
        }
      }
    }

    if (!best || score > best.score) {
      best = { score, pattern, line: exampleLine };
    }
  }

  if (!best || best.score < 2) {
    return null;
  }

  return {
    regex: best.pattern.source,
    type: best.pattern.type,
    exampleLine: best.line,
  };
}
