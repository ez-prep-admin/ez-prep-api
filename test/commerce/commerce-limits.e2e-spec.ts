import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { EntitlementScopeType } from '../../src/common/enums/entitlement-scope-type.enum';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { Entitlement } from '../../src/entitlements/schemas/entitlement.schema';
import { createCommerceHarness } from './support/app';
import { restoreHarnessEnv } from './support/env';
import {
  billingBody,
  CommerceFixture,
  seedCommerceFixture,
} from './support/seed';

jest.setTimeout(90000);

describe('commerce limits', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let connection: Connection;
  let tokenFor: (userId: string, role?: UserRole) => string;
  let fixture: CommerceFixture;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const harness = await createCommerceHarness({
      mongoUri: mongo.getUri('commerce-limits'),
      paymentProvider: 'fake',
      accessMode: 'LEGACY',
    });
    app = harness.app;
    connection = harness.connection;
    tokenFor = harness.tokenFor;
    await harness.resetData();
    fixture = await seedCommerceFixture(connection);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
    restoreHarnessEnv();
  });

  function auth(userId: string) {
    return { Authorization: `Bearer ${tokenFor(userId)}` };
  }

  it('blocks a lifetime repurchase and a fourth open order', async () => {
    await connection.model(Entitlement.name).create({
      userId: new Types.ObjectId(fixture.studentId),
      scopeType: EntitlementScopeType.EXAM,
      scopeId: new Types.ObjectId(fixture.examId),
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: null,
      sourceType: 'ADMIN_GRANT',
      provisioningKey: `life:${fixture.studentId}`,
    });

    const blocked = await request(app.getHttpServer())
      .post('/api/v1/checkout/orders')
      .set(auth(fixture.studentId))
      .send({
        offerId: fixture.offerId,
        billing: billingBody,
        idempotencyKey: 'life-1',
      });
    expect(blocked.status).toBe(409);
    expect(blocked.body.details.code).toBe('ALREADY_COVERED');

    for (let index = 0; index < 3; index += 1) {
      const created = await request(app.getHttpServer())
        .post('/api/v1/checkout/orders')
        .set(auth(fixture.otherStudentId))
        .send({
          offerId: fixture.offerId,
          billing: billingBody,
          idempotencyKey: `open-${index}`,
        });
      expect(created.status).toBe(200);
    }

    const capped = await request(app.getHttpServer())
      .post('/api/v1/checkout/orders')
      .set(auth(fixture.otherStudentId))
      .send({
        offerId: fixture.offerId,
        billing: billingBody,
        idempotencyKey: 'open-4',
      });
    expect(capped.status).toBe(429);
    expect(capped.body.details.code).toBe('TOO_MANY_OPEN_ORDERS');

    const replay = await request(app.getHttpServer())
      .post('/api/v1/checkout/orders')
      .set(auth(fixture.otherStudentId))
      .send({
        offerId: fixture.offerId,
        billing: billingBody,
        idempotencyKey: 'open-0',
      });
    expect(replay.status).toBe(200);
  });
});
