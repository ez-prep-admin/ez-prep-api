import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { entitlementCoversPaper } from '../access/match-entitlement';
import { expiresAtFromDurationPreset } from '../common/commerce/duration-preset';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { EntitlementSourceType } from '../common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { Order } from '../orders/schemas/order.schema';
import { CoverageService } from './coverage.service';
import { EntitlementLockService } from './entitlement-lock.service';
import {
  buildProvisioningKey,
  EntitlementProvisioningService,
} from './entitlement-provisioning.service';
import { PAID_ORDER_NOTIFIER } from './paid-order-notifier';
import { Entitlement } from './schemas/entitlement.schema';

type Row = Record<string, any>;

describe('EntitlementProvisioningService', () => {
  const entitlements: Row[] = [];
  const audit = { log: jest.fn() };
  const notifier = { onOrderProvisioned: jest.fn() };
  let order: Row | null = null;

  const orderModel = { findById: jest.fn() };
  const entitlementModel = { find: jest.fn(), create: jest.fn() };

  let service: EntitlementProvisioningService;

  beforeEach(async () => {
    entitlements.length = 0;
    order = null;
    audit.log.mockReset();
    audit.log.mockResolvedValue(undefined);
    notifier.onOrderProvisioned.mockReset();
    notifier.onOrderProvisioned.mockResolvedValue(undefined);

    orderModel.findById.mockImplementation(() => ({
      exec: async () => order,
    }));
    entitlementModel.find.mockImplementation((filter: Row) => ({
      exec: async () => entitlements.filter(row => overlaps(row, filter)),
    }));
    entitlementModel.create.mockImplementation(async (doc: Row) => {
      if (
        entitlements.some(row => row.provisioningKey === doc.provisioningKey)
      ) {
        throw duplicateKey();
      }
      const row = { ...doc, _id: new Types.ObjectId() };
      entitlements.push(row);
      return row;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementProvisioningService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        {
          provide: getModelToken(Entitlement.name),
          useValue: entitlementModel,
        },
        { provide: CommerceAuditService, useValue: audit },
        { provide: PAID_ORDER_NOTIFIER, useValue: notifier },
        {
          provide: EntitlementLockService,
          useValue: {
            withLock: (
              _userId: string,
              _productId: string,
              work: () => unknown,
            ) => work(),
          },
        },
        {
          provide: CoverageService,
          useValue: { isCoveredForLife: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = module.get(EntitlementProvisioningService);
  });

  function paidOrder(items: Row[], status = OrderStatus.PAID): Row {
    const _id = new Types.ObjectId();
    order = {
      _id,
      userId: new Types.ObjectId(),
      status,
      items,
      save: jest.fn(async function save(this: Row) {
        return this;
      }),
    };
    return order;
  }

  function item(
    productId: Types.ObjectId,
    grants: Array<{ scopeType: EntitlementScopeType; scopeId: string }>,
    durationPreset = DurationPreset.ONE_MONTH,
    productVersion = 3,
  ): Row {
    return { productId, productVersion, durationPreset, grants };
  }

  it('creates one entitlement per snapshot grant', async () => {
    const productId = new Types.ObjectId();
    const examId = new Types.ObjectId();
    const mockTestId = new Types.ObjectId();
    const current = paidOrder([
      item(productId, [
        { scopeType: EntitlementScopeType.EXAM, scopeId: examId.toHexString() },
        {
          scopeType: EntitlementScopeType.MOCK_TEST,
          scopeId: mockTestId.toHexString(),
        },
      ]),
    ]);

    const result = await service.provisionForPaidOrder(String(current._id));

    expect(result.created).toBe(2);
    expect(result.alreadyProvisioned).toBe(false);
    expect(entitlements).toHaveLength(2);
    expect(entitlements.map(row => row.scopeType).sort()).toEqual([
      EntitlementScopeType.EXAM,
      EntitlementScopeType.MOCK_TEST,
    ]);
    expect(
      entitlements.every(
        row => row.sourceType === EntitlementSourceType.PAYMENT,
      ),
    ).toBe(true);
    expect(
      entitlements.every(row => row.status === EntitlementStatus.ACTIVE),
    ).toBe(true);
    expect(String(entitlements[0].orderId)).toBe(String(current._id));
    expect(entitlements[0].startsAt.toISOString()).toBe(
      entitlements[1].startsAt.toISOString(),
    );
    expect(entitlements[0].expiresAt.toISOString()).toBe(
      entitlements[1].expiresAt.toISOString(),
    );
    expect(entitlements[0].provisioningKey).toBe(
      buildProvisioningKey({
        orderId: String(current._id),
        scopeType: entitlements[0].scopeType,
        scopeId: String(entitlements[0].scopeId),
        productVersion: 3,
      }),
    );
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(notifier.onOrderProvisioned).toHaveBeenCalledWith(
      String(current._id),
    );
  });

  it('is a no-op when the order is already provisioned', async () => {
    const current = paidOrder([
      item(new Types.ObjectId(), [
        {
          scopeType: EntitlementScopeType.EXAM,
          scopeId: new Types.ObjectId().toHexString(),
        },
      ]),
    ]);
    await service.provisionForPaidOrder(String(current._id));

    const replay = await service.provisionForPaidOrder(String(current._id));

    expect(replay.alreadyProvisioned).toBe(true);
    expect(replay.created).toBe(0);
    expect(entitlements).toHaveLength(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(notifier.onOrderProvisioned).toHaveBeenCalledTimes(1);
  });

  it('extends from the active product expiresAt', async () => {
    const productId = new Types.ObjectId();
    const anchor = new Date('2027-06-15T00:00:00.000Z');
    const current = paidOrder([
      item(
        productId,
        [
          {
            scopeType: EntitlementScopeType.EXAM,
            scopeId: new Types.ObjectId().toHexString(),
          },
          {
            scopeType: EntitlementScopeType.MOCK_TEST,
            scopeId: new Types.ObjectId().toHexString(),
          },
        ],
        DurationPreset.ONE_MONTH,
      ),
    ]);
    entitlements.push({
      userId: current.userId,
      productId,
      status: EntitlementStatus.ACTIVE,
      expiresAt: anchor,
      provisioningKey: 'previous-purchase',
    });

    await service.provisionForPaidOrder(String(current._id));

    const created = entitlements.filter(
      row => row.provisioningKey !== 'previous-purchase',
    );
    expect(created).toHaveLength(2);
    for (const row of created) {
      expect(row.startsAt.toISOString()).toBe(anchor.toISOString());
      expect(row.expiresAt.toISOString()).toBe('2027-07-15T00:00:00.000Z');
    }
  });

  it('starts at now when no overlapping entitlement is active', async () => {
    const productId = new Types.ObjectId();
    const current = paidOrder([
      item(productId, [
        {
          scopeType: EntitlementScopeType.EXAM,
          scopeId: new Types.ObjectId().toHexString(),
        },
      ]),
    ]);
    entitlements.push({
      userId: current.userId,
      productId,
      status: EntitlementStatus.ACTIVE,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      provisioningKey: 'lazy-expired',
    });
    entitlements.push({
      userId: current.userId,
      productId,
      status: EntitlementStatus.REVOKED,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      provisioningKey: 'revoked',
    });
    entitlements.push({
      userId: current.userId,
      status: EntitlementStatus.ACTIVE,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      provisioningKey: 'admin-without-product',
    });

    const before = Date.now();
    await service.provisionForPaidOrder(String(current._id));
    const after = Date.now();

    const created = entitlements.find(
      row =>
        row.provisioningKey !== 'lazy-expired' &&
        row.provisioningKey !== 'revoked' &&
        row.provisioningKey !== 'admin-without-product',
    );
    expect(created.startsAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(created.startsAt.getTime()).toBeLessThanOrEqual(after);
    expect(created.expiresAt.toISOString()).toBe(
      expiresAtFromDurationPreset(
        DurationPreset.ONE_MONTH,
        created.startsAt,
      )?.toISOString(),
    );
  });

  it('sets expiresAt null for a lifetime purchase', async () => {
    const current = paidOrder([
      item(
        new Types.ObjectId(),
        [
          {
            scopeType: EntitlementScopeType.EXAM,
            scopeId: new Types.ObjectId().toHexString(),
          },
        ],
        DurationPreset.LIFETIME,
      ),
    ]);

    await service.provisionForPaidOrder(String(current._id));

    expect(entitlements[0].expiresAt).toBeNull();
  });

  it('keeps lifetime when the product already has lifetime coverage', async () => {
    const productId = new Types.ObjectId();
    const current = paidOrder([
      item(productId, [
        {
          scopeType: EntitlementScopeType.EXAM,
          scopeId: new Types.ObjectId().toHexString(),
        },
      ]),
    ]);
    entitlements.push({
      userId: current.userId,
      productId,
      status: EntitlementStatus.ACTIVE,
      expiresAt: null,
      provisioningKey: 'existing-lifetime',
    });

    await service.provisionForPaidOrder(String(current._id));

    const created = entitlements.find(
      row => row.provisioningKey !== 'existing-lifetime',
    );
    expect(created.expiresAt).toBeNull();
  });

  it('uses snapshot grants rather than a live product', async () => {
    const liveGrantId = new Types.ObjectId();
    const snapshotGrantId = new Types.ObjectId();
    const current = paidOrder([
      item(new Types.ObjectId(), [
        {
          scopeType: EntitlementScopeType.EXAM,
          scopeId: snapshotGrantId.toHexString(),
        },
      ]),
    ]);

    await service.provisionForPaidOrder(String(current._id));

    expect(String(entitlements[0].scopeId)).toBe(snapshotGrantId.toHexString());
    expect(String(entitlements[0].scopeId)).not.toBe(liveGrantId.toHexString());
    expect(entitlements[0].productVersion).toBe(3);
  });

  it('treats an existing provisioning key as success and still finishes', async () => {
    const productId = new Types.ObjectId();
    const scopeId = new Types.ObjectId().toHexString();
    const current = paidOrder([
      item(productId, [{ scopeType: EntitlementScopeType.EXAM, scopeId }]),
    ]);
    entitlements.push({
      provisioningKey: buildProvisioningKey({
        orderId: String(current._id),
        scopeType: EntitlementScopeType.EXAM,
        scopeId,
        productVersion: 3,
      }),
      userId: current.userId,
      productId,
      status: EntitlementStatus.ACTIVE,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });

    const result = await service.provisionForPaidOrder(String(current._id));

    expect(result.created).toBe(0);
    expect(result.alreadyProvisioned).toBe(false);
    expect(entitlements).toHaveLength(1);
    expect(current.provisionedAt).toBeInstanceOf(Date);
    expect(notifier.onOrderProvisioned).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate rows when two calls insert the same key', async () => {
    const current = paidOrder([
      item(new Types.ObjectId(), [
        {
          scopeType: EntitlementScopeType.EXAM,
          scopeId: new Types.ObjectId().toHexString(),
        },
      ]),
    ]);
    const queued: Array<() => void> = [];
    entitlementModel.create.mockImplementation((doc: Row) => {
      return new Promise((resolve, reject) => {
        queued.push(() => {
          if (
            entitlements.some(
              row => row.provisioningKey === doc.provisioningKey,
            )
          ) {
            reject(duplicateKey());
            return;
          }
          entitlements.push({ ...doc });
          resolve({ ...doc });
        });
        if (queued.length === 2) {
          queued.splice(0).forEach(run => run());
        }
      });
    });

    const [first, second] = await Promise.all([
      service.provisionForPaidOrder(String(current._id)),
      service.provisionForPaidOrder(String(current._id)),
    ]);

    expect(entitlements).toHaveLength(1);
    expect(first.created + second.created).toBe(1);
    expect(current.provisionedAt).toBeInstanceOf(Date);
  });

  it('grants EXAM_GROUP access that covers a paper in that group', async () => {
    const examGroupId = new Types.ObjectId();
    const current = paidOrder([
      item(new Types.ObjectId(), [
        {
          scopeType: EntitlementScopeType.EXAM_GROUP,
          scopeId: examGroupId.toHexString(),
        },
      ]),
    ]);

    await service.provisionForPaidOrder(String(current._id));

    expect(
      entitlementCoversPaper(
        entitlements.map(row => ({
          scopeType: row.scopeType,
          scopeId: row.scopeId,
        })),
        new Types.ObjectId().toHexString(),
        new Types.ObjectId().toHexString(),
        examGroupId.toHexString(),
      ),
    ).toBe(true);
  });

  it('does not mark the order provisioned when insert fails', async () => {
    const current = paidOrder([
      item(new Types.ObjectId(), [
        {
          scopeType: EntitlementScopeType.EXAM,
          scopeId: new Types.ObjectId().toHexString(),
        },
      ]),
    ]);
    entitlementModel.create.mockRejectedValue(new Error('boom'));

    await expect(
      service.provisionForPaidOrder(String(current._id)),
    ).rejects.toThrow('boom');
    expect(current.provisionedAt).toBeUndefined();
    expect(notifier.onOrderProvisioned).not.toHaveBeenCalled();
  });

  it('leaves provisionedAt unset when invoice notification fails', async () => {
    notifier.onOrderProvisioned.mockRejectedValueOnce(
      new Error('invoice failed'),
    );
    const current = paidOrder([
      item(new Types.ObjectId(), [
        {
          scopeType: EntitlementScopeType.EXAM,
          scopeId: new Types.ObjectId().toHexString(),
        },
      ]),
    ]);

    await expect(
      service.provisionForPaidOrder(String(current._id)),
    ).rejects.toThrow('invoice failed');

    expect(current.provisionedAt).toBeUndefined();
    expect(current.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(notifier.onOrderProvisioned).toHaveBeenCalledTimes(1);
  });

  it('refuses an order that is not paid', async () => {
    const current = paidOrder(
      [
        item(new Types.ObjectId(), [
          {
            scopeType: EntitlementScopeType.EXAM,
            scopeId: new Types.ObjectId().toHexString(),
          },
        ]),
      ],
      OrderStatus.PENDING_PAYMENT,
    );

    await expect(
      service.provisionForPaidOrder(String(current._id)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entitlements).toHaveLength(0);
  });

  it('rejects an unknown order id', async () => {
    await expect(
      service.provisionForPaidOrder(new Types.ObjectId().toHexString()),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.provisionForPaidOrder('not-an-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function overlaps(row: Row, filter: Row): boolean {
  if (String(row.userId) !== String(filter.userId)) {
    return false;
  }
  if (String(row.productId) !== String(filter.productId)) {
    return false;
  }
  if (row.status !== filter.status) {
    return false;
  }
  if (row.expiresAt == null) {
    return true;
  }
  const gt = filter.$or?.find(
    (clause: Row) => clause.expiresAt && clause.expiresAt.$gt,
  )?.expiresAt.$gt as Date | undefined;
  return gt ? row.expiresAt.getTime() > gt.getTime() : false;
}

function duplicateKey(): Error & { code: number } {
  const error = new Error('E11000') as Error & { code: number };
  error.code = 11000;
  return error;
}
