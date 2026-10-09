import { ConfigService } from '@nestjs/config';
import { ReconciliationScheduler } from './reconciliation.scheduler';
import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationScheduler', () => {
  const reconciliation = {
    reconcileOnce: jest.fn().mockResolvedValue(undefined),
  };

  function scheduler(values: Record<string, string>) {
    const config = {
      get: (key: string) => values[key],
    } as ConfigService;
    return new ReconciliationScheduler(
      config,
      reconciliation as unknown as ReconciliationService,
    );
  }

  beforeEach(() => {
    reconciliation.reconcileOnce.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not start when reconciliation is disabled', () => {
    const job = scheduler({ RECONCILIATION_ENABLED: 'false' });
    job.onModuleInit();
    jest.advanceTimersByTime(600_000);
    expect(reconciliation.reconcileOnce).not.toHaveBeenCalled();
    job.onModuleDestroy();
  });

  it('runs on the configured interval when enabled', async () => {
    const job = scheduler({
      RECONCILIATION_ENABLED: 'true',
      RECONCILIATION_INTERVAL_MS: '1000',
    });
    job.onModuleInit();
    expect(reconciliation.reconcileOnce).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(reconciliation.reconcileOnce).toHaveBeenCalledTimes(1);
    job.onModuleDestroy();
  });
});
