import { OrderStatus } from '../../common/enums/order-status.enum';

export class IllegalOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Illegal order transition: ${from} -> ${to}`);
    this.name = 'IllegalOrderTransitionError';
  }
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.PENDING_PAYMENT, OrderStatus.EXPIRED],
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [OrderStatus.REFUNDED],
  [OrderStatus.FAILED]: [OrderStatus.PAID],
  [OrderStatus.EXPIRED]: [OrderStatus.PAID],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

/** Sources for PAID. Late edges are included only when the caller has provider proof. */
export function paidOrderSources(proof: boolean): OrderStatus[] {
  return proof
    ? [OrderStatus.PENDING_PAYMENT, OrderStatus.EXPIRED, OrderStatus.FAILED]
    : [OrderStatus.PENDING_PAYMENT];
}

/** Repeated PAID is a no-op. Every other illegal move throws. */
export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): 'apply' | 'noop' {
  if (from === to && to === OrderStatus.PAID) {
    return 'noop';
  }
  if (!ALLOWED[from].includes(to)) {
    throw new IllegalOrderTransitionError(from, to);
  }
  return 'apply';
}
