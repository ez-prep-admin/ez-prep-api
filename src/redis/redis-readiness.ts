export interface ReadyClient {
  status: string;
  connect(): Promise<unknown>;
  once(event: 'ready' | 'end', listener: () => void): unknown;
  off(event: 'ready' | 'end', listener: () => void): unknown;
}

/**
 * Resolves when the client is ready, or rejects when the timeout elapses.
 * Reconnects keep running after a timeout so a later attempt can succeed.
 */
export function waitUntilReady(
  client: ReadyClient,
  timeoutMs: number,
): Promise<void> {
  if (client.status === 'ready') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      client.off('ready', onReady);
      client.off('end', onEnd);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const onReady = () => finish();
    const onEnd = () => finish(new Error('Redis connection closed'));
    const timer = setTimeout(() => {
      finish(new Error('Redis did not become ready in time'));
    }, timeoutMs);

    client.once('ready', onReady);
    client.once('end', onEnd);

    if (client.status === 'wait') {
      client.connect().catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Redis connect failed';
        finish(error instanceof Error ? error : new Error(message));
      });
    }
  });
}
