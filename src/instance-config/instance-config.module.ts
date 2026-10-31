import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InstanceConfigController } from './instance-config.controller';
import { INSTANCE_RUNTIME_SNAPSHOT } from './instance-config.constants';
import { loadInstanceRuntimeSnapshot } from './instance-runtime.snapshot';
import { InstanceConfigService } from './instance-config.service';
import {
  InstanceConfig,
  InstanceConfigDocument,
  InstanceConfigSchema,
} from './schemas/instance-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InstanceConfig.name, schema: InstanceConfigSchema },
    ]),
  ],
  controllers: [InstanceConfigController],
  providers: [
    InstanceConfigService,
    {
      provide: INSTANCE_RUNTIME_SNAPSHOT,
      useFactory: (model: Model<InstanceConfigDocument>) =>
        loadInstanceRuntimeSnapshot(model),
      inject: [getModelToken(InstanceConfig.name)],
    },
  ],
  exports: [InstanceConfigService, INSTANCE_RUNTIME_SNAPSHOT],
})
export class InstanceConfigModule {}
