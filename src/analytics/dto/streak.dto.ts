import { ApiProperty } from '@nestjs/swagger';

export class StreakDto {
  @ApiProperty({
    description:
      'Number of consecutive days the user has attempted a test up to today',
    example: 7,
  })
  currentStreak: number;

  @ApiProperty({
    description: 'Longest consecutive day streak the user has ever achieved',
    example: 14,
  })
  longestStreak: number;

  @ApiProperty({
    description:
      'ISO date string of the last day the user submitted an attempt, or null if none',
    example: '2026-05-11',
    nullable: true,
  })
  lastActiveDate: string | null;
}
