import { Injectable } from '@nestjs/common';
import { ParsedQuestion } from '../types/parsed-question';
import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';
import { parseNumberedBlocks } from './numbered-block.parser';

@Injectable()
export class QuestionParserService {
  parse(
    markdown: string,
    boundary: QuestionBoundaryStrategy,
  ): ParsedQuestion[] {
    return parseNumberedBlocks(markdown, boundary).map(block => ({
      number: block.number,
      content: block.content,
    }));
  }
}
