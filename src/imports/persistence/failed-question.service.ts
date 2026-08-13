import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FailedQuestion,
  FailedQuestionDocument,
} from '../schemas/failed-question.schema';
import { RejectedQuestion } from '../types/import-question';

@Injectable()
export class FailedQuestionService {
  private readonly logger = new Logger(FailedQuestionService.name);

  constructor(
    @InjectModel(FailedQuestion.name)
    private readonly failedQuestionModel: Model<FailedQuestionDocument>,
  ) {}

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

    await this.failedQuestionModel.insertMany(
      rejected.map(item => ({
        uploadId: new Types.ObjectId(uploadId),
        questionNumber: item.number,
        parseIndex: item.index ?? item.matchedQuestion.index ?? item.number,
        matchedQuestion: item.matchedQuestion,
        failureStage: item.stage,
        failureMessage: item.message,
        questionDraft: item.questionDraft,
      })),
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
