import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_SETTINGS } from './redis.constants';
import { buildRedisOptions, RedisClientRole } from './redis-connection.options';
import { errorMessage } from './redis-log';
import { RedisSettings } from './redis.settings';

@Injectable()
export class RedisConnectionRegistry implements OnModuleDestroy {
  private readonly logger = new Logger(RedisConnectionRegistry.name);
  private readonly clients: Redis[] = [];

  constructor(
    @Inject(REDIS_SETTINGS) private readonly settings: RedisSettings,
  ) {}

  create(role: RedisClientRole): Redis {
    if (!this.settings.enabled) {
      throw new Error('Redis is not configured');
    }

    const client = new Redis(
      this.settings.url,
      buildRedisOptions(this.settings, role),
    );
    client.on('error', (error: Error) => {
      this.logger.error(
        `Redis ${role} client error for instance ${this.settings.instanceId}: ${errorMessage(error)}`,
      );
    });
    this.clients.push(client);
    return client;
  }

  async onModuleDestroy(): Promise<void> {
    const clients = this.clients.splice(0);
    await Promise.all(
      clients.map(async client => {
        try {
          await client.quit();
        } catch (error) {
          this.logger.error(
            `Redis quit failed for instance ${this.settings.instanceId}: ${errorMessage(error)}`,
          );
          client.disconnect();
        }
      }),
    );
  }
}
