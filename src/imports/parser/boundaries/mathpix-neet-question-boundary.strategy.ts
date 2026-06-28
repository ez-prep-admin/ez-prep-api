import { Injectable } from '@nestjs/common';
import {
  ParsedQuestionStart,
  QuestionBoundaryStrategy,
} from './question-boundary.strategy';

@Injectable()
export class MathpixNeetQuestionBoundaryStrategy
  implements QuestionBoundaryStrategy
{
  private static readonly QUESTION_START_PATTERN = /^(\d+)\.\s(.*)$/;

  isQuestionStart(line: string): boolean {
    return MathpixNeetQuestionBoundaryStrategy.QUESTION_START_PATTERN.test(
      line.trim(),
    );
  }

  parseQuestionStart(line: string): ParsedQuestionStart | null {
    const match = line
      .trim()
      .match(MathpixNeetQuestionBoundaryStrategy.QUESTION_START_PATTERN);

    if (!match) {
      return null;
    }

    return {
      number: parseInt(match[1], 10),
      content: match[2] ?? '',
    };
  }
}
