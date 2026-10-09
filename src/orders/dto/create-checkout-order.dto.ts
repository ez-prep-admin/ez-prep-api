import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CheckoutBillingDto {
  @ApiProperty({ example: 'Asha Nair' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '32', description: 'GST state code' })
  @IsString()
  @Matches(/^\d{2}$/)
  stateCode: string;

  @ApiProperty({ example: '12 Marine Drive' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Flat 4', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @ApiProperty({ example: 'Kochi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city: string;

  @ApiProperty({ example: '682001' })
  @IsString()
  @Matches(/^\d{6}$/)
  pincode: string;
}

export class CreateCheckoutOrderDto {
  @ApiProperty()
  @IsMongoId()
  offerId: string;

  @ApiProperty({ type: CheckoutBillingDto })
  @ValidateNested()
  @Type(() => CheckoutBillingDto)
  billing: CheckoutBillingDto;

  @ApiProperty({ description: 'Client-generated idempotency key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;
}
