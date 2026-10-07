import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { ExamGroupsModule } from '../exam-groups/exam-groups.module';
import { ExamsModule } from '../exams/exams.module';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminEntitlementsController } from './admin-entitlements.controller';
import { AdminUserEntitlementsController } from './admin-user-entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { MeEntitlementsController } from './me-entitlements.controller';
import { Entitlement, EntitlementSchema } from './schemas/entitlement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Entitlement.name, schema: EntitlementSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ExamsModule,
    ExamGroupsModule,
    forwardRef(() => MockTestsModule),
    CommerceAuditModule,
  ],
  controllers: [
    MeEntitlementsController,
    AdminEntitlementsController,
    AdminUserEntitlementsController,
  ],
  providers: [EntitlementsService],
  exports: [EntitlementsService, MongooseModule],
})
export class EntitlementsModule {}
