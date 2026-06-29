import { BadRequestException, Injectable } from '@nestjs/common';
import { QuestionPaperParserStrategy } from '../strategies/question-paper-parser.strategy';
import { MathpixNeetParserStrategy } from '../strategies/mathpix-neet-parser.strategy';
import { AdaptiveParserStrategy } from '../strategies/adaptive-parser.strategy';

@Injectable()
export class DocumentParserFactory {
  private readonly parsers: QuestionPaperParserStrategy[];

  constructor(
    mathpixNeetParser: MathpixNeetParserStrategy,
    adaptiveParser: AdaptiveParserStrategy,
  ) {
    // Register parsers in priority order
    // Adaptive parser should be last as it supports all formats (fallback)
    this.parsers = [mathpixNeetParser, adaptiveParser];
  }

  getParser(markdown: string): QuestionPaperParserStrategy {
    const parser = this.parsers.find(candidate => candidate.supports(markdown));

    if (!parser) {
      throw new BadRequestException(
        'No suitable parser found for this document format.',
      );
    }

    return parser;
  }
}
