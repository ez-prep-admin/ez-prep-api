import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentRole } from './domain/payment-role.enum';
import { Payment, PaymentDocument } from './schemas/payment.schema';

export const PROVIDER_PAYMENT_INDEX = 'provider_1_providerPaymentId';
export const PRIMARY_PAYMENT_INDEX = 'orderId_1_role_primary';

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
    let indexes: Array<{
      name?: string;
      key?: Record<string, unknown>;
      partialFilterExpression?: unknown;
    }> = [];
    try {
      indexes = await this.paymentModel.collection.indexes();
    } catch (error) {
      if (!isMissingNamespace(error)) {
        throw error;
      }
    }
    const legacy = legacyProviderPaymentIndexNames(indexes);
    for (const name of legacy) {
      await this.paymentModel.collection.dropIndex(name);
      this.logger.log(
        'Dropped a payments unique index that blocked another checkout before a payment id exists',
      );
    }
    await this.paymentModel.updateMany(
      { $or: [{ role: { $exists: false } }, { role: null }] },
      { $set: { role: PaymentRole.PRIMARY } },
    );
    const duplicates = await this.duplicatePrimaryOrderIds();
    if (duplicates.length > 0) {
      this.logger.error(
        `Skipped ${PRIMARY_PAYMENT_INDEX}: duplicate PRIMARY payments for orders ${duplicates.join(', ')}`,
      );
    }
    try {
      await this.paymentModel.createIndexes();
    } catch (error) {
      if (duplicates.length > 0 && isIndexConflict(error)) {
        this.logger.error(
          `Boot continued without ${PRIMARY_PAYMENT_INDEX} because PRIMARY payments are duplicated`,
        );
        return;
      }
      throw error;
    }
  }

  private async duplicatePrimaryOrderIds(): Promise<string[]> {
    const rows = await this.paymentModel
      .find({ role: PaymentRole.PRIMARY })
      .select('orderId')
      .lean()
      .exec();
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.orderId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([orderId]) => orderId);
  }
}

function isMissingNamespace(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 26
  );
}

function isIndexConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = 'code' in error ? (error as { code?: number }).code : undefined;
  if (code === 11000 || code === 86) {
    return true;
  }
  const message = error instanceof Error ? error.message : '';
  return message.includes(PRIMARY_PAYMENT_INDEX);
}
