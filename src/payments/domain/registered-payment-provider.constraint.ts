import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaymentGatewayRegistry } from '../domain/payment-gateway.registry';

@ValidatorConstraint({ name: 'registeredPaymentProvider', async: false })
@Injectable()
export class RegisteredPaymentProviderConstraint
  implements ValidatorConstraintInterface
{
  constructor(private readonly registry: PaymentGatewayRegistry) {}

  validate(value: unknown): boolean {
    return typeof value === 'string' && this.registry.isRegistered(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `Payment provider "${String(args.value)}" is not available`;
  }
}
