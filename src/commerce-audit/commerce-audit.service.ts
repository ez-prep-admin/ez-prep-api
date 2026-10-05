import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CommerceAuditLog,
  CommerceAuditLogDocument,
} from './schemas/commerce-audit-log.schema';

export type CommerceAuditLogInput = {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  correlationId?: string;
};

/** TODO(phase-12): expand commerce audit query APIs and retention. */
@Injectable()
export class CommerceAuditService {
  private readonly logger = new Logger(CommerceAuditService.name);

  constructor(
    @InjectModel(CommerceAuditLog.name)
    private readonly auditModel: Model<CommerceAuditLogDocument>,
  ) {}

  async log(input: CommerceAuditLogInput): Promise<void> {
    try {
      await this.auditModel.create({
        actorUserId: input.actorUserId
          ? new Types.ObjectId(input.actorUserId)
          : undefined,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId
          ? new Types.ObjectId(input.resourceId)
          : undefined,
        before: input.before,
        after: input.after,
        correlationId: input.correlationId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write commerce audit log action=${input.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
