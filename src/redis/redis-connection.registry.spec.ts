import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConnectionRegistry } from './redis-connection.registry';
import { resolveRedisSettings } from './redis.settings';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((url: string, options: unknown) => ({
    url,
    options,
    listeners: {} as Record<string, (error: Error) => void>,
    on(event: string, listener: (error: Error) => void) {
      this.listeners[event] = listener;
    },
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  })),
}));

const REDIS_URL = 'rediss://default:secret@example.upstash.io:6379';

describe('RedisConnectionRegistry', () => {
  const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('refuses to connect when Redis is not configured', () => {
    const registry = new RedisConnectionRegistry(resolveRedisSettings({}));
    expect(() => registry.create('command')).toThrow('Redis is not configured');
    expect(Redis).not.toHaveBeenCalled();
  });

  it('opens a lazy client and redacts connection errors', async () => {
    const registry = new RedisConnectionRegistry(
      resolveRedisSettings({ REDIS_URL, INSTANCE_ID: 'ezprep' }),
    );
    const client = registry.create('producer') as unknown as {
      url: string;
      options: { maxRetriesPerRequest: null };
      listeners: { error: (error: Error) => void };
      quit: jest.Mock;
    };

    expect(client.url).toBe(REDIS_URL);
    expect(client.options.maxRetriesPerRequest).toBeNull();
    client.listeners.error(new Error(`down ${REDIS_URL}`));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('redis://redacted'),
    );
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');

    await registry.onModuleDestroy();
    expect(client.quit).toHaveBeenCalled();
  });

  it('disconnects when quit fails', async () => {
    const registry = new RedisConnectionRegistry(
      resolveRedisSettings({ REDIS_URL, INSTANCE_ID: 'ezprep' }),
    );
    const client = registry.create('command') as unknown as {
      quit: jest.Mock;
      disconnect: jest.Mock;
    };
    client.quit.mockRejectedValueOnce(new Error(`quit ${REDIS_URL} failed`));

    await registry.onModuleDestroy();
    expect(client.disconnect).toHaveBeenCalled();
    expect(errorSpy.mock.calls.join(' ')).toContain('redis://redacted');
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');
  });
});
