import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Queue } from 'bullmq';
import {
  BullImportJobPublisher,
  createImportJobPublisher,
  QueueFactory,
} from './bull-import-job.publisher';
import { RedisConnectionRegistry } from '../redis/redis-connection.registry';
import { resolveRedisSettings } from '../redis/redis.settings';

const REDIS_URL = 'rediss://default:secret@example.upstash.io:6379';
const UPLOAD_ID = '507f1f77bcf86cd799439011';

jest.mock('bullmq', () => {
  const actual = jest.requireActual('bullmq');
  return {
    ...actual,
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'default-job' }),
      getJob: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    })),
  };
});

function settings() {
  return resolveRedisSettings({
    REDIS_URL,
    INSTANCE_ID: 'ezprep',
    QUEUE_WORKER_ENABLED: 'false',
    REDIS_CONNECT_TIMEOUT_MS: '100',
  });
}

describe('BullImportJobPublisher', () => {
  const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds the real BullMQ queue when no factory is injected', async () => {
    const publisher = createImportJobPublisher(settings(), {
      create: () => ({
        status: 'ready',
        connect: async () => undefined,
        once: jest.fn(),
        off: jest.fn(),
      }),
    } as unknown as RedisConnectionRegistry);
    await expect(publisher?.enqueueEnrich(UPLOAD_ID, {})).resolves.toBe(
      'default-job',
    );
    expect(Queue).toHaveBeenCalledWith(
      'ezprep-import-enrich',
      expect.objectContaining({ prefix: '{ezprep}:bull' }),
    );
  });

  it('starts the worker after a job is stored and keeps the job if startup fails', async () => {
    const publisher = new BullImportJobPublisher(
      settings(),
      {
        create: () => ({
          status: 'ready',
          connect: async () => undefined,
          once: jest.fn(),
          off: jest.fn(),
        }),
      } as unknown as RedisConnectionRegistry,
      () => ({
        add: async () => ({ id: 'stored-job' }),
        getJob: async () => undefined,
        close: async () => undefined,
        on: jest.fn(),
      }),
    );
    const wake = jest.fn().mockRejectedValue(new Error('worker down'));
    publisher.setOnEnqueued(wake);

    await expect(publisher.enqueueEnrich(UPLOAD_ID, {})).resolves.toBe(
      'stored-job',
    );
    await new Promise(resolve => setImmediate(resolve));
    expect(wake).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('did not start'),
    );
  });

  it('returns the job id before the worker finishes the upload', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const publisher = new BullImportJobPublisher(
      settings(),
      {
        create: () => ({
          status: 'ready',
          connect: async () => undefined,
          once: jest.fn(),
          off: jest.fn(),
        }),
      } as unknown as RedisConnectionRegistry,
      () => ({
        add: async () => ({ id: 'stored-job' }),
        getJob: async () => undefined,
        close: async () => undefined,
        on: jest.fn(),
      }),
    );
    publisher.setOnEnqueued(() => gate);

    await expect(publisher.enqueueEnrich(UPLOAD_ID, {})).resolves.toBe(
      'stored-job',
    );
    release();
    await gate;
  });

  it('does nothing until Redis is configured', () => {
    expect(
      createImportJobPublisher(
        resolveRedisSettings({ INSTANCE_ID: 'ezprep' }),
        {} as RedisConnectionRegistry,
      ),
    ).toBeNull();
  });

  it('enqueues instance-scoped jobs and reuses each queue connection', async () => {
    const created: Array<{ name: string; options: { prefix: string } }> = [];
    const handles = new Map<
      string,
      {
        add: jest.Mock;
        getJob: jest.Mock;
        close: jest.Mock;
        on: jest.Mock;
        listeners: Record<string, (error: Error) => void>;
      }
    >();
    const createQueue: QueueFactory = (name, options) => {
      created.push({ name, options: options as { prefix: string } });
      const listeners: Record<string, (error: Error) => void> = {};
      const handle = {
        add: jest.fn().mockResolvedValue({ id: `${name}-job` }),
        getJob: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn((event: string, listener: (error: Error) => void) => {
          listeners[event] = listener;
        }),
        listeners,
      };
      handles.set(name, handle);
      return handle;
    };
    const connections = {
      create: jest.fn().mockReturnValue({
        status: 'ready',
        connect: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
      }),
    } as unknown as RedisConnectionRegistry;
    const publisher = new BullImportJobPublisher(
      settings(),
      connections,
      createQueue,
    );

    const enrichA = await publisher.enqueueEnrich(UPLOAD_ID, {
      forceReparse: true,
    });
    const enrichB = await publisher.enqueueEnrich(UPLOAD_ID, {});
    const parseId = await publisher.enqueueParse(UPLOAD_ID, {
      maxPollingAttempts: 4,
    });

    expect(enrichA).toContain('ezprep-import-enrich');
    expect(enrichB).toContain('ezprep-import-enrich');
    expect(parseId).toContain('ezprep-import-parse');
    expect(created).toHaveLength(2);
    expect(created[0].options.prefix).toBe('{ezprep}:bull');
    expect(connections.create).toHaveBeenCalledTimes(1);
    expect(connections.create).toHaveBeenCalledWith('producer');

    const enrich = handles.get('ezprep-import-enrich');
    expect(enrich?.add.mock.calls[0][0]).toBe('import-enrich');
    expect(enrich?.add.mock.calls[0][1]).toMatchObject({
      uploadId: UPLOAD_ID,
      forceReparse: true,
    });
    expect(enrich?.add.mock.calls[0][2].jobId).toMatch(
      /^import-enrich-507f1f77bcf86cd799439011-/,
    );
    expect(String(enrich?.add.mock.calls[0][2].jobId)).not.toContain(':');

    enrich?.listeners.error(new Error(`queue ${REDIS_URL}`));
    expect(errorSpy.mock.calls.join(' ')).toContain('redis://redacted');
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');

    await expect(
      publisher.getJobState('import-enrich', 'missing'),
    ).resolves.toBeNull();
    enrich!.getJob.mockResolvedValueOnce({
      getState: async () => 'active',
    });
    await expect(publisher.getJobState('import-enrich', 'live')).resolves.toBe(
      'active',
    );

    enrich!.close.mockRejectedValueOnce(new Error(`close ${REDIS_URL}`));
    await publisher.close();
    await publisher.close();
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');
  });

  it('rejects an enqueue that Redis accepted without an id', async () => {
    const publisher = new BullImportJobPublisher(
      settings(),
      {
        create: () => ({
          status: 'ready',
          connect: async () => undefined,
          once: jest.fn(),
          off: jest.fn(),
        }),
      } as unknown as RedisConnectionRegistry,
      () => ({
        add: async () => ({}),
        getJob: async () => undefined,
        close: async () => undefined,
        on: jest.fn(),
      }),
    );
    await expect(publisher.enqueueParse(UPLOAD_ID, {})).rejects.toThrow(
      /accepted no id/,
    );
  });

  it('fails fast when Redis does not become ready', async () => {
    const client = new EventEmitter() as EventEmitter & {
      status: string;
      connect: jest.Mock;
    };
    client.status = 'connecting';
    client.connect = jest.fn();
    const publisher = new BullImportJobPublisher(settings(), {
      create: () => client,
    } as unknown as RedisConnectionRegistry);
    await expect(publisher.enqueueEnrich(UPLOAD_ID, {})).rejects.toThrow(
      'Redis did not become ready in time',
    );
  });
});
