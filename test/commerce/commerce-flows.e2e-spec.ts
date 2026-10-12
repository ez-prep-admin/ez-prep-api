import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { EntitlementScopeType } from '../../src/common/enums/entitlement-scope-type.enum';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { Entitlement } from '../../src/entitlements/schemas/entitlement.schema';
import { Order } from '../../src/orders/schemas/order.schema';
import { Product } from '../../src/products/schemas/product.schema';
import { FakeGateway } from '../../src/payments/infrastructure/fake/fake.gateway';
import { ReconciliationService } from '../../src/orders/reconciliation.service';
import { createCommerceHarness } from './support/app';
import { restoreHarnessEnv } from './support/env';
import {
  billingBody,
  CommerceFixture,
  seedCommerceFixture,
} from './support/seed';

jest.setTimeout(90000);

describe('commerce flows (characterization)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let connection: Connection;
  let tokenFor: (userId: string, role?: UserRole) => string;
  let resetData: () => Promise<void>;
  let close: () => Promise<void>;
  let fixture: CommerceFixture;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const harness = await createCommerceHarness({
      mongoUri: mongo.getUri('commerce'),
      paymentProvider: 'fake',
      accessMode: 'LEGACY',
    });
    app = harness.app;
    connection = harness.connection;
    tokenFor = harness.tokenFor;
    resetData = harness.resetData;
    close = harness.close;
  });

  beforeEach(async () => {
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

  async function createOrder(userId: string, idempotencyKey: string) {
    return request(app.getHttpServer())
      .post('/api/v1/checkout/orders')
      .set(auth(userId))
      .send({
        offerId: fixture.offerId,
        billing: billingBody,
        idempotencyKey,
      });
  }

  async function pay(userId: string, orderId: string, paymentId: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/checkout/orders/${orderId}/verify`)
      .set(auth(userId))
      .send({
        provider: 'fake',
        providerPayload: { fakePaymentId: paymentId },
      });
  }

  it('creates, replays, verifies, and hides the order from another user', async () => {
    const created = await createOrder(fixture.studentId, 'key-1');
    expect(created.status).toBe(200);
    expect(created.body.data.status).toBe('PENDING_PAYMENT');
    expect(created.body.data.amount).toBe(fixture.listAmount);
    const orderId = created.body.data.id as string;

    const replay = await createOrder(fixture.studentId, 'key-1');
    expect(replay.status).toBe(200);
    expect(replay.body.data.id).toBe(orderId);

    const conflict = await createOrder(fixture.otherStudentId, 'key-1');
    expect(conflict.status).toBe(409);

    const paid = await pay(fixture.studentId, orderId, 'pay-1');
    expect(paid.status).toBe(200);
    expect(paid.body.data.status).toBe('PAID');

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/checkout/orders/${orderId}`)
      .set(auth(fixture.otherStudentId));
    expect(hidden.status).toBe(404);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/me/orders')
      .set(auth(fixture.studentId));
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((row: { id: string }) => row.id)).toContain(
      orderId,
    );

    const theirs = await request(app.getHttpServer())
      .get('/api/v1/me/orders')
      .set(auth(fixture.otherStudentId));
    expect(theirs.body.data).toEqual([]);

    const invoices = await request(app.getHttpServer())
      .get('/api/v1/me/invoices')
      .set(auth(fixture.studentId));
    expect(invoices.status).toBe(200);
    expect(invoices.body.data).toHaveLength(1);
    const invoiceId = invoices.body.data[0].id as string;

    const pdf = await request(app.getHttpServer())
      .get(`/api/v1/me/invoices/${invoiceId}/pdf`)
      .set(auth(fixture.studentId));
    expect(pdf.status).toBe(200);

    const stolen = await request(app.getHttpServer())
      .get(`/api/v1/me/invoices/${invoiceId}/pdf`)
      .set(auth(fixture.otherStudentId));
    expect(stolen.status).toBe(404);
  });

  it('stacks a second purchase and still allows the entitled paper before it starts', async () => {
    const first = await createOrder(fixture.studentId, 'stack-1');
    await pay(fixture.studentId, first.body.data.id, 'pay-stack-1');
    const second = await createOrder(fixture.studentId, 'stack-2');
    await pay(fixture.studentId, second.body.data.id, 'pay-stack-2');

    const rows = await connection
      .model(Entitlement.name)
      .find({ userId: new Types.ObjectId(fixture.studentId) })
      .sort({ startsAt: 1 })
      .exec();
    expect(rows).toHaveLength(2);
    expect(rows[1].startsAt.getTime()).toBe(rows[0].expiresAt.getTime());

    const start = await request(app.getHttpServer())
      .post('/api/v1/mock-test-attempts/start')
      .set(auth(fixture.studentId))
      .send({ mockTestId: fixture.entitledPaperId });
    expect(start.status).toBe(201);
  });

  it('lists covering products from published grants and ignores a draft grant edit', async () => {
    const forExam = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/for-exam/${fixture.examId}`)
      .set(auth(fixture.studentId));
    expect(forExam.status).toBe(200);
    expect(forExam.body.data.map((row: { id: string }) => row.id)).toContain(
      fixture.productId,
    );

    const forPaper = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/for-mock-test/${fixture.entitledPaperId}`)
      .set(auth(fixture.studentId));
    expect(forPaper.body.data.map((row: { id: string }) => row.id)).toContain(
      fixture.productId,
    );

    await connection.model(Product.name).updateOne(
      { _id: fixture.productId },
      {
        $set: {
          grants: [
            {
              scopeType: EntitlementScopeType.EXAM,
              scopeId: new Types.ObjectId(fixture.otherExamId),
            },
          ],
        },
      },
    );

    const after = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/for-exam/${fixture.examId}`)
      .set(auth(fixture.studentId));
    expect(after.body.commerceEnabled).toBe(true);
    expect(after.body.data.map((row: { id: string }) => row.id)).toContain(
      fixture.productId,
    );

    const moved = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/for-exam/${fixture.otherExamId}`)
      .set(auth(fixture.studentId));
    expect(moved.body.data).toEqual([]);
  });

  it('refunds a paid order and revokes its entitlement', async () => {
    const created = await createOrder(fixture.studentId, 'refund-1');
    await pay(fixture.studentId, created.body.data.id, 'pay-refund-1');

    const refunded = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.body.data.id}/refunds`)
      .set(auth(fixture.adminId, UserRole.ADMIN))
      .send({ reason: 'Customer asked' });
    expect(refunded.status).toBe(200);
    expect(refunded.body.data.order.status).toBe('REFUNDED');

    const rows = await connection
      .model(Entitlement.name)
      .find({ orderId: created.body.data.id })
      .exec();
    expect(rows.every(row => row.status === 'REVOKED')).toBe(true);
  });

  it('expires an unpaid order and repairs a captured one', async () => {
    const pending = await createOrder(fixture.studentId, 'recon-expire');
    const pendingId = pending.body.data.id as string;
    await connection
      .model(Order.name)
      .collection.updateOne(
        { _id: new Types.ObjectId(pendingId) },
        { $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
      );

    const reconciliation = app.get(ReconciliationService);
    const expired = await reconciliation.reconcileOnce();
    expect(expired.expired).toBe(1);

    const captured = await createOrder(fixture.studentId, 'recon-capture');
    const capturedData = captured.body.data as {
      id: string;
      providerData: { fakeOrderId: string };
    };
    await connection
      .model(Order.name)
      .collection.updateOne(
        { _id: new Types.ObjectId(capturedData.id) },
        { $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
      );
    app
      .get(FakeGateway)
      .stageOrderStatus(capturedData.providerData.fakeOrderId, {
        status: 'CAPTURED',
        providerPaymentId: 'pay-recon',
        amount: fixture.listAmount,
        currency: 'INR',
      });
    const paid = await reconciliation.reconcileOnce();
    expect(paid.paid).toBe(1);
  });

  it('starts a free paper and an entitled paper under LEGACY', async () => {
    const free = await request(app.getHttpServer())
      .post('/api/v1/mock-test-attempts/start')
      .set(auth(fixture.studentId))
      .send({ mockTestId: fixture.freePaperId });
    expect(free.status).toBe(201);

    const entitled = await request(app.getHttpServer())
      .post('/api/v1/mock-test-attempts/start')
      .set(auth(fixture.otherStudentId))
      .send({ mockTestId: fixture.entitledPaperId });
    expect(entitled.status).toBe(201);
  });
});
