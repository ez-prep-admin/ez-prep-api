import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { ProductStatus } from '../common/enums/product-status.enum';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { Entitlement } from '../entitlements/schemas/entitlement.schema';
import { TaxInvoice } from '../invoices/schemas/tax-invoice.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Order } from '../orders/schemas/order.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { Product } from '../products/schemas/product.schema';
import { Refund } from '../refunds/schemas/refund.schema';
import { User } from '../users/schemas/user.schema';
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
import {
  AccountingOverview,
  AccountingOverviewBody,
  DEFAULT_CURRENCY,
  MoneyTotal,
} from './accounting.types';

type CountModel = {
  countDocuments(filter: object): Promise<number>;
};

type AggregateRow = {
  _id?: string | null;
  amountPaise?: number;
  count?: number;
};

type AggregateModel = {
  aggregate(pipeline: PipelineStage[]): {
    allowDiskUse(allow: boolean): unknown;
    exec(): Promise<AggregateRow[]>;
  };
};

@Injectable()
export class AccountingService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Entitlement.name)
    private readonly entitlements: Model<Entitlement>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Refund.name) private readonly refunds: Model<Refund>,
    @InjectModel(TaxInvoice.name)
    private readonly invoices: Model<TaxInvoice>,
    private readonly cache: AccountingSnapshotCache,
  ) {}

  getOverview(): Promise<AccountingOverview> {
    return this.cache.get(() => this.compute());
  }

  async compute(now = new Date()): Promise<AccountingOverviewBody> {
    const [
      learners,
      paidRows,
      issued,
      active,
      expired,
      revoked,
      paidOrders,
      refundedOrders,
      createdOrders,
      pendingPaymentOrders,
      failedOrders,
      expiredOrders,
      cancelledOrders,
      publishedProducts,
      draftProducts,
      archivedProducts,
      activeOffers,
      inactiveOffers,
      invoicesIssued,
      paymentRows,
      orderRefundRows,
      duplicateRefundRows,
      taxRows,
    ] = await Promise.all([
      this.count(this.users, LEARNER_FILTER),
      this.aggregate(this.entitlements, paidUsersPipeline(now), true),
      this.count(this.entitlements, {}),
      this.count(this.entitlements, activeEntitlementFilter(now)),
      this.count(this.entitlements, expiredEntitlementFilter(now)),
      this.count(this.entitlements, { status: EntitlementStatus.REVOKED }),
      this.count(this.orders, { status: OrderStatus.PAID }),
      this.count(this.orders, { status: OrderStatus.REFUNDED }),
      this.count(this.orders, { status: OrderStatus.CREATED }),
      this.count(this.orders, { status: OrderStatus.PENDING_PAYMENT }),
      this.count(this.orders, { status: OrderStatus.FAILED }),
      this.count(this.orders, { status: OrderStatus.EXPIRED }),
      this.count(this.orders, { status: OrderStatus.CANCELLED }),
      this.count(this.products, productStatusFilter(ProductStatus.PUBLISHED)),
      this.count(this.products, productStatusFilter(ProductStatus.DRAFT)),
      this.count(this.products, productStatusFilter(ProductStatus.ARCHIVED)),
      this.count(this.offers, offerStatusFilter(OfferStatus.ACTIVE)),
      this.count(this.offers, offerStatusFilter(OfferStatus.INACTIVE)),
      this.count(this.invoices, {}),
      this.aggregate(this.payments, paymentsReceivedPipeline()),
      this.aggregate(this.refunds, orderRefundsPipeline()),
      this.aggregate(this.refunds, duplicateCaptureRefundsPipeline()),
      this.aggregate(this.orders, taxOnPaidOrdersPipeline()),
    ]);

    const paidUsers = paidRows[0]?.count ?? 0;
    const paymentsReceived = moneyByCurrency(paymentRows);
    const refundsIssued = inrAmount(orderRefundRows);

    return {
      people: {
        paidUsers,
        freeUsers: Math.max(0, learners - paidUsers),
        learners,
      },
      entitlements: {
        issued,
        active,
        expired,
        revoked,
      },
      orders: {
        paid: paidOrders,
        refunded: refundedOrders,
        pending: createdOrders + pendingPaymentOrders,
        failed: failedOrders,
        expired: expiredOrders,
        cancelled: cancelledOrders,
      },
      catalog: {
        products: {
          published: publishedProducts,
          draft: draftProducts,
          archived: archivedProducts,
        },
        offers: {
          active: activeOffers,
          inactive: inactiveOffers,
        },
      },
      money: {
        paymentsReceived,
        refundsIssued,
        duplicateCaptureRefunds: inrAmount(duplicateRefundRows),
        netReceipts: netReceipts(paymentsReceived, refundsIssued),
        taxOnPaidOrders: moneyByCurrency(taxRows),
        invoicesIssued,
      },
    };
  }

  private count(model: CountModel, filter: object): Promise<number> {
    return model.countDocuments(filter);
  }

  private aggregate(
    model: AggregateModel,
    pipeline: PipelineStage[],
    allowDiskUse = false,
  ): Promise<AggregateRow[]> {
    const query = model.aggregate(pipeline);
    if (allowDiskUse) {
      query.allowDiskUse(true);
    }
    return query.exec();
  }
}

function moneyByCurrency(rows: AggregateRow[]): MoneyTotal[] {
  const totals = rows
    .filter(
      (row): row is AggregateRow & { _id: string } =>
        typeof row._id === 'string' && row._id.length > 0,
    )
    .map(row => ({
      currency: row._id,
      amountPaise: row.amountPaise ?? 0,
    }));
  return totals.length > 0
    ? sortMoney(totals)
    : [{ currency: DEFAULT_CURRENCY, amountPaise: 0 }];
}

function inrAmount(rows: AggregateRow[]): MoneyTotal[] {
  return [
    {
      currency: DEFAULT_CURRENCY,
      amountPaise: rows[0]?.amountPaise ?? 0,
    },
  ];
}

function netReceipts(
  payments: MoneyTotal[],
  refunds: MoneyTotal[],
): MoneyTotal[] {
  const totals = new Map<string, number>();
  for (const row of payments) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountPaise);
  }
  for (const row of refunds) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) - row.amountPaise);
  }
  const rows = [...totals.entries()].map(([currency, amountPaise]) => ({
    currency,
    amountPaise,
  }));
  return rows.length > 0
    ? sortMoney(rows)
    : [{ currency: DEFAULT_CURRENCY, amountPaise: 0 }];
}

function sortMoney(rows: MoneyTotal[]): MoneyTotal[] {
  return [...rows].sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
}
