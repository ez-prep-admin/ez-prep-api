import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_SETTINGS } from './redis.constants';
import { RedisConnectionRegistry } from './redis-connection.registry';
import { RedisHealthService } from './redis-health.service';
import { RedisKeyBuilder } from './redis-key.builder';
import { readRedisEnv, resolveRedisSettings } from './redis.settings';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_SETTINGS,
      useFactory: (config: ConfigService) =>
        resolveRedisSettings(readRedisEnv(config)),
      inject: [ConfigService],
    },
    RedisConnectionRegistry,
    RedisKeyBuilder,
    RedisHealthService,
  ],
  exports: [
    REDIS_SETTINGS,
    RedisConnectionRegistry,
    RedisKeyBuilder,
    RedisHealthService,
  ],
})
export class RedisModule {}
