import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_SETTINGS } from '../redis/redis.constants';
import { RedisConnectionRegistry } from '../redis/redis-connection.registry';
import { RedisKeyBuilder } from '../redis/redis-key.builder';
import { errorMessage } from '../redis/redis-log';
import { RedisSettings } from '../redis/redis.settings';
import {
  ACCOUNTING_FRESH_MS,
  ACCOUNTING_LOCK_SEC,
  ACCOUNTING_POLL_ATTEMPTS,
  ACCOUNTING_POLL_MS,
  ACCOUNTING_TTL_SEC,
} from './accounting.constants';
import { AccountingOverview, AccountingOverviewBody } from './accounting.types';

/**
 * One snapshot per hour, shared across API instances when Redis is configured.
 * A stale copy is returned immediately while a single refresh runs.
 * Redis blips fall back to the in-process copy instead of failing the page.
 */
@Injectable()
export class AccountingSnapshotCache {
  private readonly logger = new Logger(AccountingSnapshotCache.name);
  private readonly overviewKey: string;
  private readonly lockKey: string;
  private memory: AccountingOverview | null = null;
  private rememberedAt = 0;
  private clientPromise: Promise<Redis | null> | null = null;
  private missWait: Promise<AccountingOverview> | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(
    @Inject(REDIS_SETTINGS) private readonly settings: RedisSettings,
    private readonly registry: RedisConnectionRegistry,
    keys: RedisKeyBuilder,
  ) {
    this.overviewKey = keys.key('cache', 'accounting', 'overview');
    this.lockKey = keys.key('cache', 'accounting', 'overview-lock');
  }

  async get(
    compute: () => Promise<AccountingOverviewBody>,
  ): Promise<AccountingOverview> {
    const cached = await this.read();
    if (cached && this.isFresh(cached)) {
      return cached;
    }
    if (cached) {
      this.scheduleRefresh(compute);
      return cached;
    }
    if (!this.missWait) {
      this.missWait = this.computeWithLock(compute).finally(() => {
        this.missWait = null;
      });
    }
    return this.missWait;
  }

  private scheduleRefresh(compute: () => Promise<AccountingOverviewBody>) {
    if (this.refreshing || this.missWait) {
      return;
    }
    this.refreshing = this.refresh(compute)
      .catch((error: unknown) => {
        this.logger.warn(
          `Accounting snapshot refresh failed: ${errorMessage(error)}`,
        );
      })
      .finally(() => {
        this.refreshing = null;
      });
  }

  private async refresh(
    compute: () => Promise<AccountingOverviewBody>,
  ): Promise<void> {
    const token = await this.tryLock();
    if (!token) {
      return;
    }
    try {
      const overview = this.stamp(await compute());
      await this.write(overview);
    } finally {
      await this.unlock(token);
    }
  }

  private async computeWithLock(
    compute: () => Promise<AccountingOverviewBody>,
  ): Promise<AccountingOverview> {
    const token = await this.tryLock();
    if (!token) {
      const waited = await this.poll();
      if (waited) {
        return waited;
      }
      throw new ServiceUnavailableException(
        'Accounting overview is being calculated. Try again shortly.',
      );
    }
    try {
      const overview = this.stamp(await compute());
      await this.write(overview);
      return overview;
    } finally {
      await this.unlock(token);
    }
  }

  private stamp(body: AccountingOverviewBody): AccountingOverview {
    const computedAt = new Date();
    return {
      ...body,
      computedAt: computedAt.toISOString(),
      freshUntil: new Date(
        computedAt.getTime() + ACCOUNTING_FRESH_MS,
      ).toISOString(),
    };
  }

  private isFresh(snapshot: AccountingOverview): boolean {
    return Date.parse(snapshot.freshUntil) > Date.now();
  }

  private async read(): Promise<AccountingOverview | null> {
    const fromRedis = await this.readRedis();
    const fromMemory = this.readMemory();
    if (fromRedis && fromMemory) {
      return Date.parse(fromRedis.computedAt) >=
        Date.parse(fromMemory.computedAt)
        ? fromRedis
        : fromMemory;
    }
    if (fromRedis) {
      this.remember(fromRedis);
      return fromRedis;
    }
    return fromMemory;
  }

  private readMemory(): AccountingOverview | null {
    if (!this.memory) {
      return null;
    }
    if (Date.now() - this.rememberedAt > ACCOUNTING_TTL_SEC * 1000) {
      this.memory = null;
      return null;
    }
    return this.memory;
  }

  private remember(snapshot: AccountingOverview) {
    const computedAt = Date.parse(snapshot.computedAt);
    if (Number.isNaN(computedAt)) {
      return;
    }
    this.memory = snapshot;
    this.rememberedAt = computedAt;
  }

  private async write(snapshot: AccountingOverview) {
    this.remember(snapshot);
    try {
      const client = await this.redisClient();
      if (!client) {
        return;
      }
      await client.set(
        this.overviewKey,
        JSON.stringify(snapshot),
        'EX',
        ACCOUNTING_TTL_SEC,
      );
    } catch (error) {
      this.logger.warn(
        `Accounting snapshot was kept in memory after Redis write failed: ${errorMessage(error)}`,
      );
    }
  }

  private async readRedis(): Promise<AccountingOverview | null> {
    try {
      const client = await this.redisClient();
      if (!client) {
        return null;
      }
      const raw = await client.get(this.overviewKey);
      if (!raw) {
        return null;
      }
      return this.parse(raw);
    } catch (error) {
      this.logger.warn(
        `Accounting snapshot Redis read failed: ${errorMessage(error)}`,
      );
      return null;
    }
  }

  private parse(raw: string): AccountingOverview | null {
    try {
      const value = JSON.parse(raw) as AccountingOverview;
      if (
        !value ||
        typeof value.computedAt !== 'string' ||
        typeof value.freshUntil !== 'string' ||
        !value.people ||
        !value.entitlements ||
        !value.orders ||
        !value.catalog ||
        !value.money
      ) {
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  private async tryLock(): Promise<string | null> {
    const token = randomUUID();
    try {
      const client = await this.redisClient();
      if (!client) {
        return token;
      }
      const result = await client.set(
        this.lockKey,
        token,
        'EX',
        ACCOUNTING_LOCK_SEC,
        'NX',
      );
      return result === 'OK' ? token : null;
    } catch (error) {
      this.logger.warn(
        `Accounting snapshot lock failed open: ${errorMessage(error)}`,
      );
      return token;
    }
  }

  private async unlock(token: string) {
    try {
      const client = await this.redisClient();
      if (!client) {
        return;
      }
      const current = await client.get(this.lockKey);
      if (current === token) {
        await client.del(this.lockKey);
      }
    } catch (error) {
      this.logger.warn(
        `Accounting snapshot unlock failed: ${errorMessage(error)}`,
      );
    }
  }

  private async poll(): Promise<AccountingOverview | null> {
    for (let attempt = 0; attempt < ACCOUNTING_POLL_ATTEMPTS; attempt += 1) {
      const found = await this.read();
      if (found) {
        return found;
      }
      await new Promise(resolve => setTimeout(resolve, ACCOUNTING_POLL_MS));
    }
    return null;
  }

  private redisClient(): Promise<Redis | null> {
    if (!this.settings.enabled) {
      return Promise.resolve(null);
    }
    if (!this.clientPromise) {
      this.clientPromise = this.connect();
    }
    return this.clientPromise;
  }

  private async connect(): Promise<Redis | null> {
    try {
      const client = this.registry.create('command');
      if (client.status === 'wait') {
        await client.connect();
      }
      return client;
    } catch (error) {
      this.logger.warn(
        `Accounting snapshot Redis is unavailable: ${errorMessage(error)}`,
      );
      this.clientPromise = Promise.resolve(null);
      return null;
    }
  }
}
