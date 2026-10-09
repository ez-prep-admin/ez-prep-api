import { Injectable } from '@nestjs/common';
import { OrderPaidEvent, OrderPaidHandler } from '../domain/order-paid-handler';

@Injectable()
export class NoopOrderPaidHandler implements OrderPaidHandler {
  async onOrderPaid(_event: OrderPaidEvent): Promise<void> {
    // Phase 09 wires entitlement provisioning on this path and the webhook path.
  }
}
