import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import request from 'supertest';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { Entitlement } from '../../src/entitlements/schemas/entitlement.schema';
import { Order } from '../../src/orders/schemas/order.schema';
import { RefundsService } from '../../src/refunds/refunds.service';
import { createCommerceHarness } from './support/app';
import { restoreHarnessEnv } from './support/env';
import {
  createRazorpayStub,
  HARNESS_KEY_SECRET,
  HARNESS_WEBHOOK_SECRET,
} from './support/razorpay-stub';
import {
  billingBody,
  CommerceFixture,
  seedCommerceFixture,
} from './support/seed';
import { captureWebhookBody, signWebhook } from './support/sign-webhook';

jest.setTimeout(90000);

describe('commerce razorpay webhooks (characterization)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let connection: Connection;
  let tokenFor: (userId: string, role?: UserRole) => string;
  let resetData: () => Promise<void>;
  let close: () => Promise<void>;
  let fixture: CommerceFixture;
  const razorpay = createRazorpayStub();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const harness = await createCommerceHarness({
      mongoUri: mongo.getUri('commerce'),
      paymentProvider: 'razorpay',
      accessMode: 'LEGACY',
      razorpayClient: razorpay,
    });
    app = harness.app;
    connection = harness.connection;
    tokenFor = harness.tokenFor;
    resetData = harness.resetData;
    close = harness.close;
  });

  beforeEach(async () => {
    razorpay.refundPayment.mockClear();
    await resetData();
    fixture = await seedCommerceFixture(connection);
  });

  afterAll(async () => {
    await close?.();
    await mongo?.stop();
    restoreHarnessEnv();
  });

  function auth(userId: string, role?: UserRole) {
    return { Authorization: `Bearer ${tokenFor(userId, role)}` };
  }

  async function openOrder(idempotencyKey: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/checkout/orders')
      .set(auth(fixture.studentId))
      .send({
        offerId: fixture.offerId,
        billing: billingBody,
        idempotencyKey,
      });
    expect(created.status).toBe(200);
    const data = created.body.data as {
      id: string;
      amount: number;
      providerData: { razorpayOrderId: string };
    };
    return {
      id: data.id,
      amount: data.amount,
      providerOrderId: data.providerData.razorpayOrderId,
    };
  }

  function postWebhook(raw: string, eventId: string) {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/payments/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signWebhook(raw, HARNESS_WEBHOOK_SECRET))
      .set('X-Razorpay-Event-Id', eventId)
      .send(raw);
  }

  it('captures a payment, ignores the duplicate, and leaves an amount mismatch unpaid', async () => {
    const order = await openOrder('wh-1');
    const raw = captureWebhookBody({
      orderId: order.providerOrderId,
      paymentId: 'pay_wh_1',
      amount: order.amount,
    });
    const first = await postWebhook(raw, 'evt_wh_1');
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('PROCESSED');

    const duplicate = await postWebhook(raw, 'evt_wh_1');
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.status).toBe('IGNORED');

    const mismatchOrder = await openOrder('wh-2');
    const mismatch = captureWebhookBody({
      orderId: mismatchOrder.providerOrderId,
      paymentId: 'pay_wh_2',
      amount: 1,
    });
    const rejected = await postWebhook(mismatch, 'evt_wh_2');
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('FAILED');

    const stored = await connection
      .model(Order.name)
      .findById(mismatchOrder.id);
    expect(stored?.status).toBe('PENDING_PAYMENT');
  });

  it('leaves access in place when the provider refund is pending', async () => {
    const order = await openOrder('wh-refund');
    const paymentId = 'pay_refund_pending';
    const signature = createHmac('sha256', HARNESS_KEY_SECRET)
      .update(`${order.providerOrderId}|${paymentId}`)
      .digest('hex');
    const verified = await request(app.getHttpServer())
      .post(`/api/v1/checkout/orders/${order.id}/verify`)
      .set(auth(fixture.studentId))
      .send({
        provider: 'razorpay',
        providerPayload: {
          razorpay_order_id: order.providerOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        },
      });
    expect(verified.status).toBe(200);
    expect(verified.body.data.status).toBe('PAID');

    const refunded = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${order.id}/refunds`)
      .set(auth(fixture.adminId, UserRole.ADMIN))
      .send({ reason: 'Waiting on the provider' });
    expect(refunded.status).toBe(200);
    expect(refunded.body.data.order.status).toBe('PAID');

    const rows = await connection
      .model(Entitlement.name)
      .find({ orderId: order.id })
      .exec();
    expect(rows.every(row => row.status === 'ACTIVE')).toBe(true);

    const summary = await app
      .get(RefundsService)
      .reconcileInitiatedRefunds(new Date(Date.now() + 2 * 60 * 1000));
    expect(summary.examined).toBeGreaterThanOrEqual(1);
  });
});
