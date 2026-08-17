import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { MembershipTier } from '../../common/enums/membership-tier.enum';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
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

export class AppUserSubscriptionDto {
  @ApiProperty({ enum: SubscriptionPlan, example: SubscriptionPlan.FREE })
  plan: SubscriptionPlan;

  @ApiProperty({ enum: SubscriptionStatus, example: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;
}

export class AppUserTargetExamDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
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
    example: 'a***@***.com',
    description:
      'Masked email. The full address is never returned; search still matches the stored value.',
  })
  email: string;

  @ApiPropertyOptional({
    example: '+**********10',
    description:
      'Masked phone number. The full number is never returned; search still matches the stored value.',
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

  @ApiPropertyOptional({ type: AppUserSubscriptionDto })
  subscription?: AppUserSubscriptionDto;

  @ApiPropertyOptional({ enum: MembershipTier })
  membershipTier?: MembershipTier;

  @ApiPropertyOptional({ example: 0 })
  badgesEarnedCount?: number;

  @ApiPropertyOptional({ type: AppUserTargetExamDto })
  targetExam?: AppUserTargetExamDto;

  @ApiProperty({
    example: 3,
    description: 'Documents in mocktestattempts for this user',
  })
  testsAttendedCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
