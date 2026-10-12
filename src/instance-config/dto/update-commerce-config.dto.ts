import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { trimString } from '../instance-config.transforms';

/**
 * Seller identity. GSTIN is a trimmed string with no checksum and no
 * state-prefix check (D-17).
 */
export class UpdateSellerDto {
  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({
    description:
      'Replacement GSTIN. Not checked for checksum or state-code prefix.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  gstin?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  registeredAddress?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  stateCode?: string;

  @ApiPropertyOptional({ description: 'Optional. TODO(golive): U-GST-08' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  signatoryName?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  signatoryDesignation?: string;
}

export class UpdateTaxConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  taxType?: string;

  @ApiPropertyOptional({ description: 'Integer percent from 0 to 100.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pricesAreTaxInclusive?: boolean;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  sacCode?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  sacDescription?: string;

  @ApiPropertyOptional({ example: 'EZPREP' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  invoiceSeriesPrefix?: string;
}

export class UpdateCommerceConfigFields {
  @ApiPropertyOptional({ type: UpdateSellerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSellerDto)
  seller?: UpdateSellerDto;

  @ApiPropertyOptional({ type: UpdateTaxConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTaxConfigDto)
  taxConfig?: UpdateTaxConfigDto;
}
