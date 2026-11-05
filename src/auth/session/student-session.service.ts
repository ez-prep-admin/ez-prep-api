import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_SETTINGS } from '../../redis/redis.constants';
import { RedisConnectionRegistry } from '../../redis/redis-connection.registry';
import { RedisKeyBuilder } from '../../redis/redis-key.builder';
import { errorMessage } from '../../redis/redis-log';
import { RedisSettings } from '../../redis/redis.settings';
import {
  AUTH_SESSION_STORE_ENV,
  MOBILE_ACCESS_TTL_SEC,
  MOBILE_SESSION_TTL_SEC,
  SESSION_ACTIVITY_TOUCH_MS,
  SESSION_SID_CACHE_TTL_MS,
  WEB_ACCESS_TTL_SEC,
  WEB_SESSION_TTL_SEC,
} from './session.constants';
import {
  AuthClient,
  CreatedStudentSession,
  ResolvedStudentSession,
  StudentSessionRecord,
} from './session.types';

interface SidCacheEntry {
  userId: string;
  expiresAtMs: number;
  client: AuthClient;
  cachedAtMs: number;
}

export interface CreateSessionInput {
  userId: string;
  client: AuthClient;
  userAgent?: string;
  ip?: string;
}

export interface RefreshSessionResult {
  sid: string;
  refreshToken: string;
  expiresAt: Date;
  expiresInSec: number;
  client: AuthClient;
  userId: string;
}

/**
 * Redis-backed student sessions with an in-process positive sid cache so
 * authenticated traffic does not burn Upstash commands on every request.
 * See docs/REDIS.md § Student sessions.
 */
@Injectable()
export class StudentSessionService {
  private readonly logger = new Logger(StudentSessionService.name);
  private clientPromise: Promise<Redis | null> | null = null;
  private readonly sidCache = new Map<string, SidCacheEntry>();
  private readonly lastTouchAt = new Map<string, number>();
  private degradedForced: boolean;

  constructor(
    @Inject(REDIS_SETTINGS) private readonly settings: RedisSettings,
    private readonly registry: RedisConnectionRegistry,
    private readonly keys: RedisKeyBuilder,
    config: ConfigService,
  ) {
    this.degradedForced =
      (config.get<string>(AUTH_SESSION_STORE_ENV) || '').toLowerCase() ===
      'degraded';
    if (this.degradedForced) {
      this.logger.warn(
        'auth.session.degraded: AUTH_SESSION_STORE=degraded — Redis session checks are skipped',
      );
    }
  }

  ttlSecFor(client: AuthClient): number {
    return client === 'mobile' ? MOBILE_SESSION_TTL_SEC : WEB_SESSION_TTL_SEC;
  }

  isDegraded(): boolean {
    return this.degradedForced || !this.settings.enabled;
  }

  /**
   * Create a session in Redis. On Redis failure returns persisted:false so
   * the caller can issue a legacy JWT without sid (degraded login).
   */
  async create(input: CreateSessionInput): Promise<CreatedStudentSession> {
    const client = input.client === 'mobile' ? 'mobile' : 'web';
    const expiresInSec = this.ttlSecFor(client);
    const now = Date.now();
    const expiresAt = new Date(now + expiresInSec * 1000);
    const sid = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = this.hashRefresh(refreshToken);

    if (this.degradedForced) {
      this.logger.warn(
        `auth.session.degraded: issuing ephemeral session metadata for user ${input.userId}`,
      );
      return {
        sid,
        refreshToken,
        expiresAt,
        expiresInSec,
        client,
        persisted: false,
      };
    }

    const record: StudentSessionRecord = {
      userId: input.userId,
      refreshTokenHash,
      createdAt: new Date(now).toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      client,
      userAgent: input.userAgent,
      ip: input.ip,
    };

    try {
      const redis = await this.redisClient();
      if (!redis) {
        this.logger.warn(
          `auth.session.degraded: Redis unavailable while creating session for user ${input.userId}`,
        );
        return {
          sid,
          refreshToken,
          expiresAt,
          expiresInSec,
          client,
          persisted: false,
        };
      }

      const sessionKey = this.sessionKey(sid);
      const userKey = this.userSessionsKey(input.userId);
      const pipeline = redis.pipeline();
      pipeline.set(sessionKey, JSON.stringify(record), 'EX', expiresInSec);
      pipeline.set(
        this.refreshIndexKey(refreshTokenHash),
        sid,
        'EX',
        expiresInSec,
      );
      pipeline.sadd(userKey, sid);
      pipeline.expire(userKey, expiresInSec);
      await pipeline.exec();

      this.rememberSid(sid, {
        userId: input.userId,
        expiresAtMs: expiresAt.getTime(),
        client,
        cachedAtMs: now,
      });

      return {
        sid,
        refreshToken,
        expiresAt,
        expiresInSec,
        client,
        persisted: true,
      };
    } catch (error) {
      this.logger.warn(
        `auth.session.degraded: Redis write failed for user ${input.userId}: ${errorMessage(error)}`,
      );
      return {
        sid,
        refreshToken,
        expiresAt,
        expiresInSec,
        client,
        persisted: false,
      };
    }
  }

  /**
   * Confirm a live session for a JWT sid. Returns null if revoked/expired.
   * In degraded mode, accepts any non-empty sid without Redis.
   */
  async assertActive(
    sid: string,
    userId: string,
  ): Promise<ResolvedStudentSession | null> {
    if (!sid) {
      return null;
    }

    if (this.degradedForced) {
      return {
        sid,
        userId,
        expiresAt: new Date(Date.now() + WEB_SESSION_TTL_SEC * 1000),
        client: 'web',
        fromCache: true,
      };
    }

    const cached = this.sidCache.get(sid);
    const now = Date.now();
    if (
      cached &&
      cached.userId === userId &&
      cached.expiresAtMs > now &&
      now - cached.cachedAtMs < SESSION_SID_CACHE_TTL_MS
    ) {
      return {
        sid,
        userId: cached.userId,
        expiresAt: new Date(cached.expiresAtMs),
        client: cached.client,
        fromCache: true,
      };
    }

    try {
      const redis = await this.redisClient();
      if (!redis) {
        this.logger.warn(
          `auth.session.degraded: Redis unavailable while asserting sid ${sid}`,
        );
        return {
          sid,
          userId,
          expiresAt: new Date(now + WEB_SESSION_TTL_SEC * 1000),
          client: 'web',
          fromCache: true,
        };
      }

      const raw = await redis.get(this.sessionKey(sid));
      if (!raw) {
        this.sidCache.delete(sid);
        return null;
      }

      const record = this.parseRecord(raw);
      if (!record || record.userId !== userId) {
        this.sidCache.delete(sid);
        return null;
      }

      const expiresAtMs = Date.parse(record.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
        this.sidCache.delete(sid);
        return null;
      }

      this.rememberSid(sid, {
        userId: record.userId,
        expiresAtMs,
        client: record.client,
        cachedAtMs: now,
      });

      return {
        sid,
        userId: record.userId,
        expiresAt: new Date(expiresAtMs),
        client: record.client,
        fromCache: false,
      };
    } catch (error) {
      this.logger.warn(
        `auth.session.degraded: Redis GET failed for sid ${sid}: ${errorMessage(error)}`,
      );
      return {
        sid,
        userId,
        expiresAt: new Date(now + WEB_SESSION_TTL_SEC * 1000),
        client: 'web',
        fromCache: true,
      };
    }
  }

  /**
   * Rotate refresh token.
   * - web: remaining absolute TTL from original login (no slide past 7d)
   * - mobile: slide idle window forward by MOBILE_SESSION_TTL_SEC (Instagram-style)
   */
  async refresh(refreshToken: string): Promise<RefreshSessionResult | null> {
    if (!refreshToken || this.degradedForced) {
      return null;
    }

    try {
      const redis = await this.redisClient();
      if (!redis) {
        return null;
      }

      const hash = this.hashRefresh(refreshToken);
      const sid = await redis.get(this.refreshIndexKey(hash));
      if (!sid) {
        return null;
      }

      const sessionKey = this.sessionKey(sid);
      const raw = await redis.get(sessionKey);
      if (!raw) {
        await redis.del(this.refreshIndexKey(hash));
        return null;
      }

      const record = this.parseRecord(raw);
      if (!record) {
        return null;
      }

      // Presented refresh does not match the live session → possible theft after
      // rotation. Kill the session rather than issuing new tokens.
      if (record.refreshTokenHash !== hash) {
        this.logger.warn(
          `auth.session: refresh reuse/mismatch for sid ${sid}; revoking`,
        );
        await this.revoke(sid, record.userId);
        return null;
      }

      const now = Date.now();
      const expiresAtMs = Date.parse(record.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
        await this.revoke(sid, record.userId);
        return null;
      }

      const isMobile = record.client === 'mobile';
      const nextExpiresAtMs = isMobile
        ? now + MOBILE_SESSION_TTL_SEC * 1000
        : expiresAtMs;
      const ttlSec = Math.max(1, Math.floor((nextExpiresAtMs - now) / 1000));
      // Access JWT lifetime: web short-lived; mobile long until Phase 12.
      const accessExpiresInSec = isMobile
        ? Math.min(MOBILE_ACCESS_TTL_SEC, ttlSec)
        : Math.min(WEB_ACCESS_TTL_SEC, ttlSec);

      const nextRefresh = randomBytes(48).toString('base64url');
      const nextHash = this.hashRefresh(nextRefresh);
      const updated: StudentSessionRecord = {
        ...record,
        refreshTokenHash: nextHash,
        expiresAt: new Date(nextExpiresAtMs).toISOString(),
        lastSeenAt: new Date(now).toISOString(),
      };

      const pipeline = redis.pipeline();
      pipeline.set(sessionKey, JSON.stringify(updated), 'EX', ttlSec);
      pipeline.del(this.refreshIndexKey(hash));
      pipeline.set(this.refreshIndexKey(nextHash), sid, 'EX', ttlSec);
      pipeline.expire(this.userSessionsKey(record.userId), ttlSec);
      await pipeline.exec();

      this.rememberSid(sid, {
        userId: record.userId,
        expiresAtMs: nextExpiresAtMs,
        client: record.client,
        cachedAtMs: now,
      });

      return {
        sid,
        refreshToken: nextRefresh,
        expiresAt: new Date(nextExpiresAtMs),
        expiresInSec: accessExpiresInSec,
        client: record.client,
        userId: record.userId,
      };
    } catch (error) {
      this.logger.warn(`auth.session: refresh failed: ${errorMessage(error)}`);
      return null;
    }
  }

  /**
   * Delete one session. Idempotent. Best-effort when Redis is down.
   */
  async revoke(sid: string, userId?: string): Promise<void> {
    this.sidCache.delete(sid);
    if (!sid || this.degradedForced) {
      return;
    }

    try {
      const redis = await this.redisClient();
      if (!redis) {
        return;
      }

      const sessionKey = this.sessionKey(sid);
      const raw = await redis.get(sessionKey);
      const record = raw ? this.parseRecord(raw) : null;
      const owner = userId || record?.userId;

      const pipeline = redis.pipeline();
      pipeline.del(sessionKey);
      if (record?.refreshTokenHash) {
        pipeline.del(this.refreshIndexKey(record.refreshTokenHash));
      }
      if (owner) {
        pipeline.srem(this.userSessionsKey(owner), sid);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(
        `auth.session: revoke failed for sid ${sid}: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Resolve refresh token → sid and revoke. Used when logout has the HttpOnly
   * cookie but the short-lived access JWT is already expired.
   */
  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    if (!refreshToken || this.degradedForced) {
      return;
    }

    try {
      const redis = await this.redisClient();
      if (!redis) {
        return;
      }

      const hash = this.hashRefresh(refreshToken);
      const sid = await redis.get(this.refreshIndexKey(hash));
      if (!sid) {
        await redis.del(this.refreshIndexKey(hash));
        return;
      }
      await this.revoke(sid);
    } catch (error) {
      this.logger.warn(
        `auth.session: revokeByRefreshToken failed: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Throttled last-seen write. Returns true when the caller should also
   * persist Mongo lastActiveAt for this user.
   */
  async touchActivity(
    sid: string,
    userId: string,
  ): Promise<{ shouldUpdateMongo: boolean }> {
    const touchKey = `sid:${sid}`;
    const userKey = `user:${userId}`;
    const now = Date.now();
    const lastSid = this.lastTouchAt.get(touchKey) || 0;
    const lastUser = this.lastTouchAt.get(userKey) || 0;

    if (now - lastSid < SESSION_ACTIVITY_TOUCH_MS) {
      return { shouldUpdateMongo: false };
    }

    this.lastTouchAt.set(touchKey, now);
    const shouldUpdateMongo = now - lastUser >= SESSION_ACTIVITY_TOUCH_MS;
    if (shouldUpdateMongo) {
      this.lastTouchAt.set(userKey, now);
    }

    if (this.degradedForced || sid.startsWith('legacy:')) {
      return { shouldUpdateMongo };
    }

    try {
      const redis = await this.redisClient();
      if (!redis) {
        return { shouldUpdateMongo };
      }

      const sessionKey = this.sessionKey(sid);
      const raw = await redis.get(sessionKey);
      if (!raw) {
        return { shouldUpdateMongo };
      }

      const record = this.parseRecord(raw);
      if (!record) {
        return { shouldUpdateMongo };
      }

      const expiresAtMs = Date.parse(record.expiresAt);
      const remainingSec = Math.max(1, Math.floor((expiresAtMs - now) / 1000));
      const updated: StudentSessionRecord = {
        ...record,
        lastSeenAt: new Date(now).toISOString(),
      };
      await redis.set(sessionKey, JSON.stringify(updated), 'EX', remainingSec);
    } catch (error) {
      this.logger.warn(
        `auth.session: touchActivity failed for sid ${sid}: ${errorMessage(error)}`,
      );
    }

    return { shouldUpdateMongo };
  }

  private rememberSid(sid: string, entry: SidCacheEntry): void {
    this.sidCache.set(sid, entry);
  }

  private hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sessionKey(sid: string): string {
    return this.keys.key('session', sid);
  }

  private userSessionsKey(userId: string): string {
    return this.keys.key('user-sessions', userId);
  }

  private refreshIndexKey(hash: string): string {
    return this.keys.key('session-refresh', hash);
  }

  private parseRecord(raw: string): StudentSessionRecord | null {
    try {
      const parsed = JSON.parse(raw) as StudentSessionRecord;
      if (
        !parsed?.userId ||
        !parsed.refreshTokenHash ||
        !parsed.expiresAt ||
        !parsed.client
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
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
        `auth.session: Redis connect failed: ${errorMessage(error)}`,
      );
      this.clientPromise = Promise.resolve(null);
      return null;
    }
  }
}
