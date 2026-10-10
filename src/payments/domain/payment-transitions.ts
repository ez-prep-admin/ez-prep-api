import { PaymentStatus } from '../../common/enums/payment-status.enum';

export class IllegalPaymentTransitionError extends Error {
  constructor(from: PaymentStatus, to: PaymentStatus) {
    super(`Illegal payment transition: ${from} -> ${to}`);
    this.name = 'IllegalPaymentTransitionError';
  }
}

const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.INITIATED]: [
    PaymentStatus.AUTHORIZED,
    PaymentStatus.CAPTURED,
    PaymentStatus.FAILED,
  ],
  [PaymentStatus.AUTHORIZED]: [PaymentStatus.CAPTURED, PaymentStatus.FAILED],
  [PaymentStatus.CAPTURED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [PaymentStatus.CAPTURED],
  [PaymentStatus.REFUNDED]: [],
};

/** Sources for CAPTURED. FAILED is included only when the caller has provider proof. */
export function capturedPaymentSources(proof: boolean): PaymentStatus[] {
  return proof
    ? [PaymentStatus.INITIATED, PaymentStatus.AUTHORIZED, PaymentStatus.FAILED]
    : [PaymentStatus.INITIATED, PaymentStatus.AUTHORIZED];
}

/** Repeated CAPTURED is a no-op. Every other illegal move throws. */
export function assertPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): 'apply' | 'noop' {
  if (from === to && to === PaymentStatus.CAPTURED) {
    return 'noop';
  }
  if (!ALLOWED[from].includes(to)) {
    throw new IllegalPaymentTransitionError(from, to);
  }
  return 'apply';
}
