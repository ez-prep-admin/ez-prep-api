import { Logger } from '@nestjs/common';
import { RedisConnectionRegistry } from './redis-connection.registry';
import { RedisHealthService } from './redis-health.service';
import { resolveRedisSettings } from './redis.settings';

describe('RedisHealthService', () => {
  const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reports disabled and does not open a client', async () => {
    const connections = {
      create: jest.fn(),
    } as unknown as RedisConnectionRegistry;
    const service = new RedisHealthService(
      resolveRedisSettings({ INSTANCE_ID: 'ezprep' }),
      connections,
    );
    service.onModuleInit();
    await expect(service.probe()).resolves.toBe('disabled');
    expect(connections.create).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('not configured'),
    );
  });

  it('pings a configured instance and reuses the command client', async () => {
    const client = {
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
      connect: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
    };
    const connections = {
      create: jest.fn().mockReturnValue(client),
    } as unknown as RedisConnectionRegistry;
    const service = new RedisHealthService(
      resolveRedisSettings({
        REDIS_URL: 'rediss://default:secret@example.upstash.io:6379',
        INSTANCE_ID: 'examflex',
      }),
      connections,
    );
    service.onModuleInit();
    await expect(service.probe()).resolves.toBe('up');
    await expect(service.probe()).resolves.toBe('up');
    expect(connections.create).toHaveBeenCalledTimes(1);
    expect(connections.create).toHaveBeenCalledWith('command');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('examflex'));
    expect(logSpy.mock.calls.join(' ')).not.toContain('secret');
  });

  it('reports down when ping does not answer PONG or the client throws', async () => {
    const client = {
      status: 'ready',
      ping: jest
        .fn()
        .mockResolvedValueOnce('LOADING')
        .mockRejectedValueOnce(
          new Error('rediss://default:secret@example.upstash.io:6379 timeout'),
        ),
      connect: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
    };
    const connections = {
      create: jest.fn().mockReturnValue(client),
    } as unknown as RedisConnectionRegistry;
    const service = new RedisHealthService(
      resolveRedisSettings({
        REDIS_URL: 'rediss://default:secret@example.upstash.io:6379',
        INSTANCE_ID: 'ezprep',
      }),
      connections,
    );

    await expect(service.probe()).resolves.toBe('down');
    await expect(service.probe()).resolves.toBe('down');
    expect(errorSpy.mock.calls.join(' ')).toContain('redis://redacted');
    expect(errorSpy.mock.calls.join(' ')).not.toContain('secret');
  });
});
