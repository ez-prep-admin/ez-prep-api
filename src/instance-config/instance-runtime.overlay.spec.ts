import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { overlayRedisEnv, resolveRedisSettings } from '../redis/redis.settings';
import { INSTANCE_CONFIG_ID } from './instance-config.constants';
import {
  loadInstanceRuntimeSnapshot,
  toInstanceRuntimeSnapshot,
} from './instance-runtime.snapshot';
import { InstanceConfigDocument } from './schemas/instance-config.schema';

const REDIS_URL = 'rediss://default:secret@example.upstash.io:6379';

describe('instance runtime snapshot', () => {
  it('returns empty groups when the document is missing', () => {
    expect(toInstanceRuntimeSnapshot(null)).toEqual({
      operations: null,
      redis: null,
    });
  });

  it('copies only operations and redis, including false and zero', () => {
    const snapshot = toInstanceRuntimeSnapshot({
      operations: { invoicesEnabled: false, trustProxyHops: 0 },
      redis: { keepAliveMs: 0 },
    });
    expect(snapshot).toEqual({
      operations: { invoicesEnabled: false, trustProxyHops: 0 },
      redis: { keepAliveMs: 0 },
    });
  });

  it('drops seller and tax when a full document is passed', () => {
    const doc = {
      seller: { gstin: '99NOTACHECKSUM' },
      taxConfig: { taxRate: 18 },
      operations: { invoicesEnabled: true },
    };
    const snapshot = toInstanceRuntimeSnapshot(doc);
    expect(snapshot).toEqual({
      operations: { invoicesEnabled: true },
      redis: null,
    });
  });

  it('loads a projection and ignores a missing document', async () => {
    const select = jest.fn().mockReturnValue({
      lean: () => ({ exec: async () => null }),
    });
    const model = {
      findById: jest.fn().mockReturnValue({ select }),
    };
    await expect(
      loadInstanceRuntimeSnapshot(
        model as unknown as Model<InstanceConfigDocument>,
      ),
    ).resolves.toEqual({ operations: null, redis: null });
    expect(model.findById).toHaveBeenCalledWith(INSTANCE_CONFIG_ID);
    expect(select).toHaveBeenCalledWith('operations redis');
  });

  it('lets stored operations replace environment values in CommerceConfigService', () => {
    const config = {
      get: (key: string) =>
        key === 'INVOICES_ENABLED'
          ? 'true'
          : key === 'TRUST_PROXY_HOPS'
            ? '1'
            : undefined,
    } as ConfigService;
    const service = new CommerceConfigService(config, {
      operations: { invoicesEnabled: false, trustProxyHops: 0 },
      redis: null,
    });
    expect(service.settings.invoicesEnabled).toBe(false);
    expect(service.settings.trustProxyHops).toBe(0);
  });

  it('keeps redis connection settings in the environment', () => {
    const env = {
      REDIS_URL,
      INSTANCE_ID: 'ezprep',
      QUEUE_WORKER_ENABLED: 'false',
      IMPORT_QUEUE_DRIVER: 'memory',
      REDIS_CONNECT_TIMEOUT_MS: '250',
    };
    expect(overlayRedisEnv(env, null)).toBe(env);

    const overlaid = overlayRedisEnv(env, {
      connectTimeoutMs: 500,
      keepAliveMs: 0,
      keyPrefix: 'papers',
    });
    expect(overlaid.REDIS_URL).toBe(REDIS_URL);
    expect(overlaid.QUEUE_WORKER_ENABLED).toBe('false');
    expect(overlaid.IMPORT_QUEUE_DRIVER).toBe('memory');
    expect(overlaid.REDIS_CONNECT_TIMEOUT_MS).toBe('500');
    expect(overlaid.REDIS_KEEP_ALIVE_MS).toBe('0');
    expect(overlaid.REDIS_KEY_PREFIX).toBe('papers');

    const settings = resolveRedisSettings(overlaid);
    expect(settings.url).toBe(REDIS_URL);
    expect(settings.connectTimeoutMs).toBe(500);
    expect(settings.keepAliveMs).toBe(0);
    expect(settings.keyPrefix).toBe('papers');
    expect(settings.workerEnabled).toBe(false);
    expect(settings.queueDriver).toBe('memory');
  });

  it('leaves an unset redis override on the environment value', () => {
    const env = {
      REDIS_URL,
      INSTANCE_ID: 'ezprep',
      REDIS_CONNECT_TIMEOUT_MS: '250',
    };
    const overlaid = overlayRedisEnv(env, { parseConcurrency: 4 });
    expect(overlaid.REDIS_CONNECT_TIMEOUT_MS).toBe('250');
    expect(overlaid.IMPORT_PARSE_CONCURRENCY).toBe('4');
  });
});
