import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminDashboardSummaryDto {
  @ApiProperty()
  activeLearners: number;

  @ApiProperty()
  activeQuestions: number;

  @ApiProperty()
  failedQuestions: number;

  @ApiProperty()
  mockTests: number;

  @ApiProperty()
  fullMockTests: number;

  @ApiProperty()
  attempts: number;

  @ApiProperty()
  exams: number;

  @ApiProperty()
  subjects: number;

  @ApiProperty()
  topics: number;

  @ApiProperty()
  tags: number;
}

export class NamedCountDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  count: number;
}

export class PlanCountDto {
  @ApiProperty()
  plan: string;

  @ApiProperty()
  count: number;
}

export class AdminDashboardUsersDto {
  @ApiProperty()
  totalLearners: number;

  @ApiProperty()
  activeLearners: number;

  @ApiProperty()
  inactiveLearners: number;

  @ApiProperty()
  newLast7Days: number;

  @ApiProperty()
  newLast30Days: number;

  @ApiProperty({ type: [PlanCountDto] })
  byPlan: PlanCountDto[];
}

export class QuestionSubjectTopicRowDto {
  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiPropertyOptional()
  topicId?: string;

  @ApiProperty()
  topicName: string;

  @ApiProperty()
  count: number;
}

export class DifficultyCountDto {
  @ApiProperty()
  difficulty: string;

  @ApiProperty()
  count: number;
}

export class AdminDashboardQuestionsDto {
  @ApiProperty()
  totalActive: number;

  @ApiProperty({ type: [DifficultyCountDto] })
  byDifficulty: DifficultyCountDto[];

  @ApiProperty({ type: [QuestionSubjectTopicRowDto] })
  bySubjectAndTopic: QuestionSubjectTopicRowDto[];
}

export class AdminDashboardFailedQuestionsDto {
  @ApiProperty()
  total: number;

  @ApiProperty({ type: [NamedCountDto] })
  byStage: NamedCountDto[];

  @ApiProperty({ type: [NamedCountDto] })
  bySubject: NamedCountDto[];
}

export class AdminDashboardMockTestsDto {
  @ApiProperty()
  total: number;

  @ApiProperty({ type: [NamedCountDto] })
  byExam: NamedCountDto[];
}

export class AdminDashboardFullMockTestsDto {
  @ApiProperty()
  totalPublished: number;

  @ApiProperty({ type: [NamedCountDto] })
  byExam: NamedCountDto[];

  @ApiProperty({ type: [NamedCountDto] })
  draftsByStatus: NamedCountDto[];
}

export class AttemptExamRowDto {
  @ApiPropertyOptional()
  examId?: string;

  @ApiProperty()
  examName: string;

  @ApiProperty()
  attempts: number;

  @ApiProperty()
  uniqueUsers: number;

  @ApiProperty()
  submitted: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  inProgress: number;

  @ApiProperty({ description: 'Total time consumed in seconds' })
  timeConsumedSeconds: number;

  @ApiProperty()
  timeConsumedLabel: string;

  @ApiProperty({ description: 'Sum of allotted duration in minutes' })
  allottedMinutes: number;
}

export class AdminDashboardAttemptsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  submitted: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  inProgress: number;

  @ApiProperty()
  uniqueUsers: number;

  @ApiProperty()
  timeConsumedSeconds: number;

  @ApiProperty()
  timeConsumedLabel: string;

  @ApiProperty({ type: [AttemptExamRowDto] })
  byExam: AttemptExamRowDto[];
}

export class AdminDashboardExamsDto {
  @ApiProperty()
  totalActive: number;

  @ApiProperty()
  totalInactive: number;

  @ApiProperty({ type: [NamedCountDto] })
  byCategory: NamedCountDto[];
}

export class SubjectTopicCountDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  topicCount: number;

  @ApiProperty()
  isActive: boolean;
}

export class AdminDashboardSubjectsDto {
  @ApiProperty()
  totalActive: number;

  @ApiProperty({ type: [SubjectTopicCountDto] })
  rows: SubjectTopicCountDto[];
}

export class TopicRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;
}

export class AdminDashboardTopicsDto {
  @ApiProperty()
  totalActive: number;

  @ApiProperty({ type: [TopicRowDto] })
  rows: TopicRowDto[];
}

export class TagRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiPropertyOptional()
  topicName?: string;
}

export class AdminDashboardTagsDto {
  @ApiProperty()
  totalActive: number;

  @ApiProperty({ type: [TagRowDto] })
  rows: TagRowDto[];
}
