import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({
    description: 'Rank position (1-based, dense rank)',
    example: 1,
  })
  rank: number;

  @ApiProperty({
    description: 'User ObjectId as string',
    example: '64f123456789abcdef123456',
  })
  userId: string;

  @ApiProperty({
    description: 'User display name',
    example: 'Arjun Nair',
  })
  userName: string;

  @ApiProperty({
    description:
      'Average score percentage across all completed/expired attempts',
    example: 88.5,
  })
  averageScorePercent: number;

  @ApiProperty({
    description: 'Total completed/expired attempts',
    example: 18,
  })
  totalAttempts: number;

  @ApiProperty({
    description: 'Total questions answered correctly across all attempts',
    example: 265,
  })
  totalCorrect: number;

  @ApiProperty({
    description: 'Whether this entry is the currently authenticated user',
    example: false,
  })
  isCurrentUser: boolean;
}

export class UserRankDto {
  @ApiProperty({
    description:
      'Rank of the currently authenticated user in this leaderboard scope',
    example: 42,
    nullable: true,
  })
  rank: number | null;

  @ApiProperty({
    description: 'Average score percentage of the current user',
    example: 71.0,
    nullable: true,
  })
  averageScorePercent: number | null;
}
