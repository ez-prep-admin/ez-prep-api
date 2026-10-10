import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { TaxBreakdown } from '../common/commerce/calculate-inclusive-tax';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import {
  IllegalPaymentTransitionError,
  capturedPaymentSources,
} from '../payments/domain/payment-transitions';
import { PaymentRole } from '../payments/domain/payment-role.enum';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { CaptureProof } from './domain/capture-proof';
import { compareAndSet } from './domain/compare-and-set';
import { generateOrderNumber } from './domain/generate-order-number';
import {
  ORDER_PAID_HANDLER,
  OrderPaidHandler,
} from './domain/order-paid-handler';
import {
  IllegalOrderTransitionError,
  paidOrderSources,
} from './domain/order-transitions';
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
  requestHash?: string;
  expiresAt: Date;
}

const PROVIDER_OPEN_CLAIM_MS = 30_000;

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
    private readonly commerceAuditService: CommerceAuditService,
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

  /**
   * Claims the right to open a provider order. Only the winner may call the gateway.
   * A claim older than 30 seconds can be taken again.
   */
  async claimProviderOpen(order: OrderDocument): Promise<OrderDocument | null> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROVIDER_OPEN_CLAIM_MS);
    return this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          status: OrderStatus.CREATED,
          $or: [
            { providerOpenClaimAt: null },
            { providerOpenClaimAt: { $lt: staleBefore } },
          ],
        },
        { $set: { providerOpenClaimAt: now } },
        { new: true },
      )
      .exec();
  }

  /** Drops a claim when the provider call failed before an order id was saved. */
  async releaseProviderOpenClaim(order: OrderDocument): Promise<void> {
    await this.orderModel
      .updateOne(
        { _id: order._id, status: OrderStatus.CREATED },
        { $unset: { providerOpenClaimAt: '' } },
      )
      .exec();
  }

  async markPendingPayment(
    order: OrderDocument,
    providerOrder: { provider: string; providerOrderId: string },
  ): Promise<OrderDocument> {
    const result = await compareAndSet(
      this.orderModel,
      order._id,
      [OrderStatus.CREATED],
      OrderStatus.PENDING_PAYMENT,
      {
        paymentProvider: providerOrder.provider,
        providerOrderId: providerOrder.providerOrderId,
      },
    );
    if (result.won && result.doc) {
      return result.doc;
    }
    if (result.doc?.status === OrderStatus.PENDING_PAYMENT) {
      return result.doc;
    }
    throw new IllegalOrderTransitionError(
      order.status,
      OrderStatus.PENDING_PAYMENT,
    );
  }

  async ensureInitiatedPayment(order: OrderDocument): Promise<PaymentDocument> {
    const existing = await this.findPrimaryPayment(order);
    if (existing) {
      return existing;
    }

    try {
      return await this.paymentModel.create({
        orderId: order._id,
        userId: order.userId,
        provider: order.paymentProvider,
        providerOrderId: order.providerOrderId,
        amount: order.amount,
        currency: order.currency,
        status: PaymentStatus.INITIATED,
        role: PaymentRole.PRIMARY,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
      const raced = await this.findPrimaryPayment(order);
      if (raced) {
        return raced;
      }
      throw error;
    }
  }

  /**
   * Moves the primary payment to CAPTURED and the order to PAID.
   * The paid handler runs only for the compare-and-set winner.
   * A later PAID signal does not provision. That repair belongs to phase 14C.
   * EXPIRED and FAILED become PAID only when `proof` is present and matches.
   */
  async markOrderPaid(
    orderId: string,
    input: { providerPaymentId: string; proof?: CaptureProof },
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    this.assertProofMatches(order, input.proof, input.providerPaymentId);

    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.REFUNDED
    ) {
      await this.recordDuplicateCapture(order, input.providerPaymentId);
      return order;
    }

    const from = paidOrderSources(Boolean(input.proof));
    if (!from.includes(order.status)) {
      throw new IllegalOrderTransitionError(order.status, OrderStatus.PAID);
    }

    const payment = await this.findPrimaryPayment(order);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    await this.capturePrimaryPayment(payment, input);

    const late =
      order.status === OrderStatus.EXPIRED ||
      order.status === OrderStatus.FAILED;
    const paidAt = new Date();
    const result = await compareAndSet(
      this.orderModel,
      order._id,
      from,
      OrderStatus.PAID,
      {
        paidAt,
        ...(late ? { lateCaptureAt: paidAt } : {}),
      },
    );
    if (!result.won || !result.doc) {
      const current = result.doc ?? (await this.findById(orderId));
      if (
        current &&
        (current.status === OrderStatus.PAID ||
          current.status === OrderStatus.REFUNDED)
      ) {
        await this.recordDuplicateCapture(current, input.providerPaymentId);
        return current;
      }
      throw new IllegalOrderTransitionError(order.status, OrderStatus.PAID);
    }

    if (late) {
      await this.commerceAuditService.log({
        action: 'ORDER_LATE_CAPTURE',
        resourceType: 'order',
        resourceId: this.idOf(result.doc),
        after: {
          previousStatus: order.status,
          minutesSinceExpired: minutesSince(order.expiredAt),
          providerPaymentId: input.providerPaymentId,
          proofSource: input.proof?.source,
        },
      });
    }

    await this.paidHandler.onOrderPaid({
      orderId: this.idOf(result.doc),
      userId: String(result.doc.userId),
      amount: result.doc.amount,
    });

    return result.doc;
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
    if (order.status === OrderStatus.REFUNDED) {
      return order;
    }

    const payment = await this.findPrimaryPayment(order);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.REFUNDED) {
      const paymentResult = await compareAndSet(
        this.paymentModel,
        payment._id,
        [PaymentStatus.CAPTURED],
        PaymentStatus.REFUNDED,
        {},
      );
      if (
        !paymentResult.won &&
        paymentResult.doc?.status !== PaymentStatus.REFUNDED
      ) {
        throw new IllegalOrderTransitionError(
          order.status,
          OrderStatus.REFUNDED,
        );
      }
    }

    const result = await compareAndSet(
      this.orderModel,
      order._id,
      [OrderStatus.PAID],
      OrderStatus.REFUNDED,
      {},
    );
    if (result.won && result.doc) {
      return result.doc;
    }
    if (result.doc?.status === OrderStatus.REFUNDED) {
      return result.doc;
    }
    throw new IllegalOrderTransitionError(order.status, OrderStatus.REFUNDED);
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
      await compareAndSet(
        this.paymentModel,
        payment._id,
        [PaymentStatus.INITIATED, PaymentStatus.AUTHORIZED],
        PaymentStatus.FAILED,
        {},
      );
      const currentPayment = await this.findPrimaryPayment(order);
      if (currentPayment?.status === PaymentStatus.CAPTURED) {
        return order;
      }
    }

    const result = await compareAndSet(
      this.orderModel,
      order._id,
      [OrderStatus.PENDING_PAYMENT],
      OrderStatus.FAILED,
      {},
    );
    return result.doc ?? order;
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

    const expiredAt = new Date();
    const result = await compareAndSet(
      this.orderModel,
      order._id,
      [OrderStatus.PENDING_PAYMENT],
      OrderStatus.EXPIRED,
      { expiredAt },
    );
    return result.doc ?? order;
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
    const payment = await this.findPrimaryPayment(order);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private async findPrimaryPayment(
    order: OrderDocument,
  ): Promise<PaymentDocument | null> {
    const primary = await this.paymentModel
      .findOne({ orderId: order._id, role: PaymentRole.PRIMARY })
      .exec();
    if (primary) {
      return primary;
    }
    const legacy = await this.paymentModel
      .findOne({ orderId: order._id })
      .exec();
    if (!legacy || legacy.role === PaymentRole.DUPLICATE) {
      return null;
    }
    return legacy;
  }

  private assertProofMatches(
    order: OrderDocument,
    proof: CaptureProof | undefined,
    providerPaymentId: string,
  ): void {
    if (!proof) {
      return;
    }
    if (
      proof.providerPaymentId !== providerPaymentId ||
      proof.amount !== order.amount ||
      proof.currency !== order.currency
    ) {
      throw new BadRequestException('Payment does not match this order');
    }
  }

  private async capturePrimaryPayment(
    payment: PaymentDocument,
    input: { providerPaymentId: string; proof?: CaptureProof },
  ): Promise<void> {
    if (
      payment.status === PaymentStatus.CAPTURED &&
      payment.providerPaymentId &&
      payment.providerPaymentId !== input.providerPaymentId
    ) {
      return;
    }
    if (payment.status === PaymentStatus.CAPTURED) {
      return;
    }

    const result = await compareAndSet(
      this.paymentModel,
      payment._id,
      capturedPaymentSources(Boolean(input.proof)),
      PaymentStatus.CAPTURED,
      {
        providerPaymentId: input.providerPaymentId,
        capturedAt: new Date(),
        role: payment.role ?? PaymentRole.PRIMARY,
      },
    );
    if (result.won || result.doc?.status === PaymentStatus.CAPTURED) {
      return;
    }
    throw new IllegalPaymentTransitionError(
      payment.status,
      PaymentStatus.CAPTURED,
    );
  }

  private async recordDuplicateCapture(
    order: OrderDocument,
    providerPaymentId: string,
  ): Promise<void> {
    const primary = await this.findPrimaryPayment(order);
    if (
      !providerPaymentId ||
      !primary?.providerPaymentId ||
      primary.providerPaymentId === providerPaymentId
    ) {
      return;
    }

    try {
      const created = await this.paymentModel.create({
        orderId: order._id,
        userId: order.userId,
        provider: primary.provider,
        providerPaymentId,
        providerOrderId: order.providerOrderId ?? primary.providerOrderId,
        amount: order.amount,
        currency: order.currency,
        status: PaymentStatus.CAPTURED,
        role: PaymentRole.DUPLICATE,
        capturedAt: new Date(),
      });
      await this.commerceAuditService.log({
        action: 'PAYMENT_DUPLICATE_CAPTURED',
        resourceType: 'payment',
        resourceId: paymentIdOf(created),
        after: {
          orderId: this.idOf(order),
          providerPaymentId,
        },
      });
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }
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

function paymentIdOf(payment: PaymentDocument): string {
  const withVirtual = payment as PaymentDocument & { id?: string };
  return withVirtual.id ? String(withVirtual.id) : String(payment._id);
}

function minutesSince(expiredAt: Date | undefined): number | undefined {
  if (!expiredAt) {
    return undefined;
  }
  return Math.max(
    0,
    Math.round((Date.now() - new Date(expiredAt).getTime()) / 60000),
  );
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
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
