import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { Types } from 'mongoose';
import { join } from 'path';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { WebhookEventStatus } from '../common/enums/webhook-event-status.enum';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { ORDER_PAID_HANDLER } from '../orders/domain/order-paid-handler';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/schemas/order.schema';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { FakeGateway } from '../payments/infrastructure/fake/fake.gateway';
import { RAZORPAY_ORDERS_CLIENT } from '../payments/infrastructure/razorpay/razorpay-orders.client';
import { RazorpayGateway } from '../payments/infrastructure/razorpay/razorpay.gateway';
import { Payment } from '../payments/schemas/payment.schema';
import { RefundsService } from '../refunds/refunds.service';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import { WebhookEvent } from './schemas/webhook-event.schema';

const WEBHOOK_SECRET = 'test_webhook_secret';

function sign(body: Buffer): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function fixture(name: string): Buffer {
  return readFileSync(
    join(__dirname, '../payments/infrastructure/razorpay/fixtures', name),
  );
}

function matches(
  row: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  return Object.entries(filter).every(
    ([key, value]) => String(row[key]) === String(value),
  );
}

describe('RazorpayWebhookService', () => {
  const orders: Array<Record<string, any>> = [];
  const payments: Array<Record<string, any>> = [];
  const events: Array<Record<string, any>> = [];
  const paidHandler = { onOrderPaid: jest.fn() };
  const provisioning = { provisionForPaidOrder: jest.fn() };
  const refunds = {
    settleProcessed: jest.fn(),
    settleFailed: jest.fn(),
  };

  const orderModel = { findOne: jest.fn(), findById: jest.fn() };
  const paymentModel = { findOne: jest.fn(), create: jest.fn() };
  const webhookModel = { create: jest.fn(), findOne: jest.fn() };

  let service: RazorpayWebhookService;
  let ordersService: OrdersService;

  beforeEach(async () => {
    orders.length = 0;
    payments.length = 0;
    events.length = 0;
    paidHandler.onOrderPaid.mockReset();
    paidHandler.onOrderPaid.mockResolvedValue(undefined);
    provisioning.provisionForPaidOrder.mockReset();
    provisioning.provisionForPaidOrder.mockResolvedValue(undefined);
    refunds.settleProcessed.mockReset();
    refunds.settleFailed.mockReset();

    orderModel.findOne.mockImplementation(
      (filter: Record<string, unknown>) => ({
        exec: async () => orders.find(order => matches(order, filter)) ?? null,
      }),
    );
    orderModel.findById.mockImplementation((id: string) => ({
      exec: async () =>
        orders.find(
          order => order.id === String(id) || String(order._id) === String(id),
        ) ?? null,
    }));
    paymentModel.findOne.mockImplementation(
      (filter: Record<string, unknown>) => ({
        exec: async () =>
          payments.find(payment => matches(payment, filter)) ?? null,
      }),
    );
    webhookModel.create.mockImplementation(
      async (doc: Record<string, unknown>) => {
        if (
          events.some(
            event =>
              event.provider === doc.provider &&
              event.providerEventId === doc.providerEventId,
          )
        ) {
          const error = new Error('E11000') as Error & { code: number };
          error.code = 11000;
          throw error;
        }
        const row = {
          ...doc,
          save: jest.fn(async function save(this: Record<string, unknown>) {
            return this;
          }),
        };
        events.push(row);
        return row;
      },
    );
    webhookModel.findOne.mockImplementation(
      (filter: Record<string, unknown>) => ({
        exec: async () => events.find(event => matches(event, filter)) ?? null,
      }),
    );

    const config = {
      get: (key: string) =>
        ({
          RAZORPAY_KEY_ID: 'rzp_test_key',
          RAZORPAY_KEY_SECRET: 'test_key_secret',
          RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
        })[key],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayWebhookService,
        OrdersService,
        PaymentGatewayRegistry,
        FakeGateway,
        RazorpayGateway,
        { provide: getModelToken(WebhookEvent.name), useValue: webhookModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: ConfigService, useValue: config },
        {
          provide: RAZORPAY_ORDERS_CLIENT,
          useValue: { createOrder: jest.fn() },
        },
        { provide: ORDER_PAID_HANDLER, useValue: paidHandler },
        { provide: EntitlementProvisioningService, useValue: provisioning },
        { provide: RefundsService, useValue: refunds },
      ],
    }).compile();

    service = module.get(RazorpayWebhookService);
    ordersService = module.get(OrdersService);
  });

  function seed(providerOrderId: string, amount = 79900) {
    const _id = new Types.ObjectId();
    const order = {
      _id,
      id: _id.toHexString(),
      userId: new Types.ObjectId(),
      status: OrderStatus.PENDING_PAYMENT,
      paymentProvider: 'razorpay',
      providerOrderId,
      amount,
      currency: 'INR',
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

  function deliver(name: string, eventId: string, body = fixture(name)) {
    return service.handle({
      rawBody: body,
      headers: {
        'x-razorpay-signature': sign(body),
        'x-razorpay-event-id': eventId,
      },
    });
  }

  it('marks a pending order paid for payment.captured', async () => {
    const order = seed('order_test_1');
    const result = await deliver('payment-captured.json', 'evt_captured');

    expect(result.status).toBe(WebhookEventStatus.PROCESSED);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(payments[0].status).toBe(PaymentStatus.CAPTURED);
    expect(payments[0].providerPaymentId).toBe('pay_test_captured');
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(WebhookEventStatus.PROCESSED);
  });

  it('marks a pending order paid for order.paid', async () => {
    const order = seed('order_test_2');
    const result = await deliver('order-paid.json', 'evt_order_paid');
    expect(result.status).toBe(WebhookEventStatus.PROCESSED);
    expect(order.status).toBe(OrderStatus.PAID);
  });

  it('ignores a duplicate event id and does not pay twice', async () => {
    seed('order_test_1');
    await deliver('payment-captured.json', 'evt_captured');
    const second = await deliver('payment-captured.json', 'evt_captured');

    expect(second.status).toBe(WebhookEventStatus.IGNORED);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(WebhookEventStatus.PROCESSED);
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(
      orders.filter(order => order.status === OrderStatus.PAID),
    ).toHaveLength(1);
  });

  it('does not change the order when the signature is invalid', async () => {
    const order = seed('order_test_1');
    const rawBody = fixture('payment-captured.json');
    await expect(
      service.handle({
        rawBody,
        headers: {
          'x-razorpay-signature': 'deadbeef',
          'x-razorpay-event-id': 'evt_bad',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(events).toHaveLength(0);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('ignores payment.failed without changing the order', async () => {
    const order = seed('order_test_1');
    const result = await deliver('payment-failed.json', 'evt_failed');
    expect(result.status).toBe(WebhookEventStatus.IGNORED);
    expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('records an amount mismatch and leaves the order pending', async () => {
    const order = seed('order_test_1', 10000);
    const result = await deliver('payment-captured.json', 'evt_mismatch');
    expect(result.status).toBe(WebhookEventStatus.FAILED);
    expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(events[0].error).toBe('Amount or currency does not match the order');
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('asks Razorpay to retry when the order is missing', async () => {
    await expect(
      deliver('payment-captured.json', 'evt_missing'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(events[0].status).toBe(WebhookEventStatus.FAILED);
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('does not call the paid handler again when verify already paid the order', async () => {
    const order = seed('order_test_1');
    await ordersService.markOrderPaid(order.id, {
      providerPaymentId: 'pay_from_verify',
    });
    const result = await deliver('payment-captured.json', 'evt_after_verify');

    expect(result.status).toBe(WebhookEventStatus.PROCESSED);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
  });

  it('settles a processed refund webhook', async () => {
    refunds.settleProcessed.mockResolvedValue('settled');
    const result = await deliver('refund-processed.json', 'evt_refund_ok');

    expect(result.status).toBe(WebhookEventStatus.PROCESSED);
    expect(refunds.settleProcessed).toHaveBeenCalledWith(
      'rfnd_test_processed',
      12900,
      'INR',
    );
    expect(paidHandler.onOrderPaid).not.toHaveBeenCalled();
  });

  it('ignores a duplicate refund webhook', async () => {
    refunds.settleProcessed.mockResolvedValue('settled');
    await deliver('refund-processed.json', 'evt_refund_ok');
    const second = await deliver('refund-processed.json', 'evt_refund_ok');

    expect(second.status).toBe(WebhookEventStatus.IGNORED);
    expect(refunds.settleProcessed).toHaveBeenCalledTimes(1);
  });

  it('asks Razorpay to retry when the refund row is missing', async () => {
    refunds.settleProcessed.mockResolvedValue('missing');
    await expect(
      deliver('refund-processed.json', 'evt_refund_missing'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(events[0].status).toBe(WebhookEventStatus.FAILED);
    expect(events[0].error).toBe('Refund not found');
  });

  it('records a refund amount mismatch without settling access', async () => {
    refunds.settleProcessed.mockResolvedValue('mismatch');
    const result = await deliver(
      'refund-processed.json',
      'evt_refund_mismatch',
    );

    expect(result.status).toBe(WebhookEventStatus.FAILED);
    expect(events[0].error).toBe(
      'Amount or currency does not match the refund',
    );
  });

  it('marks the refund failed when the provider reports failure', async () => {
    refunds.settleFailed.mockResolvedValue('failed');
    const result = await deliver('refund-failed.json', 'evt_refund_failed');

    expect(result.status).toBe(WebhookEventStatus.PROCESSED);
    expect(refunds.settleFailed).toHaveBeenCalledWith('rfnd_test_failed');
    expect(refunds.settleProcessed).not.toHaveBeenCalled();
  });
});
