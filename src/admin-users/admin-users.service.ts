import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { StudyTimePreference } from '../common/enums/study-time-preference.enum';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import {
  MockTestAttempt,
  MockTestAttemptDocument,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  AttemptActivityCounts,
  buildAttemptActivityPipeline,
  EMPTY_ATTEMPT_ACTIVITY,
  normalizeAttemptActivity,
  totalAttempts,
} from './admin-users.attempt-counts';
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
import {
  buildUserPerformancePipeline,
  mapUserPerformance,
  UserPerformanceAggregate,
} from './admin-users.performance';
import {
  AppUserDetailDto,
  AppUserDetailProfileDto,
} from './dto/app-user-detail.dto';
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
        this.toListItem(
          user,
          attemptCounts.get(String(user._id)) ?? EMPTY_ATTEMPT_ACTIVITY,
        ),
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

  /**
   * Learner profile plus finished-attempt performance for the admin detail page.
   * Admins and unknown ids are not found. Open attempts stay in `testActivity`
   * only; the recent lists and analysis use finished attempts.
   */
  async getAppUserDetails(id: string): Promise<AppUserDetailDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    let userId: Types.ObjectId;
    try {
      userId = new Types.ObjectId(id);
    } catch {
      throw new BadRequestException('Invalid user ID format');
    }

    const user = await this.userModel
      .findOne({
        ...buildAppUserFilter(),
        _id: userId,
      })
      .populate('targetExam', 'name')
      .exec();

    if (!user || !isAppUserRole(user.role)) {
      throw new NotFoundException('Learner not found');
    }

    const learnerId = user._id as Types.ObjectId;
    const [attemptCounts, performanceRows] = await Promise.all([
      this.countAttemptsByUser([learnerId]),
      this.attemptModel
        .aggregate<UserPerformanceAggregate>(
          buildUserPerformancePipeline(learnerId),
        )
        .exec(),
    ]);

    const activity =
      attemptCounts.get(String(user._id)) ?? EMPTY_ATTEMPT_ACTIVITY;
    const listItem = this.toListItem(user, activity);
    if (!listItem) {
      throw new NotFoundException('Learner not found');
    }

    const performance = mapUserPerformance(
      Array.isArray(performanceRows) ? performanceRows[0] : undefined,
    );

    return {
      profile: this.toDetailProfile(user, listItem),
      recentTopicWiseAttempts: performance.recentTopicWiseAttempts,
      recentFullExamAttempts: performance.recentFullExamAttempts,
      recentSprintAttempts: performance.recentSprintAttempts,
      analysis: performance.analysis,
    };
  }

  private async countAttemptsByUser(
    userIds: Types.ObjectId[],
  ): Promise<Map<string, AttemptActivityCounts>> {
    const counts = new Map<string, AttemptActivityCounts>();
    if (userIds.length === 0) {
      return counts;
    }

    const rows = await this.attemptModel
      .aggregate<
        AttemptActivityCounts & {
          _id: Types.ObjectId;
        }
      >(buildAttemptActivityPipeline(userIds))
      .exec();

    for (const row of rows) {
      counts.set(String(row._id), normalizeAttemptActivity(row));
    }
    return counts;
  }

  private toListItem(
    user: UserDocument,
    activity: AttemptActivityCounts,
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
    const counts = normalizeAttemptActivity(activity);

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
      testsAttendedCount: totalAttempts(counts),
      testActivity: {
        fullExam: {
          finished: counts.fullExamFinished,
          open: counts.fullExamOpen,
        },
        topicWise: {
          finished: counts.topicWiseFinished,
          open: counts.topicWiseOpen,
        },
        sprint: {
          finished: counts.sprintFinished,
          open: counts.sprintOpen,
        },
      },
      createdAt: (obj.createdAt as Date) ?? new Date(0),
      updatedAt: (obj.updatedAt as Date) ?? new Date(0),
    };
  }

  private toDetailProfile(
    user: UserDocument,
    listItem: AppUserListItemDto,
  ): AppUserDetailProfileDto {
    const obj = user.toObject() as Record<string, unknown>;
    const subscription = (obj.subscription ?? {}) as Record<string, unknown>;
    const preferences = (obj.preferences ?? {}) as Record<string, unknown>;
    const study = studyPreference(preferences);
    const profile: AppUserDetailProfileDto = {
      ...listItem,
      subscription: {
        plan: listItem.subscription?.plan ?? SubscriptionPlan.FREE,
        status: listItem.subscription?.status ?? SubscriptionStatus.ACTIVE,
        startedAt: asOptionalDate(subscription.startedAt),
        expiresAt: asOptionalDate(subscription.expiresAt),
        trialEndsAt: asOptionalDate(subscription.trialEndsAt),
        ...(typeof subscription.autoRenew === 'boolean'
          ? { autoRenew: subscription.autoRenew }
          : {}),
      },
    };

    const bio = asOptionalString(obj.bio);
    const dateOfBirth = asOptionalDate(obj.dateOfBirth);
    const targetExamDate = asOptionalDate(obj.targetExamDate);
    const lastTierUpdatedAt = asOptionalDate(obj.lastTierUpdatedAt);
    if (bio) {
      profile.bio = bio;
    }
    if (dateOfBirth) {
      profile.dateOfBirth = dateOfBirth;
    }
    if (targetExamDate) {
      profile.targetExamDate = targetExamDate;
    }
    if (lastTierUpdatedAt) {
      profile.lastTierUpdatedAt = lastTierUpdatedAt;
    }
    if (study) {
      profile.study = study;
    }
    return profile;
  }
}

const STUDY_TIMES = new Set<string>(Object.values(StudyTimePreference));

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asOptionalDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return undefined;
}

function asStudyHours(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const hours = Math.trunc(value);
  if (hours < 1 || hours > 100) {
    return undefined;
  }
  return hours;
}

function studyPreference(
  preferences: Record<string, unknown>,
): AppUserDetailProfileDto['study'] {
  const studyTime = asOptionalString(preferences.studyTime);
  const weeklyStudyGoalHours = asStudyHours(preferences.weeklyStudyGoalHours);
  const knownStudyTime =
    studyTime && STUDY_TIMES.has(studyTime)
      ? (studyTime as StudyTimePreference)
      : undefined;
  if (!knownStudyTime && weeklyStudyGoalHours == null) {
    return undefined;
  }
  return {
    ...(knownStudyTime ? { studyTime: knownStudyTime } : {}),
    ...(weeklyStudyGoalHours != null ? { weeklyStudyGoalHours } : {}),
  };
}
