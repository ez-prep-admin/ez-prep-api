import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { RefundStatus } from '../common/enums/refund-status.enum';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { InvoiceService } from '../invoices/invoice.service';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { ProviderRefund } from '../payments/domain/payment-gateway';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Refund, RefundDocument } from './schemas/refund.schema';

export const REFUND_COMPLETED_MESSAGE = 'Order refunded';
export const REFUND_PENDING_MESSAGE =
  'Refund is pending at the payment provider. Access was not revoked.';

const REFUND_SETTLE_MIN_AGE_MS = 60_000;
const REFUND_SETTLE_BATCH = 50;

export type RefundSettleOutcome =
  | 'settled'
  | 'already'
  | 'missing'
  | 'mismatch';
export type RefundFailOutcome = 'failed' | 'left' | 'missing';

export type RefundReconcileSummary = {
  examined: number;
  settled: number;
  failed: number;
  pending: number;
  skipped: number;
};

export type AdminOrderUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  username?: string;
};

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  userId: string;
  user: AdminOrderUser | null;
  status: OrderStatus;
  amount: number;
  currency: string;
  paymentProvider?: string;
  paidAt?: Date;
  createdAt?: Date;
};

export type AdminRefundView = {
  id: string;
  orderId: string;
  paymentId: string;
  status: RefundStatus;
  amount: number;
  reason: string;
  provider: string;
  providerRefundId?: string;
  initiatedBy: string;
  createdAt?: Date;
};

export type AdminOrderDetail = AdminOrderListItem & {
  items: Order['items'];
  tax: Order['tax'];
  billing: Order['billing'];
  providerOrderId?: string;
  payment: {
    id: string;
    status: PaymentStatus;
    provider: string;
    providerPaymentId?: string;
    amount: number;
    currency: string;
  } | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
  } | null;
  refund: AdminRefundView | null;
};

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly ordersService: OrdersService,
    private readonly entitlementsService: EntitlementsService,
    private readonly invoiceService: InvoiceService,
    private readonly commerceAuditService: CommerceAuditService,
    private readonly paymentGateways: PaymentGatewayRegistry,
  ) {}

  async list(options: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{
    data: AdminOrderListItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const page = positiveInt(options.page, 1);
    const limit = Math.min(positiveInt(options.limit, 20), 100);
    const skip = (page - 1) * limit;
    const query: FilterQuery<Order> = {};

    if (options.status) {
      if (!isOrderStatus(options.status)) {
        throw new BadRequestException('Invalid order status');
      }
      query.status = options.status;
    }
    if (options.search?.trim()) {
      query.orderNumber = new RegExp(escapeRegex(options.search.trim()), 'i');
    }

    const [rows, total] = await Promise.all([
      this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const users = await this.usersById(rows.map(row => String(row.userId)));
    return {
      data: rows.map(row =>
        this.toListItem(row, users.get(String(row.userId)) ?? null),
      ),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async get(orderId: string): Promise<AdminOrderDetail> {
    const order = await this.requireOrder(orderId);
    return this.toDetail(order);
  }

  /**
   * Full refund of a paid order. No partial amount.
   * A processed provider refund revokes PAYMENT entitlements for this order.
   * A pending provider refund leaves the order paid.
   * The tax invoice stays ISSUED. Credit notes are out of app scope.
   * TODO(golive): U-GST-04 — filing-relevant refunds still need a Zoho/CA credit note.
   */
  async refund(
    orderId: string,
    actorUserId: string,
    reason: string,
  ): Promise<{
    message: string;
    data: { refund: AdminRefundView; order: AdminOrderDetail };
  }> {
    if (!Types.ObjectId.isValid(actorUserId)) {
      throw new BadRequestException('Invalid admin id');
    }
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException('Refund reason is required');
    }

    const order = await this.requireOrder(orderId);
    if (order.status === OrderStatus.REFUNDED) {
      throw new ConflictException('Order is already refunded');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new ConflictException('Only paid orders can be refunded');
    }

    const payment = await this.paymentModel
      .findOne({ orderId: order._id })
      .exec();
    if (!payment || payment.status !== PaymentStatus.CAPTURED) {
      throw new ConflictException('Only captured payments can be refunded');
    }
    if (!payment.providerPaymentId?.trim()) {
      throw new ConflictException(
        'Captured payment has no provider payment id',
      );
    }
    if (
      payment.amount !== order.amount ||
      payment.currency !== order.currency ||
      order.currency !== 'INR'
    ) {
      throw new ConflictException('Payment amount does not match the order');
    }
    if (!order.paymentProvider?.trim()) {
      throw new ConflictException('Order has no payment provider');
    }

    const gateway = this.paymentGateways.get(order.paymentProvider);
    const refund = await this.beginRefund(
      order,
      payment,
      actorUserId,
      trimmedReason,
    );

    await this.commerceAuditService.log({
      actorUserId,
      action: 'REFUND_INITIATED',
      resourceType: 'refund',
      resourceId: this.idOf(refund),
      after: {
        orderId: this.idOf(order),
        amount: payment.amount,
        status: RefundStatus.INITIATED,
      },
    });

    let providerRefund: {
      status: string;
      amount: number;
      providerRefundId: string;
    };
    try {
      providerRefund = await gateway.refund({
        providerPaymentId: payment.providerPaymentId.trim(),
        amount: payment.amount,
        currency: 'INR',
      });
    } catch (error) {
      refund.status = RefundStatus.FAILED;
      await refund.save();
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException('Payment provider request failed');
    }

    const providerStatus = providerRefund.status.trim().toLowerCase();
    if (
      providerRefund.amount !== payment.amount ||
      (providerStatus !== 'pending' && providerStatus !== 'processed')
    ) {
      refund.providerRefundId = providerRefund.providerRefundId;
      refund.status = RefundStatus.FAILED;
      await refund.save();
      throw new BadGatewayException('Payment provider request failed');
    }

    refund.providerRefundId = providerRefund.providerRefundId;
    await refund.save();

    if (providerStatus === 'pending') {
      const fresh = await this.requireOrder(this.idOf(order));
      return {
        message: REFUND_PENDING_MESSAGE,
        data: {
          refund: this.toRefundView(refund),
          order: await this.toDetail(fresh),
        },
      };
    }

    const outcome = await this.settleProcessed(
      providerRefund.providerRefundId,
      providerRefund.amount,
      'INR',
    );
    if (outcome !== 'settled' && outcome !== 'already') {
      throw new BadGatewayException('Payment provider request failed');
    }

    const fresh = await this.requireOrder(this.idOf(order));
    const settled =
      (await this.refundModel
        .findOne({ providerRefundId: providerRefund.providerRefundId })
        .exec()) ?? refund;
    return {
      message: REFUND_COMPLETED_MESSAGE,
      data: {
        refund: this.toRefundView(settled),
        order: await this.toDetail(fresh),
      },
    };
  }

  /**
   * Completes a provider refund that is already processed.
   * A second call does not revoke again. The invoice stays ISSUED.
   * TODO(golive): U-GST-04 — filing-relevant refunds still need a Zoho/CA credit note.
   */
  async settleProcessed(
    providerRefundId: string,
    amount: number,
    currency: string,
  ): Promise<RefundSettleOutcome> {
    const refund = await this.findByProviderRefundId(providerRefundId);
    if (!refund) {
      return 'missing';
    }
    if (refund.status === RefundStatus.COMPLETED) {
      return 'already';
    }

    const order = await this.orderModel.findById(refund.orderId).exec();
    if (!order) {
      return 'missing';
    }
    if (order.status === OrderStatus.REFUNDED) {
      refund.status = RefundStatus.COMPLETED;
      await refund.save();
      return 'already';
    }
    if (amount !== refund.amount || currency !== 'INR') {
      return 'mismatch';
    }

    const actorUserId = String(refund.initiatedBy);
    await this.entitlementsService.revokePaymentEntitlementsForOrder(
      this.idOf(order),
      actorUserId,
      refund.reason,
    );
    await this.ordersService.markOrderRefunded(this.idOf(order));

    refund.status = RefundStatus.COMPLETED;
    await refund.save();

    await this.commerceAuditService.log({
      actorUserId,
      action: 'REFUND_COMPLETED',
      resourceType: 'refund',
      resourceId: this.idOf(refund),
      after: {
        orderId: this.idOf(order),
        amount: refund.amount,
        status: RefundStatus.COMPLETED,
        providerRefundId: refund.providerRefundId,
      },
    });

    return 'settled';
  }

  /**
   * Marks an in-progress refund failed. A completed refund is left alone.
   * The order stays PAID so admin can retry.
   */
  async settleFailed(providerRefundId: string): Promise<RefundFailOutcome> {
    const refund = await this.findByProviderRefundId(providerRefundId);
    if (!refund) {
      return 'missing';
    }
    if (
      refund.status === RefundStatus.COMPLETED ||
      refund.status === RefundStatus.FAILED
    ) {
      return 'left';
    }

    refund.status = RefundStatus.FAILED;
    await refund.save();
    await this.commerceAuditService.log({
      actorUserId: String(refund.initiatedBy),
      action: 'REFUND_FAILED',
      resourceType: 'refund',
      resourceId: this.idOf(refund),
      after: {
        orderId: String(refund.orderId),
        amount: refund.amount,
        status: RefundStatus.FAILED,
        providerRefundId: refund.providerRefundId,
      },
    });
    return 'failed';
  }

  /**
   * Backup for a missed refund.processed or refund.failed webhook.
   * Rows newer than one minute stay put so this does not race the POST.
   */
  async reconcileInitiatedRefunds(
    now: Date = new Date(),
  ): Promise<RefundReconcileSummary> {
    const olderThan = new Date(now.getTime() - REFUND_SETTLE_MIN_AGE_MS);
    const rows = await this.refundModel
      .find({
        status: RefundStatus.INITIATED,
        providerRefundId: { $gt: '' },
        updatedAt: { $lt: olderThan },
      })
      .sort({ updatedAt: 1 })
      .limit(REFUND_SETTLE_BATCH)
      .exec();

    const summary: RefundReconcileSummary = {
      examined: rows.length,
      settled: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
    };

    for (const refund of rows) {
      const providerRefundId = refund.providerRefundId?.trim();
      if (!providerRefundId) {
        summary.skipped += 1;
        continue;
      }

      let fetched: ProviderRefund;
      try {
        fetched = await this.paymentGateways
          .get(refund.provider)
          .fetchRefundStatus(providerRefundId);
      } catch (error) {
        summary.skipped += 1;
        this.logger.warn(
          `Refund reconciliation skipped ${providerRefundId}: ${
            error instanceof Error ? error.message : 'unexpected error'
          }`,
        );
        continue;
      }

      const status = fetched.status.trim().toLowerCase();
      if (status === 'pending') {
        summary.pending += 1;
        continue;
      }
      if (status === 'processed') {
        const outcome = await this.settleProcessed(
          providerRefundId,
          fetched.amount,
          fetched.currency ?? 'INR',
        );
        if (outcome === 'settled' || outcome === 'already') {
          summary.settled += 1;
        } else {
          summary.skipped += 1;
        }
        continue;
      }
      if (status === 'failed') {
        const outcome = await this.settleFailed(providerRefundId);
        if (outcome === 'failed' || outcome === 'left') {
          summary.failed += 1;
        } else {
          summary.skipped += 1;
        }
        continue;
      }

      summary.skipped += 1;
    }

    return summary;
  }

  private async findByProviderRefundId(
    providerRefundId: string,
  ): Promise<RefundDocument | null> {
    const id = providerRefundId.trim();
    if (!id) {
      return null;
    }
    return this.refundModel.findOne({ providerRefundId: id }).exec();
  }

  private async beginRefund(
    order: OrderDocument,
    payment: PaymentDocument,
    actorUserId: string,
    reason: string,
  ): Promise<RefundDocument> {
    const existing = await this.refundModel
      .findOne({ orderId: order._id })
      .exec();
    if (existing?.status === RefundStatus.COMPLETED) {
      throw new ConflictException('Order is already refunded');
    }
    if (existing?.status === RefundStatus.INITIATED) {
      throw new ConflictException('Refund already in progress');
    }

    if (existing) {
      existing.status = RefundStatus.INITIATED;
      existing.reason = reason;
      existing.initiatedBy = new Types.ObjectId(actorUserId);
      existing.amount = payment.amount;
      existing.provider = order.paymentProvider ?? payment.provider;
      existing.paymentId = payment._id;
      existing.providerRefundId = undefined;
      await existing.save();
      return existing;
    }

    return this.refundModel.create({
      orderId: order._id,
      paymentId: payment._id,
      userId: order.userId,
      provider: order.paymentProvider ?? payment.provider,
      amount: payment.amount,
      status: RefundStatus.INITIATED,
      reason,
      initiatedBy: new Types.ObjectId(actorUserId),
    });
  }

  private async requireOrder(orderId: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async toDetail(order: OrderDocument): Promise<AdminOrderDetail> {
    const [payment, invoice, refund] = await Promise.all([
      this.paymentModel.findOne({ orderId: order._id }).exec(),
      this.invoiceService.findByOrderId(this.idOf(order)),
      this.refundModel.findOne({ orderId: order._id }).exec(),
    ]);

    const users = await this.usersById([String(order.userId)]);
    return {
      ...this.toListItem(order, users.get(String(order.userId)) ?? null),
      items: order.items,
      tax: order.tax,
      billing: order.billing,
      providerOrderId: order.providerOrderId,
      payment: payment
        ? {
            id: this.idOf(payment),
            status: payment.status,
            provider: payment.provider,
            providerPaymentId: payment.providerPaymentId,
            amount: payment.amount,
            currency: payment.currency,
          }
        : null,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
          }
        : null,
      refund: refund ? this.toRefundView(refund) : null,
    };
  }

  private async usersById(ids: string[]): Promise<Map<string, AdminOrderUser>> {
    const objectIds = [...new Set(ids)]
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));
    if (objectIds.length === 0) {
      return new Map();
    }

    const users = await this.userModel
      .find({ _id: { $in: objectIds } })
      .select('name email phoneNumber username')
      .exec();
    return new Map(
      users.map(user => [
        String(user._id),
        {
          id: String(user._id),
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          username: user.username,
        },
      ]),
    );
  }

  private toListItem(
    order: OrderDocument,
    user: AdminOrderUser | null,
  ): AdminOrderListItem {
    return {
      id: this.idOf(order),
      orderNumber: order.orderNumber,
      userId: String(order.userId),
      user,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      paymentProvider: order.paymentProvider,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    };
  }

  private toRefundView(refund: RefundDocument): AdminRefundView {
    return {
      id: this.idOf(refund),
      orderId: String(refund.orderId),
      paymentId: String(refund.paymentId),
      status: refund.status,
      amount: refund.amount,
      reason: refund.reason,
      provider: refund.provider,
      providerRefundId: refund.providerRefundId,
      initiatedBy: String(refund.initiatedBy),
      createdAt: refund.createdAt,
    };
  }

  private idOf(doc: { _id: Types.ObjectId; id?: string }): string {
    return doc.id ? String(doc.id) : String(doc._id);
  }
}

function positiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}

function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
