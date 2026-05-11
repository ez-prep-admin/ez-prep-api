import { IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Subscription plan',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.PREMIUM,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({
    description: 'Subscription status',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Date subscription started (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({
    description: 'Date subscription expires (ISO 8601)',
    example: '2027-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Date free trial ends (ISO 8601)',
    example: '2026-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional({
    description: 'Whether the subscription auto-renews',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
