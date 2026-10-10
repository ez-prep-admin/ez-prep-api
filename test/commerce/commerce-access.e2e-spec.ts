import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { EntitlementSourceType } from '../../src/common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../../src/common/enums/entitlement-status.enum';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { Entitlement } from '../../src/entitlements/schemas/entitlement.schema';
import { createCommerceHarness } from './support/app';
import { restoreHarnessEnv } from './support/env';
import { CommerceFixture, seedCommerceFixture } from './support/seed';

jest.setTimeout(90000);

describe('commerce access gates (characterization)', () => {
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
      accessMode: 'ENFORCED',
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

  function auth(userId: string) {
    return { Authorization: `Bearer ${tokenFor(userId)}` };
  }

  it('allows a free paper and denies an entitled paper with no grant', async () => {
    const free = await request(app.getHttpServer())
      .post('/api/v1/mock-test-attempts/start')
      .set(auth(fixture.studentId))
      .send({ mockTestId: fixture.freePaperId });
    expect(free.status).toBe(201);

    const denied = await request(app.getHttpServer())
      .post('/api/v1/mock-test-attempts/start')
      .set(auth(fixture.studentId))
      .send({ mockTestId: fixture.entitledPaperId });
    expect(denied.status).toBe(403);
    expect(denied.body.details.code).toBe('ENTITLEMENT_REQUIRED');
  });

  it('denies an entitled paper whose only coverage starts in the future', async () => {
    const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await connection.model(Entitlement.name).create({
      userId: new Types.ObjectId(fixture.studentId),
      scopeType: 'EXAM',
      scopeId: new Types.ObjectId(fixture.examId),
      status: EntitlementStatus.ACTIVE,
      startsAt,
      expiresAt: new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      sourceType: EntitlementSourceType.PAYMENT,
      productId: new Types.ObjectId(fixture.productId),
      orderId: new Types.ObjectId(),
      provisioningKey: `future:${fixture.studentId}`,
    });

    const start = await request(app.getHttpServer())
      .post('/api/v1/mock-test-attempts/start')
      .set(auth(fixture.studentId))
      .send({ mockTestId: fixture.entitledPaperId });
    expect(start.status).toBe(403);
    expect(start.body.details.code).toBe('ENTITLEMENT_REQUIRED');
  });
});
