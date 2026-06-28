import { Injectable } from '@nestjs/common';
import { ParsedSolution } from '../types/parsed-solution';
import { QuestionBoundaryStrategy } from './boundaries/question-boundary.strategy';
import { parseNumberedBlocks } from './numbered-block.parser';

@Injectable()
export class SolutionParserService {
  parse(
    markdown: string,
    boundary: QuestionBoundaryStrategy,
  ): ParsedSolution[] {
    return parseNumberedBlocks(markdown, boundary).map(block => ({
      number: block.number,
      content: block.content,
    }));
  }
}
