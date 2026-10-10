import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { EntitlementLockService } from '../../src/entitlements/entitlement-lock.service';
import { EntitlementProvisioningService } from '../../src/entitlements/entitlement-provisioning.service';
import { Entitlement } from '../../src/entitlements/schemas/entitlement.schema';
import { Order } from '../../src/orders/schemas/order.schema';
import request from 'supertest';
import { createCommerceHarness } from './support/app';
import { restoreHarnessEnv } from './support/env';
import {
  billingBody,
  CommerceFixture,
  seedCommerceFixture,
} from './support/seed';

jest.setTimeout(90000);

describe('commerce entitlement lock', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let connection: Connection;
  let tokenFor: (userId: string, role?: UserRole) => string;
  let fixture: CommerceFixture;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const harness = await createCommerceHarness({
      mongoUri: mongo.getUri('commerce-lock'),
      paymentProvider: 'fake',
      accessMode: 'LEGACY',
      invoicesEnabled: 'false',
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

  it('stacks two parallel provisions back to back and takes over an expired lease', async () => {
    const auth = {
      Authorization: `Bearer ${tokenFor(fixture.studentId)}`,
    };
    const created = [];
    for (const key of ['lock-a', 'lock-b']) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/checkout/orders')
        .set(auth)
        .send({
          offerId: fixture.offerId,
          billing: billingBody,
          idempotencyKey: key,
        });
      expect(response.status).toBe(200);
      created.push(response.body.data.id as string);
    }

    await connection
      .model(Order.name)
      .collection.updateMany(
        { _id: { $in: created.map(id => new Types.ObjectId(id)) } },
        { $set: { status: 'PAID', paidAt: new Date() } },
      );

    const provisioning = app.get(EntitlementProvisioningService);
    await Promise.all(
      created.map(id => provisioning.provisionForPaidOrder(id)),
    );

    const rows = await connection
      .model(Entitlement.name)
      .find({ userId: new Types.ObjectId(fixture.studentId) })
      .sort({ startsAt: 1 })
      .exec();
    expect(rows).toHaveLength(2);
    expect(rows[1].startsAt.getTime()).toBe(rows[0].expiresAt.getTime());

    const lockId = `${fixture.studentId}:${fixture.productId}`;
    await connection.collection('entitlement_locks').insertOne({
      _id: lockId as never,
      holder: 'expired',
      lockedUntil: new Date(Date.now() - 1000),
    });
    const locks = app.get(EntitlementLockService);
    const held = await locks.withLock(
      fixture.studentId,
      fixture.productId,
      async () => 'taken',
    );
    expect(held).toBe('taken');
  });
});
