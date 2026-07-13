import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Question,
  QuestionDocument,
} from '../../mock-test-attempts/schemas/question.schema';
import { ImportQuestion } from '../types/import-question';

@Injectable()
export class QuestionPersistenceService {
  private readonly logger = new Logger(QuestionPersistenceService.name);

  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
  ) {}

  async saveOne(question: ImportQuestion): Promise<QuestionDocument> {
    const payload = this.toDocumentPayload(question);

    try {
      const created = await this.questionModel.create(payload);
      this.logger.log(`[persist] Saved question ${created._id.toString()}`);
      return created;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Failed to save question to database: ${message}`);
    }
  }

  private toDocumentPayload(question: ImportQuestion) {
    return {
      questionText: {
        en: {
          text: question.questionText.en.text ?? undefined,
          image: question.questionText.en.image ?? undefined,
        },
        ml: {
          text: null,
          image: null,
        },
      },
      optionType: question.optionType,
      options: question.options.map(option => ({
        id: option.id,
        type: option.type,
        en: option.en,
        ml: option.ml,
        image: option.image ?? undefined,
      })),
      explanation: {
        en: question.explanation.en,
        ml: question.explanation.ml,
        image: question.explanation.image ?? undefined,
      },
      correctAnswer: question.correctAnswer,
      subject: new Types.ObjectId(question.subject),
      topic: new Types.ObjectId(question.topic),
      exams: question.exams.map(examId => new Types.ObjectId(examId)),
      difficultyLevel: question.difficultyLevel,
      isActive: question.isActive,
      isDeleted: question.isDeleted,
      source: question.source,
      ...(question.uploadId
        ? { uploadId: new Types.ObjectId(question.uploadId) }
        : {}),
    };
  }
}
