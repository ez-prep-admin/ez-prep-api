import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { RegisteredPaymentProviderConstraint } from '../../payments/domain/registered-payment-provider.constraint';

const RAZORPAY_FIELDS = [
  'razorpay_order_id',
  'razorpay_payment_id',
  'razorpay_signature',
] as const;

@ValidatorConstraint({ name: 'checkoutProviderPayload', async: false })
export class CheckoutProviderPayloadConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    if (!isPayload(value)) {
      return false;
    }
    const provider = (args.object as { provider?: string }).provider;
    if (provider !== 'razorpay') {
      return true;
    }
    return RAZORPAY_FIELDS.every(key => {
      const field = value[key];
      return typeof field === 'string' && field.trim().length > 0;
    });
  }

  defaultMessage(): string {
    return 'razorpay providerPayload requires razorpay_order_id, razorpay_payment_id, and razorpay_signature';
  }
}

export class VerifyCheckoutPaymentDto {
  @ApiProperty({ example: 'razorpay' })
  @Validate(RegisteredPaymentProviderConstraint)
  provider: string;

  @ApiProperty({
    type: Object,
    example: {
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'signature',
    },
  })
  @IsObject()
  @Validate(CheckoutProviderPayloadConstraint)
  providerPayload: Record<string, unknown>;
}

function isPayload(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
