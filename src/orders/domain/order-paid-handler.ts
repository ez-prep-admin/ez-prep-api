export interface OrderPaidEvent {
  orderId: string;
  userId: string;
  amount: number;
}

/**
 * Called after an order first reaches PAID.
 * Provisions entitlements from the order snapshot.
 */
export interface OrderPaidHandler {
  onOrderPaid(event: OrderPaidEvent): Promise<void>;
}

export const ORDER_PAID_HANDLER = 'ORDER_PAID_HANDLER';
