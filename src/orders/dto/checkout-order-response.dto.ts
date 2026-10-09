import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { TaxBreakdown } from '../../common/commerce/calculate-inclusive-tax';
import { OrderBillingSnapshot } from '../schemas/order.schema';

export class CheckoutOrderDataDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ description: 'Inclusive amount in paise', example: 99900 })
  amount: number;

  @ApiProperty({ example: 'INR' })
  currency: string;

  @ApiProperty({ example: 'fake' })
  provider: string;

  @ApiProperty({ type: Object })
  providerData: Record<string, unknown>;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiProperty({ type: Object })
  tax: TaxBreakdown;

  @ApiProperty({ type: Object })
  billing: OrderBillingSnapshot;

  @ApiPropertyOptional()
  paidAt?: Date;
}

export class CheckoutOrderApiResponseDto {
  @ApiProperty({ example: 'Order created' })
  message: string;

  @ApiProperty({ type: CheckoutOrderDataDto })
  data: CheckoutOrderDataDto;
}
