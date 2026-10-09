import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PAID_ORDER_NOTIFIER } from '../entitlements/paid-order-notifier';
import {
  InstanceConfig,
  InstanceConfigSchema,
} from '../instance-config/schemas/instance-config.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { AdminInvoicesController } from './admin-invoices.controller';
import { InvoicePaidOrderNotifier } from './invoice-paid-order.notifier';
import { InvoiceService, TAX_INVOICE_PDF_RENDERER } from './invoice.service';
import { MeInvoicesController } from './me-invoices.controller';
import { renderTaxInvoicePdf } from './pdf/render-tax-invoice-pdf';
import { TaxInvoice, TaxInvoiceSchema } from './schemas/tax-invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaxInvoice.name, schema: TaxInvoiceSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: InstanceConfig.name, schema: InstanceConfigSchema },
    ]),
  ],
  controllers: [MeInvoicesController, AdminInvoicesController],
  providers: [
    InvoiceService,
    InvoicePaidOrderNotifier,
    {
      provide: TAX_INVOICE_PDF_RENDERER,
      useValue: renderTaxInvoicePdf,
    },
    {
      provide: PAID_ORDER_NOTIFIER,
      useExisting: InvoicePaidOrderNotifier,
    },
  ],
  exports: [InvoiceService, PAID_ORDER_NOTIFIER],
})
export class InvoicesModule {}
