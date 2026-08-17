import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../common/enums/user-role.enum';
import {
  Question,
  QuestionDocument,
} from '../mock-test-attempts/schemas/question.schema';
import {
  FailedQuestion,
  FailedQuestionDocument,
} from '../imports/schemas/failed-question.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import { PaperType } from '../common/enums/paper-type.enum';
import {
  FullMockTestDraft,
  FullMockTestDraftDocument,
} from '../full-mock-tests/schemas/full-mock-test-draft.schema';
import {
  MockTestAttempt,
  MockTestAttemptDocument,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { EFFECTIVE_TIME_CONSUMED_EXPR } from '../common/aggregations/attempt-time.aggregation';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Topic, TopicDocument } from '../topics/schemas/topic.schema';
import { Tag, TagDocument } from '../tags/schemas/tag.schema';
import {
  AdminDashboardAttemptsDto,
  AdminDashboardExamsDto,
  AdminDashboardFailedQuestionsDto,
  AdminDashboardFullMockTestsDto,
  AdminDashboardMockTestsDto,
  AdminDashboardQuestionsDto,
  AdminDashboardSubjectsDto,
  AdminDashboardSummaryDto,
  AdminDashboardTagsDto,
  AdminDashboardTopicsDto,
  AdminDashboardUsersDto,
  AttemptExamRowDto,
  NamedCountDto,
} from './dto/admin-dashboard.dto';

const NOT_DELETED = { isDeleted: { $ne: true } };
const ACTIVE = { isActive: true, ...NOT_DELETED };
const LEARNER = { role: UserRole.USER, ...NOT_DELETED };
const IN_PROGRESS_STATUSES = ['IN_PROGRESS', 'PAUSED'];

export function formatDurationLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(FailedQuestion.name)
    private readonly failedQuestionModel: Model<FailedQuestionDocument>,
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
    @InjectModel(FullMockTestDraft.name)
    private readonly draftModel: Model<FullMockTestDraftDocument>,
    @InjectModel(MockTestAttempt.name)
    private readonly attemptModel: Model<MockTestAttemptDocument>,
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Topic.name) private readonly topicModel: Model<TopicDocument>,
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
  ) {}

  async getSummary(): Promise<AdminDashboardSummaryDto> {
    const [
      activeLearners,
      activeQuestions,
      failedQuestions,
      mockTests,
      fullMockTests,
      attempts,
      exams,
      subjects,
      topics,
      tags,
    ] = await Promise.all([
      this.userModel.countDocuments({ ...LEARNER, isActive: true }),
      this.questionModel.countDocuments(ACTIVE),
      this.failedQuestionModel.countDocuments({}),
      this.mockTestModel.countDocuments({
        paperType: PaperType.TOPIC_WISE,
        ...NOT_DELETED,
      }),
      this.mockTestModel.countDocuments({
        paperType: PaperType.FULL_EXAM,
        ...NOT_DELETED,
      }),
      this.attemptModel.countDocuments({}),
      this.examModel.countDocuments(ACTIVE),
      this.subjectModel.countDocuments(ACTIVE),
      this.topicModel.countDocuments(ACTIVE),
      this.tagModel.countDocuments(ACTIVE),
    ]);

    return {
      activeLearners,
      activeQuestions,
      failedQuestions,
      mockTests,
      fullMockTests,
      attempts,
      exams,
      subjects,
      topics,
      tags,
    };
  }

  async getUsers(): Promise<AdminDashboardUsersDto> {
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalLearners, activeLearners, newLast7Days, newLast30Days, byPlan] =
      await Promise.all([
        this.userModel.countDocuments(LEARNER),
        this.userModel.countDocuments({ ...LEARNER, isActive: true }),
        this.userModel.countDocuments({
          ...LEARNER,
          createdAt: { $gte: last7 },
        }),
        this.userModel.countDocuments({
          ...LEARNER,
          createdAt: { $gte: last30 },
        }),
        this.userModel.aggregate<{ _id: string; count: number }>([
          { $match: LEARNER },
          {
            $group: {
              _id: { $ifNull: ['$subscription.plan', 'unknown'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
      ]);

    return {
      totalLearners,
      activeLearners,
      inactiveLearners: totalLearners - activeLearners,
      newLast7Days,
      newLast30Days,
      byPlan: byPlan.map(row => ({
        plan: row._id || 'unknown',
        count: row.count,
      })),
    };
  }

  async getQuestions(): Promise<AdminDashboardQuestionsDto> {
    const [totalActive, byDifficulty, grouped] = await Promise.all([
      this.questionModel.countDocuments(ACTIVE),
      this.questionModel.aggregate<{ _id: string; count: number }>([
        { $match: ACTIVE },
        {
          $group: {
            _id: { $ifNull: ['$difficultyLevel', 'unspecified'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      this.questionModel.aggregate(this.subjectTopicPipeline()),
    ]);

    return {
      totalActive,
      byDifficulty: byDifficulty.map(row => ({
        difficulty: row._id || 'unspecified',
        count: row.count,
      })),
      bySubjectAndTopic: grouped.map((row: Record<string, unknown>) => ({
        subjectId: String(row.subjectId ?? ''),
        subjectName: String(row.subjectName || 'Unassigned'),
        topicId: row.topicId ? String(row.topicId) : undefined,
        topicName: String(row.topicName || 'Unassigned'),
        count: Number(row.count) || 0,
      })),
    };
  }

  async getFailedQuestions(): Promise<AdminDashboardFailedQuestionsDto> {
    const [total, byStage, bySubject] = await Promise.all([
      this.failedQuestionModel.countDocuments({}),
      this.failedQuestionModel.aggregate<{ _id: string; count: number }>([
        {
          $group: {
            _id: { $ifNull: ['$failureStage', 'unknown'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      this.failedQuestionModel.aggregate([
        {
          $group: {
            _id: '$questionDraft.subject',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'subjects',
            localField: '_id',
            foreignField: '_id',
            as: 'subject',
          },
        },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      total,
      byStage: byStage.map(row => ({
        name: row._id || 'unknown',
        count: row.count,
      })),
      bySubject: bySubject.map((row: Record<string, unknown>) => ({
        id: row._id ? String(row._id) : undefined,
        name:
          ((row.subject as { name?: string } | undefined)?.name as
            | string
            | undefined) || 'Unassigned',
        count: Number(row.count) || 0,
      })),
    };
  }

  async getMockTests(): Promise<AdminDashboardMockTestsDto> {
    const match = { paperType: PaperType.TOPIC_WISE, ...NOT_DELETED };
    const [total, byExam] = await Promise.all([
      this.mockTestModel.countDocuments(match),
      this.groupByExam(this.mockTestModel, match),
    ]);
    return { total, byExam };
  }

  async getFullMockTests(): Promise<AdminDashboardFullMockTestsDto> {
    const match = { paperType: PaperType.FULL_EXAM, ...NOT_DELETED };
    const [totalPublished, byExam, draftsByStatus] = await Promise.all([
      this.mockTestModel.countDocuments(match),
      this.groupByExam(this.mockTestModel, match),
      this.draftModel.aggregate<{ _id: string; count: number }>([
        {
          $group: {
            _id: { $ifNull: ['$status', 'unknown'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      totalPublished,
      byExam,
      draftsByStatus: draftsByStatus.map(row => ({
        name: row._id || 'unknown',
        count: row.count,
      })),
    };
  }

  async getAttempts(): Promise<AdminDashboardAttemptsDto> {
    const [totals] = await this.attemptModel.aggregate<{
      total: number;
      submitted: number;
      expired: number;
      inProgress: number;
      uniqueUsers: string[];
      timeConsumedSeconds: number;
    }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          submitted: {
            $sum: { $cond: [{ $eq: ['$status', 'SUBMITTED'] }, 1, 0] },
          },
          expired: {
            $sum: { $cond: [{ $eq: ['$status', 'EXPIRED'] }, 1, 0] },
          },
          inProgress: {
            $sum: {
              $cond: [{ $in: ['$status', IN_PROGRESS_STATUSES] }, 1, 0],
            },
          },
          uniqueUsers: { $addToSet: '$user' },
          timeConsumedSeconds: { $sum: EFFECTIVE_TIME_CONSUMED_EXPR },
        },
      },
    ]);

    const byExamRaw = await this.attemptModel.aggregate([
      {
        $group: {
          _id: '$exam',
          attempts: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
          submitted: {
            $sum: { $cond: [{ $eq: ['$status', 'SUBMITTED'] }, 1, 0] },
          },
          expired: {
            $sum: { $cond: [{ $eq: ['$status', 'EXPIRED'] }, 1, 0] },
          },
          inProgress: {
            $sum: {
              $cond: [{ $in: ['$status', IN_PROGRESS_STATUSES] }, 1, 0],
            },
          },
          timeConsumedSeconds: { $sum: EFFECTIVE_TIME_CONSUMED_EXPR },
          allottedMinutes: { $sum: { $ifNull: ['$durationInMinutes', 0] } },
        },
      },
      {
        $lookup: {
          from: 'exams',
          localField: '_id',
          foreignField: '_id',
          as: 'exam',
        },
      },
      { $unwind: { path: '$exam', preserveNullAndEmptyArrays: true } },
      { $sort: { attempts: -1 } },
    ]);

    const timeConsumedSeconds = totals?.timeConsumedSeconds ?? 0;
    const byExam: AttemptExamRowDto[] = byExamRaw.map(
      (row: Record<string, unknown>) => {
        const seconds = Number(row.timeConsumedSeconds) || 0;
        return {
          examId: row._id ? String(row._id) : undefined,
          examName:
            ((row.exam as { name?: string } | undefined)?.name as
              | string
              | undefined) || 'Unassigned',
          attempts: Number(row.attempts) || 0,
          uniqueUsers: Array.isArray(row.uniqueUsers)
            ? row.uniqueUsers.length
            : 0,
          submitted: Number(row.submitted) || 0,
          expired: Number(row.expired) || 0,
          inProgress: Number(row.inProgress) || 0,
          timeConsumedSeconds: seconds,
          timeConsumedLabel: formatDurationLabel(seconds),
          allottedMinutes: Number(row.allottedMinutes) || 0,
        };
      },
    );

    return {
      total: totals?.total ?? 0,
      submitted: totals?.submitted ?? 0,
      expired: totals?.expired ?? 0,
      inProgress: totals?.inProgress ?? 0,
      uniqueUsers: totals?.uniqueUsers?.length ?? 0,
      timeConsumedSeconds,
      timeConsumedLabel: formatDurationLabel(timeConsumedSeconds),
      byExam,
    };
  }

  async getExams(): Promise<AdminDashboardExamsDto> {
    const [totalActive, totalInactive, byCategory] = await Promise.all([
      this.examModel.countDocuments(ACTIVE),
      this.examModel.countDocuments({ isActive: false, ...NOT_DELETED }),
      this.examModel.aggregate([
        { $match: ACTIVE },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      totalActive,
      totalInactive,
      byCategory: byCategory.map((row: Record<string, unknown>) => ({
        id: row._id ? String(row._id) : undefined,
        name:
          ((row.category as { name?: string } | undefined)?.name as
            | string
            | undefined) || 'Unassigned',
        count: Number(row.count) || 0,
      })),
    };
  }

  async getSubjects(): Promise<AdminDashboardSubjectsDto> {
    const [totalActive, rows] = await Promise.all([
      this.subjectModel.countDocuments(ACTIVE),
      this.subjectModel.aggregate([
        { $match: NOT_DELETED },
        {
          $project: {
            name: 1,
            isActive: 1,
            topicCount: { $size: { $ifNull: ['$topics', []] } },
          },
        },
        { $sort: { name: 1 } },
      ]),
    ]);

    return {
      totalActive,
      rows: rows.map((row: Record<string, unknown>) => ({
        id: String(row._id),
        name: String(row.name || 'Unnamed'),
        topicCount: Number(row.topicCount) || 0,
        isActive: Boolean(row.isActive),
      })),
    };
  }

  async getTopics(): Promise<AdminDashboardTopicsDto> {
    const [totalActive, rows] = await Promise.all([
      this.topicModel.countDocuments(ACTIVE),
      this.subjectModel.aggregate([
        { $match: NOT_DELETED },
        { $unwind: { path: '$topics', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'topics',
            localField: 'topics',
            foreignField: '_id',
            as: 'topic',
          },
        },
        { $unwind: { path: '$topic', preserveNullAndEmptyArrays: false } },
        { $match: { 'topic.isDeleted': { $ne: true } } },
        {
          $project: {
            id: '$topic._id',
            name: '$topic.name',
            subjectId: '$_id',
            subjectName: '$name',
          },
        },
        { $sort: { subjectName: 1, name: 1 } },
      ]),
    ]);

    return {
      totalActive,
      rows: rows.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name || 'Unnamed'),
        subjectId: String(row.subjectId),
        subjectName: String(row.subjectName || 'Unassigned'),
      })),
    };
  }

  async getTags(): Promise<AdminDashboardTagsDto> {
    const [totalActive, rows] = await Promise.all([
      this.tagModel.countDocuments(ACTIVE),
      this.tagModel.aggregate([
        { $match: ACTIVE },
        {
          $lookup: {
            from: 'subjects',
            localField: 'subject',
            foreignField: '_id',
            as: 'subjectDoc',
          },
        },
        {
          $lookup: {
            from: 'topics',
            localField: 'topic',
            foreignField: '_id',
            as: 'topicDoc',
          },
        },
        { $unwind: { path: '$subjectDoc', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$topicDoc', preserveNullAndEmptyArrays: true } },
        { $sort: { name: 1 } },
      ]),
    ]);

    return {
      totalActive,
      rows: rows.map((row: Record<string, unknown>) => ({
        id: String(row._id),
        name: String(row.name || 'Unnamed'),
        subjectId: row.subject ? String(row.subject) : '',
        subjectName:
          ((row.subjectDoc as { name?: string } | undefined)?.name as
            | string
            | undefined) || 'Unassigned',
        topicName: (row.topicDoc as { name?: string } | undefined)?.name,
      })),
    };
  }

  private subjectTopicPipeline(): PipelineStage[] {
    return [
      { $match: ACTIVE },
      {
        $group: {
          _id: { subject: '$subject', topic: '$topic' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id.subject',
          foreignField: '_id',
          as: 'subjectDoc',
        },
      },
      {
        $lookup: {
          from: 'topics',
          localField: '_id.topic',
          foreignField: '_id',
          as: 'topicDoc',
        },
      },
      { $unwind: { path: '$subjectDoc', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$topicDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          subjectId: '$_id.subject',
          subjectName: { $ifNull: ['$subjectDoc.name', 'Unassigned'] },
          topicId: '$_id.topic',
          topicName: { $ifNull: ['$topicDoc.name', 'Unassigned'] },
          count: 1,
        },
      },
      { $sort: { subjectName: 1, topicName: 1 } },
    ];
  }

  private async groupByExam(
    model: Model<MockTestDocument>,
    match: Record<string, unknown>,
  ): Promise<NamedCountDto[]> {
    const rows = await model.aggregate([
      { $match: match },
      { $group: { _id: '$exam', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'exams',
          localField: '_id',
          foreignField: '_id',
          as: 'exam',
        },
      },
      { $unwind: { path: '$exam', preserveNullAndEmptyArrays: true } },
      { $sort: { count: -1 } },
    ]);

    return rows.map((row: Record<string, unknown>) => ({
      id: row._id ? String(row._id) : undefined,
      name:
        ((row.exam as { name?: string } | undefined)?.name as
          | string
          | undefined) || 'Unassigned',
      count: Number(row.count) || 0,
    }));
  }
}
