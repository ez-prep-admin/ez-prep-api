import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntitlementScopeType } from '../../common/enums/entitlement-scope-type.enum';
import { ProductStatus } from '../../common/enums/product-status.enum';
import { OfferResponseDto } from '../../offers/dto/offer-response.dto';

export class ProductGrantResponseDto {
  @ApiProperty({ enum: EntitlementScopeType })
  scopeType: EntitlementScopeType;

  @ApiProperty()
  scopeId: string;
}

export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ProductStatus })
  status: ProductStatus;

  @ApiProperty({
    description: '0 until first publish; then 1, 2, …',
    example: 1,
  })
  version: number;

  @ApiProperty({ type: [ProductGrantResponseDto] })
  grants: ProductGrantResponseDto[];

  @ApiPropertyOptional({ type: Object })
  display?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ProductDetailResponseDto extends ProductResponseDto {
  @ApiPropertyOptional({
    description: 'All offers for this product (admin detail)',
    type: [OfferResponseDto],
  })
  offers?: OfferResponseDto[];
}

export class ProductApiResponseDto {
  @ApiProperty({ example: 'Product created successfully' })
  message: string;

  @ApiProperty({ type: ProductResponseDto })
  data: ProductResponseDto | ProductDetailResponseDto;
}

export class ProductVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: [ProductGrantResponseDto] })
  grants: ProductGrantResponseDto[];

  @ApiProperty()
  frozenAt: Date;

  @ApiPropertyOptional()
  publishedBy?: string;
}

export class ProductVersionsApiResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: [ProductVersionResponseDto] })
  data: ProductVersionResponseDto[];
}

export class ProductVersionApiResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: ProductVersionResponseDto })
  data: ProductVersionResponseDto;
}
