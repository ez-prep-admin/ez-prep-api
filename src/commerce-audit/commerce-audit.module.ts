import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminCommerceAuditController } from './admin-commerce-audit.controller';
import { CommerceAuditService } from './commerce-audit.service';
import {
  CommerceAuditLog,
  CommerceAuditLogSchema,
} from './schemas/commerce-audit-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommerceAuditLog.name, schema: CommerceAuditLogSchema },
    ]),
  ],
  controllers: [AdminCommerceAuditController],
  providers: [CommerceAuditService],
  exports: [CommerceAuditService],
})
export class CommerceAuditModule {}
