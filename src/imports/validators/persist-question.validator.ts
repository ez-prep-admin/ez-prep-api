import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ZodError } from 'zod';
import {
  Subject,
  SubjectDocument,
} from '../../subjects/schemas/subject.schema';
import { Topic, TopicDocument } from '../../topics/schemas/topic.schema';
import { Exam, ExamDocument } from '../../exams/schemas/exam.schema';
import { ImportQuestion, ImportQuestionInput } from '../types/import-question';
import {
  ImportQuestionSchema,
} from './import-question.schema';
import { NEET_BUSINESS_VALIDATOR_CONFIG } from '../config/business-validator.config';
import type { z } from 'zod';

type ParsedImportQuestion = z.infer<typeof ImportQuestionSchema>;

export class PersistQuestionValidationError extends Error {
  constructor(
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'PersistQuestionValidationError';
  }
}

@Injectable()
export class PersistQuestionValidator {
  private readonly logger = new Logger(PersistQuestionValidator.name);

  constructor(
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
  ) {}

  async validateQuestion(
    question: ImportQuestionInput,
    index: number,
  ): Promise<ImportQuestion> {
    try {
      const validated = ImportQuestionSchema.parse(question);
      this.assertNeetOptionRules(validated, index);
      await this.assertReferencesExist(validated, index);
      return validated as ImportQuestion;
    } catch (error) {
      if (error instanceof PersistQuestionValidationError) {
        throw error;
      }

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof ZodError) {
        throw new PersistQuestionValidationError(
          `Question at index ${index} failed validation.`,
          error.issues.map(
            issue => `${issue.path.join('.') || 'root'}: ${issue.message}`,
          ),
        );
      }

      throw error;
    }
  }

  private assertNeetOptionRules(
    question: ParsedImportQuestion,
    index: number,
  ): void {
    const { optionCount } = NEET_BUSINESS_VALIDATOR_CONFIG;

    if (question.options.length !== optionCount) {
      throw new PersistQuestionValidationError(
        `Question at index ${index} must contain exactly ${optionCount} options.`,
      );
    }

    if (question.optionType === 'text') {
      const missingText = question.options.some(option => !option.en?.trim());

      if (missingText) {
        throw new PersistQuestionValidationError(
          `Question at index ${index} has one or more text options without content.`,
        );
      }
    }
  }

  private async assertReferencesExist(
    question: ParsedImportQuestion,
    index: number,
  ): Promise<void> {
    const subjectExists = await this.subjectModel.exists({
      _id: new Types.ObjectId(question.subject),
    });

    if (!subjectExists) {
      throw new NotFoundException(
        `Question at index ${index}: subject ${question.subject} was not found.`,
      );
    }

    const topicExists = await this.topicModel.exists({
      _id: new Types.ObjectId(question.topic),
    });

    if (!topicExists) {
      throw new NotFoundException(
        `Question at index ${index}: topic ${question.topic} was not found.`,
      );
    }

    for (const examId of question.exams) {
      const examExists = await this.examModel.exists({
        _id: new Types.ObjectId(examId),
      });

      if (!examExists) {
        throw new NotFoundException(
          `Question at index ${index}: exam ${examId} was not found.`,
        );
      }
    }
  }
}
