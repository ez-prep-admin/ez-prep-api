import { Injectable } from '@nestjs/common';
import { QuestionPaperParserStrategy } from '../strategies/question-paper-parser.strategy';
import { AdaptiveParserStrategy } from '../strategies/adaptive-parser.strategy';

@Injectable()
export class DocumentParserFactory {
  constructor(private readonly adaptiveParser: AdaptiveParserStrategy) {}

  getParser(_markdown: string): QuestionPaperParserStrategy {
    return this.adaptiveParser;
  }
}
