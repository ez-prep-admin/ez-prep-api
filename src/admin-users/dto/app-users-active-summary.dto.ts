import { ApiProperty } from '@nestjs/swagger';

/**
 * Unique learners recently active, based on throttled `lastActiveAt`.
 * Admins and soft-deleted accounts are excluded.
 */
export class AppUsersActiveSummaryDto {
  @ApiProperty({
    description:
      'Unique learners with lastActiveAt within the past 24 hours',
    example: 12,
  })
  last1Day: number;

  @ApiProperty({
    description:
      'Unique learners with lastActiveAt within the past 7 days',
    example: 48,
  })
  last7Days: number;
}

export class AppUsersActiveSummaryApiResponseDto {
  @ApiProperty({
    example: 'Active learner summary retrieved successfully',
  })
  message: string;

  @ApiProperty({ type: AppUsersActiveSummaryDto })
  data: AppUsersActiveSummaryDto;
}
