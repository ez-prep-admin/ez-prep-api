import { ConfigService } from '@nestjs/config';
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
    return new RefundReconciliationScheduler(
      config,
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
});
