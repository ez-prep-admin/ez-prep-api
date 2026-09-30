import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudyTimePreference } from '../../common/enums/study-time-preference.enum';
import {
  AppUserListItemDto,
  AppUserSubscriptionDto,
} from './app-user-list-item.dto';

export class AppUserSubscriptionDetailDto extends AppUserSubscriptionDto {
  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiPropertyOptional()
  trialEndsAt?: Date;

  @ApiPropertyOptional({ example: false })
  autoRenew?: boolean;
}

export class AppUserStudyDto {
  @ApiPropertyOptional({ enum: StudyTimePreference })
  studyTime?: StudyTimePreference;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100 })
  weeklyStudyGoalHours?: number;
}

export class AppUserDetailProfileDto extends AppUserListItemDto {
  @ApiPropertyOptional({ example: 'Preparing for prelims.' })
  bio?: string;

  @ApiPropertyOptional()
  dateOfBirth?: Date;

  @ApiPropertyOptional()
  targetExamDate?: Date;

  @ApiPropertyOptional()
  lastTierUpdatedAt?: Date;

  @ApiProperty({ type: AppUserSubscriptionDetailDto })
  subscription: AppUserSubscriptionDetailDto;

  @ApiPropertyOptional({ type: AppUserStudyDto })
  study?: AppUserStudyDto;
}

export class FinishedAttemptSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  mockTestId: string;

  @ApiProperty({ example: 'Polity practice set' })
  title: string;

  @ApiProperty({ enum: ['TOPIC_WISE', 'FULL_EXAM'] })
  paperType: 'TOPIC_WISE' | 'FULL_EXAM';

  @ApiProperty({ enum: ['SUBMITTED', 'EXPIRED'] })
  status: 'SUBMITTED' | 'EXPIRED';

  @ApiProperty({
    example: 42,
    description: 'Marks obtained after negative marking. Can be negative.',
  })
  score: number;

  @ApiProperty({
    example: 100,
    description:
      'Marks available if every question was answered correctly. Taken from each question’s marks when the attempt stored them, otherwise total questions times marks per question.',
  })
  totalMarks: number;

  @ApiProperty({
    example: 42,
    nullable: true,
    description:
      'score / totalMarks as a percentage, rounded to 1 decimal. Null when total marks are 0.',
  })
  percentage: number | null;

  @ApiProperty()
  correct: number;

  @ApiProperty()
  incorrect: number;

  @ApiProperty()
  unanswered: number;

  @ApiProperty()
  totalQuestions: number;

  @ApiProperty({ nullable: true })
  passingScore: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Null when the paper has no pass mark.',
  })
  passed: boolean | null;

  @ApiProperty({ nullable: true })
  examName: string | null;

  @ApiProperty({ nullable: true })
  subjectName: string | null;

  @ApiProperty({ nullable: true })
  topicName: string | null;

  @ApiProperty({ description: 'Time spent on the paper, in seconds.' })
  timeConsumedSeconds: number;

  @ApiProperty()
  durationInMinutes: number;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  submittedAt?: Date;
}

export class PaperPerformanceDto {
  @ApiProperty({
    description:
      'Every finished attempt of this paper type, not only the recent five.',
  })
  finishedCount: number;

  @ApiProperty({ description: 'Sum of scores on finished attempts.' })
  score: number;

  @ApiProperty({ description: 'Sum of marks available on finished attempts.' })
  totalMarks: number;

  @ApiProperty({ nullable: true })
  percentage: number | null;

  @ApiProperty({ nullable: true })
  averagePercentage: number | null;

  @ApiProperty({ nullable: true })
  bestPercentage: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Percentage on the most recent finished attempt in the returned window.',
  })
  latestPercentage: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Correct answers / answered questions, as a percentage. Null when nothing was answered.',
  })
  accuracy: number | null;

  @ApiProperty()
  correct: number;

  @ApiProperty()
  incorrect: number;

  @ApiProperty()
  unanswered: number;

  @ApiProperty()
  passedCount: number;

  @ApiProperty({
    description: 'Finished attempts that had a pass mark greater than zero.',
  })
  gradedCount: number;

  @ApiProperty({
    enum: ['improving', 'declining', 'steady', 'insufficient'],
    description:
      'Compares the latest scored finished test with the oldest scored test among the last five. Needs at least two scored tests. A change of 5 percentage points or more is improving or declining.',
  })
  trend: 'improving' | 'declining' | 'steady' | 'insufficient';
}

export class UserPerformanceAnalysisDto {
  @ApiProperty({ type: PaperPerformanceDto })
  topicWise: PaperPerformanceDto;

  @ApiProperty({ type: PaperPerformanceDto })
  fullExam: PaperPerformanceDto;

  @ApiProperty({ type: PaperPerformanceDto })
  overall: PaperPerformanceDto;
}

export class AppUserDetailDto {
  @ApiProperty({ type: AppUserDetailProfileDto })
  profile: AppUserDetailProfileDto;

  @ApiProperty({
    type: [FinishedAttemptSummaryDto],
    description:
      'Newest finished topic-wise attempts, at most five. Fewer are returned when the learner has fewer.',
  })
  recentTopicWiseAttempts: FinishedAttemptSummaryDto[];

  @ApiProperty({
    type: [FinishedAttemptSummaryDto],
    description:
      'Newest finished full mock attempts (paperType FULL_EXAM), at most five.',
  })
  recentFullExamAttempts: FinishedAttemptSummaryDto[];

  @ApiProperty({ type: UserPerformanceAnalysisDto })
  analysis: UserPerformanceAnalysisDto;
}

export class AppUserDetailApiResponseDto {
  @ApiProperty({ example: 'App user retrieved successfully' })
  message: string;

  @ApiProperty({ type: AppUserDetailDto })
  data: AppUserDetailDto;
}
