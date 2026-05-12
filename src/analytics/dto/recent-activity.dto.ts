import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecentActivitySubjectDto {
  @ApiProperty({
    description: 'Subject ID',
    example: '64f123456789abcdef123456',
  })
  id: string;

  @ApiProperty({
    description: 'Subject name',
    example: 'Mathematics',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Subject description',
    example: 'Mathematical reasoning and problem solving',
  })
  description?: string;
}

export class RecentActivityExamDto {
  @ApiProperty({
    description: 'Exam ID',
    example: '64f123456789abcdef654321',
  })
  id: string;

  @ApiProperty({
    description: 'Exam name',
    example: 'SSC CGL Tier 1',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Exam description',
    example: 'Staff Selection Commission Combined Graduate Level Tier 1',
  })
  description?: string;
}

export class RecentActivityTopicDto {
  @ApiProperty({
    description: 'Topic ID',
    example: '64f123456789abcdef789012',
  })
  id: string;

  @ApiProperty({
    description: 'Topic name',
    example: 'Algebra',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Topic description',
    example: 'Linear and quadratic equations',
  })
  description?: string;
}

export class RecentActivityItemDto {
  @ApiProperty({
    description: 'Attempt ID',
    example: '64f123456789abcdef111111',
  })
  attemptId: string;

  @ApiProperty({
    description: 'Test title (frozen snapshot from attempt)',
    example: 'SSC CGL Tier 1 Mock Test 4',
  })
  testTitle: string;

  @ApiProperty({
    description: 'Score percentage achieved',
    example: 78.0,
  })
  scorePercent: number;

  @ApiProperty({
    description: 'Actual score obtained',
    example: 31.5,
  })
  score: number;

  @ApiProperty({
    description: 'Total possible marks',
    example: 40,
  })
  totalMarks: number;

  @ApiProperty({
    description: 'Number of correct answers',
    example: 8,
  })
  correctAnswers: number;

  @ApiProperty({
    description: 'Number of incorrect answers',
    example: 1,
  })
  incorrectAnswers: number;

  @ApiProperty({
    description: 'Number of unanswered questions',
    example: 1,
  })
  unansweredQuestions: number;

  @ApiProperty({
    description: 'Total number of questions in the test',
    example: 10,
  })
  totalQuestions: number;

  @ApiProperty({
    description: 'Time consumed in minutes (rounded to 1 decimal)',
    example: 55.0,
  })
  timeConsumedMinutes: number;

  @ApiProperty({
    description: 'When the attempt was submitted (ISO date)',
    example: '2026-05-11T10:30:00.000Z',
  })
  submittedAt: string;

  @ApiProperty({
    description: 'Attempt status',
    example: 'SUBMITTED',
    enum: ['SUBMITTED', 'EXPIRED'],
  })
  status: string;

  @ApiProperty({
    description: 'Subject details',
    type: RecentActivitySubjectDto,
    nullable: true,
  })
  subject: RecentActivitySubjectDto | null;

  @ApiProperty({
    description: 'Exam details',
    type: RecentActivityExamDto,
    nullable: true,
  })
  exam: RecentActivityExamDto | null;

  @ApiPropertyOptional({
    description: 'Topic details (optional)',
    type: RecentActivityTopicDto,
    nullable: true,
  })
  topic?: RecentActivityTopicDto | null;
}
