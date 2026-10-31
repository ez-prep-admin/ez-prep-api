import { Injectable, Logger } from '@nestjs/common';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { PaidOrderNotifier } from '../entitlements/paid-order-notifier';
import { InvoiceService } from './invoice.service';

/**
 * Schedules a tax invoice after entitlements are inserted and provisionedAt
 * is saved. Failures are logged and repaired by the sweep. They do not fail
 * verify or the webhook.
 */
@Injectable()
export class InvoicePaidOrderNotifier implements PaidOrderNotifier {
  private readonly logger = new Logger(InvoicePaidOrderNotifier.name);

  constructor(
    private readonly commerceConfig: CommerceConfigService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async onOrderProvisioned(orderId: string): Promise<void> {
    if (!this.commerceConfig.settings.invoicesEnabled) {
      return;
    }
    setImmediate(() => {
      void this.invoiceService.issueForPaidOrder(orderId).catch(error => {
        this.logger.warn(
          `Invoice issue failed for order ${orderId}: ${
            error instanceof Error ? error.message : 'unexpected error'
          }`,
        );
      });
    });
  }
}
