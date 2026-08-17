import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import {
  MockTestAttempt,
  MockTestAttemptDocument,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  APP_USER_ROLE,
  buildAppUserFilter,
  clampLimit,
  clampPage,
  excludeNonAppUsers,
  isAppUserRole,
  maskEmail,
  maskPhoneNumber,
} from './admin-users.guardrails';
import { AppUserListItemDto } from './dto/app-user-list-item.dto';
import { PaginatedAppUsersResponseDto } from './dto/paginated-app-users-response.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(MockTestAttempt.name)
    private readonly attemptModel: Model<MockTestAttemptDocument>,
  ) {}

  async listAppUsers(
    page = 1,
    limit = 12,
    search?: string,
  ): Promise<PaginatedAppUsersResponseDto> {
    const validPage = clampPage(page);
    const validLimit = clampLimit(limit);
    const skip = (validPage - 1) * validLimit;
    const filter = buildAppUserFilter(search);

    const [documents, total] = await Promise.all([
      this.userModel
        .find(filter)
        .populate('targetExam', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    const learners = excludeNonAppUsers(documents);
    const attemptCounts = await this.countAttemptsByUser(
      learners.map(user => user._id as Types.ObjectId),
    );

    const data = learners
      .map(user =>
        this.toListItem(user, attemptCounts.get(String(user._id)) ?? 0),
      )
      .filter((item): item is AppUserListItemDto => item !== null);

    const totalPages = Math.ceil(total / validLimit);
    const pagination: PaginationMetaDto = {
      total,
      page: validPage,
      limit: validLimit,
      totalPages,
      hasNextPage: validPage < totalPages,
      hasPrevPage: validPage > 1,
    };

    return { data, pagination };
  }

  private async countAttemptsByUser(
    userIds: Types.ObjectId[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (userIds.length === 0) {
      return counts;
    }

    const rows = await this.attemptModel
      .aggregate<{
        _id: Types.ObjectId;
        count: number;
      }>([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ])
      .exec();

    for (const row of rows) {
      counts.set(String(row._id), row.count);
    }
    return counts;
  }

  private toListItem(
    user: UserDocument,
    testsAttendedCount: number,
  ): AppUserListItemDto | null {
    if (!isAppUserRole(user.role)) {
      return null;
    }

    const obj = user.toObject() as Record<string, unknown>;

    if (!isAppUserRole(obj.role)) {
      return null;
    }

    delete obj.username;
    delete obj.passwordHash;
    delete obj.preferences;
    delete obj.interactions;
    delete obj.bio;
    delete obj.dateOfBirth;
    delete obj.isDeleted;

    let targetExam: AppUserListItemDto['targetExam'];
    if (obj.targetExam != null && typeof obj.targetExam === 'object') {
      const exam = obj.targetExam as Record<string, unknown>;
      if ('name' in exam && exam.name) {
        targetExam = {
          id: String(exam.id ?? exam._id ?? ''),
          name: String(exam.name),
        };
        if (!targetExam.id) {
          targetExam = undefined;
        }
      }
    }

    const location = obj.location as AppUserListItemDto['location'] | undefined;
    const subscription = obj.subscription as
      | { plan?: SubscriptionPlan; status?: SubscriptionStatus }
      | undefined;

    return {
      id: String(obj.id ?? user._id),
      name: String(obj.name ?? ''),
      email: maskEmail(obj.email),
      phoneNumber: maskPhoneNumber(obj.phoneNumber),
      avatarUrl: typeof obj.avatarUrl === 'string' ? obj.avatarUrl : undefined,
      role: APP_USER_ROLE,
      isActive: obj.isActive !== false,
      gender: obj.gender as AppUserListItemDto['gender'],
      location,
      subscription: {
        plan: subscription?.plan ?? SubscriptionPlan.FREE,
        status: subscription?.status ?? SubscriptionStatus.ACTIVE,
      },
      membershipTier:
        obj.membershipTier as AppUserListItemDto['membershipTier'],
      badgesEarnedCount:
        typeof obj.badgesEarnedCount === 'number' ? obj.badgesEarnedCount : 0,
      targetExam,
      testsAttendedCount: Math.max(0, testsAttendedCount),
      createdAt: (obj.createdAt as Date) ?? new Date(0),
      updatedAt: (obj.updatedAt as Date) ?? new Date(0),
    };
  }
}
