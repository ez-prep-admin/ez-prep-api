export interface OrderPaidEvent {
  orderId: string;
  userId: string;
  amount: number;
}

/**
 * Called after an order first reaches PAID.
 * Phase 07 ships a no-op. Phase 09 replaces it with entitlement provisioning.
 */
export interface OrderPaidHandler {
  onOrderPaid(event: OrderPaidEvent): Promise<void>;
}

export const ORDER_PAID_HANDLER = 'ORDER_PAID_HANDLER';
