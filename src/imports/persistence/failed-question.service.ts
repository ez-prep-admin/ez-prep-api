import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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
      throw new BadRequestException(`Invalid failed question ID: ${failedQuestionId}`);
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

  async deleteById(failedQuestionId: string): Promise<void> {
    await this.failedQuestionModel.deleteOne({
      _id: new Types.ObjectId(failedQuestionId),
    });
  }

  async countByUpload(uploadId: string): Promise<number> {
    return this.failedQuestionModel.countDocuments({
      uploadId: new Types.ObjectId(uploadId),
    });
  }
}
