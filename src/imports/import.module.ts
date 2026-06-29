import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { MarkdownParserService } from './parser/markdown-parser.service';
import { QuestionParserService } from './parser/question-parser.service';
import { SolutionParserService } from './parser/solution-parser.service';
import { QuestionMatcherService } from './parser/question-matcher.service';
import { MathpixNeetQuestionBoundaryStrategy } from './parser/boundaries/mathpix-neet-question-boundary.strategy';
import { AdaptiveBoundaryStrategy } from './parser/boundaries/adaptive-boundary.strategy';
import { MathpixNeetParserStrategy } from './parser/strategies/mathpix-neet-parser.strategy';
import { AdaptiveParserStrategy } from './parser/strategies/adaptive-parser.strategy';
import { DocumentParserFactory } from './parser/factories/document-parser.factory';
import { StructureDetectorService } from './parser/structure-detector.service';
import { DeepseekService } from './llm/deepseek.service';
import { AiOutputValidator } from './validators/ai-output.validator';
import { BusinessValidator } from './validators/business.validator';
import { QuestionMapper } from './mapper/question.mapper';
import { MarkdownImageExtractorService } from './mapper/markdown-image.extractor';
import { QuestionChunkerService } from './chunking/question-chunker.service';
import { PersistQuestionValidator } from './validators/persist-question.validator';
import { QuestionPersistenceService } from './persistence/question-persistence.service';
import {
  Question,
  QuestionSchema,
} from '../mock-test-attempts/schemas/question.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema';
import {
  QuestionUpload,
  QuestionUploadSchema,
} from './schemas/question-upload.schema';
import { AwsModule } from '../aws/aws.module';
import { MathpixModule } from '../integrations/mathpix/mathpix.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Topic.name, schema: TopicSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: QuestionUpload.name, schema: QuestionUploadSchema },
    ]),
    AwsModule,
    MathpixModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    MarkdownParserService,
    QuestionParserService,
    SolutionParserService,
    QuestionMatcherService,
    MathpixNeetQuestionBoundaryStrategy,
    AdaptiveBoundaryStrategy,
    MathpixNeetParserStrategy,
    AdaptiveParserStrategy,
    DocumentParserFactory,
    StructureDetectorService,
    DeepseekService,
    AiOutputValidator,
    BusinessValidator,
    QuestionMapper,
    MarkdownImageExtractorService,
    QuestionChunkerService,
    PersistQuestionValidator,
    QuestionPersistenceService,
  ],
  exports: [ImportService],
})
export class ImportModule {}
