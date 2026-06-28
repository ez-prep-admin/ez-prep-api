import { BadRequestException, Injectable } from '@nestjs/common';
import { QuestionPaperParserStrategy } from '../strategies/question-paper-parser.strategy';
import { MathpixNeetParserStrategy } from '../strategies/mathpix-neet-parser.strategy';

@Injectable()
export class DocumentParserFactory {
  private readonly parsers: QuestionPaperParserStrategy[];

  constructor(mathpixNeetParser: MathpixNeetParserStrategy) {
    this.parsers = [mathpixNeetParser];
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
