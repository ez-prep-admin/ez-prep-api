import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InvoicePaidOrderNotifier } from './invoice-paid-order.notifier';
import { InvoiceService } from './invoice.service';

describe('InvoicePaidOrderNotifier', () => {
  const invoices = { issueForPaidOrder: jest.fn() };
  const config = { get: jest.fn() };
  let notifier: InvoicePaidOrderNotifier;

  beforeEach(async () => {
    invoices.issueForPaidOrder.mockReset();
    invoices.issueForPaidOrder.mockResolvedValue({ invoiceNumber: 'N' });
    config.get.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicePaidOrderNotifier,
        { provide: InvoiceService, useValue: invoices },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    notifier = module.get(InvoicePaidOrderNotifier);
  });

  it('issues when invoices are enabled', async () => {
    config.get.mockReturnValue('true');

    await notifier.onOrderProvisioned('order-1');

    expect(config.get).toHaveBeenCalledWith('INVOICES_ENABLED');
    expect(invoices.issueForPaidOrder).toHaveBeenCalledWith('order-1');
  });

  it('skips issue when the flag is not true', async () => {
    config.get.mockReturnValue('false');

    await notifier.onOrderProvisioned('order-1');

    expect(invoices.issueForPaidOrder).not.toHaveBeenCalled();
  });
});
