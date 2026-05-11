import { ApiProperty } from '@nestjs/swagger';

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
    description: 'Total number of questions in the test',
    example: 25,
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
    description: 'Subject details, or null if not set',
    type: RecentActivitySubjectDto,
    nullable: true,
  })
  subject: RecentActivitySubjectDto | null;

  @ApiProperty({
    description: 'Exam details, or null if not set',
    type: RecentActivityExamDto,
    nullable: true,
  })
  exam: RecentActivityExamDto | null;
}
