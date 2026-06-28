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
}
