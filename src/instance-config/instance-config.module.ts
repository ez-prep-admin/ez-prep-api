import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InstanceConfigController } from './instance-config.controller';
import { InstanceConfigService } from './instance-config.service';
import {
  InstanceConfig,
  InstanceConfigSchema,
} from './schemas/instance-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InstanceConfig.name, schema: InstanceConfigSchema },
    ]),
  ],
  controllers: [InstanceConfigController],
  providers: [InstanceConfigService],
  exports: [InstanceConfigService],
})
export class InstanceConfigModule {}
