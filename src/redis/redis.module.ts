import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INSTANCE_RUNTIME_SNAPSHOT } from '../instance-config/instance-config.constants';
import { InstanceConfigModule } from '../instance-config/instance-config.module';
import { InstanceRuntimeSnapshot } from '../instance-config/instance-runtime.snapshot';
import { REDIS_SETTINGS } from './redis.constants';
import { RedisConnectionRegistry } from './redis-connection.registry';
import { RedisHealthService } from './redis-health.service';
import { RedisKeyBuilder } from './redis-key.builder';
import {
  overlayRedisEnv,
  readRedisEnv,
  resolveRedisSettings,
} from './redis.settings';

@Global()
@Module({
  imports: [InstanceConfigModule],
  providers: [
    {
      provide: REDIS_SETTINGS,
      useFactory: (config: ConfigService, runtime: InstanceRuntimeSnapshot) =>
        resolveRedisSettings(
          overlayRedisEnv(readRedisEnv(config), runtime.redis),
        ),
      inject: [ConfigService, INSTANCE_RUNTIME_SNAPSHOT],
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
