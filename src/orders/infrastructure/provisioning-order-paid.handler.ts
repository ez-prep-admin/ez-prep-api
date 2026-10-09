import { Injectable } from '@nestjs/common';
import { EntitlementProvisioningService } from '../../entitlements/entitlement-provisioning.service';
import { OrderPaidEvent, OrderPaidHandler } from '../domain/order-paid-handler';

@Injectable()
export class ProvisioningOrderPaidHandler implements OrderPaidHandler {
  constructor(private readonly provisioning: EntitlementProvisioningService) {}

  async onOrderPaid(event: OrderPaidEvent): Promise<void> {
    await this.provisioning.provisionForPaidOrder(event.orderId);
  }
}
