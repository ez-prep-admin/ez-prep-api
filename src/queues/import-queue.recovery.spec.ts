import { Logger } from '@nestjs/common';
import { ImportJobPublisher } from './bull-import-job.publisher';
import { ImportQueueRecovery } from './import-queue.recovery';
import { resolveRedisSettings } from '../redis/redis.settings';

const REDIS_URL = 'rediss://default:secret@example.upstash.io:6379';

function settings(enabled = true) {
  return resolveRedisSettings(
    enabled
      ? { REDIS_URL, INSTANCE_ID: 'ezprep', QUEUE_WORKER_ENABLED: 'true' }
      : { INSTANCE_ID: 'ezprep' },
  );
}

function upload(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'upload-1',
    status: 'processing',
    updatedAt: new Date('2020-01-01'),
    ...overrides,
  };
}

function modelFor(batches: unknown[][]) {
  const find = jest.fn();
  batches.forEach(batch => {
    find.mockReturnValueOnce({
      sort: () => ({
        limit: () => ({
          exec: async () => batch,
        }),
      }),
    });
  });
  find.mockReturnValue({
    sort: () => ({
      limit: () => ({
        exec: async () => [],
      }),
    }),
  });
  return {
    find,
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: async () => ({ _id: 'claimed' }),
    }),
  };
}

describe('ImportQueueRecovery', () => {
  const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips recovery when Redis is not configured', async () => {
    const model = modelFor([[]]);
    const recovery = new ImportQueueRecovery(
      settings(false),
      null,
      model as never,
    );
    await expect(recovery.recoverStaleUploads()).resolves.toEqual({
      examined: 0,
      failed: 0,
      spared: 0,
    });
    expect(model.find).not.toHaveBeenCalled();
  });

  it('fails stale uploads whose queue job is gone', async () => {
    const stale = upload();
    const parsing = upload({
      _id: 'upload-2',
      status: 'parsing',
      activeJobId: 'job-2',
      activeJobName: 'import-parse',
    });
    const model = modelFor([[stale, parsing]]);
    const publisher: ImportJobPublisher = {
      enqueueEnrich: jest.fn(),
      enqueueParse: jest.fn(),
      getJobState: jest.fn().mockResolvedValue('completed'),
      close: jest.fn(),
    };
    const recovery = new ImportQueueRecovery(
      settings(),
      publisher,
      model as never,
    );

    const now = new Date('2026-01-01T00:00:00.000Z');
    await expect(recovery.recoverStaleUploads(now)).resolves.toEqual({
      examined: 2,
      failed: 2,
      spared: 0,
    });
    expect(publisher.getJobState).not.toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
    expect(publisher.getJobState).toHaveBeenCalledWith('import-parse', 'job-2');
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'upload-1', status: 'processing' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Enrichment interrupted by server restart',
        }),
      }),
    );
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'upload-2', status: 'parsing' },
      expect.objectContaining({
        $set: expect.objectContaining({
          errorMessage: 'PDF parsing interrupted by server restart',
        }),
      }),
    );
    const filter = model.find.mock.calls[0][0];
    expect(filter.updatedAt.$lt.getTime()).toBe(
      now.getTime() - settings().staleJobMs,
    );
  });

  it('leaves uploads alone while their job is still queued or Redis cannot be inspected', async () => {
    const live = upload({
      activeJobId: 'live',
      activeJobName: 'import-enrich',
    });
    const unknown = upload({ _id: 'upload-3', activeJobId: 'missing' });
    const model = modelFor([[live, unknown]]);
    const publisher: ImportJobPublisher = {
      enqueueEnrich: jest.fn(),
      enqueueParse: jest.fn(),
      getJobState: jest
        .fn()
        .mockResolvedValueOnce('waiting')
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error(`lookup ${REDIS_URL}`)),
      close: jest.fn(),
    };
    const recovery = new ImportQueueRecovery(
      settings(),
      publisher,
      model as never,
    );

    await expect(recovery.recoverStaleUploads()).resolves.toEqual({
      examined: 2,
      failed: 0,
      spared: 2,
    });
    expect(model.find.mock.calls[1][0]._id.$nin).toEqual([
      'upload-1',
      'upload-3',
    ]);
    expect(publisher.getJobState).toHaveBeenCalledWith(
      'import-enrich',
      'missing',
    );
    expect(publisher.getJobState).toHaveBeenCalledWith(
      'import-parse',
      'missing',
    );
    expect(warnSpy.mock.calls.join(' ')).toContain('redis://redacted');
    expect(warnSpy.mock.calls.join(' ')).not.toContain('secret');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not count a claim that another worker already took', async () => {
    const model = modelFor([[upload({ activeJobId: 'gone' })]]);
    model.findOneAndUpdate.mockReturnValue({ exec: async () => null });
    const publisher: ImportJobPublisher = {
      enqueueEnrich: jest.fn(),
      enqueueParse: jest.fn(),
      getJobState: jest.fn().mockResolvedValue(null),
      close: jest.fn(),
    };
    const recovery = new ImportQueueRecovery(
      settings(),
      publisher,
      model as never,
    );
    await expect(recovery.recoverStaleUploads()).resolves.toMatchObject({
      examined: 1,
      failed: 0,
    });
  });

  it('stops after the batch limit when stale uploads keep appearing', async () => {
    const find = jest.fn().mockReturnValue({
      sort: () => ({
        limit: () => ({
          exec: async () => [upload()],
        }),
      }),
    });
    const model = {
      find,
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: async () => ({ _id: 'claimed' }),
      }),
    };
    const recovery = new ImportQueueRecovery(
      settings(),
      {
        enqueueEnrich: jest.fn(),
        enqueueParse: jest.fn(),
        getJobState: jest.fn(),
        close: jest.fn(),
      },
      model as never,
    );
    await expect(recovery.recoverStaleUploads()).resolves.toMatchObject({
      examined: 20,
      failed: 20,
    });
  });
});
