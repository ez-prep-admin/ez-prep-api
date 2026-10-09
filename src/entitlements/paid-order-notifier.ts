import { Injectable } from '@nestjs/common';

/**
 * Phase 10 replaces this with GST invoice issue. Phase 9 calls it and does nothing.
 */
export interface PaidOrderNotifier {
  onOrderProvisioned(orderId: string): Promise<void>;
}

export const PAID_ORDER_NOTIFIER = 'PAID_ORDER_NOTIFIER';

@Injectable()
export class NoopPaidOrderNotifier implements PaidOrderNotifier {
  async onOrderProvisioned(_orderId: string): Promise<void> {}
}
