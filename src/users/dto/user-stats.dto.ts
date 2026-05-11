import { ApiProperty } from '@nestjs/swagger';

/**
 * User statistics response DTO
 */
export class UserStatsDto {
  @ApiProperty({
    description: 'Total number of users',
    example: 1000,
  })
  totalUsers: number;

  @ApiProperty({
    description: 'Number of active users',
    example: 950,
  })
  activeUsers: number;

  @ApiProperty({
    description: 'Number of inactive users',
    example: 50,
  })
  inactiveUsers: number;

  @ApiProperty({
    description: 'Number of deleted users',
    example: 10,
  })
  deletedUsers: number;

  @ApiProperty({
    description: 'Users grouped by role',
    example: { admin: 5, user: 995 },
  })
  byRole: Record<string, number>;

  @ApiProperty({
    description: 'Recently registered users count',
    example: 25,
  })
  recentRegistrations: number;
}
