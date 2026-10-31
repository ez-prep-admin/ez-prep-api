import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { maskEmail } from '../admin-users/admin-users.guardrails';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import {
  FeedbackAuthorDto,
  FeedbackCategorySummaryDto,
  FeedbackCreatedDto,
  FeedbackListItemDto,
  FeedbackRatingsResponseDto,
  FeedbackSummaryDto,
} from './dto/feedback-response.dto';
import {
  clampLimit,
  clampPage,
  FEEDBACK_RATING_KEYS,
  FeedbackRatingKey,
  FeedbackRatings,
  roundToOneDecimal,
} from './feedback.constants';
import { Feedback, FeedbackDocument } from './schemas/feedback.schema';

type RatingAggregate = {
  feedbackCount: number;
} & Record<`${FeedbackRatingKey}Sum` | `${FeedbackRatingKey}Count`, number>;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
  ) {}

  async create(
    userId: string,
    dto: CreateFeedbackDto,
  ): Promise<FeedbackCreatedDto> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const text = dto.text?.trim() || undefined;
    const ratings = ratingsFromDto(dto);
    if (!text && Object.keys(ratings).length === 0) {
      throw new BadRequestException('Share a rating or a written note');
    }

    const created = await this.feedbackModel.create({
      userId: new Types.ObjectId(userId),
      ...(text ? { text } : {}),
      ratings,
    });

    return this.toCreated(created);
  }

  async summary(): Promise<FeedbackSummaryDto> {
    const [row] = await this.feedbackModel.aggregate<RatingAggregate>([
      { $group: ratingGroupStage() },
    ]);

    if (!row) {
      return emptySummary();
    }

    let ratedSum = 0;
    let ratedCount = 0;
    const categories = {} as Record<
      FeedbackRatingKey,
      FeedbackCategorySummaryDto
    >;

    for (const key of FEEDBACK_RATING_KEYS) {
      const count = row[`${key}Count`] ?? 0;
      const sum = row[`${key}Sum`] ?? 0;
      ratedSum += sum;
      ratedCount += count;
      categories[key] = {
        average: count > 0 ? roundToOneDecimal(sum / count) : null,
        count,
      };
    }

    return {
      feedbackCount: row.feedbackCount ?? 0,
      overall: ratedCount > 0 ? roundToOneDecimal(ratedSum / ratedCount) : null,
      ratedCount,
      ...categories,
    };
  }

  async list(
    page = 1,
    limit = 10,
  ): Promise<{ data: FeedbackListItemDto[]; pagination: PaginationMetaDto }> {
    const validPage = clampPage(page);
    const validLimit = clampLimit(limit);
    const skip = (validPage - 1) * validLimit;

    const [documents, total] = await Promise.all([
      this.feedbackModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .populate('userId', 'name email')
        .exec(),
      this.feedbackModel.countDocuments().exec(),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / validLimit);

    return {
      data: documents.map(doc => this.toListItem(doc)),
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1 && totalPages > 0,
      },
    };
  }

  private toCreated(doc: FeedbackDocument): FeedbackCreatedDto {
    return {
      id: documentId(doc),
      text: doc.text ?? null,
      ratings: publicRatings(doc.ratings),
      createdAt: doc.createdAt ?? new Date(),
    };
  }

  private toListItem(doc: FeedbackDocument): FeedbackListItemDto {
    return {
      ...this.toCreated(doc),
      user: authorFromPopulated(doc.userId),
    };
  }
}

function ratingsFromDto(dto: CreateFeedbackDto): FeedbackRatings {
  const ratings: FeedbackRatings = {};
  for (const key of FEEDBACK_RATING_KEYS) {
    const value = dto[key];
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 5
    ) {
      ratings[key] = value;
    }
  }
  return ratings;
}

function publicRatings(
  ratings?: FeedbackRatings | null,
): FeedbackRatingsResponseDto {
  const result: FeedbackRatingsResponseDto = {};
  if (!ratings) {
    return result;
  }
  for (const key of FEEDBACK_RATING_KEYS) {
    const value = ratings[key];
    if (typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

function ratingGroupStage(): PipelineStage.Group['$group'] {
  const group: Record<string, unknown> = {
    _id: null,
    feedbackCount: { $sum: 1 },
  };

  for (const key of FEEDBACK_RATING_KEYS) {
    const path = `$ratings.${key}`;
    const present = {
      $and: [{ $gte: [path, 1] }, { $lte: [path, 5] }],
    };
    group[`${key}Sum`] = { $sum: { $cond: [present, path, 0] } };
    group[`${key}Count`] = { $sum: { $cond: [present, 1, 0] } };
  }

  return group as PipelineStage.Group['$group'];
}

function emptyCategory(): FeedbackCategorySummaryDto {
  return { average: null, count: 0 };
}

function emptySummary(): FeedbackSummaryDto {
  return {
    feedbackCount: 0,
    overall: null,
    ratedCount: 0,
    userInterface: emptyCategory(),
    questions: emptyCategory(),
    fullMockTests: emptyCategory(),
    topicWisePractice: emptyCategory(),
    easeOfUse: emptyCategory(),
  };
}

function documentId(doc: FeedbackDocument): string {
  if (typeof doc.id === 'string' && doc.id.length > 0) {
    return doc.id;
  }
  return String(doc._id);
}

function authorFromPopulated(value: unknown): FeedbackAuthorDto | null {
  if (!value || typeof value !== 'object' || !('name' in value)) {
    return null;
  }

  const author = value as {
    id?: string;
    _id?: Types.ObjectId;
    name?: string;
    email?: string;
  };
  if (typeof author.name !== 'string' || typeof author.email !== 'string') {
    return null;
  }

  const id =
    typeof author.id === 'string' && author.id.length > 0
      ? author.id
      : author._id
        ? String(author._id)
        : '';
  if (!id) {
    return null;
  }

  return { id, name: author.name, email: maskEmail(author.email) };
}
