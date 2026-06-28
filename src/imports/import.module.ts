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
import { DeepseekService } from './llm/deepseek.service';
import { AiOutputValidator } from './validators/ai-output.validator';
import { BusinessValidator } from './validators/business.validator';
import { QuestionMapper } from './mapper/question.mapper';
import { MarkdownImageExtractorService } from './mapper/markdown-image.extractor';
import { QuestionChunkerService } from './chunking/question-chunker.service';

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
    DeepseekService,
    AiOutputValidator,
    BusinessValidator,
    QuestionMapper,
    MarkdownImageExtractorService,
    QuestionChunkerService,
  ],
  exports: [ImportService],
})
export class ImportModule {}
