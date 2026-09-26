import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { ImportService } from '../imports/import.service';
import { RedisConnectionRegistry } from '../redis/redis-connection.registry';
import { resolveRedisSettings } from '../redis/redis.settings';
import { ImportQueueRecovery } from './import-queue.recovery';
import {
  ImportQueueWorker,
  ManualJob,
  ManualWorkerFactory,
  resolveImportService,
} from './import-queue.worker';

jest.mock('bullmq', () => {
  const actual = jest.requireActual('bullmq');
  return {
    ...actual,
    Worker: jest.fn().mockImplementation(() => ({
      getNextJob: jest.fn().mockResolvedValue(undefined),
      moveStalledJobsToWait: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    })),
  };
});

const REDIS_URL = 'rediss://default:secret@example.upstash.io:6379';

function enabledSettings() {
  return resolveRedisSettings({
    REDIS_URL,
    INSTANCE_ID: 'ezprep',
    NODE_ENV: 'test',
    QUEUE_WORKER_ENABLED: 'true',
  });
}

function readyConnection() {
  return {
    status: 'ready',
    connect: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
  };
}

function job(overrides: Partial<ManualJob> = {}): ManualJob {
  return {
    id: 'job-1',
    name: 'import-enrich',
    data: { uploadId: '507f1f77bcf86cd799439011' },
    token: 'lock-token',
    extendLock: jest.fn().mockResolvedValue(1),
    moveToCompleted: jest.fn().mockResolvedValue(undefined),
    moveToFailed: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ImportQueueWorker', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let intervals: Array<() => unknown>;

  beforeEach(() => {
    intervals = [];
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(global, 'setInterval').mockImplementation(((
      callback: () => unknown,
    ) => {
      intervals.push(callback);
      return intervals.length as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves the import service after the module cycle is created', () => {
    expect(resolveImportService()).toBe(ImportService);
  });

  it('does not poll when the worker is disabled', async () => {
    const create = jest.fn();
    const worker = new ImportQueueWorker(
      resolveRedisSettings({ INSTANCE_ID: 'ezprep' }),
      { create } as unknown as RedisConnectionRegistry,
      { recoverStaleUploads: jest.fn() } as unknown as ImportQueueRecovery,
      {} as ImportService,
    );
    await worker.onModuleInit();
    await worker.ensureStarted();
    await worker.close();
    expect(create).not.toHaveBeenCalled();
  });

  it('fetches without blocking and reuses one connection', async () => {
    const parseJob = job({
      id: 'parse-1',
      name: 'import-parse',
      data: {
        uploadId: '507f1f77bcf86cd799439011',
        maxPollingAttempts: 2,
        pollingIntervalMs: 1000,
      },
    });
    const second = job({ id: 'parse-2', name: 'import-parse' });
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(parseJob)
      .mockResolvedValueOnce(second)
      .mockResolvedValue(undefined);
    const manual = {
      getNextJob: fetch,
      moveStalledJobsToWait: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    const createWorker: ManualWorkerFactory = () => manual;
    const importService = {
      runEnrichUploadInBackground: jest.fn().mockResolvedValue(undefined),
      runParsePdfInBackground: jest.fn().mockResolvedValue(undefined),
    } as unknown as ImportService;
    const connections = {
      create: jest.fn().mockReturnValue(readyConnection()),
    };
    const worker = new ImportQueueWorker(
      enabledSettings(),
      connections as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest.fn().mockResolvedValue({
          examined: 0,
          failed: 0,
          spared: 0,
        }),
      } as unknown as ImportQueueRecovery,
      importService,
      createWorker,
    );

    await worker.onModuleInit();
    expect(fetch).toHaveBeenCalledWith(expect.any(String), { block: false });
    expect(manual.moveStalledJobsToWait).toHaveBeenCalled();
    expect(importService.runParsePdfInBackground).toHaveBeenCalled();
    expect(parseJob.moveToCompleted).toHaveBeenCalledWith(
      'ok',
      'lock-token',
      false,
    );
    expect(connections.create).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('checked every 60000ms'),
    );

    await intervals[1]();
    expect(manual.moveStalledJobsToWait.mock.calls.length).toBeGreaterThan(2);

    manual.on.mock.calls.find(([event]) => event === 'error')?.[1](
      new Error(`worker ${REDIS_URL}`),
    );
    expect(errorSpy.mock.calls.join(' ')).toContain('redis://redacted');
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');

    await worker.close();
    expect(manual.close).toHaveBeenCalled();
    await intervals[1]();
    await worker.ensureStarted();
    expect(fetch.mock.calls.length).toBeGreaterThan(0);
  });

  it('records job failures and keeps a failed record when Redis rejects it', async () => {
    const failing = job({
      moveToFailed: jest
        .fn()
        .mockRejectedValueOnce(new Error('record down'))
        .mockResolvedValue(undefined),
    });
    const textFailure = job({ id: 'job-2', token: undefined });
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(failing)
      .mockResolvedValueOnce(textFailure)
      .mockResolvedValue(undefined);
    const importService = {
      runEnrichUploadInBackground: jest
        .fn()
        .mockRejectedValueOnce(new Error('deepseek down'))
        .mockRejectedValueOnce('not-an-error'),
      runParsePdfInBackground: jest.fn(),
    } as unknown as ImportService;
    const worker = new ImportQueueWorker(
      enabledSettings(),
      {
        create: jest.fn().mockReturnValue(readyConnection()),
      } as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest
          .fn()
          .mockResolvedValueOnce({ examined: 1, failed: 0, spared: 0 })
          .mockRejectedValueOnce(new Error('mongo down')),
      } as unknown as ImportQueueRecovery,
      importService,
      () => ({
        getNextJob: fetch,
        moveStalledJobsToWait: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockRejectedValue(new Error(`close ${REDIS_URL}`)),
        on: jest.fn(),
      }),
    );

    await worker.onModuleInit();
    expect(failing.moveToFailed).toHaveBeenCalled();
    expect(textFailure.moveToFailed).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(String),
      false,
    );
    await intervals[0]();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Stale upload recovery failed'),
    );
    await worker.close();
    expect(errorSpy.mock.calls.join(' ')).toContain('redis://redacted');
  });

  it('extends the job lock on the poll interval and reports a failed extension', async () => {
    let releaseJob: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
      releaseJob = resolve;
    });
    const active = job({
      extendLock: jest.fn().mockRejectedValue(new Error(`lock ${REDIS_URL}`)),
    });
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(active)
      .mockResolvedValue(undefined);
    const worker = new ImportQueueWorker(
      enabledSettings(),
      {
        create: jest.fn().mockReturnValue(readyConnection()),
      } as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest.fn().mockResolvedValue({
          examined: 0,
          failed: 0,
          spared: 0,
        }),
      } as unknown as ImportQueueRecovery,
      {
        runEnrichUploadInBackground: () => gate,
        runParsePdfInBackground: jest.fn(),
      } as unknown as ImportService,
      () => ({
        getNextJob: fetch,
        moveStalledJobsToWait: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }),
    );

    const pending = worker.onModuleInit();
    for (let attempt = 0; attempt < 10 && intervals.length < 3; attempt += 1) {
      await new Promise(resolve => setImmediate(resolve));
    }
    await intervals[2]?.();
    releaseJob();
    await pending;
    expect(active.extendLock).toHaveBeenCalled();
    expect(errorSpy.mock.calls.join(' ')).toContain('redis://redacted');
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');
    await worker.close();
  });

  it('logs a poll error and retries when Redis is briefly unavailable', async () => {
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error(`fetch ${REDIS_URL}`))
      .mockResolvedValue(undefined);
    const worker = new ImportQueueWorker(
      enabledSettings(),
      {
        create: jest.fn().mockReturnValue({
          status: 'wait',
          connect: jest.fn().mockRejectedValue(new Error('offline')),
          once: jest.fn(),
          off: jest.fn(),
        }),
      } as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest.fn().mockResolvedValue({
          examined: 0,
          failed: 0,
          spared: 0,
        }),
      } as unknown as ImportQueueRecovery,
      {} as ImportService,
      () => ({
        getNextJob: fetch,
        moveStalledJobsToWait: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }),
    );

    await worker.onModuleInit();
    expect(errorSpy.mock.calls.join(' ')).toContain('redis://redacted');
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('could not reach Redis'),
    );
    await worker.close();
  });

  it('runs another pass when a job arrives while a poll is already in progress', async () => {
    let duringPoll: (() => Promise<void>) | undefined;
    const fetch = jest.fn().mockImplementation(async () => {
      if (duringPoll) {
        const followUp = duringPoll;
        duringPoll = undefined;
        await followUp();
      }
      return undefined;
    });
    const worker = new ImportQueueWorker(
      enabledSettings(),
      {
        create: jest.fn().mockReturnValue(readyConnection()),
      } as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest.fn().mockResolvedValue({
          examined: 0,
          failed: 0,
          spared: 0,
        }),
      } as unknown as ImportQueueRecovery,
      {} as ImportService,
      () => ({
        getNextJob: fetch,
        moveStalledJobsToWait: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }),
    );
    duringPoll = () => worker.ensureStarted();

    await worker.onModuleInit();
    expect(fetch.mock.calls.length).toBeGreaterThan(2);
    await worker.close();
  });

  it('does not start the BullMQ blocking loop', async () => {
    const worker = new ImportQueueWorker(
      enabledSettings(),
      {
        create: jest.fn().mockReturnValue(readyConnection()),
      } as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest.fn().mockResolvedValue({
          examined: 0,
          failed: 0,
          spared: 0,
        }),
      } as unknown as ImportQueueRecovery,
      {} as ImportService,
    );

    await worker.onModuleInit();
    expect(Worker).toHaveBeenCalledWith(
      'ezprep-import-parse',
      null,
      expect.objectContaining({
        autorun: false,
        prefix: '{ezprep}:bull',
        stalledInterval: 60_000,
      }),
    );
    const created = (Worker as unknown as jest.Mock).mock.results[0].value as {
      run?: jest.Mock;
    };
    expect(created.run).toBeUndefined();
    await worker.close();
  });

  it('records a nameless failed job when the failure itself cannot be stored', async () => {
    const unnamed = job({
      id: undefined,
      extendLock: jest.fn().mockRejectedValue(new Error('lock lost')),
      moveToFailed: jest.fn().mockRejectedValue(new Error('record down')),
    });
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(unnamed)
      .mockResolvedValue(undefined);
    const worker = new ImportQueueWorker(
      enabledSettings(),
      {
        create: jest.fn().mockReturnValue(readyConnection()),
      } as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest.fn().mockResolvedValue({
          examined: 0,
          failed: 0,
          spared: 0,
        }),
      } as unknown as ImportQueueRecovery,
      {
        runEnrichUploadInBackground: jest
          .fn()
          .mockRejectedValue(new Error('enrich failed')),
        runParsePdfInBackground: jest.fn(),
      } as unknown as ImportService,
      () => ({
        getNextJob: fetch,
        moveStalledJobsToWait: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }),
    );

    const pending = worker.onModuleInit();
    for (let attempt = 0; attempt < 10 && intervals.length < 3; attempt += 1) {
      await new Promise(resolve => setImmediate(resolve));
    }
    await intervals[2]?.();
    await pending;
    expect(errorSpy.mock.calls.join(' ')).toContain('unknown');
    await worker.close();
  });

  it('stops a poll that is closed while a job is being fetched', async () => {
    const manual = {
      getNextJob: jest.fn().mockResolvedValue(undefined),
      moveStalledJobsToWait: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    const worker = new ImportQueueWorker(
      enabledSettings(),
      {
        create: jest.fn().mockReturnValue(readyConnection()),
      } as unknown as RedisConnectionRegistry,
      {
        recoverStaleUploads: jest.fn().mockResolvedValue({
          examined: 0,
          failed: 0,
          spared: 0,
        }),
      } as unknown as ImportQueueRecovery,
      {
        runEnrichUploadInBackground: jest.fn().mockResolvedValue(undefined),
        runParsePdfInBackground: jest.fn(),
      } as unknown as ImportService,
      () => manual,
    );
    manual.moveStalledJobsToWait.mockImplementationOnce(async () => {
      await worker.close();
      throw new Error('stalled down');
    });
    await worker.onModuleInit();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('stalled down'),
    );
  });
});
