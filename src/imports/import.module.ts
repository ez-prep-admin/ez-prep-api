import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { MarkdownParserService } from './parser/markdown-parser.service';
import { QuestionParserService } from './parser/question-parser.service';
import { SolutionParserService } from './parser/solution-parser.service';
import { QuestionMatcherService } from './parser/question-matcher.service';
import { MathpixNeetQuestionBoundaryStrategy } from './parser/boundaries/mathpix-neet-question-boundary.strategy';
import { MathpixNeetParserStrategy } from './parser/strategies/mathpix-neet-parser.strategy';
import { DocumentParserFactory } from './parser/factories/document-parser.factory';

@Module({
  controllers: [ImportController],
  providers: [
    ImportService,
    MarkdownParserService,
    QuestionParserService,
    SolutionParserService,
    QuestionMatcherService,
    MathpixNeetQuestionBoundaryStrategy,
    MathpixNeetParserStrategy,
    DocumentParserFactory,
  ],
  exports: [ImportService],
})
export class ImportModule {}
