import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentRole } from '../payments/domain/payment-role.enum';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { RefundKind } from './domain/refund-kind.enum';
import { Refund, RefundDocument } from './schemas/refund.schema';

export const REFUND_PAYMENT_INDEX = 'paymentId_1';

export function uniqueOrderRefundIndexNames(
  indexes: Array<{
    name?: string;
    unique?: boolean;
    key?: Record<string, unknown>;
  }>,
): string[] {
  return indexes.flatMap(index => {
    if (!index.name || !index.unique) {
      return [];
    }
    if (index.key?.orderId !== 1) {
      return [];
    }
    if (index.key.paymentId != null) {
      return [];
    }
    return [index.name];
  });
}

@Injectable()
export class RefundIndexRepair implements OnModuleInit {
  private readonly logger = new Logger(RefundIndexRepair.name);

  constructor(
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    let indexes: Array<{
      name?: string;
      unique?: boolean;
      key?: Record<string, unknown>;
    }> = [];
    try {
      indexes = await this.refundModel.collection.indexes();
    } catch (error) {
      if (!isMissingNamespace(error)) {
        throw error;
      }
    }
    for (const name of uniqueOrderRefundIndexNames(indexes)) {
      await this.refundModel.collection.dropIndex(name);
      this.logger.log(
        'Dropped the refunds unique orderId index so one order can record a later duplicate-capture refund',
      );
    }

    await this.refundModel.updateMany(
      { $or: [{ kind: { $exists: false } }, { kind: null }] },
      { $set: { kind: RefundKind.ORDER } },
    );
    await this.backfillPaymentIds();

    const duplicates = await this.duplicatePaymentIds();
    if (duplicates.length > 0) {
      this.logger.error(
        `Skipped ${REFUND_PAYMENT_INDEX}: duplicate refunds for payments ${duplicates.join(', ')}`,
      );
    }
    try {
      await this.refundModel.createIndexes();
    } catch (error) {
      if (duplicates.length > 0 && isIndexConflict(error)) {
        this.logger.error(
          `Boot continued without ${REFUND_PAYMENT_INDEX} because refund payment ids are duplicated`,
        );
        return;
      }
      throw error;
    }
  }

  private async backfillPaymentIds(): Promise<void> {
    const missing = await this.refundModel
      .find({ $or: [{ paymentId: { $exists: false } }, { paymentId: null }] })
      .exec();
    for (const refund of missing) {
      const payment =
        (await this.paymentModel
          .findOne({ orderId: refund.orderId, role: PaymentRole.PRIMARY })
          .exec()) ??
        (await this.paymentModel.findOne({ orderId: refund.orderId }).exec());
      if (!payment) {
        this.logger.error(
          `Refund ${String(refund._id)} has no payment to backfill`,
        );
        continue;
      }
      refund.paymentId = payment._id;
      await refund.save();
    }
  }

  private async duplicatePaymentIds(): Promise<string[]> {
    const rows = await this.refundModel
      .find({ paymentId: { $exists: true } })
      .select('paymentId')
      .lean()
      .exec();
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.paymentId) {
        continue;
      }
      const key = String(row.paymentId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([paymentId]) => paymentId);
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
  return message.includes(REFUND_PAYMENT_INDEX);
}
