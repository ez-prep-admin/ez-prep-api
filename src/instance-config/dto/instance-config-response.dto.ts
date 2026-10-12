import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstanceSellerResponseDto {
  @ApiProperty({ nullable: true })
  legalName: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Seller GSTIN snapshot source. Admin-only on this API.',
  })
  gstin: string | null;

  @ApiProperty({ nullable: true })
  registeredAddress: string | null;

  @ApiProperty({ nullable: true })
  state: string | null;

  @ApiProperty({ nullable: true })
  stateCode: string | null;

  @ApiProperty({ nullable: true })
  signatoryName: string | null;

  @ApiProperty({ nullable: true })
  signatoryDesignation: string | null;
}

export class InstanceTaxConfigResponseDto {
  @ApiProperty({ nullable: true })
  taxEnabled: boolean | null;

  @ApiProperty({ nullable: true })
  taxType: string | null;

  @ApiProperty({ nullable: true, description: 'Percent, for example 18.' })
  taxRate: number | null;

  @ApiProperty({ nullable: true })
  pricesAreTaxInclusive: boolean | null;

  @ApiProperty({ nullable: true })
  currency: string | null;

  @ApiProperty({ nullable: true })
  sacCode: string | null;

  @ApiProperty({ nullable: true })
  sacDescription: string | null;

  @ApiProperty({ nullable: true })
  invoiceSeriesPrefix: string | null;
}

export class InstanceConfigResponseDto {
  @ApiProperty({ example: 'singleton' })
  id: string;

  @ApiProperty({
    description:
      'Stored shape version. Clients can ignore it until it changes.',
    example: 1,
  })
  schemaVersion: number;

  @ApiProperty({ example: 'EZ Prep' })
  name: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/logo.png',
    nullable: true,
  })
  logoUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/favicon.png',
    nullable: true,
  })
  faviconUrl: string | null;

  @ApiPropertyOptional({ type: InstanceSellerResponseDto, nullable: true })
  seller: InstanceSellerResponseDto | null;

  @ApiPropertyOptional({ type: InstanceTaxConfigResponseDto, nullable: true })
  taxConfig: InstanceTaxConfigResponseDto | null;

  @ApiProperty({ example: '2026-09-28T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-28T00:00:00.000Z' })
  updatedAt: Date;

  constructor(partial: Partial<InstanceConfigResponseDto>) {
    Object.assign(this, partial);
  }
}
