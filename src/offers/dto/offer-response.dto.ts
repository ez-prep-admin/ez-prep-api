import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurationPreset } from '../../common/enums/duration-preset.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';

export class OfferResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ enum: DurationPreset })
  durationPreset: DurationPreset;

  @ApiProperty({ example: 'INR' })
  currency: string;

  @ApiProperty({
    description: 'List price in integer paise (GST-inclusive)',
    example: 99900,
  })
  listAmount: number;

  @ApiPropertyOptional({
    description: 'Sale price in integer paise (GST-inclusive)',
  })
  saleAmount?: number;

  @ApiProperty({ example: true })
  taxIncluded: boolean;

  @ApiPropertyOptional()
  saleValidFrom?: Date;

  @ApiPropertyOptional()
  saleValidUntil?: Date;

  @ApiProperty({ enum: OfferStatus })
  status: OfferStatus;

  @ApiPropertyOptional({
    description:
      'Effective amount in paise at evaluation time (catalog responses)',
    example: 79900,
  })
  effectiveAmount?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class OfferApiResponseDto {
  @ApiProperty({ example: 'Offer created successfully' })
  message: string;

  @ApiProperty({ type: OfferResponseDto })
  data: OfferResponseDto;
}
