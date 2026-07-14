export interface HeaderlessSolutionSplitResult {
  split: boolean;
  questionsSection: string;
  solutionsSection: string;
  numberingRegex: string;
  exampleLine: string;
  matchCount: number;
}

interface SolutionPatternCandidate {
  /** Full-line test regex (no ^/$ anchors beyond start — applied to trimmed lines). */
  lineRegex: RegExp;
  /** Source string suitable for AdaptiveBoundaryStrategy / RegExp constructor. */
  source: string;
  type: 'numbered' | 'labeled';
}

/**
 * Solution line patterns that often differ from question prefixes.
 * Order matters: more specific labeled forms are preferred over bare "1." answers.
 */
export const HEADERLESS_SOLUTION_CANDIDATES: SolutionPatternCandidate[] = [
  {
    lineRegex: /^Sol\.(\d+)\./i,
    source: '^Sol\\.(\\d+)\\.',
    type: 'labeled',
  },
  {
    lineRegex: /^Sol\.?\s*(\d+)[.:)]\s/i,
    source: '^Sol\\.?\\s*(\\d+)[.:)]\\s',
    type: 'labeled',
  },
  {
    lineRegex: /^Solution\s+(\d+)[.:)]\s/i,
    source: '^Solution\\s+(\\d+)[.:)]\\s',
    type: 'labeled',
  },
  {
    lineRegex: /^Ans(?:wer)?\.?\s*(\d+)[.:)]\s/i,
    source: '^Ans(?:wer)?\\.?\\s*(\\d+)[.:)]\\s',
    type: 'labeled',
  },
  {
    lineRegex: /^##\s*Sol(?:ution)?\.?\s*(\d+)/i,
    source: '^##\\s*Sol(?:ution)?\\.?\\s*(\\d+)',
    type: 'labeled',
  },
  {
    lineRegex: /^(\d+)\s*\.\s*[\(\[]?[a-dA-D1-4]/,
    source: '^(\\d+)\\s*\\.\\s',
    type: 'numbered',
  },
  {
    lineRegex: /^(\d+)\s*\.\s/,
    source: '^(\\d+)\\s*\\.\\s',
    type: 'numbered',
  },
  {
    lineRegex: /^(\d+)\)\s/,
    source: '^(\\d+)\\)\\s',
    type: 'numbered',
  },
];

/**
 * Detect a headerless answers block that uses a different line prefix than questions
 * (e.g. questions as "Q.48." and answers as "Sol.48.(d)" with no "## SOLUTIONS" heading).
 *
 * Safe to call when the repeated same-numbering split already failed.
 */
export function splitHeaderlessAlternateSolutions(
  markdown: string,
  questionRegexSource: string,
  preferredSolutionRegex?: string,
): HeaderlessSolutionSplitResult | null {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  if (lines.length < 4) {
    return null;
  }

  let questionPattern: RegExp;
  try {
    questionPattern = new RegExp(questionRegexSource);
  } catch {
    return null;
  }

  const questionStarts = collectPatternStarts(lines, questionPattern);
  if (questionStarts.length < 2) {
    return null;
  }

  const questionNumbers = questionStarts.map(item => item.number);
  const lastQuestionLineIndex =
    questionStarts[questionStarts.length - 1].lineIndex;

  const candidates = buildCandidateList(preferredSolutionRegex);

  let best: {
    candidate: SolutionPatternCandidate;
    matches: Array<{ lineIndex: number; number: number; line: string }>;
    score: number;
  } | null = null;

  for (const candidate of candidates) {
    if (patternsEffectivelyEqual(candidate.source, questionRegexSource)) {
      continue;
    }

    const matches: Array<{ lineIndex: number; number: number; line: string }> =
      [];

    for (
      let lineIndex = lastQuestionLineIndex + 1;
      lineIndex < lines.length;
      lineIndex++
    ) {
      const line = lines[lineIndex].trim();
      if (!line) {
        continue;
      }

      // Interleaved question lines after the "last" question mean this is not a clean trail block.
      if (questionPattern.test(line)) {
        continue;
      }

      const match = line.match(candidate.lineRegex);
      if (!match?.[1]) {
        continue;
      }

      const number = parseInt(match[1], 10);
      if (!Number.isFinite(number)) {
        continue;
      }

      matches.push({ lineIndex, number, line });
    }

    if (
      !isPlausibleSolutionBlock(
        questionNumbers,
        matches.map(m => m.number),
      )
    ) {
      continue;
    }

    const score = scoreSolutionBlock(
      questionNumbers,
      matches.map(m => m.number),
      candidate.source === preferredSolutionRegex,
    );

    if (!best || score > best.score) {
      best = { candidate, matches, score };
    }
  }

  if (!best || best.matches.length < 2) {
    return null;
  }

  // Reject interleaved forms: solution-pattern hits must not appear between question starts.
  if (
    hasInterleavedSolutionLines(
      lines,
      questionStarts,
      best.candidate.lineRegex,
      questionPattern,
    )
  ) {
    return null;
  }

  const splitLineIndex = best.matches[0].lineIndex;
  const questionsSection = lines.slice(0, splitLineIndex).join('\n').trim();
  const solutionsSection = lines.slice(splitLineIndex).join('\n').trim();

  if (!questionsSection || !solutionsSection) {
    return null;
  }

  return {
    split: true,
    questionsSection,
    solutionsSection,
    numberingRegex: best.candidate.source,
    exampleLine: best.matches[0].line,
    matchCount: best.matches.length,
  };
}

function buildCandidateList(
  preferredSolutionRegex?: string,
): SolutionPatternCandidate[] {
  if (!preferredSolutionRegex?.trim()) {
    return HEADERLESS_SOLUTION_CANDIDATES;
  }

  try {
    const preferred: SolutionPatternCandidate = {
      lineRegex: new RegExp(preferredSolutionRegex),
      source: preferredSolutionRegex,
      type: preferredSolutionRegex.includes('Q(') ? 'labeled' : 'numbered',
    };
    return [
      preferred,
      ...HEADERLESS_SOLUTION_CANDIDATES.filter(
        candidate => candidate.source !== preferredSolutionRegex,
      ),
    ];
  } catch {
    return HEADERLESS_SOLUTION_CANDIDATES;
  }
}

function collectPatternStarts(
  lines: string[],
  pattern: RegExp,
): Array<{ lineIndex: number; number: number }> {
  const starts: Array<{ lineIndex: number; number: number }> = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    const match = line.match(pattern);
    if (!match) {
      continue;
    }

    const number = extractNumber(match, line);
    if (number === null) {
      continue;
    }

    starts.push({ lineIndex, number });
  }

  return starts;
}

function extractNumber(match: RegExpMatchArray, line: string): number | null {
  if (match[1]) {
    const fromCapture = parseInt(match[1].match(/\d+/)?.[0] ?? match[1], 10);
    if (Number.isFinite(fromCapture)) {
      return fromCapture;
    }
  }

  const fromLine = line.match(/\d+/);
  if (!fromLine) {
    return null;
  }

  const parsed = parseInt(fromLine[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPlausibleSolutionBlock(
  questionNumbers: number[],
  solutionNumbers: number[],
): boolean {
  if (solutionNumbers.length < 2) {
    return false;
  }

  const questionSet = new Set(questionNumbers);
  const overlap = solutionNumbers.filter(number =>
    questionSet.has(number),
  ).length;
  if (overlap >= Math.min(2, questionNumbers.length)) {
    return true;
  }

  // Answers renumbered from 1 after labeled questions (Q.48… / 1. (a)…)
  const coversMostQuestions =
    solutionNumbers.length >=
    Math.max(2, Math.ceil(questionNumbers.length * 0.5));
  if (
    coversMostQuestions &&
    solutionNumbers[0] === 1 &&
    isMostlyIncreasing(solutionNumbers)
  ) {
    return true;
  }

  return false;
}

function scoreSolutionBlock(
  questionNumbers: number[],
  solutionNumbers: number[],
  preferred: boolean,
): number {
  const questionSet = new Set(questionNumbers);
  const overlap = solutionNumbers.filter(number =>
    questionSet.has(number),
  ).length;
  const countScore = solutionNumbers.length * 10;
  const overlapScore = overlap * 25;
  const coverageScore =
    Math.abs(solutionNumbers.length - questionNumbers.length) <= 1 ? 40 : 0;
  const preferredBonus = preferred ? 100 : 0;

  return countScore + overlapScore + coverageScore + preferredBonus;
}

function isMostlyIncreasing(numbers: number[]): boolean {
  if (numbers.length < 2) {
    return false;
  }

  let increases = 0;
  for (let index = 1; index < numbers.length; index++) {
    if (numbers[index] > numbers[index - 1]) {
      increases++;
    }
  }

  return increases >= Math.ceil((numbers.length - 1) * 0.7);
}

function hasInterleavedSolutionLines(
  lines: string[],
  questionStarts: Array<{ lineIndex: number; number: number }>,
  solutionPattern: RegExp,
  questionPattern: RegExp,
): boolean {
  if (questionStarts.length < 2) {
    return false;
  }

  const lastQuestionLineIndex =
    questionStarts[questionStarts.length - 1].lineIndex;

  for (let lineIndex = 0; lineIndex < lastQuestionLineIndex; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line || questionPattern.test(line)) {
      continue;
    }

    if (solutionPattern.test(line)) {
      return true;
    }
  }

  return false;
}

function patternsEffectivelyEqual(left: string, right: string): boolean {
  return normalizePattern(left) === normalizePattern(right);
}

function normalizePattern(pattern: string): string {
  return pattern.replace(/\\\\/g, '\\').replace(/\s+/g, '').toLowerCase();
}
