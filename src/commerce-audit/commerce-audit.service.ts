import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { redactAuditPayload } from './redact-audit-payload';
import {
  CommerceAuditLog,
  CommerceAuditLogDocument,
} from './schemas/commerce-audit-log.schema';

export type CommerceAuditLogInput = {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: object;
  after?: object;
  correlationId?: string;
};

export type CommerceAuditLogView = {
  id: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  correlationId?: string;
  createdAt?: Date;
};

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
        before: redactAuditPayload(input.before),
        after: redactAuditPayload(input.after),
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

  async list(options: {
    page?: number;
    limit?: number;
    action?: string;
    resourceType?: string;
  }): Promise<{
    data: CommerceAuditLogView[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const page = positiveInt(options.page, 1);
    const limit = Math.min(positiveInt(options.limit, 20), 100);
    const skip = (page - 1) * limit;
    const query: FilterQuery<CommerceAuditLog> = {};
    if (options.action?.trim()) {
      query.action = options.action.trim();
    }
    if (options.resourceType?.trim()) {
      query.resourceType = options.resourceType.trim();
    }

    const [rows, total] = await Promise.all([
      this.auditModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      data: rows.map(row => this.toView(row)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  private toView(doc: CommerceAuditLogDocument): CommerceAuditLogView {
    const obj = doc.toObject();
    return {
      id: String(obj.id ?? doc._id),
      actorUserId: obj.actorUserId ? String(obj.actorUserId) : undefined,
      action: obj.action,
      resourceType: obj.resourceType,
      resourceId: obj.resourceId ? String(obj.resourceId) : undefined,
      before: obj.before,
      after: obj.after,
      correlationId: obj.correlationId,
      createdAt: obj.createdAt,
    };
  }
}

function positiveInt(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}
