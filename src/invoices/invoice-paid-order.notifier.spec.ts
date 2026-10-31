import { Test, TestingModule } from '@nestjs/testing';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { InvoicePaidOrderNotifier } from './invoice-paid-order.notifier';
import { InvoiceService } from './invoice.service';

describe('InvoicePaidOrderNotifier', () => {
  const invoices = { issueForPaidOrder: jest.fn() };
  const commerce = { settings: { invoicesEnabled: false } };
  let notifier: InvoicePaidOrderNotifier;

  beforeEach(async () => {
    invoices.issueForPaidOrder.mockReset();
    invoices.issueForPaidOrder.mockResolvedValue({ invoiceNumber: 'N' });
    commerce.settings.invoicesEnabled = false;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicePaidOrderNotifier,
        { provide: InvoiceService, useValue: invoices },
        { provide: CommerceConfigService, useValue: commerce },
      ],
    }).compile();

    notifier = module.get(InvoicePaidOrderNotifier);
  });

  it('issues when invoices are enabled', async () => {
    commerce.settings.invoicesEnabled = true;

    await notifier.onOrderProvisioned('order-1');
    await new Promise(resolve => setImmediate(resolve));

    expect(invoices.issueForPaidOrder).toHaveBeenCalledWith('order-1');
  });

  it('skips issue when the flag is not true', async () => {
    await notifier.onOrderProvisioned('order-1');

    expect(invoices.issueForPaidOrder).not.toHaveBeenCalled();
  });
});
