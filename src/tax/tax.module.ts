import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InstanceConfig,
  InstanceConfigSchema,
} from '../instance-config/schemas/instance-config.schema';
import { TaxService } from './tax.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InstanceConfig.name, schema: InstanceConfigSchema },
    ]),
  ],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
