import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TaxBreakdown } from '../common/commerce/calculate-inclusive-tax';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { assertPaymentTransition } from '../payments/domain/payment-transitions';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { generateOrderNumber } from './domain/generate-order-number';
import {
  ORDER_PAID_HANDLER,
  OrderPaidHandler,
} from './domain/order-paid-handler';
import { assertOrderTransition } from './domain/order-transitions';
import { duplicateField } from './domain/duplicate-key';
import {
  Order,
  OrderBillingSnapshot,
  OrderDocument,
  OrderItem,
  OrderTaxSnapshot,
} from './schemas/order.schema';

export interface OrderHistoryItemView {
  productName: string;
  durationPreset: DurationPreset;
  amount: number;
}

export interface OrderHistoryView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  createdAt?: Date;
  paidAt?: Date;
  expiresAt?: Date;
  items: OrderHistoryItemView[];
  tax?: TaxBreakdown;
}

export interface InsertCreatedOrderInput {
  userId: Types.ObjectId;
  items: OrderItem[];
  amount: number;
  currency: string;
  tax: OrderTaxSnapshot;
  billing: OrderBillingSnapshot;
  paymentProvider: string;
  idempotencyKey: string;
  expiresAt: Date;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @Inject(ORDER_PAID_HANDLER)
    private readonly paidHandler: OrderPaidHandler,
    private readonly provisioning: EntitlementProvisioningService,
  ) {}

  async findByIdempotencyKey(key: string): Promise<OrderDocument | null> {
    return this.orderModel.findOne({ idempotencyKey: key }).exec();
  }

  async countOpenCheckoutOrders(userId: string, since: Date): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) {
      return 0;
    }
    return this.orderModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        status: { $in: [OrderStatus.CREATED, OrderStatus.PENDING_PAYMENT] },
        createdAt: { $gte: since },
      })
      .exec();
  }

  async listForUser(
    userId: string,
    options: { page?: number; limit?: number },
  ): Promise<{
    data: OrderHistoryView[];
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
    if (!Types.ObjectId.isValid(userId)) {
      return {
        data: [],
        pagination: emptyPagination(page, limit),
      };
    }

    const query = { userId: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;
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
      data: rows.map(row => this.toHistory(row)),
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

  async getForUser(userId: string, orderId: string): Promise<OrderHistoryView> {
    const order = await this.findById(orderId);
    if (!order || String(order.userId) !== userId) {
      throw new NotFoundException('Order not found');
    }
    return this.toHistory(order);
  }

  async findById(id: string): Promise<OrderDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.orderModel.findById(id).exec();
  }

  async findByProviderOrderId(
    provider: string,
    providerOrderId: string,
  ): Promise<OrderDocument | null> {
    return this.orderModel
      .findOne({ paymentProvider: provider, providerOrderId })
      .exec();
  }

  idOf(order: OrderDocument): string {
    const withVirtual = order as OrderDocument & { id?: string };
    return withVirtual.id ? String(withVirtual.id) : String(order._id);
  }

  async insertCreated(input: InsertCreatedOrderInput): Promise<OrderDocument> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.orderModel.create({
          ...input,
          orderNumber: generateOrderNumber(),
          status: OrderStatus.CREATED,
        });
      } catch (error) {
        if (duplicateField(error) === 'orderNumber') {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Could not allocate an order number');
  }

  async markPendingPayment(
    order: OrderDocument,
    providerOrder: { provider: string; providerOrderId: string },
  ): Promise<OrderDocument> {
    assertOrderTransition(order.status, OrderStatus.PENDING_PAYMENT);
    order.status = OrderStatus.PENDING_PAYMENT;
    order.paymentProvider = providerOrder.provider;
    order.providerOrderId = providerOrder.providerOrderId;
    await order.save();
    return order;
  }

  async ensureInitiatedPayment(order: OrderDocument): Promise<PaymentDocument> {
    const existing = await this.paymentModel
      .findOne({ orderId: order._id })
      .exec();
    if (existing) {
      return existing;
    }

    return this.paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: order.paymentProvider,
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: order.currency,
      status: PaymentStatus.INITIATED,
    });
  }

  /**
   * Moves payment to CAPTURED and order to PAID, then provisions entitlements.
   * The paid handler runs only on the first transition to PAID.
   * A later PAID signal does not call the handler. If `provisionedAt` is still
   * unset, that signal calls provisionForPaidOrder directly.
   */
  async markOrderPaid(
    orderId: string,
    input: { providerPaymentId: string },
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const decision = assertOrderTransition(order.status, OrderStatus.PAID);
    if (decision === 'noop') {
      if (!order.provisionedAt) {
        await this.provisioning.provisionForPaidOrder(this.idOf(order));
      }
      return order;
    }

    const payment = await this.paymentModel
      .findOne({ orderId: order._id })
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const paymentDecision = assertPaymentTransition(
      payment.status,
      PaymentStatus.CAPTURED,
    );
    if (paymentDecision === 'apply') {
      payment.status = PaymentStatus.CAPTURED;
      payment.providerPaymentId = input.providerPaymentId;
      payment.capturedAt = new Date();
      await payment.save();
    }

    order.status = OrderStatus.PAID;
    order.paidAt = new Date();
    await order.save();

    await this.paidHandler.onOrderPaid({
      orderId: this.idOf(order),
      userId: String(order.userId),
      amount: order.amount,
    });

    return order;
  }

  /**
   * Full-refund completion. Caller has already confirmed the provider refund
   * is processed. Does not touch entitlements or invoices.
   */
  async markOrderRefunded(orderId: string): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const payment = await this.paymentModel
      .findOne({ orderId: order._id })
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    assertPaymentTransition(payment.status, PaymentStatus.REFUNDED);
    assertOrderTransition(order.status, OrderStatus.REFUNDED);

    payment.status = PaymentStatus.REFUNDED;
    await payment.save();

    order.status = OrderStatus.REFUNDED;
    await order.save();
    return order;
  }

  async findStalePending(
    olderThan: Date,
    limit: number,
  ): Promise<OrderDocument[]> {
    return this.orderModel
      .find({
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { $lt: olderThan },
      })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Terminal provider failure. No-op unless the order is still pending.
   * Does not revoke entitlements or touch invoices.
   */
  async markOrderFailed(orderId: string): Promise<OrderDocument> {
    const order = await this.requireOrder(orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return order;
    }

    const payment = await this.requirePayment(order);
    if (payment.status === PaymentStatus.CAPTURED) {
      return order;
    }
    if (payment.status !== PaymentStatus.FAILED) {
      assertPaymentTransition(payment.status, PaymentStatus.FAILED);
      payment.status = PaymentStatus.FAILED;
      await payment.save();
    }

    assertOrderTransition(order.status, OrderStatus.FAILED);
    order.status = OrderStatus.FAILED;
    await order.save();
    return order;
  }

  /**
   * Checkout abandoned past the reconciliation window.
   * Payment stays at its current status. No-op unless the order is still pending.
   */
  async markOrderExpired(orderId: string): Promise<OrderDocument> {
    const order = await this.requireOrder(orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return order;
    }

    const payment = await this.requirePayment(order);
    if (payment.status === PaymentStatus.CAPTURED) {
      return order;
    }

    assertOrderTransition(order.status, OrderStatus.EXPIRED);
    order.status = OrderStatus.EXPIRED;
    await order.save();
    return order;
  }

  private toHistory(order: OrderDocument): OrderHistoryView {
    return {
      id: this.idOf(order),
      orderNumber: order.orderNumber,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      expiresAt: order.expiresAt,
      items: (order.items ?? []).map(item => ({
        productName: item.productName,
        durationPreset: item.durationPreset,
        amount: item.amount,
      })),
      ...(order.tax ? { tax: toHistoryTax(order.tax) } : {}),
    };
  }

  private async requireOrder(orderId: string): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async requirePayment(order: OrderDocument): Promise<PaymentDocument> {
    const payment = await this.paymentModel
      .findOne({ orderId: order._id })
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }
}

function toHistoryTax(tax: OrderTaxSnapshot): TaxBreakdown {
  return {
    grossAmount: tax.grossAmount,
    taxableAmount: tax.taxableAmount,
    taxAmount: tax.taxAmount,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    taxRate: tax.taxRate,
    ...(tax.supplyType ? { supplyType: tax.supplyType } : {}),
    ...(tax.sellerStateCode ? { sellerStateCode: tax.sellerStateCode } : {}),
    ...(tax.buyerStateCode ? { buyerStateCode: tax.buyerStateCode } : {}),
  };
}

function positiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}

function emptyPagination(page: number, limit: number) {
  return {
    total: 0,
    page,
    limit,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: page > 1,
  };
}
