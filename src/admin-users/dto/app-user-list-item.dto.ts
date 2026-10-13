import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { MembershipTier } from '../../common/enums/membership-tier.enum';
import { Gender } from '../../common/enums/gender.enum';

export class AppUserLocationDto {
  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  state?: string;

  @ApiPropertyOptional()
  country?: string;

  @ApiPropertyOptional()
  timezone?: string;
}

/**
 * Paid access matches accounting: at least one usable entitlement.
 */
export class AppUserAccessDto {
  @ApiProperty({
    example: false,
    description:
      'True when the learner has a grant that is active, already started, and not past its end. A null end date is lifetime.',
  })
  paid: boolean;

  @ApiProperty({
    example: 0,
    description: 'How many of those usable grants the learner has.',
  })
  usableCount: number;

  @ApiPropertyOptional({
    description:
      'Soonest end among usable grants. Omitted when any usable grant does not expire.',
  })
  expiresAt?: Date;
}

export class AppUserTargetExamDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class AttemptStatusCountsDto {
  @ApiProperty({
    example: 2,
    description: 'Attempts with status SUBMITTED or EXPIRED',
  })
  finished: number;

  @ApiProperty({
    example: 1,
    description:
      'Attempts that are still started, in progress, or paused (any status other than SUBMITTED or EXPIRED)',
  })
  open: number;
}

export class AppUserTestActivityDto {
  @ApiProperty({
    type: AttemptStatusCountsDto,
    description: 'Attempts on papers with paperType FULL_EXAM',
  })
  fullExam: AttemptStatusCountsDto;

  @ApiProperty({
    type: AttemptStatusCountsDto,
    description: 'Attempts on papers with paperType TOPIC_WISE.',
  })
  topicWise: AttemptStatusCountsDto;

  @ApiProperty({
    type: AttemptStatusCountsDto,
    description: 'Attempts on papers with paperType SPRINT',
  })
  sprint: AttemptStatusCountsDto;
}

/**
 * Learner card payload for the admin users directory.
 * Intentionally omits admin-only fields (username, passwordHash) and
 * never includes a full email or phone number — those are masked at
 * serialization time. Search still matches the stored values.
 */
export class AppUserListItemDto {
  @ApiProperty({ example: '64f123456789abcdef123456' })
  id: string;

  @ApiProperty({ example: 'Anita Sharma' })
  name: string;

  @ApiProperty({
    example: 'a***@gmail.com',
    description:
      'Masked email: first letter of the local part plus the full domain. The rest of the local part is never returned; search still matches the stored value.',
  })
  email: string;

  @ApiPropertyOptional({
    example: '+91**********',
    description:
      'Masked phone number: country code (e.g. +91) is kept and the subscriber digits are hidden. Search still matches the stored value.',
  })
  phoneNumber?: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiProperty({
    enum: [UserRole.USER],
    example: UserRole.USER,
    description: 'Always `user`. Admins are never included.',
  })
  role: UserRole.USER;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ enum: Gender })
  gender?: Gender;

  @ApiPropertyOptional({ type: AppUserLocationDto })
  location?: AppUserLocationDto;

  @ApiProperty({ type: AppUserAccessDto })
  access: AppUserAccessDto;

  @ApiPropertyOptional({ enum: MembershipTier })
  membershipTier?: MembershipTier;

  @ApiPropertyOptional({ example: 0 })
  badgesEarnedCount?: number;

  @ApiPropertyOptional({ type: AppUserTargetExamDto })
  targetExam?: AppUserTargetExamDto;

  @ApiProperty({
    example: 3,
    description:
      'All mock-test attempts for this user. Equal to the sum of testActivity buckets.',
  })
  testsAttendedCount: number;

  @ApiProperty({ type: AppUserTestActivityDto })
  testActivity: AppUserTestActivityDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
