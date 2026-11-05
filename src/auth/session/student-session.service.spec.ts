import { ConfigService } from '@nestjs/config';
import { StudentSessionService } from './student-session.service';
import { REDIS_SETTINGS } from '../../redis/redis.constants';
import { resolveRedisSettings } from '../../redis/redis.settings';

describe('StudentSessionService', () => {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  const redis = {
    status: 'ready',
    connect: jest.fn(),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let n = 0;
      for (const key of keys) {
        if (store.delete(key)) n += 1;
      }
      return n;
    }),
    sadd: jest.fn(async (key: string, member: string) => {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
      return 1;
    }),
    srem: jest.fn(async (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return 1;
    }),
    expire: jest.fn(async () => 1),
    pipeline: jest.fn(() => {
      const ops: Array<() => Promise<unknown>> = [];
      const api = {
        set: (key: string, value: string, _ex?: string, _ttl?: number) => {
          ops.push(async () => {
            store.set(key, value);
          });
          return api;
        },
        sadd: (key: string, member: string) => {
          ops.push(async () => {
            const set = sets.get(key) ?? new Set<string>();
            set.add(member);
            sets.set(key, set);
          });
          return api;
        },
        expire: () => {
          ops.push(async () => 1);
          return api;
        },
        del: (...keys: string[]) => {
          ops.push(async () => {
            for (const key of keys) store.delete(key);
          });
          return api;
        },
        srem: (key: string, member: string) => {
          ops.push(async () => {
            sets.get(key)?.delete(member);
          });
          return api;
        },
        exec: async () => {
          for (const op of ops) await op();
          return ops.map(() => [null, 'OK']);
        },
      };
      return api;
    }),
  };

  const registry = {
    create: jest.fn(() => redis),
  };

  const keys = {
    key: (...parts: string[]) => ['ezprep', ...parts].join(':'),
  };

  const settings = resolveRedisSettings({
    REDIS_URL: 'rediss://default:secret@example.upstash.io:6379',
    INSTANCE_ID: 'ezprep',
  });

  let service: StudentSessionService;

  beforeEach(() => {
    store.clear();
    sets.clear();
    jest.clearAllMocks();
    service = new StudentSessionService(
      settings,
      registry as never,
      keys as never,
      { get: () => undefined } as unknown as ConfigService,
    );
  });

  it('creates a persisted web session and indexes the refresh token', async () => {
    const created = await service.create({
      userId: 'user-1',
      client: 'web',
    });

    expect(created.persisted).toBe(true);
    expect(created.expiresInSec).toBe(7 * 24 * 60 * 60);
    expect(created.refreshToken).toBeTruthy();

    const active = await service.assertActive(created.sid, 'user-1');
    expect(active?.userId).toBe('user-1');
    expect(active?.fromCache).toBe(true);
  });

  it('uses a 90-day TTL for mobile', async () => {
    const created = await service.create({
      userId: 'user-1',
      client: 'mobile',
    });
    expect(created.expiresInSec).toBe(90 * 24 * 60 * 60);
  });

  it('revokes only the targeted session', async () => {
    const a = await service.create({ userId: 'user-1', client: 'web' });
    const b = await service.create({ userId: 'user-1', client: 'mobile' });

    await service.revoke(a.sid, 'user-1');

    expect(await service.assertActive(a.sid, 'user-1')).toBeNull();
    // b may still be in positive cache from create; force miss by clearing cache via revoke path already deleted a only
    const stillB = await service.assertActive(b.sid, 'user-1');
    expect(stillB?.sid).toBe(b.sid);
  });

  it('rotates web refresh without extending absolute expiry', async () => {
    const created = await service.create({ userId: 'user-1', client: 'web' });
    const first = await service.refresh(created.refreshToken);
    expect(first?.refreshToken).toBeTruthy();
    expect(first?.refreshToken).not.toBe(created.refreshToken);
    expect(first?.expiresInSec).toBeLessThanOrEqual(created.expiresInSec);

    expect(await service.refresh(created.refreshToken)).toBeNull();
    const second = await service.refresh(first!.refreshToken);
    expect(second?.sid).toBe(created.sid);
  });

  it('slides mobile session TTL on refresh', async () => {
    const created = await service.create({
      userId: 'user-1',
      client: 'mobile',
    });
    const before = created.expiresAt.getTime();
    const refreshed = await service.refresh(created.refreshToken);
    expect(refreshed?.client).toBe('mobile');
    expect(refreshed?.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
    expect(refreshed?.expiresInSec).toBe(90 * 24 * 60 * 60);
  });

  it('issues non-persisted metadata when AUTH_SESSION_STORE=degraded', async () => {
    const degraded = new StudentSessionService(
      settings,
      registry as never,
      keys as never,
      {
        get: (key: string) =>
          key === 'AUTH_SESSION_STORE' ? 'degraded' : undefined,
      } as unknown as ConfigService,
    );

    const created = await degraded.create({
      userId: 'user-1',
      client: 'web',
    });
    expect(created.persisted).toBe(false);
    expect(registry.create).not.toHaveBeenCalled();
  });

  it('throttles activity touches', async () => {
    const created = await service.create({ userId: 'user-1', client: 'web' });
    const first = await service.touchActivity(created.sid, 'user-1');
    const second = await service.touchActivity(created.sid, 'user-1');
    expect(first.shouldUpdateMongo).toBe(true);
    expect(second.shouldUpdateMongo).toBe(false);
  });
});

// silence unused import lint in some configs
void REDIS_SETTINGS;
