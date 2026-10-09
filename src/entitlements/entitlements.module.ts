import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { ExamGroupsModule } from '../exam-groups/exam-groups.module';
import { ExamsModule } from '../exams/exams.module';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminEntitlementsController } from './admin-entitlements.controller';
import { AdminUserEntitlementsController } from './admin-user-entitlements.controller';
import { EntitlementProvisioningService } from './entitlement-provisioning.service';
import { EntitlementsService } from './entitlements.service';
import { MeEntitlementsController } from './me-entitlements.controller';
import {
  NoopPaidOrderNotifier,
  PAID_ORDER_NOTIFIER,
} from './paid-order-notifier';
import { Entitlement, EntitlementSchema } from './schemas/entitlement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Entitlement.name, schema: EntitlementSchema },
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
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
  providers: [
    EntitlementsService,
    EntitlementProvisioningService,
    { provide: PAID_ORDER_NOTIFIER, useClass: NoopPaidOrderNotifier },
  ],
  exports: [
    EntitlementsService,
    EntitlementProvisioningService,
    MongooseModule,
  ],
})
export class EntitlementsModule {}
