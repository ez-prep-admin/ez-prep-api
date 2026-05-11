import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import {
  MockTestAttempt,
  MockTestAttemptSchema,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import {
  Question,
  QuestionSchema,
} from '../mock-test-attempts/schemas/question.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MockTestAttempt.name, schema: MockTestAttemptSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // Module-scoped cache — TTLs are set per-operation in the service
    CacheModule.register(),
    UsersModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
