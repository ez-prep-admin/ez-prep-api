import { ApiProperty } from '@nestjs/swagger';
import { StreakDto } from './streak.dto';
import { ScoreAnalyticsDto } from './score-analytics.dto';
import { AccuracyDto } from './accuracy.dto';
import { TimeInvestmentDto } from './time-investment.dto';
import {
  SubjectPerformanceDto,
  ExamPerformanceDto,
} from './subject-performance.dto';

export class TestsSummaryDto {
  @ApiProperty({
    description: 'Total number of attempts started (all statuses)',
    example: 30,
  })
  attempted: number;

  @ApiProperty({
    description: 'Number of attempts in SUBMITTED or EXPIRED status',
    example: 24,
  })
  completed: number;

  @ApiProperty({
    description:
      'Completion rate as a percentage (completed / attempted * 100)',
    example: 80.0,
  })
  completionRate: number;
}

export class UserDashboardDto {
  @ApiProperty({ type: StreakDto })
  streak: StreakDto;

  @ApiProperty({ type: TestsSummaryDto })
  testsSummary: TestsSummaryDto;

  @ApiProperty({ type: ScoreAnalyticsDto })
  scoreAnalytics: ScoreAnalyticsDto;

  @ApiProperty({ type: AccuracyDto })
  accuracy: AccuracyDto;

  @ApiProperty({ type: TimeInvestmentDto })
  timeInvestment: TimeInvestmentDto;

  @ApiProperty({ type: [SubjectPerformanceDto] })
  subjectPerformance: SubjectPerformanceDto[];

  @ApiProperty({ type: [ExamPerformanceDto] })
  examPerformance: ExamPerformanceDto[];
}
