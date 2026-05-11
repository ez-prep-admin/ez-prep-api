import { ApiProperty } from '@nestjs/swagger';

export class TopicPerformanceDto {
  @ApiProperty({
    description: 'Topic ID',
    example: '64f123456789abcdef123456',
  })
  topicId: string;

  @ApiProperty({
    description: 'Topic name',
    example: 'Trigonometry',
  })
  topicName: string;

  @ApiProperty({
    description: 'Number of questions attempted in this topic',
    example: 30,
  })
  questionsAttempted: number;

  @ApiProperty({
    description: 'Number of questions answered correctly',
    example: 18,
  })
  correctAnswers: number;

  @ApiProperty({
    description: 'Accuracy percentage for this topic',
    example: 60.0,
  })
  accuracyPercent: number;

  @ApiProperty({
    description: 'Performance trend based on recent vs previous attempts',
    enum: ['improving', 'declining', 'stable', 'insufficient-data'],
    example: 'improving',
  })
  trend: string;

  @ApiProperty({
    description: 'Whether this topic is a weak area (< 50% accuracy)',
    example: false,
  })
  isWeak: boolean;

  @ApiProperty({
    description: 'Whether this topic is a strong area (>= 75% accuracy)',
    example: false,
  })
  isStrong: boolean;
}

export class SubjectDetailedPerformanceDto {
  @ApiProperty({
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
  })
  subjectId: string;

  @ApiProperty({
    description: 'Subject name',
    example: 'Quantitative Aptitude',
  })
  subjectName: string;

  @ApiProperty({
    description: 'Overall accuracy percentage for this subject',
    example: 68.0,
  })
  averageScorePercent: number;

  @ApiProperty({
    description: 'Performance trend for this subject',
    enum: ['improving', 'declining', 'stable', 'insufficient-data'],
    example: 'improving',
  })
  trend: string;

  @ApiProperty({
    description: 'Strength classification',
    enum: ['Strong', 'Good', 'Weak'],
    example: 'Good',
  })
  strengthLabel: string;

  @ApiProperty({
    description: 'Per-topic breakdown within this subject',
    type: [TopicPerformanceDto],
  })
  topics: TopicPerformanceDto[];

  @ApiProperty({
    description: 'Number of weak topics (< 50% accuracy)',
    example: 2,
  })
  weakTopicCount: number;

  @ApiProperty({
    description: 'Number of strong topics (>= 75% accuracy)',
    example: 1,
  })
  strongTopicCount: number;
}

export class SubjectTopicBreakdownDto {
  @ApiProperty({
    description: 'Subject-level performance with nested topic breakdowns',
    type: [SubjectDetailedPerformanceDto],
  })
  subjects: SubjectDetailedPerformanceDto[];
}
