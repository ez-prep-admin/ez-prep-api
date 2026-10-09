import { Module } from '@nestjs/common';
import { IndianStatesController } from './indian-states.controller';

@Module({
  controllers: [IndianStatesController],
})
export class MetaModule {}
