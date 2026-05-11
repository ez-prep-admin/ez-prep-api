import { ApiProperty } from '@nestjs/swagger';

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
    description: 'Attempt status',
    example: 'submitted',
    enum: ['in_progress', 'paused', 'submitted'],
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
