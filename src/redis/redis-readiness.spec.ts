import { EventEmitter } from 'events';
import { waitUntilReady } from './redis-readiness';

class FakeRedis extends EventEmitter {
  status = 'wait';
  connect = jest.fn(async () => undefined);
}

describe('waitUntilReady', () => {
  it('returns immediately when the client is already ready', async () => {
    const client = new FakeRedis();
    client.status = 'ready';
    await expect(waitUntilReady(client, 50)).resolves.toBeUndefined();
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('connects a waiting client and resolves on ready', async () => {
    const client = new FakeRedis();
    client.connect.mockImplementation(async () => {
      client.status = 'ready';
      client.emit('ready');
    });
    await expect(waitUntilReady(client, 50)).resolves.toBeUndefined();
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('does not connect again while a connection is already opening', async () => {
    const client = new FakeRedis();
    client.status = 'connecting';
    const pending = waitUntilReady(client, 50);
    client.emit('ready');
    await expect(pending).resolves.toBeUndefined();
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('rejects when the connection closes or the timeout elapses', async () => {
    const closed = new FakeRedis();
    closed.status = 'connecting';
    const closedAttempt = waitUntilReady(closed, 50);
    closed.emit('end');
    await expect(closedAttempt).rejects.toThrow('Redis connection closed');

    const timedOut = new FakeRedis();
    timedOut.status = 'connecting';
    await expect(waitUntilReady(timedOut, 10)).rejects.toThrow(
      'Redis did not become ready in time',
    );
  });

  it('rejects when connect fails, including non-error rejections', async () => {
    const client = new FakeRedis();
    client.connect.mockRejectedValueOnce(new Error('auth failed'));
    await expect(waitUntilReady(client, 50)).rejects.toThrow('auth failed');

    const text = new FakeRedis();
    text.connect.mockRejectedValueOnce('nope');
    await expect(waitUntilReady(text, 50)).rejects.toThrow(
      'Redis connect failed',
    );
  });

  it('ignores a late ready event after the attempt already settled', async () => {
    const listeners: Record<string, () => void> = {};
    const client = {
      status: 'connecting',
      connect: jest.fn(),
      once(event: 'ready' | 'end', listener: () => void) {
        listeners[event] = listener;
      },
      off() {
        return undefined;
      },
    };
    const pending = waitUntilReady(client, 50);
    listeners.ready();
    listeners.end();
    await expect(pending).resolves.toBeUndefined();
  });
});
