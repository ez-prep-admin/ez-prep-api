import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { OfferStatus } from '../../common/enums/offer-status.enum';

export class UpdateOfferDto {
  @ApiPropertyOptional({
    description: 'List price in integer paise (GST-inclusive)',
    example: 99900,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  listAmount?: number;

  @ApiPropertyOptional({
    description: 'Sale price in integer paise; null clears sale',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  saleAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  saleValidFrom?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  saleValidUntil?: string | null;

  @ApiPropertyOptional({ enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
