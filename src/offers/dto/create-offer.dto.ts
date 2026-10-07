import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';

export class CreateOfferDto {
  @ApiProperty({ enum: DurationPreset, example: DurationPreset.THREE_MONTHS })
  @IsEnum(DurationPreset)
  durationPreset: DurationPreset;

  @ApiProperty({
    description: 'List price in integer paise (GST-inclusive). ₹999 → 99900',
    example: 99900,
  })
  @IsInt()
  @Min(0)
  listAmount: number;

  @ApiPropertyOptional({
    description: 'Sale price in integer paise (GST-inclusive)',
    example: 79900,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  saleAmount?: number;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  saleValidFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  saleValidUntil?: string;

  @ApiPropertyOptional({
    enum: OfferStatus,
    default: OfferStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
