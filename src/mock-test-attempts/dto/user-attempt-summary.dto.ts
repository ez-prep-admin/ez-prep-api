import { ApiProperty } from '@nestjs/swagger';

/**
 * Basic info DTO for exam/subject/topic
 */
export class BasicInfoDto {
  @ApiProperty({
    description: 'ID',
    example: '507f1f77bcf86cd799439013',
  })
  id: string;

  @ApiProperty({
    description: 'Name',
    example: 'UPSC Civil Services',
  })
  name: string;

  @ApiProperty({
    description: 'Description',
    example: 'Union Public Service Commission Civil Services Examination',
    required: false,
  })
  description?: string;
}

/**
 * User attempt summary DTO
 */
export class UserAttemptSummaryDto {
  @ApiProperty({
    description: 'Attempt ID',
    example: '507f1f77bcf86cd799439011',
  })
  attemptId: string;

  @ApiProperty({
    description: 'Mock test ID',
    example: '507f1f77bcf86cd799439012',
  })
  mockTestId: string;

  @ApiProperty({
    description: 'Mock test title',
    example: 'Sample Mock Test',
  })
  mockTestTitle: string;

  @ApiProperty({
    description: 'Exam information',
    type: BasicInfoDto,
  })
  exam: BasicInfoDto;

  @ApiProperty({
    description: 'Subject information',
    type: BasicInfoDto,
  })
  subject: BasicInfoDto;

  @ApiProperty({
    description: 'Topic information (optional)',
    type: BasicInfoDto,
    required: false,
  })
  topic?: BasicInfoDto;

  @ApiProperty({
    description: 'Attempt status',
    example: 'submitted',
    enum: ['in_progress', 'paused', 'submitted', 'expired'],
  })
  status: string;

  @ApiProperty({
    description: 'Score obtained (if submitted)',
    example: 85,
    required: false,
  })
  score?: number;

  @ApiProperty({
    description: 'Total marks',
    example: 100,
  })
  totalMarks: number;

  @ApiProperty({
    description: 'Started at timestamp',
    example: '2024-01-01T00:00:00Z',
  })
  startedAt: Date;

  @ApiProperty({
    description: 'Submitted at timestamp',
    example: '2024-01-01T01:00:00Z',
    required: false,
  })
  submittedAt?: Date;
}
