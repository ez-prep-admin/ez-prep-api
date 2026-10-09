import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeBillingProfileController } from './me-billing-profile.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController, MeBillingProfileController],
  providers: [UsersService],
  exports: [UsersService], // Export service for use in other modules
})
export class UsersModule {}
