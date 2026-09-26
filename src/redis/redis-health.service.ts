import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { REDIS_SETTINGS } from './redis.constants';
import { RedisConnectionRegistry } from './redis-connection.registry';
import { errorMessage } from './redis-log';
import { waitUntilReady } from './redis-readiness';
import { RedisSettings } from './redis.settings';

export type RedisHealthStatus = 'disabled' | 'up' | 'down';

interface ProbeClient {
  status: string;
  ping(): Promise<string>;
  connect(): Promise<unknown>;
  once(event: 'ready' | 'end', listener: () => void): void;
  off(event: 'ready' | 'end', listener: () => void): void;
}

@Injectable()
export class RedisHealthService implements OnModuleInit {
  private readonly logger = new Logger(RedisHealthService.name);
  private client?: ProbeClient;

  constructor(
    @Inject(REDIS_SETTINGS) private readonly settings: RedisSettings,
    private readonly connections: RedisConnectionRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.settings.enabled) {
      this.logger.log(
        'Redis is not configured. Upload jobs stay in this process until REDIS_URL is set.',
      );
      return;
    }

    this.logger.log(
      `Redis configured for instance ${this.settings.instanceId} (key prefix ${this.settings.keyPrefix}, queue prefix ${this.settings.bullPrefix})`,
    );
  }

  async probe(): Promise<RedisHealthStatus> {
    if (!this.settings.enabled) {
      return 'disabled';
    }

    try {
      const client = this.client ?? this.connections.create('command');
      this.client = client;
      await waitUntilReady(client, this.settings.healthTimeoutMs);
      const reply = await client.ping();
      return reply === 'PONG' ? 'up' : 'down';
    } catch (error) {
      this.logger.error(
        `Redis health check failed for instance ${this.settings.instanceId}: ${errorMessage(error)}`,
      );
      return 'down';
    }
  }
}
