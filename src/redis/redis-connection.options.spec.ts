import { buildRedisOptions } from './redis-connection.options';
import { resolveRedisSettings } from './redis.settings';

describe('buildRedisOptions', () => {
  const settings = resolveRedisSettings({
    REDIS_URL: 'rediss://default:secret@example.upstash.io:6379',
    INSTANCE_ID: 'ezprep',
    REDIS_CONNECT_TIMEOUT_MS: '1500',
    REDIS_COMMAND_TIMEOUT_MS: '800',
    REDIS_KEEP_ALIVE_MS: '1000',
  });

  it('keeps blocking BullMQ clients free of command timeouts', () => {
    for (const role of ['producer', 'worker'] as const) {
      const options = buildRedisOptions(settings, role);
      expect(options.maxRetriesPerRequest).toBeNull();
      expect(options.commandTimeout).toBeUndefined();
      expect(options.enableReadyCheck).toBe(false);
      expect(options.lazyConnect).toBe(true);
      expect(options.connectionName).toBe(`ezprep:${role}`);
      expect(options.keyPrefix).toBeUndefined();
      expect(options.connectTimeout).toBe(1500);
      expect(options.keepAlive).toBe(1000);
      expect(options.retryStrategy?.(1)).toBe(200);
      expect(options.retryStrategy?.(100)).toBe(2000);
    }
  });

  it('bounds the health client so a probe cannot hang', () => {
    const options = buildRedisOptions(settings, 'command');
    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.commandTimeout).toBe(800);
  });
});
