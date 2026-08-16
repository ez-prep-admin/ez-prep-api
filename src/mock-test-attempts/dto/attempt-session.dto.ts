import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttemptSessionDto {
  @ApiProperty({
    description: 'Subject ID for this session',
    example: '64f123456789abcdef123456',
  })
  subject: string;

  @ApiPropertyOptional({
    description: 'Subject display name',
    example: 'Quantitative Aptitude',
  })
  name?: string;

  @ApiProperty({
    description: '0-based session order (exam.subjects[] order)',
    example: 0,
  })
  order: number;

  @ApiProperty({
    description:
      'Live timer for THIS session in minutes. Session-wise UI must use this, not mockTestData.durationInMinutes.',
    example: 15,
  })
  durationInMinutes: number;

  @ApiProperty({
    description:
      'Inclusive start index into the locked questions array. Kept for compatibility. Frontend should use questionIds / sessionOrder, not these indexes.',
    example: 0,
  })
  startIndex: number;

  @ApiProperty({
    description:
      'Inclusive end index into the locked questions array. Kept for compatibility. Frontend should use questionIds / sessionOrder, not these indexes.',
    example: 24,
  })
  endIndex: number;

  @ApiPropertyOptional({
    description:
      'Frozen question IDs in this session, in display order. Prefer this over startIndex/endIndex.',
    type: [String],
    example: ['64f123456789abcdef123456'],
  })
  questionIds?: string[];

  @ApiPropertyOptional({
    description: 'Number of questions in this session (questionIds.length)',
    example: 25,
  })
  questionCount?: number;

  @ApiProperty({
    description:
      'LOCKED = not yet unlocked. IN_PROGRESS = current. PAUSED with the attempt. SUBMITTED/EXPIRED = finished.',
    enum: ['LOCKED', 'IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'EXPIRED'],
    example: 'IN_PROGRESS',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'When this session last started running',
  })
  startedAt?: Date;

  @ApiPropertyOptional({
    description: 'When this session was completed or expired',
  })
  submittedAt?: Date;

  @ApiProperty({
    description:
      'Accumulated seconds used in this session (across pause/resume)',
    example: 120,
  })
  timeConsumed: number;
}
