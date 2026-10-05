import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';

export class GrantEntitlementDto {
  @ApiProperty({ example: '64f123456789abcdef123456' })
  @IsMongoId()
  userId: string;

  @ApiProperty({ enum: EntitlementScopeType })
  @IsEnum(EntitlementScopeType)
  scopeType: EntitlementScopeType;

  @ApiProperty({ example: '64f123456789abcdef123456' })
  @IsMongoId()
  scopeId: string;

  @ApiProperty({ enum: DurationPreset, example: DurationPreset.THREE_MONTHS })
  @IsEnum(DurationPreset)
  durationPreset: DurationPreset;

  @ApiPropertyOptional({ example: 'support' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Optional product reference; null for pure admin grants',
    nullable: true,
  })
  @IsOptional()
  @IsMongoId()
  productId?: string | null;
}
