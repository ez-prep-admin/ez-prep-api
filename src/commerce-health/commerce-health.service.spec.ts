import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { CommerceAuditLog } from '../commerce-audit/schemas/commerce-audit-log.schema';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { TaxInvoice } from '../invoices/schemas/tax-invoice.schema';
import { Order } from '../orders/schemas/order.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { Refund } from '../refunds/schemas/refund.schema';
import { WebhookDeliveryStat } from '../webhooks/schemas/webhook-delivery-stat.schema';
import { WebhookEvent } from '../webhooks/schemas/webhook-event.schema';
import { CommerceHealthService } from './commerce-health.service';

function query(result: unknown) {
  const chain = {
    sort: () => chain,
    limit: () => chain,
    select: () => chain,
    exec: async () => result,
  };
  return chain;
}

function model(counts: () => number) {
  return {
    countDocuments: () => query(counts()),
    find: () => query([]),
    findOne: () => query(null),
    distinct: async () => [],
    aggregate: () => query([]),
    collection: {
      indexes: async () => [
        { name: 'orderId_1_role_primary' },
        { name: 'paymentId_1' },
      ],
    },
  };
}

describe('CommerceHealthService', () => {
  async function service(paidCount: number) {
    const module = await Test.createTestingModule({
      providers: [
        CommerceHealthService,
        {
          provide: CommerceConfigService,
          useValue: {
            settings: {
              commerceEnabled: true,
              paymentProvider: 'fake',
              invoicesEnabled: true,
              reconciliationEnabled: true,
            },
          },
        },
        {
          provide: getModelToken(Order.name),
          useValue: model(() => paidCount),
        },
        { provide: getModelToken(Payment.name), useValue: model(() => 0) },
        { provide: getModelToken(Refund.name), useValue: model(() => 0) },
        { provide: getModelToken(WebhookEvent.name), useValue: model(() => 0) },
        {
          provide: getModelToken(WebhookDeliveryStat.name),
          useValue: model(() => 0),
        },
        { provide: getModelToken(TaxInvoice.name), useValue: model(() => 0) },
        {
          provide: getModelToken(CommerceAuditLog.name),
          useValue: model(() => 0),
        },
      ],
    }).compile();
    return module.get(CommerceHealthService);
  }

  it('reports ok and reuses the snapshot for 30 seconds', async () => {
    const health = await service(0);
    const now = new Date('2026-10-11T00:00:00.000Z');
    const first = await health.snapshot(now);
    const second = await health.snapshot(new Date(now.getTime() + 1000));

    expect(first.status).toBe('ok');
    expect(first.webhook.webhookSilentWhilePaid).toBe(false);
    expect(second).toBe(first);
  });

  it('logs COMMERCE_DEGRADED when a recent payment has no processed webhook', async () => {
    const health = await service(1);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await health.degradedTick(new Date('2026-10-11T00:00:00.000Z'));

    expect(warn).toHaveBeenCalledWith('COMMERCE_DEGRADED');
    warn.mockRestore();
  });
});
