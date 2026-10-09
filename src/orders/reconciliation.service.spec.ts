import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { FakeGateway } from '../payments/infrastructure/fake/fake.gateway';
import { RazorpayGateway } from '../payments/infrastructure/razorpay/razorpay.gateway';
import { Payment } from '../payments/schemas/payment.schema';
import { ORDER_PAID_HANDLER } from './domain/order-paid-handler';
import { ReconciliationService } from './reconciliation.service';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';

describe('ReconciliationService', () => {
  const orders: Array<Record<string, any>> = [];
  const payments: Array<Record<string, any>> = [];
  const paidHandler = { onOrderPaid: jest.fn() };
  const provisioning = { provisionForPaidOrder: jest.fn() };
  const razorpay = { fetchOrderStatus: jest.fn() };
  const configValues: Record<string, string> = {
    PAYMENT_PROVIDER: 'fake',
    RECONCILIATION_MIN_AGE_MINUTES: '60',
  };
  const config = {
    get: (key: string) => configValues[key],
  };
  const orderModel = { find: jest.fn(), findById: jest.fn() };
  const paymentModel = { findOne: jest.fn() };

  let fake: FakeGateway;
  let service: ReconciliationService;

  beforeEach(async () => {
    fake = new FakeGateway();
    orders.length = 0;
    payments.length = 0;
    paidHandler.onOrderPaid.mockReset();
    paidHandler.onOrderPaid.mockResolvedValue(undefined);
    provisioning.provisionForPaidOrder.mockReset();
    razorpay.fetchOrderStatus.mockReset();
    configValues.RECONCILIATION_MIN_AGE_MINUTES = '60';

    orderModel.find.mockImplementation((query: Record<string, any>) => ({
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      exec: async () =>
        orders.filter(
          order =>
            order.status === query.status &&
            order.createdAt.getTime() < query.createdAt.$lt.getTime(),
        ),
    }));
    orderModel.findById.mockImplementation((id: string) => ({
      exec: async () =>
        orders.find(
          order => order.id === String(id) || String(order._id) === String(id),
        ) ?? null,
    }));
    paymentModel.findOne.mockImplementation(
      (filter: { orderId: { toString(): string } }) => ({
        exec: async () =>
          payments.find(
            payment => String(payment.orderId) === String(filter.orderId),
          ) ?? null,
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        OrdersService,
        { provide: ConfigService, useValue: config },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: ORDER_PAID_HANDLER, useValue: paidHandler },
        { provide: EntitlementProvisioningService, useValue: provisioning },
        { provide: FakeGateway, useValue: fake },
        { provide: RazorpayGateway, useValue: razorpay },
        PaymentGatewayRegistry,
      ],
    }).compile();

    service = module.get(ReconciliationService);
  });

  function seed(
    status = OrderStatus.PENDING_PAYMENT,
    createdAt = new Date('2020-01-01T00:00:00.000Z'),
  ) {
    const _id = new Types.ObjectId();
    const order: Record<string, any> = {
      _id,
      id: _id.toHexString(),
      userId: new Types.ObjectId(),
      status,
      amount: 79900,
      currency: 'INR',
      paymentProvider: 'fake',
      providerOrderId: `fake_${_id.toHexString()}`,
      createdAt,
      save: jest.fn(async function save(this: Record<string, unknown>) {
        return this;
      }),
    };
    orders.push(order);
    payments.push({
      orderId: _id,
      status: PaymentStatus.INITIATED,
      save: jest.fn(async function save(this: Record<string, unknown>) {
        return this;
      }),
    });
    return order;
  }

  it('marks a captured stale order paid and provisions once', async () => {
    const order = seed();
    fake.stageOrderStatus(order.providerOrderId, {
      status: 'CAPTURED',
      providerPaymentId: 'pay_1',
      amount: 79900,
      currency: 'INR',
    });

    const summary = await service.reconcileOnce(
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(summary.paid).toBe(1);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);

    await service.reconcileOnce(new Date('2026-01-01T00:00:00.000Z'));
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
  });

  it('marks a failed provider order FAILED and does not provision', async () => {
    const order = seed();
    fake.stageOrderStatus(order.providerOrderId, { status: 'FAILED' });

    const summary = await service.reconcileOnce(
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(summary.failed).toBe(1);
    expect(order.status).toBe(OrderStatus.FAILED);
    expect(payments[0].status).toBe(PaymentStatus.FAILED);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('expires an unpaid stale order and leaves the payment initiated', async () => {
    const order = seed();

    const summary = await service.reconcileOnce(
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(summary.expired).toBe(1);
    expect(order.status).toBe(OrderStatus.EXPIRED);
    expect(payments[0].status).toBe(PaymentStatus.INITIATED);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('does not select or rewrite an order that is already paid', async () => {
    const order = seed(OrderStatus.PAID);

    const summary = await service.reconcileOnce(
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(summary.examined).toBe(0);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('leaves a mismatched capture pending', async () => {
    const order = seed();
    fake.stageOrderStatus(order.providerOrderId, {
      status: 'CAPTURED',
      providerPaymentId: 'pay_1',
      amount: 1,
      currency: 'INR',
    });

    const summary = await service.reconcileOnce(
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(summary.skipped).toBe(1);
    expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('skips an order when the provider status call fails', async () => {
    const order = seed();
    order.paymentProvider = 'razorpay';
    razorpay.fetchOrderStatus.mockRejectedValue(new Error('sdk down'));

    const summary = await service.reconcileOnce(
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(summary.skipped).toBe(1);
    expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
  });
});
