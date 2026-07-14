import { ParsedQuestion } from '../types/parsed-question';
import { ParsedSolution } from '../types/parsed-solution';

export interface OrphanReattachResult {
  questions: ParsedQuestion[];
  solutions: ParsedSolution[];
  notes: string[];
}

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g;

/**
 * Mathpix multi-column PDFs often dump solution bodies (incl. Short Trick +
 * diagrams) after the last question's options, or absorb the next solution
 * into the previous Sol.N block. Peel those fragments back onto thin Sol.N
 * entries without changing well-formed questions/solutions.
 */
export function reattachOrphanSolutionFragments(
  questions: ParsedQuestion[],
  solutions: ParsedSolution[],
): OrphanReattachResult {
  const notes: string[] = [];
  let nextQuestions = questions.map(q => ({ ...q }));
  let nextSolutions = solutions.map(s => ({ ...s }));

  // 1) Peel solution-like trailing from question blocks (esp. last Q).
  for (let index = 0; index < nextQuestions.length; index++) {
    const peeled = peelSolutionLikeTrailing(nextQuestions[index].content);
    if (!peeled.orphan) {
      continue;
    }

    nextQuestions[index] = {
      ...nextQuestions[index],
      content: peeled.question,
    };

    const target = findBestThinSolution(
      peeled.orphan,
      nextQuestions,
      nextSolutions,
    );
    if (!target) {
      notes.push(
        `Found solution-like trailing after Q${nextQuestions[index].number} but no thin Sol.* to attach it to.`,
      );
      // Put it back — better leave on question than drop.
      nextQuestions[index] = {
        ...nextQuestions[index],
        content: `${peeled.question}\n\n${peeled.orphan}`.trim(),
      };
      continue;
    }

    nextSolutions = nextSolutions.map(solution =>
      solution.number === target.number
        ? {
            ...solution,
            content: mergeSolutionContent(solution.content, peeled.orphan),
          }
        : solution,
    );
    notes.push(
      `Reattached orphan solution fragment from Q${nextQuestions[index].number} → Sol.${target.number}`,
    );
  }

  // 2) Split a rich Sol.N that absorbed a sibling thin Sol.M body after Short Trick.
  nextSolutions = splitAbsorbedSiblingSolutions(
    nextQuestions,
    nextSolutions,
    notes,
  );

  return { questions: nextQuestions, solutions: nextSolutions, notes };
}

export function peelSolutionLikeTrailing(questionContent: string): {
  question: string;
  orphan: string | null;
} {
  const optionLines = questionContent.match(/(?:^|\n)\s*\([a-d]\)\s*[^\n]*/gim);
  if (!optionLines?.length) {
    return { question: questionContent, orphan: null };
  }

  const lastOptionLine = optionLines[optionLines.length - 1];
  const lastIndex = questionContent.lastIndexOf(lastOptionLine);
  if (lastIndex === -1) {
    return { question: questionContent, orphan: null };
  }

  const questionHead = questionContent
    .slice(0, lastIndex + lastOptionLine.length)
    .trim();
  const trailing = questionContent
    .slice(lastIndex + lastOptionLine.length)
    .trim();

  if (!looksLikeSolutionTrailing(trailing)) {
    return { question: questionContent, orphan: null };
  }

  return { question: questionHead, orphan: trailing };
}

export function looksLikeSolutionTrailing(trailing: string): boolean {
  const text = trailing.trim();
  if (!text) {
    return false;
  }

  if (/short\s*trick/i.test(text)) {
    return true;
  }

  const imageCount = countImages(text);
  const withoutImages = text.replace(MARKDOWN_IMAGE_REGEX, '').trim();

  // Classic stem diagram: one image + short Fig. caption only.
  if (
    imageCount === 1 &&
    (withoutImages.length < 50 || /^Fig\.\s*[\d.]+/i.test(withoutImages))
  ) {
    return false;
  }

  if (imageCount >= 2) {
    return true;
  }

  if (
    imageCount >= 1 &&
    withoutImages.length > 100 &&
    /perimeter|tangent|from the given figure|eq\s*\.|solving|pythagoras|radius|chord/i.test(
      withoutImages,
    )
  ) {
    return true;
  }

  return false;
}

function splitAbsorbedSiblingSolutions(
  questions: ParsedQuestion[],
  solutions: ParsedSolution[],
  notes: string[],
): ParsedSolution[] {
  let next = solutions.map(s => ({ ...s }));

  for (const solution of [...next]) {
    if (countImages(solution.content) < 2 && !/short\s*trick/i.test(solution.content)) {
      continue;
    }

    const split = findAbsorbedSiblingSplit(
      solution.number,
      solution.content,
      questions,
      next,
    );
    if (!split) {
      continue;
    }

    const thin = next.find(
      item => item.number === split.siblingNumber && isThinSolution(item.content),
    );
    if (!thin) {
      continue;
    }

    next = next.map(item => {
      if (item.number === solution.number) {
        return { ...item, content: split.head.trim() };
      }
      if (item.number === thin.number) {
        return {
          ...item,
          content: mergeSolutionContent(item.content, split.tail),
        };
      }
      return item;
    });

    notes.push(
      `Split absorbed Sol.${thin.number} body out of Sol.${solution.number}`,
    );
  }

  return next;
}

function findAbsorbedSiblingSplit(
  currentNumber: number,
  content: string,
  questions: ParsedQuestion[],
  solutions: ParsedSolution[],
): { head: string; tail: string; siblingNumber: number } | null {
  const shortTrickMatch = content.match(/short\s*trick\s*:?\s*-?/i);
  if (!shortTrickMatch || shortTrickMatch.index === undefined) {
    return null;
  }

  const afterTrickStart = shortTrickMatch.index + shortTrickMatch[0].length;
  const afterTrick = content.slice(afterTrickStart);
  const imageMatches = [...afterTrick.matchAll(MARKDOWN_IMAGE_REGEX)];
  if (imageMatches.length < 1) {
    return null;
  }

  // Prefer a second diagram after Short Trick as the sibling solution start.
  const candidate =
    imageMatches.length >= 2 ? imageMatches[1] : imageMatches[0];
  if (candidate.index === undefined) {
    return null;
  }

  const absoluteIndex = afterTrickStart + candidate.index;
  // If only one image after trick and it sits immediately under the trick
  // heading, it likely belongs to this solution's short trick — don't split.
  if (imageMatches.length === 1 && candidate.index < 80) {
    return null;
  }

  const head = content.slice(0, absoluteIndex).trim();
  const tail = content.slice(absoluteIndex).trim();
  if (tail.length < 80) {
    return null;
  }

  const thin = solutions.filter(
    item => item.number !== currentNumber && isThinSolution(item.content),
  );
  if (!thin.length) {
    return null;
  }

  let best: { number: number; score: number } | null = null;
  for (const candidateSolution of thin) {
    const question = questions.find(q => q.number === candidateSolution.number);
    if (!question) {
      continue;
    }
    const score = contentOverlap(tail, question.content);
    if (!best || score > best.score) {
      best = { number: candidateSolution.number, score };
    }
  }

  if (!best || best.score < 2) {
    return null;
  }

  return { head, tail, siblingNumber: best.number };
}

function findBestThinSolution(
  orphan: string,
  questions: ParsedQuestion[],
  solutions: ParsedSolution[],
): ParsedSolution | null {
  const thin = solutions.filter(item => isThinSolution(item.content));
  if (thin.length === 0) {
    return null;
  }
  if (thin.length === 1) {
    return thin[0];
  }

  let best: ParsedSolution | null = null;
  let bestScore = -1;
  for (const solution of thin) {
    const question = questions.find(item => item.number === solution.number);
    const score = question ? contentOverlap(orphan, question.content) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = solution;
    }
  }

  return bestScore > 0 ? best : thin[0];
}

export function isThinSolution(content: string): boolean {
  const images = countImages(content);
  const text = content
    .replace(MARKDOWN_IMAGE_REGEX, '')
    .replace(/^\([a-d]\)\s*/i, '')
    .trim();
  return images === 0 && text.length < 180;
}

function mergeSolutionContent(existing: string, orphan: string): string {
  const existingTrimmed = existing.trim();
  const orphanTrimmed = orphan.trim();
  if (!existingTrimmed) {
    return orphanTrimmed;
  }
  if (!orphanTrimmed) {
    return existingTrimmed;
  }
  if (existingTrimmed.includes(orphanTrimmed.slice(0, 80))) {
    return existingTrimmed;
  }
  return `${existingTrimmed}\n\n${orphanTrimmed}`.trim();
}

function contentOverlap(left: string, right: string): number {
  const leftTokens = distinctiveTokens(left);
  const rightTokens = distinctiveTokens(right);
  let score = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      score += 1;
    }
  }
  return score;
}

function distinctiveTokens(text: string): Set<string> {
  const normalized = text
    .replace(MARKDOWN_IMAGE_REGEX, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ');
  const tokens = normalized
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .filter(token => !STOP_TOKENS.has(token));
  return new Set(tokens);
}

function countImages(text: string): number {
  return (text.match(/!\[/g) ?? []).length;
}

const STOP_TOKENS = new Set([
  'the',
  'and',
  'for',
  'from',
  'with',
  'that',
  'this',
  'are',
  'is',
  'of',
  'to',
  'in',
  'on',
  'at',
  'cm',
  'mm',
  'given',
  'figure',
  'find',
  'what',
  'then',
  'each',
  'other',
  'such',
]);
