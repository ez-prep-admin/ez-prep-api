import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
  providers: [CommerceAuditService],
  exports: [CommerceAuditService],
})
export class CommerceAuditModule {}
