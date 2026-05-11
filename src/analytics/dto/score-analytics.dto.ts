import { ApiProperty } from '@nestjs/swagger';

export class ScoreAnalyticsDto {
  @ApiProperty({
    description:
      'Average score percentage across all completed/expired attempts',
    example: 72.5,
  })
  averageScorePercent: number;

  @ApiProperty({
    description: 'Best score percentage achieved in any single attempt',
    example: 95.0,
  })
  bestScorePercent: number;

  @ApiProperty({
    description:
      'Total number of completed or expired attempts used for score calculation',
    example: 24,
  })
  totalTestsScored: number;
}
