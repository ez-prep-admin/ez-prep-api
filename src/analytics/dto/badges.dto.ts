import { ApiProperty } from '@nestjs/swagger';

export class BadgeDto {
  @ApiProperty({
    description: 'Unique badge identifier',
    example: 'streak-7',
  })
  id: string;

  @ApiProperty({
    description: 'Badge display name',
    example: '7-Day Streak',
  })
  name: string;

  @ApiProperty({
    description: 'Badge description',
    example: 'Achieve a 7-day consecutive activity streak',
  })
  description: string;

  @ApiProperty({
    description: 'Badge category',
    enum: ['Milestone', 'Consistency', 'Performance', 'Mastery'],
    example: 'Consistency',
  })
  category: string;

  @ApiProperty({
    description: 'Whether the user has earned this badge',
    example: true,
  })
  isEarned: boolean;

  @ApiProperty({
    description: 'Human-readable criteria for earning the badge',
    example: 'Maintain a 7-day consecutive test attempt streak',
  })
  criteria: string;
}

export class UserBadgesDto {
  @ApiProperty({
    description: 'All available badges with earned status',
    type: [BadgeDto],
  })
  badges: BadgeDto[];

  @ApiProperty({
    description: 'Number of badges earned by the user',
    example: 3,
  })
  earnedCount: number;

  @ApiProperty({
    description: 'Total number of available badges',
    example: 10,
  })
  totalCount: number;
}
