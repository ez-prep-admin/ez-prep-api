import { ConfigService } from '@nestjs/config';
import { parseCommerceSettings } from '../commerce/commerce-config';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { RefundReconciliationScheduler } from './refund-reconciliation.scheduler';
import { RefundsService } from './refunds.service';

describe('RefundReconciliationScheduler', () => {
  const refunds = {
    reconcileInitiatedRefunds: jest.fn().mockResolvedValue(undefined),
  };

  function scheduler(values: Record<string, string>) {
    const config = {
      get: (key: string) => values[key],
    } as ConfigService;
    const commerce = {
      settings: parseCommerceSettings({ get: key => values[key] }),
    } as CommerceConfigService;
    return new RefundReconciliationScheduler(
      config,
      commerce,
      refunds as unknown as RefundsService,
    );
  }

  beforeEach(() => {
    refunds.reconcileInitiatedRefunds.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not start when reconciliation is disabled', () => {
    const job = scheduler({ RECONCILIATION_ENABLED: 'false' });
    job.onModuleInit();
    jest.advanceTimersByTime(600_000);
    expect(refunds.reconcileInitiatedRefunds).not.toHaveBeenCalled();
    job.onModuleDestroy();
  });

  it('runs on the configured interval when enabled', async () => {
    const job = scheduler({
      COMMERCE_ENABLED: 'true',
      RECONCILIATION_ENABLED: 'true',
      RECONCILIATION_INTERVAL_MS: '1000',
    });
    job.onModuleInit();
    expect(refunds.reconcileInitiatedRefunds).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(refunds.reconcileInitiatedRefunds).toHaveBeenCalledTimes(1);
    job.onModuleDestroy();
  });

  it('does not start a second pass while the first is running', async () => {
    let release: () => void = () => undefined;
    refunds.reconcileInitiatedRefunds.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          release = () => resolve();
        }),
    );
    const job = scheduler({
      COMMERCE_ENABLED: 'true',
      RECONCILIATION_ENABLED: 'true',
      RECONCILIATION_INTERVAL_MS: '1000',
    });
    job.onModuleInit();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(refunds.reconcileInitiatedRefunds).toHaveBeenCalledTimes(1);
    release();
    await Promise.resolve();
    job.onModuleDestroy();
  });
});
