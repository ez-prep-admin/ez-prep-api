import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { ProductStatus } from '../common/enums/product-status.enum';
import { RefundStatus } from '../common/enums/refund-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { PaymentRole } from '../payments/domain/payment-role.enum';
import { RefundKind } from '../refunds/domain/refund-kind.enum';
import { AccountingSnapshotCache } from './accounting-snapshot.cache';
import {
  activeEntitlementFilter,
  duplicateCaptureRefundsPipeline,
  expiredEntitlementFilter,
  LEARNER_FILTER,
  offerStatusFilter,
  orderRefundsPipeline,
  paidUsersPipeline,
  paymentsReceivedPipeline,
  productStatusFilter,
  taxOnPaidOrdersPipeline,
} from './accounting.filters';
import { AccountingService } from './accounting.service';
import { DEFAULT_CURRENCY } from './accounting.types';

function createModel() {
  const pipelines: unknown[] = [];
  const allowDiskUseCalls: boolean[] = [];
  const queue: unknown[][] = [];
  return {
    pipelines,
    allowDiskUseCalls,
    countDocuments: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn((pipeline: unknown) => {
      const index = pipelines.length;
      pipelines.push(pipeline);
      let allowDisk = false;
      const chain = {
        allowDiskUse: jest.fn((value: boolean) => {
          allowDisk = value;
          return chain;
        }),
        exec: jest.fn(async () => {
          allowDiskUseCalls[index] = allowDisk;
          return queue[index] ?? [];
        }),
      };
      return chain;
    }),
    queueResults(...rows: unknown[][]) {
      queue.splice(0, queue.length, ...rows);
    },
  };
}

describe('accounting filters', () => {
  const now = new Date('2026-10-11T08:00:00.000Z');

  it('treats a usable entitlement as active, started, and unexpired', () => {
    expect(activeEntitlementFilter(now)).toEqual({
      status: EntitlementStatus.ACTIVE,
      startsAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  });

  it('counts lazy expiry as well as rows already marked expired', () => {
    expect(expiredEntitlementFilter(now)).toEqual({
      $or: [
        { status: EntitlementStatus.EXPIRED },
        {
          status: EntitlementStatus.ACTIVE,
          expiresAt: { $ne: null, $lte: now },
        },
      ],
    });
  });

  it('sums captured and refunded primary payments and leaves duplicate captures out', () => {
    expect(paymentsReceivedPipeline()).toEqual([
      {
        $match: {
          status: { $in: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] },
          role: { $ne: PaymentRole.DUPLICATE },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$currency', DEFAULT_CURRENCY] },
          amountPaise: { $sum: '$amount' },
        },
      },
    ]);
  });

  it('sums completed order refunds separately from duplicate-capture refunds', () => {
    expect(orderRefundsPipeline()).toEqual([
      {
        $match: {
          status: RefundStatus.COMPLETED,
          kind: RefundKind.ORDER,
        },
      },
      { $group: { _id: null, amountPaise: { $sum: '$amount' } } },
    ]);
    expect(duplicateCaptureRefundsPipeline()[0]).toEqual({
      $match: {
        status: RefundStatus.COMPLETED,
        kind: RefundKind.DUPLICATE_CAPTURE,
      },
    });
  });

  it('excludes deleted products from catalog counts', () => {
    expect(productStatusFilter(ProductStatus.PUBLISHED)).toEqual({
      isDeleted: { $ne: true },
      status: ProductStatus.PUBLISHED,
    });
  });
});

describe('AccountingService.compute', () => {
  const now = new Date('2026-10-11T08:00:00.000Z');
  const users = createModel();
  const entitlements = createModel();
  const orders = createModel();
  const products = createModel();
  const offers = createModel();
  const payments = createModel();
  const refunds = createModel();
  const invoices = createModel();
  const cache = { get: jest.fn() };

  const service = new AccountingService(
    users as never,
    entitlements as never,
    orders as never,
    products as never,
    offers as never,
    payments as never,
    refunds as never,
    invoices as never,
    cache as unknown as AccountingSnapshotCache,
  );

  function scriptCounts(
    model: ReturnType<typeof createModel>,
    cases: Array<[object, number]>,
  ) {
    model.countDocuments.mockImplementation(async (filter: object) => {
      const found = cases.find(
        ([expected]) => JSON.stringify(expected) === JSON.stringify(filter),
      );
      if (!found) {
        throw new Error(`Unexpected filter ${JSON.stringify(filter)}`);
      }
      return found[1];
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    for (const model of [
      users,
      entitlements,
      orders,
      products,
      offers,
      payments,
      refunds,
      invoices,
    ]) {
      model.pipelines.length = 0;
      model.allowDiskUseCalls.length = 0;
      model.countDocuments.mockReset();
      model.countDocuments.mockResolvedValue(0);
      model.queueResults();
    }

    scriptCounts(users, [[LEARNER_FILTER, 10]]);
    scriptCounts(entitlements, [
      [{}, 20],
      [activeEntitlementFilter(now), 8],
      [expiredEntitlementFilter(now), 4],
      [{ status: EntitlementStatus.REVOKED }, 2],
    ]);
    scriptCounts(orders, [
      [{ status: OrderStatus.PAID }, 6],
      [{ status: OrderStatus.REFUNDED }, 1],
      [{ status: OrderStatus.CREATED }, 3],
      [{ status: OrderStatus.PENDING_PAYMENT }, 2],
      [{ status: OrderStatus.FAILED }, 1],
      [{ status: OrderStatus.EXPIRED }, 4],
      [{ status: OrderStatus.CANCELLED }, 1],
    ]);
    scriptCounts(products, [
      [productStatusFilter(ProductStatus.PUBLISHED), 5],
      [productStatusFilter(ProductStatus.DRAFT), 2],
      [productStatusFilter(ProductStatus.ARCHIVED), 1],
    ]);
    scriptCounts(offers, [
      [offerStatusFilter(OfferStatus.ACTIVE), 7],
      [offerStatusFilter(OfferStatus.INACTIVE), 3],
    ]);
    scriptCounts(invoices, [[{}, 6]]);

    entitlements.queueResults([{ count: 4 }]);
    payments.queueResults([{ _id: 'INR', amountPaise: 500000 }]);
    refunds.queueResults([{ amountPaise: 100000 }], [{ amountPaise: 25000 }]);
    orders.queueResults([{ _id: 'INR', amountPaise: 76300 }]);
  });

  it('builds the overview from indexed counts and sums', async () => {
    const overview = await service.compute(now);

    expect(overview.people).toEqual({
      paidUsers: 4,
      freeUsers: 6,
      learners: 10,
    });
    expect(overview.entitlements).toEqual({
      issued: 20,
      active: 8,
      expired: 4,
      revoked: 2,
    });
    expect(overview.orders).toEqual({
      paid: 6,
      refunded: 1,
      pending: 5,
      failed: 1,
      expired: 4,
      cancelled: 1,
    });
    expect(overview.catalog).toEqual({
      products: { published: 5, draft: 2, archived: 1 },
      offers: { active: 7, inactive: 3 },
    });
    expect(overview.money).toEqual({
      paymentsReceived: [{ currency: 'INR', amountPaise: 500000 }],
      refundsIssued: [{ currency: 'INR', amountPaise: 100000 }],
      duplicateCaptureRefunds: [{ currency: 'INR', amountPaise: 25000 }],
      netReceipts: [{ currency: 'INR', amountPaise: 400000 }],
      taxOnPaidOrders: [{ currency: 'INR', amountPaise: 76300 }],
      invoicesIssued: 6,
    });

    expect(users.countDocuments).toHaveBeenCalledWith({
      role: UserRole.USER,
      isDeleted: { $ne: true },
    });
    expect(entitlements.pipelines).toEqual([paidUsersPipeline(now)]);
    expect(entitlements.allowDiskUseCalls).toEqual([true]);
    expect(payments.pipelines).toEqual([paymentsReceivedPipeline()]);
    expect(refunds.pipelines).toEqual([
      orderRefundsPipeline(),
      duplicateCaptureRefundsPipeline(),
    ]);
    expect(orders.pipelines).toEqual([taxOnPaidOrdersPipeline()]);
    expect(products.countDocuments).toHaveBeenCalledWith({
      isDeleted: { $ne: true },
      status: ProductStatus.PUBLISHED,
    });
  });

  it('does not report a negative free-user count when staff hold entitlements', async () => {
    scriptCounts(users, [[LEARNER_FILTER, 1]]);
    entitlements.queueResults([{ count: 3 }]);

    const overview = await service.compute(now);

    expect(overview.people.paidUsers).toBe(3);
    expect(overview.people.freeUsers).toBe(0);
  });
});
