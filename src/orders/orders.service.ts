import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { assertPaymentTransition } from '../payments/domain/payment-transitions';
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
  ) {}

  async findByIdempotencyKey(key: string): Promise<OrderDocument | null> {
    return this.orderModel.findOne({ idempotencyKey: key }).exec();
  }

  async findById(id: string): Promise<OrderDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.orderModel.findById(id).exec();
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
   * Moves payment to CAPTURED and order to PAID. Does not grant entitlements.
   * A repeated PAID signal returns the order and does not call the paid handler.
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
}
