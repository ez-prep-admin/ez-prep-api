import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommerceAuditLog } from '../commerce-audit/schemas/commerce-audit-log.schema';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { RefundStatus } from '../common/enums/refund-status.enum';
import { WebhookEventStatus } from '../common/enums/webhook-event-status.enum';
import { TaxInvoice } from '../invoices/schemas/tax-invoice.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { PRIMARY_PAYMENT_INDEX } from '../payments/payment-index.repair';
import { PaymentRole } from '../payments/domain/payment-role.enum';
import { Payment } from '../payments/schemas/payment.schema';
import { RefundInitiatedBySource } from '../refunds/domain/refund-initiated-by-source.enum';
import { RefundKind } from '../refunds/domain/refund-kind.enum';
import { REFUND_PAYMENT_INDEX } from '../refunds/refund-index.repair';
import { Refund } from '../refunds/schemas/refund.schema';
import {
  SIGNATURE_REJECTION_DEGRADED_THRESHOLD,
  WebhookDeliveryStat,
  webhookRejectionHourIds,
} from '../webhooks/schemas/webhook-delivery-stat.schema';
import { WebhookEvent } from '../webhooks/schemas/webhook-event.schema';

const CACHE_MS = 30_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type HealthSlice = {
  count: number;
  oldestAt: Date | null;
  orderNumbers: string[];
};

export type CommerceHealthReport = {
  status: 'ok' | 'degraded';
  commerceEnabled: boolean;
  flags: {
    commerceEnabled: boolean;
    paymentProvider: string;
    instanceId: string;
    invoicesEnabled: boolean;
    reconciliationEnabled: boolean;
    accessEnforcementMode: string;
    webhookRetryWindowMinutes: number;
    lateCaptureWatchHours: number;
    reconciliationBatch: number;
    reconciliationMaxAttempts: number;
    refundUnknownWindowMinutes: number;
  };
  pendingPastWindow: HealthSlice;
  needsReview: HealthSlice;
  underLateWatch: HealthSlice;
  lateCaptures7d: HealthSlice;
  paidUnprovisioned: HealthSlice;
  paidWithoutInvoice: HealthSlice;
  invoiceWithoutPdf: HealthSlice;
  invoicesIssuedLate: HealthSlice;
  redundantPurchases: HealthSlice;
  duplicates: HealthSlice & { refunded: number };
  refundsUnknownOutcome: HealthSlice;
  externalRefunds7d: HealthSlice;
  partialExternalRefunds: HealthSlice;
  refundsOnUnpaidOrders7d: HealthSlice;
  webhookIgnored: {
    otherInstance24h: number;
    foreignPayment24h: number;
  };
  webhook: {
    lastWebhookProcessedAt: Date | null;
    signatureRejections1h: number;
    signatureRejections24h: number;
    failed24h: number;
    ignored24h: number;
    webhookSilentWhilePaid: boolean;
  };
  sellerStateMismatches: HealthSlice;
  indexWarnings: string[];
};

@Injectable()
export class CommerceHealthService {
  private readonly logger = new Logger(CommerceHealthService.name);
  private cached?: { at: number; value: CommerceHealthReport };

  constructor(
    private readonly commerceConfig: CommerceConfigService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Refund.name) private readonly refundModel: Model<Refund>,
    @InjectModel(WebhookEvent.name)
    private readonly webhookModel: Model<WebhookEvent>,
    @InjectModel(WebhookDeliveryStat.name)
    private readonly statModel: Model<WebhookDeliveryStat>,
    @InjectModel(TaxInvoice.name)
    private readonly invoiceModel: Model<TaxInvoice>,
    @InjectModel(CommerceAuditLog.name)
    private readonly auditModel: Model<CommerceAuditLog>,
  ) {}

  async snapshot(now = new Date()): Promise<CommerceHealthReport> {
    if (this.cached && now.getTime() - this.cached.at < CACHE_MS) {
      return this.cached.value;
    }
    const value = await this.compute(now);
    this.cached = { at: now.getTime(), value };
    return value;
  }

  async degradedTick(now = new Date()): Promise<void> {
    const webhook = await this.webhookBlock(now);
    const hourRejections = await this.rejectionCount(now, 1);
    if (
      hourRejections > SIGNATURE_REJECTION_DEGRADED_THRESHOLD ||
      webhook.webhookSilentWhilePaid
    ) {
      this.logger.warn('COMMERCE_DEGRADED');
    }
  }

  private async compute(now: Date): Promise<CommerceHealthReport> {
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const settings = this.commerceConfig.settings;
    const [
      pendingPastWindow,
      needsReview,
      underLateWatch,
      lateCaptures7d,
      paidUnprovisioned,
      paidWithoutInvoice,
      invoiceWithoutPdf,
      invoicesIssuedLate,
      redundantPurchases,
      duplicates,
      refundsUnknownOutcome,
      externalRefunds7d,
      partialExternalRefunds,
      refundsOnUnpaidOrders7d,
      webhookIgnored,
      webhook,
      sellerStateMismatches,
      indexWarnings,
    ] = await Promise.all([
      this.orderSlice(
        {
          status: OrderStatus.PENDING_PAYMENT,
          expiresAt: { $lt: now },
        },
        'createdAt',
      ),
      this.orderSlice({ needsReview: true }, 'createdAt'),
      this.orderSlice(
        {
          status: OrderStatus.EXPIRED,
          lateWatchUntil: { $gte: now },
        },
        'expiredAt',
      ),
      this.orderSlice({ lateCaptureAt: { $gte: weekAgo } }, 'lateCaptureAt'),
      this.orderSlice(
        { status: OrderStatus.PAID, provisionedAt: null },
        'paidAt',
      ),
      this.uninvoicedSlice(),
      this.invoiceSlice({
        $or: [
          { pdfStorageKey: null },
          { pdfStorageKey: '' },
          { pdfStorageKey: { $exists: false } },
        ],
      }),
      this.lateInvoiceSlice(),
      this.orderSlice({ redundantPurchase: true }, 'paidAt'),
      this.duplicateSlice(),
      this.refundSlice(
        {
          status: RefundStatus.INITIATED,
          outcomeUnknownAt: { $ne: null },
        },
        'outcomeUnknownAt',
      ),
      this.refundSlice(
        {
          initiatedBySource: RefundInitiatedBySource.PROVIDER,
          partial: { $ne: true },
          createdAt: { $gte: weekAgo },
        },
        'createdAt',
      ),
      this.refundSlice({ partial: true }, 'createdAt'),
      this.webhookReasonSlice('refund_on_unpaid_order', weekAgo),
      this.ignoredCounts(now),
      this.webhookBlock(now),
      this.sellerMismatchSlice(),
      this.indexWarnings(),
    ]);

    const degraded =
      indexWarnings.length > 0 ||
      webhook.webhookSilentWhilePaid ||
      webhook.signatureRejections1h > SIGNATURE_REJECTION_DEGRADED_THRESHOLD ||
      needsReview.count > 0 ||
      paidUnprovisioned.count > 0 ||
      paidWithoutInvoice.count > 0 ||
      invoiceWithoutPdf.count > 0 ||
      refundsUnknownOutcome.count > 0 ||
      partialExternalRefunds.count > 0 ||
      sellerStateMismatches.count > 0;

    return {
      status: degraded ? 'degraded' : 'ok',
      commerceEnabled: settings.commerceEnabled,
      flags: {
        commerceEnabled: settings.commerceEnabled,
        paymentProvider: settings.paymentProvider,
        instanceId: settings.instanceId,
        invoicesEnabled: settings.invoicesEnabled,
        reconciliationEnabled: settings.reconciliationEnabled,
        accessEnforcementMode: settings.accessEnforcementMode,
        webhookRetryWindowMinutes: settings.webhookRetryWindowMinutes,
        lateCaptureWatchHours: settings.lateCaptureWatchHours,
        reconciliationBatch: settings.reconciliationBatch,
        reconciliationMaxAttempts: settings.reconciliationMaxAttempts,
        refundUnknownWindowMinutes: settings.refundUnknownWindowMinutes,
      },
      pendingPastWindow,
      needsReview,
      underLateWatch,
      lateCaptures7d,
      paidUnprovisioned,
      paidWithoutInvoice,
      invoiceWithoutPdf,
      invoicesIssuedLate,
      redundantPurchases,
      duplicates,
      refundsUnknownOutcome,
      externalRefunds7d,
      partialExternalRefunds,
      refundsOnUnpaidOrders7d,
      webhookIgnored,
      webhook,
      sellerStateMismatches,
      indexWarnings,
    };
  }

  private async orderSlice(
    filter: Record<string, unknown>,
    dateField: string,
  ): Promise<HealthSlice> {
    const [count, rows] = await Promise.all([
      this.orderModel.countDocuments(filter).exec(),
      this.orderModel
        .find(filter)
        .sort({ [dateField]: 1 })
        .limit(5)
        .select(`orderNumber ${dateField}`)
        .exec(),
    ]);
    return {
      count,
      oldestAt: dateOf(rows[0], dateField),
      orderNumbers: rows.map(row => row.orderNumber),
    };
  }

  private async uninvoicedSlice(): Promise<HealthSlice> {
    const invoiced = await this.invoiceModel.distinct('orderId');
    return this.orderSlice(
      {
        status: { $in: [OrderStatus.PAID, OrderStatus.REFUNDED] },
        provisionedAt: { $ne: null },
        _id: { $nin: invoiced },
      },
      'paidAt',
    );
  }

  private async invoiceSlice(
    filter: Record<string, unknown>,
  ): Promise<HealthSlice> {
    const [count, rows] = await Promise.all([
      this.invoiceModel.countDocuments(filter).exec(),
      this.invoiceModel
        .find(filter)
        .sort({ issuedAt: 1 })
        .limit(5)
        .select('orderNumber issuedAt')
        .exec(),
    ]);
    return {
      count,
      oldestAt: rows[0]?.issuedAt ?? null,
      orderNumbers: rows.map(row => row.orderNumber),
    };
  }

  private async lateInvoiceSlice(): Promise<HealthSlice> {
    const rows = await this.invoiceModel
      .aggregate<{
        orderNumber: string;
        issuedAt: Date;
        paidAt: Date;
      }>([
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order',
          },
        },
        {
          $addFields: {
            paidAt: { $arrayElemAt: ['$order.paidAt', 0] },
          },
        },
        {
          $match: {
            $expr: {
              $gt: [{ $subtract: ['$issuedAt', '$paidAt'] }, DAY_MS],
            },
          },
        },
        { $sort: { issuedAt: 1 } },
        { $limit: 5 },
        {
          $project: {
            orderNumber: 1,
            issuedAt: 1,
            paidAt: 1,
          },
        },
      ])
      .exec();
    const countRows = await this.invoiceModel
      .aggregate<{ count: number }>([
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order',
          },
        },
        {
          $addFields: { paidAt: { $arrayElemAt: ['$order.paidAt', 0] } },
        },
        {
          $match: {
            $expr: {
              $gt: [{ $subtract: ['$issuedAt', '$paidAt'] }, DAY_MS],
            },
          },
        },
        { $count: 'count' },
      ])
      .exec();
    return {
      count: countRows[0]?.count ?? rows.length,
      oldestAt: rows[0]?.issuedAt ?? null,
      orderNumbers: rows.map(row => row.orderNumber),
    };
  }

  private async duplicateSlice(): Promise<HealthSlice & { refunded: number }> {
    const filter = { role: PaymentRole.DUPLICATE };
    const [count, refunded, rows] = await Promise.all([
      this.paymentModel.countDocuments(filter).exec(),
      this.refundModel
        .countDocuments({
          kind: RefundKind.DUPLICATE_CAPTURE,
          status: RefundStatus.COMPLETED,
        })
        .exec(),
      this.paymentModel.find(filter).sort({ createdAt: 1 }).limit(5).exec(),
    ]);
    const orderIds = rows.map(row => row.orderId);
    const orders =
      orderIds.length === 0
        ? []
        : await this.orderModel
            .find({ _id: { $in: orderIds } })
            .select('orderNumber')
            .exec();
    return {
      count,
      refunded,
      oldestAt: rows[0]?.createdAt ?? null,
      orderNumbers: orders.map(order => order.orderNumber),
    };
  }

  private async refundSlice(
    filter: Record<string, unknown>,
    dateField: string,
  ): Promise<HealthSlice> {
    const [count, rows] = await Promise.all([
      this.refundModel.countDocuments(filter).exec(),
      this.refundModel
        .find(filter)
        .sort({ [dateField]: 1 })
        .limit(5)
        .select(`orderId ${dateField}`)
        .exec(),
    ]);
    const orderIds = rows.map(row => row.orderId);
    const orders =
      orderIds.length === 0
        ? []
        : await this.orderModel
            .find({ _id: { $in: orderIds } })
            .select('orderNumber')
            .exec();
    return {
      count,
      oldestAt: dateOf(rows[0], dateField),
      orderNumbers: orders.map(order => order.orderNumber),
    };
  }

  private async webhookReasonSlice(
    reason: string,
    since: Date,
  ): Promise<HealthSlice> {
    const filter = {
      status: WebhookEventStatus.IGNORED,
      error: reason,
      receivedAt: { $gte: since },
    };
    const [count, rows] = await Promise.all([
      this.webhookModel.countDocuments(filter).exec(),
      this.webhookModel
        .find(filter)
        .sort({ receivedAt: 1 })
        .limit(5)
        .select('receivedAt')
        .exec(),
    ]);
    return {
      count,
      oldestAt: rows[0]?.receivedAt ?? null,
      orderNumbers: [],
    };
  }

  private async ignoredCounts(now: Date): Promise<{
    otherInstance24h: number;
    foreignPayment24h: number;
  }> {
    const since = new Date(now.getTime() - DAY_MS);
    const [otherInstance24h, foreignPayment24h] = await Promise.all([
      this.webhookModel
        .countDocuments({
          status: WebhookEventStatus.IGNORED,
          error: 'other_instance',
          receivedAt: { $gte: since },
        })
        .exec(),
      this.webhookModel
        .countDocuments({
          status: WebhookEventStatus.IGNORED,
          error: 'foreign_payment',
          receivedAt: { $gte: since },
        })
        .exec(),
    ]);
    return { otherInstance24h, foreignPayment24h };
  }

  private async webhookBlock(
    now: Date,
  ): Promise<CommerceHealthReport['webhook']> {
    const since6h = new Date(now.getTime() - 6 * HOUR_MS);
    const since24h = new Date(now.getTime() - DAY_MS);
    const [
      last,
      failed24h,
      ignored24h,
      paid,
      processed,
      rejections1h,
      rejections24h,
    ] = await Promise.all([
      this.webhookModel
        .findOne({ status: WebhookEventStatus.PROCESSED })
        .sort({ processedAt: -1 })
        .select('processedAt')
        .exec(),
      this.webhookModel
        .countDocuments({
          status: WebhookEventStatus.FAILED,
          processedAt: { $gte: since24h },
        })
        .exec(),
      this.webhookModel
        .countDocuments({
          status: WebhookEventStatus.IGNORED,
          receivedAt: { $gte: since24h },
        })
        .exec(),
      this.orderModel.countDocuments({ paidAt: { $gte: since6h } }).exec(),
      this.webhookModel
        .countDocuments({
          status: WebhookEventStatus.PROCESSED,
          processedAt: { $gte: since6h },
        })
        .exec(),
      this.rejectionCount(now, 1),
      this.rejectionCount(now, 24),
    ]);
    return {
      lastWebhookProcessedAt: last?.processedAt ?? null,
      signatureRejections1h: rejections1h,
      signatureRejections24h: rejections24h,
      failed24h,
      ignored24h,
      webhookSilentWhilePaid: paid > 0 && processed === 0,
    };
  }

  private async rejectionCount(now: Date, hours: number): Promise<number> {
    const ids = webhookRejectionHourIds(now, hours);
    const rows = await this.statModel
      .find({ _id: { $in: ids } })
      .select('count')
      .exec();
    return rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
  }

  private async sellerMismatchSlice(): Promise<HealthSlice> {
    const ids = await this.auditModel.distinct('resourceId', {
      action: 'INVOICE_SELLER_STATE_MISMATCH',
    });
    const objectIds = ids.filter(
      (id): id is Types.ObjectId => id instanceof Types.ObjectId,
    );
    if (objectIds.length === 0) {
      return { count: 0, oldestAt: null, orderNumbers: [] };
    }
    const rows = await this.orderModel
      .find({ _id: { $in: objectIds } })
      .sort({ paidAt: 1 })
      .limit(5)
      .select('orderNumber paidAt')
      .exec();
    return {
      count: objectIds.length,
      oldestAt: rows[0]?.paidAt ?? null,
      orderNumbers: rows.map(row => row.orderNumber),
    };
  }

  private async indexWarnings(): Promise<string[]> {
    const warnings: string[] = [];
    warnings.push(
      ...(await this.missingIndex(
        this.paymentModel,
        PRIMARY_PAYMENT_INDEX,
        `payments.${PRIMARY_PAYMENT_INDEX}`,
      )),
    );
    warnings.push(
      ...(await this.missingIndex(
        this.refundModel,
        REFUND_PAYMENT_INDEX,
        `refunds.${REFUND_PAYMENT_INDEX}`,
      )),
    );
    return warnings;
  }

  private async missingIndex(
    model: { collection: { indexes(): Promise<Array<{ name?: string }>> } },
    indexName: string,
    label: string,
  ): Promise<string[]> {
    try {
      const indexes = await model.collection.indexes();
      const present = indexes.some(index => index.name === indexName);
      return present ? [] : [label];
    } catch (error) {
      this.logger.warn(
        `Index check failed for ${label}: ${
          error instanceof Error ? error.message : 'unexpected error'
        }`,
      );
      return [`${label} check failed`];
    }
  }
}

function dateOf(
  row: { get?(key: string): unknown } | undefined,
  field: string,
): Date | null {
  if (!row) {
    return null;
  }
  const value =
    (row as unknown as Record<string, unknown>)[field] ?? row.get?.(field);
  return value instanceof Date ? value : null;
}
