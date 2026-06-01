import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminSeedService } from './admin-seed.service';
import { AdminsController } from '../admins/admins.controller';
import { AdminsService } from '../admins/admins.service';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../../auth/auth.module';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { ValidationModule } from '../../common/validators/validation.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ValidationModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AdminAuthController, AdminsController],
  providers: [AdminAuthService, AdminSeedService, AdminsService],
})
export class AdminAuthModule {}
