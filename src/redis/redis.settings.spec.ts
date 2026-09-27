import { queueName } from './queue-name';
import { readRedisEnv, resolveRedisSettings } from './redis.settings';

const REDIS_URL = 'rediss://default:secret@example.upstash.io:6379';

describe('resolveRedisSettings', () => {
  it('stays disabled until a Redis URL is configured', () => {
    const settings = resolveRedisSettings({ INSTANCE_ID: 'EzPrep' });
    expect(settings.enabled).toBe(false);
    expect(settings.queueDriver).toBe('memory');
    expect(settings.workerEnabled).toBe(false);
    expect(settings.instanceId).toBe('ezprep');
    expect(settings.keyPrefix).toBe('ezprep');
    expect(settings.bullPrefix).toBe('{ezprep}:bull');
    expect(settings.url).toBe('');
    expect(settings.parseConcurrency).toBe(2);
    expect(settings.enrichConcurrency).toBe(2);
    expect(settings.attempts).toBe(3);
    expect(settings.staleJobMs).toBe(1_800_000);
    expect(settings.recoveryIntervalMs).toBe(60_000);
    expect(settings.pollIntervalMs).toBe(60_000);
  });

  it('treats a blank Redis URL as disabled', () => {
    expect(resolveRedisSettings({ REDIS_URL: '   ' }).enabled).toBe(false);
  });

  it('uses local as the namespace when Redis and INSTANCE_ID are unset', () => {
    expect(resolveRedisSettings({}).instanceId).toBe('local');
  });

  it('requires INSTANCE_ID once Redis is enabled', () => {
    expect(() => resolveRedisSettings({ REDIS_URL })).toThrow(
      'INSTANCE_ID is required when REDIS_URL is set',
    );
  });

  it('rejects an instance id that cannot be used as a key prefix', () => {
    expect(() =>
      resolveRedisSettings({ REDIS_URL, INSTANCE_ID: 'EZ Prep' }),
    ).toThrow(/INSTANCE_ID/);
  });

  it('isolates two deployments by URL and prefix', () => {
    const ezprep = resolveRedisSettings({
      REDIS_URL,
      INSTANCE_ID: 'ezprep',
    });
    const examflex = resolveRedisSettings({
      REDIS_URL: 'rediss://default:other@examflex.upstash.io:6379',
      INSTANCE_ID: 'examflex',
      REDIS_KEY_PREFIX: 'ExamFlex',
    });

    expect(ezprep.url).not.toBe(examflex.url);
    expect(ezprep.bullPrefix).toBe('{ezprep}:bull');
    expect(examflex.keyPrefix).toBe('examflex');
    expect(examflex.bullPrefix).toBe('{examflex}:bull');
    expect(queueName(ezprep.keyPrefix, 'import-enrich')).toBe(
      'ezprep-import-enrich',
    );
    expect(queueName(examflex.keyPrefix, 'import-enrich')).toBe(
      'examflex-import-enrich',
    );
  });

  it('accepts redis and rediss URLs and a custom hash-tagged prefix', () => {
    const settings = resolveRedisSettings({
      REDIS_URL: 'redis://127.0.0.1:6379',
      INSTANCE_ID: 'ezprep',
      BULLMQ_PREFIX: '{shared}:bull',
      QUEUE_WORKER_ENABLED: 'no',
      REDIS_CONNECT_TIMEOUT_MS: '250',
      REDIS_KEEP_ALIVE_MS: '0',
      IMPORT_QUEUE_BACKOFF_MS: '0',
      IMPORT_QUEUE_MAX_STALLED_COUNT: '0',
    });
    expect(settings.enabled).toBe(true);
    expect(settings.workerEnabled).toBe(false);
    expect(settings.bullPrefix).toBe('{shared}:bull');
    expect(settings.connectTimeoutMs).toBe(250);
    expect(settings.keepAliveMs).toBe(0);
    expect(settings.backoffDelayMs).toBe(0);
    expect(settings.maxStalledCount).toBe(0);
  });

  it('turns the worker on outside tests unless the flag says otherwise', () => {
    const enabled = resolveRedisSettings({
      REDIS_URL,
      INSTANCE_ID: 'ezprep',
      NODE_ENV: 'production',
    });
    const tests = resolveRedisSettings({
      REDIS_URL,
      INSTANCE_ID: 'ezprep',
      NODE_ENV: 'test',
    });
    const forced = resolveRedisSettings({
      REDIS_URL,
      INSTANCE_ID: 'ezprep',
      NODE_ENV: 'test',
      QUEUE_WORKER_ENABLED: 'true',
    });
    expect(enabled.workerEnabled).toBe(true);
    expect(enabled.queueDriver).toBe('bullmq');
    expect(tests.workerEnabled).toBe(false);
    expect(forced.workerEnabled).toBe(true);
    for (const value of ['1', 'yes', 'on']) {
      expect(
        resolveRedisSettings({
          REDIS_URL,
          INSTANCE_ID: 'ezprep',
          QUEUE_WORKER_ENABLED: value,
        }).workerEnabled,
      ).toBe(true);
    }
    for (const value of ['0', 'false', 'off']) {
      expect(
        resolveRedisSettings({
          REDIS_URL,
          INSTANCE_ID: 'ezprep',
          QUEUE_WORKER_ENABLED: value,
        }).workerEnabled,
      ).toBe(false);
    }
  });

  it('keeps Redis connected while the import queue stays in-process', () => {
    const settings = resolveRedisSettings({
      REDIS_URL,
      INSTANCE_ID: 'ezprep',
      NODE_ENV: 'production',
      IMPORT_QUEUE_DRIVER: 'memory',
    });
    expect(settings.enabled).toBe(true);
    expect(settings.queueDriver).toBe('memory');
    expect(settings.workerEnabled).toBe(false);

    expect(
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        IMPORT_QUEUE_DRIVER: 'in-memory',
      }).queueDriver,
    ).toBe('memory');
    expect(
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        NODE_ENV: 'production',
        IMPORT_QUEUE_DRIVER: 'bullmq',
      }).queueDriver,
    ).toBe('bullmq');
    expect(() =>
      resolveRedisSettings({
        INSTANCE_ID: 'ezprep',
        IMPORT_QUEUE_DRIVER: 'bullmq',
      }),
    ).toThrow(/requires REDIS_URL/);
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        IMPORT_QUEUE_DRIVER: 'kafka',
      }),
    ).toThrow(/must be memory or bullmq/);
  });

  it('rejects malformed Redis URLs without echoing the secret', () => {
    expect(() =>
      resolveRedisSettings({ REDIS_URL: 'not a url', INSTANCE_ID: 'ezprep' }),
    ).toThrow('REDIS_URL is not a valid URL');
    expect(() =>
      resolveRedisSettings({
        REDIS_URL: 'https://default:secret@example.com',
        INSTANCE_ID: 'ezprep',
      }),
    ).toThrow('REDIS_URL must use the redis:// or rediss:// scheme');
    try {
      resolveRedisSettings({
        REDIS_URL: 'redis:///missing-host',
        INSTANCE_ID: 'ezprep',
      });
      fail('expected a host error');
    } catch (error) {
      expect((error as Error).message).toBe('REDIS_URL must include a host');
      expect((error as Error).message).not.toContain('secret');
    }
  });

  it('rejects prefixes that would break key isolation', () => {
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        REDIS_KEY_PREFIX: 'bad prefix',
      }),
    ).toThrow(/REDIS_KEY_PREFIX/);
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        BULLMQ_PREFIX: 'bull',
      }),
    ).toThrow(/hash tag/);
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        BULLMQ_PREFIX: '{}:bull',
      }),
    ).toThrow(/hash tag/);
  });

  it('rejects integers outside their allowed range', () => {
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        IMPORT_PARSE_CONCURRENCY: '0',
      }),
    ).toThrow(/IMPORT_PARSE_CONCURRENCY/);
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        IMPORT_ENRICH_CONCURRENCY: '1.5',
      }),
    ).toThrow(/must be an integer/);
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        QUEUE_WORKER_ENABLED: 'maybe',
      }),
    ).toThrow(/boolean/);
    expect(() =>
      resolveRedisSettings({
        REDIS_URL,
        INSTANCE_ID: 'ezprep',
        IMPORT_QUEUE_POLL_INTERVAL_MS: '1000',
      }),
    ).toThrow(/IMPORT_QUEUE_POLL_INTERVAL_MS/);
  });
});

describe('readRedisEnv', () => {
  it('copies only values the config service actually has', () => {
    const env = readRedisEnv({
      get: key => (key === 'INSTANCE_ID' ? 'ezprep' : undefined),
    });
    expect(env).toEqual({ INSTANCE_ID: 'ezprep' });
  });
});
