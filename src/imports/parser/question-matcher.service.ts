import { Injectable } from '@nestjs/common';
import { MatchedQuestion } from '../types/matched-question';
import { ParsedQuestion } from '../types/parsed-question';
import { ParsedSolution } from '../types/parsed-solution';
import { ParserWarning } from '../types/parser-result';

export interface MatchResult {
  matched: MatchedQuestion[];
  warnings: ParserWarning[];
}

@Injectable()
export class QuestionMatcherService {
  match(
    questions: ParsedQuestion[],
    solutions: ParsedSolution[],
  ): MatchedQuestion[] {
    return this.matchWithWarnings(questions, solutions).matched;
  }

  matchWithWarnings(
    questions: ParsedQuestion[],
    solutions: ParsedSolution[],
  ): MatchResult {
    if (!hasRepeatedQuestionNumber(questions)) {
      return matchUniqueNumbers(questions, solutions);
    }

    return matchRepeatedNumbers(questions, solutions);
  }
}

function hasRepeatedQuestionNumber(questions: ParsedQuestion[]): boolean {
  const seen = new Set<number>();
  for (const question of questions) {
    if (seen.has(question.number)) {
      return true;
    }
    seen.add(question.number);
  }
  return false;
}

/** One solution per number. A repeated solution number keeps the last block. */
function matchUniqueNumbers(
  questions: ParsedQuestion[],
  solutions: ParsedSolution[],
): MatchResult {
  const solutionMap = new Map(
    solutions.map(solution => [solution.number, solution.content]),
  );
  const questionNumbers = new Set(questions.map(question => question.number));
  const warnings: ParserWarning[] = [];

  for (const solution of solutions) {
    if (!questionNumbers.has(solution.number)) {
      warnings.push({
        code: 'ORPHAN_SOLUTION',
        message: `Solution ${solution.number} has no matching question.`,
      });
    }
  }

  const matched = questions.map(question => {
    const solution = solutionMap.get(question.number);

    if (!solution) {
      warnings.push({
        code: 'MISSING_SOLUTION',
        message: `Question ${question.number} has no matching solution.`,
      });
    }

    return {
      number: question.number,
      question: question.content,
      solution,
    };
  });

  return { matched, warnings };
}

/** Session 2 restarts at 1, so the nth question N pairs with the nth solution N. */
function matchRepeatedNumbers(
  questions: ParsedQuestion[],
  solutions: ParsedSolution[],
): MatchResult {
  const solutionsByNumber = new Map<number, string[]>();
  for (const solution of solutions) {
    const queue = solutionsByNumber.get(solution.number) ?? [];
    queue.push(solution.content);
    solutionsByNumber.set(solution.number, queue);
  }

  const warnings: ParserWarning[] = [];
  const matched = questions.map(question => {
    const queue = solutionsByNumber.get(question.number);
    const solution = queue?.shift();

    if (!solution) {
      warnings.push({
        code: 'MISSING_SOLUTION',
        message: `Question ${question.number} has no matching solution.`,
      });
    }

    return {
      number: question.number,
      question: question.content,
      solution,
    };
  });

  for (const [number, queue] of solutionsByNumber) {
    while (queue.length > 0) {
      queue.shift();
      warnings.push({
        code: 'ORPHAN_SOLUTION',
        message: `Solution ${number} has no matching question.`,
      });
    }
  }

  return { matched, warnings };
}
