import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private readonly configService: ConfigService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async onOrderProvisioned(orderId: string): Promise<void> {
    if (this.configService.get<string>('INVOICES_ENABLED') !== 'true') {
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
