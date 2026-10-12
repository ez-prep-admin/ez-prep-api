import { ApiProperty } from '@nestjs/swagger';

export class MoneyTotalDto {
  @ApiProperty({ example: 'INR' })
  currency: string;

  @ApiProperty({ description: 'Integer paise', example: 99900 })
  amountPaise: number;
}

export class AccountingPeopleDto {
  @ApiProperty()
  paidUsers: number;

  @ApiProperty()
  freeUsers: number;

  @ApiProperty()
  learners: number;
}

export class AccountingEntitlementsDto {
  @ApiProperty()
  issued: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  revoked: number;
}

export class AccountingOrdersDto {
  @ApiProperty()
  paid: number;

  @ApiProperty()
  refunded: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  cancelled: number;
}

export class AccountingProductsDto {
  @ApiProperty()
  published: number;

  @ApiProperty()
  draft: number;

  @ApiProperty()
  archived: number;
}

export class AccountingOffersDto {
  @ApiProperty()
  active: number;

  @ApiProperty()
  inactive: number;
}

export class AccountingCatalogDto {
  @ApiProperty({ type: AccountingProductsDto })
  products: AccountingProductsDto;

  @ApiProperty({ type: AccountingOffersDto })
  offers: AccountingOffersDto;
}

export class AccountingMoneyDto {
  @ApiProperty({ type: [MoneyTotalDto] })
  paymentsReceived: MoneyTotalDto[];

  @ApiProperty({ type: [MoneyTotalDto] })
  refundsIssued: MoneyTotalDto[];

  @ApiProperty({ type: [MoneyTotalDto] })
  duplicateCaptureRefunds: MoneyTotalDto[];

  @ApiProperty({ type: [MoneyTotalDto] })
  netReceipts: MoneyTotalDto[];

  @ApiProperty({ type: [MoneyTotalDto] })
  taxOnPaidOrders: MoneyTotalDto[];

  @ApiProperty()
  invoicesIssued: number;
}

export class AccountingOverviewDto {
  @ApiProperty()
  computedAt: string;

  @ApiProperty()
  freshUntil: string;

  @ApiProperty({ type: AccountingPeopleDto })
  people: AccountingPeopleDto;

  @ApiProperty({ type: AccountingEntitlementsDto })
  entitlements: AccountingEntitlementsDto;

  @ApiProperty({ type: AccountingOrdersDto })
  orders: AccountingOrdersDto;

  @ApiProperty({ type: AccountingCatalogDto })
  catalog: AccountingCatalogDto;

  @ApiProperty({ type: AccountingMoneyDto })
  money: AccountingMoneyDto;
}
