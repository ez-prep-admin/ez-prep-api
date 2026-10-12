/**
 * Runs after a paid order's entitlements are inserted and before
 * `provisionedAt` is saved. A throw leaves the order unprovisioned so the
 * next paid signal can retry. Invoice issue is the Phase 10 implementation.
 */
export interface PaidOrderNotifier {
  onOrderProvisioned(orderId: string): Promise<void>;
}

export const PAID_ORDER_NOTIFIER = 'PAID_ORDER_NOTIFIER';
