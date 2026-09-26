import type { RedisOptions } from 'ioredis';
import { RedisSettings } from './redis.settings';

export type RedisClientRole = 'command' | 'producer' | 'worker';

/**
 * BullMQ blocking commands require `maxRetriesPerRequest: null`.
 * A command timeout is only safe on the short-lived health client;
 * a timeout on a worker connection aborts long-polling.
 * The ioredis `keyPrefix` option is intentionally unused. It would
 * prefix BullMQ's Lua keys a second time and break the queue scripts.
 * Isolation uses the BullMQ `prefix` option instead.
 */
export function buildRedisOptions(
  settings: RedisSettings,
  role: RedisClientRole,
): RedisOptions {
  const blocking = role !== 'command';
  return {
    maxRetriesPerRequest: blocking ? null : 1,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: settings.connectTimeoutMs,
    keepAlive: settings.keepAliveMs,
    connectionName: `${settings.instanceId}:${role}`,
    ...(blocking ? {} : { commandTimeout: settings.commandTimeoutMs }),
    retryStrategy: (times: number) => Math.min(times * 200, 2_000),
  };
}
