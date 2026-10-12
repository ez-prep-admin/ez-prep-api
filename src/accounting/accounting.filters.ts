import { PipelineStage } from 'mongoose';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { ProductStatus } from '../common/enums/product-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { PaymentRole } from '../payments/domain/payment-role.enum';
import { RefundKind } from '../refunds/domain/refund-kind.enum';
import { RefundStatus } from '../common/enums/refund-status.enum';
import { DEFAULT_CURRENCY } from './accounting.types';

export const LEARNER_FILTER = {
  role: UserRole.USER,
  isDeleted: { $ne: true },
};

/** Usable grant: active, already started, and not past expiresAt. Null expiresAt is lifetime. */
export function activeEntitlementFilter(now: Date) {
  return {
    status: EntitlementStatus.ACTIVE,
    startsAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

/**
 * EXPIRED is rarely written. A grant lapses while it is still stored as ACTIVE
 * once expiresAt is in the past.
 */
export function expiredEntitlementFilter(now: Date) {
  return {
    $or: [
      { status: EntitlementStatus.EXPIRED },
      {
        status: EntitlementStatus.ACTIVE,
        expiresAt: { $ne: null, $lte: now },
      },
    ],
  };
}

export function productStatusFilter(status: ProductStatus) {
  return {
    isDeleted: { $ne: true },
    status,
  };
}

export function offerStatusFilter(status: OfferStatus) {
  return { status };
}

export function paidUsersPipeline(now: Date): PipelineStage[] {
  return [
    { $match: activeEntitlementFilter(now) },
    { $group: { _id: '$userId' } },
    { $count: 'count' },
  ];
}

/**
 * A completed refund moves the payment from CAPTURED to REFUNDED.
 * Gross receipts include both. Duplicate captures are not revenue.
 */
export function paymentsReceivedPipeline(): PipelineStage[] {
  return [
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
  ];
}

export function orderRefundsPipeline(): PipelineStage[] {
  return [
    {
      $match: {
        status: RefundStatus.COMPLETED,
        kind: RefundKind.ORDER,
      },
    },
    { $group: { _id: null, amountPaise: { $sum: '$amount' } } },
  ];
}

export function duplicateCaptureRefundsPipeline(): PipelineStage[] {
  return [
    {
      $match: {
        status: RefundStatus.COMPLETED,
        kind: RefundKind.DUPLICATE_CAPTURE,
      },
    },
    { $group: { _id: null, amountPaise: { $sum: '$amount' } } },
  ];
}

export function taxOnPaidOrdersPipeline(): PipelineStage[] {
  return [
    { $match: { status: OrderStatus.PAID } },
    {
      $group: {
        _id: { $ifNull: ['$currency', DEFAULT_CURRENCY] },
        amountPaise: { $sum: { $ifNull: ['$tax.taxAmount', 0] } },
      },
    },
  ];
}
