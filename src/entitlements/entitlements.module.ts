import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceAuditModule } from '../commerce-audit/commerce-audit.module';
import { ExamGroupsModule } from '../exam-groups/exam-groups.module';
import { ExamsModule } from '../exams/exams.module';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ProductsModule } from '../products/products.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminEntitlementsController } from './admin-entitlements.controller';
import { AdminUserEntitlementsController } from './admin-user-entitlements.controller';
import { CoverageService } from './coverage.service';
import { EntitlementLockService } from './entitlement-lock.service';
import { EntitlementProvisioningService } from './entitlement-provisioning.service';
import { EntitlementsService } from './entitlements.service';
import { MeEntitlementsController } from './me-entitlements.controller';
import { Entitlement, EntitlementSchema } from './schemas/entitlement.schema';
import {
  EntitlementLock,
  EntitlementLockSchema,
} from './schemas/entitlement-lock.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Entitlement.name, schema: EntitlementSchema },
      { name: EntitlementLock.name, schema: EntitlementLockSchema },
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    ExamsModule,
    ExamGroupsModule,
    forwardRef(() => MockTestsModule),
    CommerceAuditModule,
    InvoicesModule,
    ProductsModule,
  ],
  controllers: [
    MeEntitlementsController,
    AdminEntitlementsController,
    AdminUserEntitlementsController,
  ],
  providers: [
    EntitlementsService,
    EntitlementProvisioningService,
    EntitlementLockService,
    CoverageService,
  ],
  exports: [
    EntitlementsService,
    EntitlementProvisioningService,
    CoverageService,
    MongooseModule,
  ],
})
export class EntitlementsModule {}
