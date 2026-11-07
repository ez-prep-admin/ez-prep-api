import { findSolutionMarker } from './solution-markers';

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
 * Mathpix often emits `\item[1.]` (period inside brackets). Older samples use
 * `\item[1]` without a period. Prefer the period-tolerant form.
 */
const ITEMIZE_QUESTION_PATTERNS = [
  {
    lineRegex: /^\\item\[(\d+)\.\]/gm,
    source: '^\\\\item\\[(\\d+)\\.\\]',
    type: 'numbered' as const,
  },
  {
    lineRegex: /^\\item\[(\d+)\]/gm,
    source: '^\\\\item\\[(\\d+)\\]',
    type: 'numbered' as const,
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
  const bestPrimary = scoreQuestionPattern(
    questionsPortion,
    CANDIDATE_PATTERNS,
  );
  const bestItemize = scoreQuestionPattern(
    questionsPortion,
    ITEMIZE_QUESTION_PATTERNS,
  );

  if (bestItemize && shouldPreferItemizeOverPrimary(bestPrimary, bestItemize)) {
    return withOptionalPlainNumberedFallback(
      bestItemize,
      bestPrimary,
      questionsPortion,
    );
  }

  if (bestPrimary) {
    return bestPrimary;
  }

  return bestItemize;
}

const PLAIN_NUMBERED_SOURCE = '^(\\d+)\\.\\s';

/**
 * Mathpix often wraps most stems as `\item[N.]` but leaves a few as plain `N. `.
 * When itemize wins overall, keep matching those escaped plain-numbered lines too
 * — even a single escape (below the usual ≥2 scoring floor) should stay reachable.
 */
function withOptionalPlainNumberedFallback(
  itemize: InferredQuestionPattern,
  primary: InferredQuestionPattern | null,
  questionsPortion: string,
): InferredQuestionPattern {
  const plainFromPrimary =
    primary &&
    primary.type === 'numbered' &&
    primary.regex === PLAIN_NUMBERED_SOURCE
      ? primary.matchCount
      : 0;
  const plainMatchCount =
    plainFromPrimary > 0
      ? plainFromPrimary
      : countPatternMatches(questionsPortion, PLAIN_NUMBERED_SOURCE);

  if (plainMatchCount < 1) {
    return itemize;
  }

  const combinedRegex = itemize.regex.includes('\\.\\]')
    ? '^(?:\\\\item\\[(\\d+)\\.\\]|(\\d+)\\.\\s)'
    : '^(?:\\\\item\\[(\\d+)\\]|(\\d+)\\.\\s)';

  return {
    ...itemize,
    regex: combinedRegex,
    matchCount: itemize.matchCount + plainMatchCount,
  };
}

/**
 * Prefer Mathpix itemize numbering only when the primary pattern looks like a
 * *sparse* escape hatch (a few `N.` / `Qn.` lines) while itemize dominates.
 *
 * Full plain-numbered NEET papers often nest `\item[1.]` statement lists under
 * each stem (~3 per question). That density must NOT flip boundaries to
 * itemize. Require a low primary count **and** itemize counts strictly above
 * the typical nested-statement ratio (or ≥4× primary).
 */
export const ITEMIZE_OVER_PRIMARY_MAX_SPARSE_PRIMARY = 6;

export function shouldPreferItemizeOverPrimary(
  primary: InferredQuestionPattern | null,
  itemize: InferredQuestionPattern,
): boolean {
  if (!primary) {
    return true;
  }

  const primaryCount = primary.matchCount;
  const itemizeCount = itemize.matchCount;

  if (primaryCount > ITEMIZE_OVER_PRIMARY_MAX_SPARSE_PRIMARY) {
    return false;
  }

  const clearlyAboveNestedRatio =
    itemizeCount > primaryCount * 3 && itemizeCount >= primaryCount + 8;
  const stronglyItemizeLed = itemizeCount >= primaryCount * 4;

  return clearlyAboveNestedRatio || stronglyItemizeLed;
}

function scoreQuestionPattern(
  questionsPortion: string,
  candidates: ReadonlyArray<{
    lineRegex: RegExp;
    source: string;
    type: 'numbered' | 'labeled' | 'hierarchical';
  }>,
): InferredQuestionPattern | null {
  let best: InferredQuestionPattern | null = null;

  for (const candidate of candidates) {
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
  const marker = findSolutionMarker(markdown);
  if (!marker) {
    return markdown;
  }

  const index = markdown.indexOf(marker);
  return index === -1 ? markdown : markdown.slice(0, index);
}
