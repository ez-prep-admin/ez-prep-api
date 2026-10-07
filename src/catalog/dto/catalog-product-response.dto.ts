import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferResponseDto } from '../../offers/dto/offer-response.dto';
import {
  ProductGrantResponseDto,
  ProductResponseDto,
} from '../../products/dto/product-response.dto';
import { ProductStatus } from '../../common/enums/product-status.enum';

/** User-facing product card; amounts on nested offers are paise. */
export class CatalogProductDto {
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

  @ApiProperty()
  version: number;

  @ApiProperty({ type: [ProductGrantResponseDto] })
  grants: ProductGrantResponseDto[];

  @ApiPropertyOptional({ type: Object })
  display?: Record<string, unknown>;

  @ApiProperty({
    type: [OfferResponseDto],
    description: 'ACTIVE offers only; effectiveAmount in integer paise',
  })
  offers: OfferResponseDto[];
}

export class CatalogProductApiResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: CatalogProductDto })
  data: CatalogProductDto;
}

export class CatalogProductsListApiResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: [CatalogProductDto] })
  data: CatalogProductDto[];
}

export function toCatalogProduct(
  product: ProductResponseDto,
  offers: OfferResponseDto[],
): CatalogProductDto {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    status: product.status,
    version: product.version,
    grants: product.grants,
    display: product.display,
    offers,
  };
}
