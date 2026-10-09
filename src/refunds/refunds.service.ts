import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
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
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Refund, RefundDocument } from './schemas/refund.schema';

export const REFUND_COMPLETED_MESSAGE = 'Order refunded';
export const REFUND_PENDING_MESSAGE =
  'Refund is pending at the payment provider. Access was not revoked.';

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  userId: string;
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
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
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
    return {
      data: rows.map(row => this.toListItem(row)),
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

    await this.entitlementsService.revokePaymentEntitlementsForOrder(
      this.idOf(order),
      actorUserId,
      trimmedReason,
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

    const fresh = await this.requireOrder(this.idOf(order));
    return {
      message: REFUND_COMPLETED_MESSAGE,
      data: {
        refund: this.toRefundView(refund),
        order: await this.toDetail(fresh),
      },
    };
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

    return {
      ...this.toListItem(order),
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

  private toListItem(order: OrderDocument): AdminOrderListItem {
    return {
      id: this.idOf(order),
      orderNumber: order.orderNumber,
      userId: String(order.userId),
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
