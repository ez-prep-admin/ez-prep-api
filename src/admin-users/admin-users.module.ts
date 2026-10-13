import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  MockTestAttempt,
  MockTestAttemptSchema,
} from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import {
  Entitlement,
  EntitlementSchema,
} from '../entitlements/schemas/entitlement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: MockTestAttempt.name, schema: MockTestAttemptSchema },
      { name: Entitlement.name, schema: EntitlementSchema },
    ]),
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
