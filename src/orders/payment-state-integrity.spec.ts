import { Logger } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { RefundStatus } from '../common/enums/refund-status.enum';
import { PaymentRole } from '../payments/domain/payment-role.enum';
import {
  PaymentIndexRepair,
  PRIMARY_PAYMENT_INDEX,
} from '../payments/payment-index.repair';
import {
  Payment,
  PaymentDocument,
  PaymentSchema,
} from '../payments/schemas/payment.schema';
import { RefundKind } from '../refunds/domain/refund-kind.enum';
import {
  REFUND_PAYMENT_INDEX,
  RefundIndexRepair,
} from '../refunds/refund-index.repair';
import { RefundsService } from '../refunds/refunds.service';
import {
  Refund,
  RefundDocument,
  RefundSchema,
} from '../refunds/schemas/refund.schema';
import { RazorpayWebhookService } from '../webhooks/razorpay-webhook.service';
import {
  WebhookEvent,
  WebhookEventDocument,
  WebhookEventSchema,
} from '../webhooks/schemas/webhook-event.schema';
import { CheckoutService } from './checkout.service';
import { checkoutRequestHash } from './domain/request-hash';
import { IllegalOrderTransitionError } from './domain/order-transitions';
import { OrdersService } from './orders.service';
import { Order, OrderDocument, OrderSchema } from './schemas/order.schema';

describe('payment state integrity', () => {
  let mongo: MongoMemoryServer;
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let paymentModel: Model<PaymentDocument>;
  let refundModel: Model<RefundDocument>;
  let webhookModel: Model<WebhookEventDocument>;
  let ordersService: OrdersService;
  let checkout: CheckoutService;
  let refunds: RefundsService;
  let webhook: RazorpayWebhookService;

  const paidHandler = { onOrderPaid: jest.fn().mockResolvedValue(undefined) };
  const provisioning = {
    provisionForPaidOrder: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const revoke = jest.fn().mockResolvedValue(undefined);
  const gateway = {
    provider: 'fake',
    createOrder: jest.fn(
      async (input: { orderId: string; amount: number }) => ({
        providerOrderId: `fake_${input.orderId}`,
        amount: input.amount,
        currency: 'INR',
        providerData: {},
      }),
    ),
    verifyPayment: jest.fn(),
    parseWebhook: jest.fn(),
    refund: jest.fn(),
    fetchOrderStatus: jest.fn(),
    fetchRefundStatus: jest.fn(),
    fetchPayment: jest.fn(),
    clientProviderData: jest.fn(),
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongo.getUri()).asPromise();
    orderModel = connection.model(
      Order.name,
      OrderSchema,
    ) as unknown as Model<OrderDocument>;
    paymentModel = connection.model(
      Payment.name,
      PaymentSchema,
    ) as unknown as Model<PaymentDocument>;
    refundModel = connection.model(
      Refund.name,
      RefundSchema,
    ) as unknown as Model<RefundDocument>;
    webhookModel = connection.model(
      WebhookEvent.name,
      WebhookEventSchema,
    ) as unknown as Model<WebhookEventDocument>;
    await Promise.all([
      orderModel.createIndexes(),
      paymentModel.createIndexes(),
      refundModel.createIndexes(),
      webhookModel.createIndexes(),
    ]);

    ordersService = new OrdersService(
      orderModel,
      paymentModel,
      paidHandler,
      provisioning as never,
      audit as never,
    );
    const registry = { get: () => gateway };
    checkout = new CheckoutService(
      ordersService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      registry as never,
      { settings: { instanceId: 'ezprep', maxOpenOrdersPerUser: 3 } } as never,
      {} as never,
    );
    refunds = new RefundsService(
      orderModel,
      paymentModel,
      refundModel,
      {
        find: () => ({ select: () => ({ exec: async () => [] }) }),
      } as never,
      ordersService,
      { revokePaymentEntitlementsForOrder: revoke } as never,
      { findByOrderId: async () => null } as never,
      audit as never,
      registry as never,
      { settings: { refundUnknownWindowMinutes: 60 } } as never,
    );
    webhook = new RazorpayWebhookService(
      webhookModel,
      { updateOne: jest.fn().mockResolvedValue({}) } as never,
      registry as never,
      ordersService,
      refunds,
      {
        settings: { webhookRetryWindowMinutes: 30, instanceId: 'ezprep' },
      } as never,
    );
  });

  afterAll(async () => {
    await connection?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    paidHandler.onOrderPaid.mockClear();
    provisioning.provisionForPaidOrder.mockClear();
    audit.log.mockClear();
    revoke.mockClear();
    gateway.createOrder.mockClear();
    gateway.verifyPayment.mockReset();
    gateway.parseWebhook.mockReset();
    gateway.refund.mockReset();
    gateway.refund.mockResolvedValue({
      providerRefundId: 'rfnd_1',
      status: 'pending',
      amount: 79900,
    });
    await Promise.all(
      Object.values(connection.collections).map(collection =>
        collection.deleteMany({}),
      ),
    );
  });

  function orderBody(overrides: Record<string, unknown> = {}) {
    return {
      orderNumber: `ORD-${new Types.ObjectId().toHexString()}`,
      userId: new Types.ObjectId(),
      status: OrderStatus.PENDING_PAYMENT,
      items: [
        {
          productId: new Types.ObjectId(),
          productVersion: 1,
          productCode: 'PAPER',
          productName: 'Paper',
          offerId: new Types.ObjectId(),
          durationPreset: DurationPreset.ONE_MONTH,
          listAmount: 79900,
          amount: 79900,
          grants: [
            {
              scopeType: EntitlementScopeType.EXAM,
              scopeId: new Types.ObjectId().toHexString(),
            },
          ],
        },
      ],
      amount: 79900,
      currency: 'INR',
      tax: {
        grossAmount: 79900,
        taxableAmount: 79900,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        taxRate: 0,
      },
      billing: {
        name: 'Asha Nair',
        state: 'Kerala',
        stateCode: '32',
        addressLine1: '12 Marine Drive',
        city: 'Kochi',
        pincode: '682001',
      },
      paymentProvider: 'razorpay',
      providerOrderId: `order_${new Types.ObjectId().toHexString()}`,
      idempotencyKey: new Types.ObjectId().toHexString(),
      ...overrides,
    };
  }

  async function seedPending() {
    const order = await orderModel.create(orderBody());
    const payment = await paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: order.paymentProvider,
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: order.currency,
      status: PaymentStatus.INITIATED,
      role: PaymentRole.PRIMARY,
    });
    return { order, payment };
  }

  it('runs the paid handler once when three captures arrive together', async () => {
    const { order } = await seedPending();
    const orderId = ordersService.idOf(order);

    await Promise.all([
      ordersService.markOrderPaid(orderId, { providerPaymentId: 'pay_1' }),
      ordersService.markOrderPaid(orderId, { providerPaymentId: 'pay_1' }),
      ordersService.markOrderPaid(orderId, { providerPaymentId: 'pay_1' }),
    ]);

    const fresh = await orderModel.findById(order._id);
    expect(fresh?.status).toBe(OrderStatus.PAID);
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(provisioning.provisionForPaidOrder).not.toHaveBeenCalled();
  });

  it('cannot finish expired with a captured payment', async () => {
    const { order } = await seedPending();
    const orderId = ordersService.idOf(order);
    const proof = {
      source: 'VERIFY_FETCH' as const,
      providerPaymentId: 'pay_1',
      amount: order.amount,
      currency: 'INR',
    };

    await Promise.allSettled([
      ordersService.markOrderExpired(orderId),
      ordersService.markOrderPaid(orderId, {
        providerPaymentId: 'pay_1',
        proof,
      }),
    ]);

    const fresh = await orderModel.findById(order._id);
    const payment = await paymentModel.findOne({
      orderId: order._id,
      role: PaymentRole.PRIMARY,
    });
    expect(
      fresh?.status === OrderStatus.EXPIRED &&
        payment?.status === PaymentStatus.CAPTURED,
    ).toBe(false);
    if (payment?.status === PaymentStatus.CAPTURED) {
      expect(fresh?.status).toBe(OrderStatus.PAID);
    }
  });

  it('opens one provider order when two checkouts replay a created order', async () => {
    const offerId = new Types.ObjectId().toHexString();
    const userId = new Types.ObjectId();
    const billing = {
      name: 'Asha Nair',
      stateCode: '32',
      addressLine1: '12 Marine Drive',
      city: 'Kochi',
      pincode: '682001',
    };
    await orderModel.create(
      orderBody({
        userId,
        status: OrderStatus.CREATED,
        paymentProvider: 'fake',
        providerOrderId: undefined,
        idempotencyKey: 'replay-key',
        requestHash: checkoutRequestHash(offerId, billing),
      }),
    );

    await Promise.all([
      checkout.createOrder(userId.toHexString(), {
        offerId,
        billing,
        idempotencyKey: 'replay-key',
      }),
      checkout.createOrder(userId.toHexString(), {
        offerId,
        billing,
        idempotencyKey: 'replay-key',
      }),
    ]);

    expect(gateway.createOrder).toHaveBeenCalledTimes(1);
    const payments = await paymentModel.find({ role: PaymentRole.PRIMARY });
    expect(payments).toHaveLength(1);
  });

  it('lets one refund claim call the provider', async () => {
    const order = await orderModel.create(
      orderBody({ status: OrderStatus.PAID, paymentProvider: 'razorpay' }),
    );
    await paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: 'razorpay',
      providerPaymentId: 'pay_1',
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: 'INR',
      status: PaymentStatus.CAPTURED,
      role: PaymentRole.PRIMARY,
    });
    const adminId = new Types.ObjectId().toHexString();

    const results = await Promise.allSettled([
      refunds.refund(ordersService.idOf(order), adminId, 'customer request'),
      refunds.refund(ordersService.idOf(order), adminId, 'customer request'),
    ]);

    expect(
      results.filter(result => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status === 'rejected') {
      expect(rejected.reason.getResponse()).toMatchObject({
        details: { code: 'REFUND_IN_PROGRESS' },
      });
    }
    expect(gateway.refund).toHaveBeenCalledTimes(1);
  });

  it('settles a refund once when the POST and the webhook arrive together', async () => {
    const order = await orderModel.create(
      orderBody({ status: OrderStatus.PAID }),
    );
    const payment = await paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: 'razorpay',
      providerPaymentId: 'pay_1',
      amount: order.amount,
      currency: 'INR',
      status: PaymentStatus.CAPTURED,
      role: PaymentRole.PRIMARY,
    });
    await refundModel.create({
      orderId: order._id,
      paymentId: payment._id,
      kind: RefundKind.ORDER,
      userId: order.userId,
      provider: 'razorpay',
      providerRefundId: 'rfnd_race',
      amount: order.amount,
      status: RefundStatus.INITIATED,
      reason: 'customer request',
      initiatedBy: new Types.ObjectId(),
    });

    const outcomes = await Promise.all([
      refunds.settleProcessed('rfnd_race', order.amount, 'INR'),
      refunds.settleProcessed('rfnd_race', order.amount, 'INR'),
    ]);

    expect(outcomes.sort()).toEqual(['already', 'settled']);
    expect(revoke).toHaveBeenCalledTimes(1);
    const fresh = await orderModel.findById(order._id);
    expect(fresh?.status).toBe(OrderStatus.REFUNDED);
  });

  it('rejects a late capture that has no proof', async () => {
    const { order } = await seedPending();
    await orderModel.updateOne(
      { _id: order._id },
      { $set: { status: OrderStatus.EXPIRED, expiredAt: new Date() } },
    );

    await expect(
      ordersService.markOrderPaid(ordersService.idOf(order), {
        providerPaymentId: 'pay_late',
      }),
    ).rejects.toBeInstanceOf(IllegalOrderTransitionError);
  });

  it('pays an expired order from verify and records the late capture', async () => {
    const order = await orderModel.create(
      orderBody({
        status: OrderStatus.EXPIRED,
        expiredAt: new Date(Date.now() - 60_000),
      }),
    );
    await paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: 'razorpay',
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: 'INR',
      status: PaymentStatus.FAILED,
      role: PaymentRole.PRIMARY,
    });
    gateway.verifyPayment.mockResolvedValue({
      verified: true,
      status: 'CAPTURED',
      providerPaymentId: 'pay_late',
    });

    const view = await checkout.verifyPayment(
      String(order.userId),
      ordersService.idOf(order),
      { razorpay_order_id: order.providerOrderId },
      'razorpay',
    );

    const fresh = await orderModel.findById(order._id);
    expect(view.status).toBe(OrderStatus.PAID);
    expect(fresh?.lateCaptureAt).toBeInstanceOf(Date);
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_LATE_CAPTURE' }),
    );
  });

  it('pays a failed order from a webhook capture', async () => {
    const order = await orderModel.create(
      orderBody({
        status: OrderStatus.FAILED,
        expiredAt: new Date(Date.now() - 120_000),
      }),
    );
    await paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: 'razorpay',
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: 'INR',
      status: PaymentStatus.FAILED,
      role: PaymentRole.PRIMARY,
    });
    gateway.parseWebhook.mockResolvedValue({
      providerEventId: 'evt_late',
      eventType: 'payment.captured',
      providerOrderId: order.providerOrderId,
      providerPaymentId: 'pay_hook',
      status: 'CAPTURED',
      amount: order.amount,
      currency: 'INR',
    });

    await webhook.handle({ rawBody: Buffer.from('late'), headers: {} });

    const fresh = await orderModel.findById(order._id);
    expect(fresh?.status).toBe(OrderStatus.PAID);
    expect(fresh?.lateCaptureAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_LATE_CAPTURE',
        after: expect.objectContaining({ proofSource: 'WEBHOOK' }),
      }),
    );
  });

  it('pays an expired order from reconciliation fetch proof', async () => {
    const order = await orderModel.create(
      orderBody({ status: OrderStatus.EXPIRED, expiredAt: new Date() }),
    );
    await paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: 'razorpay',
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: 'INR',
      status: PaymentStatus.INITIATED,
      role: PaymentRole.PRIMARY,
    });

    await ordersService.markOrderPaid(ordersService.idOf(order), {
      providerPaymentId: 'pay_recon',
      proof: {
        source: 'RECON_FETCH',
        providerPaymentId: 'pay_recon',
        amount: order.amount,
        currency: 'INR',
      },
    });

    const fresh = await orderModel.findById(order._id);
    expect(fresh?.status).toBe(OrderStatus.PAID);
    expect(fresh?.lateCaptureAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_LATE_CAPTURE',
        after: expect.objectContaining({ proofSource: 'RECON_FETCH' }),
      }),
    );
  });

  it('records one duplicate row when a second payment is captured', async () => {
    const order = await orderModel.create(
      orderBody({ status: OrderStatus.PAID }),
    );
    await paymentModel.create({
      orderId: order._id,
      userId: order.userId,
      provider: 'razorpay',
      providerPaymentId: 'pay_1',
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: 'INR',
      status: PaymentStatus.CAPTURED,
      role: PaymentRole.PRIMARY,
    });
    const proof = {
      source: 'WEBHOOK' as const,
      providerPaymentId: 'pay_2',
      amount: order.amount,
      currency: 'INR',
    };

    await ordersService.markOrderPaid(ordersService.idOf(order), {
      providerPaymentId: 'pay_2',
      proof,
    });
    await ordersService.markOrderPaid(ordersService.idOf(order), {
      providerPaymentId: 'pay_2',
      proof,
    });

    const duplicates = await paymentModel.find({ role: PaymentRole.DUPLICATE });
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].providerPaymentId).toBe('pay_2');
    const fresh = await orderModel.findById(order._id);
    expect(fresh?.status).toBe(OrderStatus.PAID);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_DUPLICATE_CAPTURED' }),
    );
  });

  it('backfills PRIMARY and skips the unique index when two primary payments exist', async () => {
    const orderId = new Types.ObjectId();
    await paymentModel.collection.dropIndex(PRIMARY_PAYMENT_INDEX);
    await paymentModel.collection.insertMany([
      {
        orderId,
        userId: new Types.ObjectId(),
        provider: 'razorpay',
        amount: 79900,
        currency: 'INR',
        status: PaymentStatus.CAPTURED,
      },
      {
        orderId,
        userId: new Types.ObjectId(),
        provider: 'razorpay',
        providerPaymentId: 'pay_dup',
        amount: 79900,
        currency: 'INR',
        status: PaymentStatus.CAPTURED,
      },
    ]);
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await new PaymentIndexRepair(paymentModel).onModuleInit();

    const indexes = await paymentModel.collection.indexes();
    expect(indexes.some(index => index.name === PRIMARY_PAYMENT_INDEX)).toBe(
      false,
    );
    expect(error).toHaveBeenCalled();
    const rows = await paymentModel.find({ orderId });
    expect(rows.every(row => row.role === PaymentRole.PRIMARY)).toBe(true);
    error.mockRestore();
    await paymentModel.deleteMany({});
    await paymentModel.createIndexes();
  });

  it('moves the refund unique index from orderId to paymentId', async () => {
    const paymentId = new Types.ObjectId();
    await refundModel.collection.dropIndexes();
    await refundModel.collection.createIndex(
      { orderId: 1 },
      { unique: true, name: 'orderId_1' },
    );
    await refundModel.collection.insertOne({
      orderId: new Types.ObjectId(),
      paymentId,
      userId: new Types.ObjectId(),
      provider: 'razorpay',
      amount: 79900,
      status: RefundStatus.COMPLETED,
      reason: 'customer request',
      initiatedBy: new Types.ObjectId(),
    });

    await new RefundIndexRepair(refundModel, paymentModel).onModuleInit();

    const indexes = await refundModel.collection.indexes();
    const orderIndex = indexes.find(index => index.key?.orderId === 1);
    expect(orderIndex?.unique).not.toBe(true);
    expect(
      indexes.find(index => index.name === REFUND_PAYMENT_INDEX)?.unique,
    ).toBe(true);
    const refund = await refundModel.findOne({ paymentId });
    expect(refund?.kind).toBe(RefundKind.ORDER);
  });
});
