import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { Gender } from '../../common/enums/gender.enum';
import { MembershipTier } from '../../common/enums/membership-tier.enum';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { StudyTimePreference } from '../../common/enums/study-time-preference.enum';

// ─── Nested response types ────────────────────────────────────────────────────

export class LocationResponseDto {
  @Expose() city?: string;
  @Expose() state?: string;
  @Expose() country?: string;
  @Expose() timezone?: string;
}

export class SubscriptionResponseDto {
  @Expose() plan: SubscriptionPlan;
  @Expose() status: SubscriptionStatus;
  @Expose() startedAt?: Date;
  @Expose() expiresAt?: Date;
  @Expose() trialEndsAt?: Date;
  @Expose() autoRenew: boolean;
}

export class NotificationPreferencesResponseDto {
  @Expose() email: boolean;
  @Expose() push: boolean;
  @Expose() sms: boolean;
  @Expose() studyReminders: boolean;
  @Expose() weeklyReport: boolean;
  @Expose() promotionalOffers: boolean;
}

export class PreferencesResponseDto {
  @Expose() studyTime?: StudyTimePreference;
  @Expose() weeklyStudyGoalHours?: number;

  @Expose()
  @Type(() => NotificationPreferencesResponseDto)
  notifications: NotificationPreferencesResponseDto;
}

export class TargetExamResponseDto {
  @Expose() id: string;
  @Expose() name: string;
}

export class InteractionsResponseDto {
  @Expose() interestedSubjects: string[];
  @Expose() likedTopics: string[];
  @Expose() dislikedTopics: string[];
  @Expose() interestedExams: string[];
}

// ─── Main response DTO ────────────────────────────────────────────────────────

export class UserResponseDto {
  // ── Core identity ──────────────────────────────────────────────────────────
  @ApiProperty({
    description: 'Unique identifier',
    example: '64f123456789abcdef123456',
  })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @Expose()
  email: string;

  @ApiProperty({ description: 'Phone number', example: '+911234567890' })
  @Expose()
  phoneNumber: string;

  @ApiProperty({
    description: 'System role',
    enum: UserRole,
    example: UserRole.USER,
  })
  @Expose()
  role: UserRole;

  @ApiProperty({ description: 'Account active flag', example: true })
  @Expose()
  isActive: boolean;

  // ── Group 1: Extended profile ──────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Short bio (max 500 chars)' })
  @Expose()
  bio?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @Expose()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @Expose()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ description: 'Gender', enum: Gender })
  @Expose()
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Location details',
    type: LocationResponseDto,
  })
  @Expose()
  @Type(() => LocationResponseDto)
  location?: LocationResponseDto;

  // ── Group 2: Target exam ───────────────────────────────────────────────────
  @ApiPropertyOptional({
    description: 'Target exam (id and name)',
    type: TargetExamResponseDto,
  })
  @Expose()
  @Type(() => TargetExamResponseDto)
  targetExam?: TargetExamResponseDto;

  @ApiPropertyOptional({ description: 'Target exam date' })
  @Expose()
  targetExamDate?: Date;

  @ApiPropertyOptional({ description: 'Days remaining until target exam date' })
  @Expose()
  targetExamRemainingDays?: number;

  // ── Group 3: Subscription ──────────────────────────────────────────────────
  @ApiPropertyOptional({
    description: 'Subscription summary',
    type: SubscriptionResponseDto,
  })
  @Expose()
  @Type(() => SubscriptionResponseDto)
  subscription?: SubscriptionResponseDto;

  // ── Group 4: Achievement ───────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Membership tier', enum: MembershipTier })
  @Expose()
  membershipTier?: MembershipTier;

  @ApiPropertyOptional({ description: 'Number of badges earned' })
  @Expose()
  badgesEarnedCount?: number;

  @ApiPropertyOptional({
    description: 'When the membership tier was last updated',
  })
  @Expose()
  lastTierUpdatedAt?: Date;

  // ── Group 5: Preferences ───────────────────────────────────────────────────
  @ApiPropertyOptional({
    description: 'User study preferences',
    type: PreferencesResponseDto,
  })
  @Expose()
  @Type(() => PreferencesResponseDto)
  preferences?: PreferencesResponseDto;

  // ── Group 6: Interactions ──────────────────────────────────────────────────
  @ApiPropertyOptional({
    description: 'Interaction signals for personalisation',
    type: InteractionsResponseDto,
  })
  @Expose()
  @Type(() => InteractionsResponseDto)
  interactions?: InteractionsResponseDto;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  @ApiProperty({
    description: 'Account created at',
    example: '2025-09-17T02:30:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Last updated at',
    example: '2025-09-17T02:35:00.000Z',
  })
  @Expose()
  updatedAt: Date;

  @Exclude()
  isDeleted: boolean;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
