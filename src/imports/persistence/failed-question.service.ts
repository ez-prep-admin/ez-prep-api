import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FailedQuestion,
  FailedQuestionDocument,
} from '../schemas/failed-question.schema';
import { RejectedQuestion } from '../types/import-question';

/** Left behind when uniqueness moved from question number to parse index. */
export const LEGACY_FAILED_QUESTION_NUMBER_INDEX =
  'uploadId_1_questionNumber_1';

type IndexSpec = { name?: string; unique?: boolean };

export async function dropLegacyFailedQuestionNumberIndex(collection: {
  indexes(): Promise<IndexSpec[]>;
  dropIndex(name: string): Promise<unknown>;
}): Promise<boolean> {
  const indexes = await collection.indexes();
  const legacy = indexes.find(
    index => index.name === LEGACY_FAILED_QUESTION_NUMBER_INDEX,
  );
  if (!legacy) {
    return false;
  }
  await collection.dropIndex(LEGACY_FAILED_QUESTION_NUMBER_INDEX);
  return true;
}

@Injectable()
export class FailedQuestionService implements OnModuleInit {
  private readonly logger = new Logger(FailedQuestionService.name);

  constructor(
    @InjectModel(FailedQuestion.name)
    private readonly failedQuestionModel: Model<FailedQuestionDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const dropped = await dropLegacyFailedQuestionNumberIndex(
        this.failedQuestionModel.collection,
      );
      if (dropped) {
        this.logger.log(
          `[failed-questions] Dropped legacy unique index ${LEGACY_FAILED_QUESTION_NUMBER_INDEX}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[failed-questions] Could not drop legacy unique index ${LEGACY_FAILED_QUESTION_NUMBER_INDEX}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  async replaceForUpload(
    uploadId: string,
    rejected: RejectedQuestion[],
  ): Promise<void> {
    await this.failedQuestionModel.deleteMany({
      uploadId: new Types.ObjectId(uploadId),
    });

    if (rejected.length === 0) {
      return;
    }

    const usedParseIndexes = new Set<number>();
    await this.failedQuestionModel.insertMany(
      rejected.map((item, position) => {
        const preferred = item.index ?? item.matchedQuestion.index;
        let parseIndex =
          typeof preferred === 'number' && preferred >= 0
            ? preferred
            : position;
        while (usedParseIndexes.has(parseIndex)) {
          parseIndex += 1;
        }
        usedParseIndexes.add(parseIndex);

        return {
          uploadId: new Types.ObjectId(uploadId),
          questionNumber: item.number,
          parseIndex,
          matchedQuestion: item.matchedQuestion,
          failureStage: item.stage,
          failureMessage: item.message,
          questionDraft: item.questionDraft,
        };
      }),
    );

    this.logger.log(
      `[failed-questions] Stored ${rejected.length} rejected question(s) for upload_id=${uploadId}`,
    );
  }

  async listPaginated(
    page: number,
    limit: number,
    filters?: {
      subjectId?: string;
      topicId?: string;
      examId?: string;
    },
  ): Promise<{
    docs: FailedQuestionDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const validPage = Math.max(1, Number(page) || 1);
    const validLimit = Math.min(Math.max(1, Number(limit) || 10), 100);
    const skip = (validPage - 1) * validLimit;
    const query: Record<string, unknown> = {};

    if (filters?.subjectId && Types.ObjectId.isValid(filters.subjectId)) {
      query['questionDraft.subject'] = filters.subjectId;
    }
    if (filters?.topicId && Types.ObjectId.isValid(filters.topicId)) {
      query['questionDraft.topic'] = filters.topicId;
    }
    if (filters?.examId && Types.ObjectId.isValid(filters.examId)) {
      query['questionDraft.exams'] = filters.examId;
    }

    const [docs, total] = await Promise.all([
      this.failedQuestionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.failedQuestionModel.countDocuments(query),
    ]);

    return { docs, total, page: validPage, limit: validLimit };
  }

  async listByUpload(uploadId: string): Promise<FailedQuestionDocument[]> {
    return this.failedQuestionModel
      .find({ uploadId: new Types.ObjectId(uploadId) })
      .sort({ questionNumber: 1 })
      .exec();
  }

  async findByIdOrThrow(
    failedQuestionId: string,
  ): Promise<FailedQuestionDocument> {
    if (!Types.ObjectId.isValid(failedQuestionId)) {
      throw new BadRequestException(
        `Invalid failed question ID: ${failedQuestionId}`,
      );
    }

    const doc = await this.failedQuestionModel.findById(
      new Types.ObjectId(failedQuestionId),
    );

    if (!doc) {
      throw new NotFoundException(
        `Failed question not found with ID: ${failedQuestionId}`,
      );
    }

    return doc;
  }

  async deleteByIdOrThrow(
    failedQuestionId: string,
  ): Promise<FailedQuestionDocument> {
    const doc = await this.findByIdOrThrow(failedQuestionId);

    await this.failedQuestionModel.deleteOne({ _id: doc._id });

    this.logger.log(
      `[failed-questions] Deleted failed_question_id=${failedQuestionId} (upload_id=${doc.uploadId.toString()}, question_number=${doc.questionNumber})`,
    );

    return doc;
  }

  async deleteById(failedQuestionId: string): Promise<void> {
    await this.deleteByIdOrThrow(failedQuestionId);
  }

  async countByUpload(uploadId: string): Promise<number> {
    return this.failedQuestionModel.countDocuments({
      uploadId: new Types.ObjectId(uploadId),
    });
  }
}
