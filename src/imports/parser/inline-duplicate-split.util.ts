import { ParsedQuestion } from '../types/parsed-question';
import { ParsedSolution } from '../types/parsed-solution';

export interface InlineDuplicateSplitResult {
  questions: ParsedQuestion[];
  solutions: ParsedSolution[];
  split: boolean;
}

/**
 * Mathpix/LLM structure detection can classify a document as "inline" even when
 * an answer/solution block follows the questions with the same numbering.
 * In that case parsing the whole document as questions yields 1..N, 1..N.
 */
export function splitRepeatedInlineNumbering(
  parsedQuestions: ParsedQuestion[],
): InlineDuplicateSplitResult {
  const firstRepeatIndex = findFirstRepeatIndex(parsedQuestions);

  if (firstRepeatIndex === -1) {
    return { questions: parsedQuestions, solutions: [], split: false };
  }

  const questionCycle = parsedQuestions.slice(0, firstRepeatIndex);
  const solutionCycle = parsedQuestions.slice(firstRepeatIndex);

  if (!isSameNumberSequence(questionCycle, solutionCycle)) {
    return { questions: parsedQuestions, solutions: [], split: false };
  }

  return {
    questions: questionCycle,
    solutions: solutionCycle.map(block => ({
      number: block.number,
      content: block.content,
    })),
    split: true,
  };
}

function findFirstRepeatIndex(parsedQuestions: ParsedQuestion[]): number {
  if (parsedQuestions.length < 4) {
    return -1;
  }

  const firstNumber = parsedQuestions[0].number;

  for (let index = 1; index < parsedQuestions.length; index++) {
    if (parsedQuestions[index].number === firstNumber) {
      return index;
    }
  }

  return -1;
}

function isSameNumberSequence(
  questions: ParsedQuestion[],
  possibleSolutions: ParsedQuestion[],
): boolean {
  if (questions.length === 0 || questions.length !== possibleSolutions.length) {
    return false;
  }

  const uniqueQuestionNumbers = new Set(questions.map(item => item.number));
  if (uniqueQuestionNumbers.size !== questions.length) {
    return false;
  }

  return questions.every(
    (question, index) => question.number === possibleSolutions[index].number,
  );
}
