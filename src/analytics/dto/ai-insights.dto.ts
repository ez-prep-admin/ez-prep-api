import { ApiProperty } from '@nestjs/swagger';
import { SubjectDetailedPerformanceDto } from './topic-performance.dto';

export class InsightSummaryDto {
  @ApiProperty({
    description: 'Average score percentage across all subjects',
    example: 75.0,
  })
  averageScorePercent: number;

  @ApiProperty({
    description: 'Number of subjects classified as weak (< 50%)',
    example: 1,
  })
  weakAreaCount: number;

  @ApiProperty({
    description: 'Number of subjects classified as strong (>= 75%)',
    example: 2,
  })
  strongAreaCount: number;
}

export class RecommendationDto {
  @ApiProperty({
    description: 'Recommendation type/severity',
    enum: ['urgent-focus', 'focus-area', 'tip', 'strength'],
    example: 'urgent-focus',
  })
  type: string;

  @ApiProperty({
    description: 'Short recommendation title',
    example: 'Quantitative Aptitude — Trigonometry',
  })
  title: string;

  @ApiProperty({
    description: 'Detailed recommendation text',
    example:
      'Your score in Trigonometry is 38% — significantly below your average. This topic needs immediate attention.',
  })
  description: string;

  @ApiProperty({
    description: 'Priority level (1 = highest)',
    example: 1,
  })
  priority: number;
}

export class AiInsightsDto {
  @ApiProperty({ type: InsightSummaryDto })
  summary: InsightSummaryDto;

  @ApiProperty({
    description: 'Detailed subject breakdown with topic-level performance',
    type: [SubjectDetailedPerformanceDto],
  })
  subjectBreakdown: SubjectDetailedPerformanceDto[];

  @ApiProperty({
    description: 'AI-generated recommendations sorted by priority (max 8)',
    type: [RecommendationDto],
  })
  recommendations: RecommendationDto[];
}
