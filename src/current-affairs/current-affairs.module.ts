import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CurrentAffairsController } from './current-affairs.controller';
import { CurrentAffairsService } from './current-affairs.service';
import {
  CurrentAffair,
  CurrentAffairSchema,
} from './schemas/current-affair.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CurrentAffair.name, schema: CurrentAffairSchema },
    ]),
  ],
  controllers: [CurrentAffairsController],
  providers: [CurrentAffairsService],
  exports: [
    CurrentAffairsService,
    MongooseModule.forFeature([
      { name: CurrentAffair.name, schema: CurrentAffairSchema },
    ]),
  ],
})
export class CurrentAffairsModule {}
