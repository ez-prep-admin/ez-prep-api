import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { createCommerceHarness } from './support/app';
import { restoreHarnessEnv } from './support/env';
import {
  billingBody,
  CommerceFixture,
  seedCommerceFixture,
} from './support/seed';

jest.setTimeout(90000);

describe('commerce disabled', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let tokenFor: (userId: string, role?: UserRole) => string;
  let fixture: CommerceFixture;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const harness = await createCommerceHarness({
      mongoUri: mongo.getUri('commerce-off'),
      paymentProvider: 'fake',
      accessMode: 'LEGACY',
      commerceEnabled: 'false',
    });
    app = harness.app;
    tokenFor = harness.tokenFor;
    await harness.resetData();
    fixture = await seedCommerceFixture(harness.connection);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
    restoreHarnessEnv();
  });

  it('returns COMMERCE_DISABLED for checkout and leaves catalog up', async () => {
    const checkout = await request(app.getHttpServer())
      .post('/api/v1/checkout/orders')
      .set({
        Authorization: `Bearer ${tokenFor(fixture.studentId)}`,
      })
      .send({
        offerId: fixture.offerId,
        billing: billingBody,
        idempotencyKey: 'off-1',
      });
    expect(checkout.status).toBe(404);
    expect(checkout.body.details.code).toBe('COMMERCE_DISABLED');

    const catalog = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/for-exam/${fixture.examId}`)
      .set({
        Authorization: `Bearer ${tokenFor(fixture.studentId)}`,
      });
    expect(catalog.status).toBe(200);
    expect(catalog.body.commerceEnabled).toBe(false);
  });
});
