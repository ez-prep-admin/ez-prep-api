import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaidOrderNotifier } from '../entitlements/paid-order-notifier';
import { InvoiceService } from './invoice.service';

/**
 * Issues a tax invoice after entitlements are inserted.
 * `INVOICES_ENABLED` must be the string `true`. Any other value skips
 * issue so provisioning can still finish.
 */
@Injectable()
export class InvoicePaidOrderNotifier implements PaidOrderNotifier {
  constructor(
    private readonly configService: ConfigService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async onOrderProvisioned(orderId: string): Promise<void> {
    if (this.configService.get<string>('INVOICES_ENABLED') !== 'true') {
      return;
    }
    await this.invoiceService.issueForPaidOrder(orderId);
  }
}
