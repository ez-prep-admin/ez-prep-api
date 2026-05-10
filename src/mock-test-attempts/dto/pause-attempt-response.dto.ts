import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PauseEventDto {
  @ApiProperty({
    description: 'Action type',
    enum: ['PAUSE', 'RESUME'],
    example: 'PAUSE',
  })
  action: string;

  @ApiProperty({
    description: 'Event timestamp',
    example: '2026-05-11T10:30:00.000Z',
  })
  timestamp: Date;

  @ApiPropertyOptional({
    description: 'Time consumed at pause (in seconds)',
    example: 450,
  })
  timeConsumedAtPause?: number;
}

export class PauseAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt ID',
    example: '64f123456789abcdef123456',
  })
  attemptId: string;

  @ApiProperty({
    description: 'Test title',
    example: 'Daily Practice Test 1',
  })
  testTitle: string;

  @ApiProperty({
    description: 'Current status after pause',
    example: 'PAUSED',
  })
  status: string;

  @ApiProperty({
    description: 'Time consumed so far (in seconds)',
    example: 450,
  })
  timeConsumed: number;

  @ApiProperty({
    description: 'Time remaining (in seconds)',
    example: 1350,
  })
  timeRemaining: number;

  @ApiProperty({
    description: 'When the attempt was paused',
    example: '2026-05-11T10:30:00.000Z',
  })
  pausedAt: Date;

  @ApiProperty({
    description: 'Number of times paused',
    example: 2,
  })
  pauseCount: number;

  @ApiPropertyOptional({
    description: 'Recent pause/resume history',
    type: [PauseEventDto],
  })
  recentHistory?: PauseEventDto[];
}
