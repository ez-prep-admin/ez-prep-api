import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';

export const PROVIDER_PAYMENT_INDEX = 'provider_1_providerPaymentId';

export function legacyProviderPaymentIndexNames(
  indexes: Array<{
    name?: string;
    key?: Record<string, unknown>;
    partialFilterExpression?: unknown;
  }>,
): string[] {
  return indexes.flatMap(index => {
    if (!index.name) return [];
    if (index.key?.provider !== 1 || index.key?.providerPaymentId !== 1) {
      return [];
    }
    if (index.partialFilterExpression != null) return [];
    return [index.name];
  });
}

@Injectable()
export class PaymentIndexRepair implements OnModuleInit {
  private readonly logger = new Logger(PaymentIndexRepair.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const indexes = await this.paymentModel.collection.indexes();
    const legacy = legacyProviderPaymentIndexNames(indexes);
    for (const name of legacy) {
      await this.paymentModel.collection.dropIndex(name);
      this.logger.log(
        'Dropped a payments unique index that blocked another checkout before a payment id exists',
      );
    }
    await this.paymentModel.createIndexes();
  }
}
