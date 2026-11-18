import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaidUsersByProductRowDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  productId: string;

  @ApiProperty({ example: 'SSC CGL Pack' })
  productName: string;

  @ApiPropertyOptional({ example: 'SSC-CGL' })
  productCode?: string;

  @ApiProperty({
    description: 'Distinct learners with a usable entitlement for this product',
    example: 4,
  })
  userCount: number;
}

export class PaidUsersByProductDto {
  @ApiProperty({
    description: 'Distinct learners with any usable entitlement',
    example: 60,
  })
  paidUsers: number;

  @ApiProperty({ type: [PaidUsersByProductRowDto] })
  products: PaidUsersByProductRowDto[];
}
