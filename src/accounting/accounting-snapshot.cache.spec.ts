import { ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConnectionRegistry } from '../redis/redis-connection.registry';
import { RedisKeyBuilder } from '../redis/redis-key.builder';
import { RedisSettings } from '../redis/redis.settings';
import { AccountingSnapshotCache } from './accounting-snapshot.cache';
import { AccountingOverviewBody } from './accounting.types';

const BODY: AccountingOverviewBody = {
  people: { paidUsers: 2, freeUsers: 3, learners: 5 },
  entitlements: { issued: 4, active: 2, expired: 1, revoked: 1 },
  orders: {
    paid: 2,
    refunded: 1,
    pending: 0,
    failed: 0,
    expired: 0,
    cancelled: 0,
  },
  catalog: {
    products: { published: 1, draft: 0, archived: 0 },
    offers: { active: 1, inactive: 0 },
  },
  money: {
    paymentsReceived: [{ currency: 'INR', amountPaise: 100000 }],
    refundsIssued: [{ currency: 'INR', amountPaise: 0 }],
    duplicateCaptureRefunds: [{ currency: 'INR', amountPaise: 0 }],
    netReceipts: [{ currency: 'INR', amountPaise: 100000 }],
    taxOnPaidOrders: [{ currency: 'INR', amountPaise: 0 }],
    invoicesIssued: 2,
  },
};

class MemoryRedis {
  status = 'wait';
  readonly values = new Map<string, string>();

  connect(): Promise<void> {
    this.status = 'ready';
    return Promise.resolve();
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(
    key: string,
    value: string,
    ...rest: Array<string | number>
  ): Promise<string | null> {
    if (rest.includes('NX') && this.values.has(key)) {
      return Promise.resolve(null);
    }
    this.values.set(key, value);
    return Promise.resolve('OK');
  }

  del(key: string): Promise<number> {
    this.values.delete(key);
    return Promise.resolve(1);
  }
}

function settings(enabled: boolean): RedisSettings {
  return {
    enabled,
    keyPrefix: 'ezprep',
  } as RedisSettings;
}

function createCache(redis?: MemoryRedis, enabled = true) {
  const registry = {
    create: jest.fn(() => redis as unknown as Redis),
  } as unknown as RedisConnectionRegistry;
  return new AccountingSnapshotCache(
    settings(enabled && Boolean(redis)),
    registry,
    new RedisKeyBuilder(settings(true)),
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('AccountingSnapshotCache', () => {
  it('does not recompute a fresh in-memory snapshot', async () => {
    const cache = createCache(undefined, false);
    const compute = jest.fn().mockResolvedValue(BODY);

    await cache.get(compute);
    await cache.get(compute);

    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('runs one compute when two callers miss together', async () => {
    const cache = createCache(undefined, false);
    let release: (value: AccountingOverviewBody) => void = () => undefined;
    const compute = jest.fn(
      () =>
        new Promise<AccountingOverviewBody>(resolve => {
          release = resolve;
        }),
    );

    const first = cache.get(compute);
    const second = cache.get(compute);
    await delay(20);

    expect(compute).toHaveBeenCalledTimes(1);
    release(BODY);
    const [left, right] = await Promise.all([first, second]);
    expect(left.people).toEqual(BODY.people);
    expect(right.computedAt).toBe(left.computedAt);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh Redis snapshot to another instance without querying again', async () => {
    const redis = new MemoryRedis();
    const first = createCache(redis);
    const second = createCache(redis);
    const compute = jest.fn().mockResolvedValue(BODY);

    await first.get(compute);
    await second.get(compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(redis.values.size).toBeGreaterThan(0);
  });

  it('does not start a second compute while another instance holds the lock', async () => {
    const redis = new MemoryRedis();
    const leader = createCache(redis);
    const follower = createCache(redis);
    let release: (value: AccountingOverviewBody) => void = () => undefined;
    const compute = jest.fn(
      () =>
        new Promise<AccountingOverviewBody>(resolve => {
          release = resolve;
        }),
    );

    const leading = leader.get(compute);
    await delay(20);
    const following = follower.get(compute);
    await delay(20);

    expect(compute).toHaveBeenCalledTimes(1);
    release(BODY);
    await leading;
    await expect(following).resolves.toMatchObject({ people: BODY.people });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('returns a stale snapshot immediately and refreshes it once', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-11T00:00:00.000Z') });
    try {
      const cache = createCache(undefined, false);
      const compute = jest.fn().mockResolvedValue(BODY);

      const first = await cache.get(compute);
      expect(first.computedAt).toBe('2026-10-11T00:00:00.000Z');

      jest.setSystemTime(new Date('2026-10-11T01:30:00.000Z'));
      const stale = await cache.get(compute);
      expect(stale.computedAt).toBe(first.computedAt);

      await jest.advanceTimersByTimeAsync(0);
      const refreshed = await cache.get(compute);
      expect(refreshed.computedAt).toBe('2026-10-11T01:30:00.000Z');
      expect(compute).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to memory when Redis commands fail', async () => {
    const redis = new MemoryRedis();
    redis.get = () => Promise.reject(new Error('redis down'));
    redis.set = () => Promise.reject(new Error('redis down'));
    const cache = createCache(redis);
    const compute = jest.fn().mockResolvedValue(BODY);

    const overview = await cache.get(compute);
    const again = await cache.get(compute);

    expect(overview.money.paymentsReceived[0].amountPaise).toBe(100000);
    expect(again.computedAt).toBe(overview.computedAt);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('rejects a waiter when the lock holder never publishes a snapshot', async () => {
    jest.useFakeTimers();
    try {
      const redis = new MemoryRedis();
      redis.values.set('ezprep:cache:accounting:overview-lock', 'held');
      const cache = createCache(redis);
      const compute = jest.fn().mockResolvedValue(BODY);
      const pending = cache.get(compute);
      const assertion = expect(pending).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await jest.advanceTimersByTimeAsync(ACCOUNTING_WAIT_MS);
      await assertion;
      expect(compute).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

const ACCOUNTING_WAIT_MS = 200 * 75 + 1000;
