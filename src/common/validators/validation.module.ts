import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { IsUniqueEmailConstraint } from './is-unique-email.validator';
import { IsUniquePhoneConstraint } from './is-unique-phone.validator';
import { IsValidPhoneConstraint } from './is-valid-phone.validator';
import { IsProperNameConstraint } from './is-proper-name.validator';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [
    IsUniqueEmailConstraint,
    IsUniquePhoneConstraint,
    IsValidPhoneConstraint,
    IsProperNameConstraint,
  ],
  exports: [
    IsUniqueEmailConstraint,
    IsUniquePhoneConstraint,
    IsValidPhoneConstraint,
    IsProperNameConstraint,
  ],
})
export class ValidationModule {}
