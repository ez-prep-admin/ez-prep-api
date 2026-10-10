import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { expiresAtFromDurationPreset } from '../common/commerce/duration-preset';
import { isEntitlementCurrentlyActive } from '../common/commerce/is-entitlement-active';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { EntitlementSourceType } from '../common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import {
  ExamGroup,
  ExamGroupDocument,
} from '../exam-groups/schemas/exam-group.schema';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { GrantEntitlementDto } from './dto/grant-entitlement.dto';
import { EntitlementResponseDto } from './dto/entitlement-response.dto';
import { Entitlement, EntitlementDocument } from './schemas/entitlement.schema';

export type GrantEntitlementOptions = {
  actorUserId: string;
  provisioningKey?: string;
};

/**
 * Entitlements are the SoT for content access.
 * User.subscription / membershipTier must not be used for authorization (D-06, R-13).
 */
@Injectable()
export class EntitlementsService {
  constructor(
    @InjectModel(Entitlement.name)
    private readonly entitlementModel: Model<EntitlementDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
    @InjectModel(ExamGroup.name)
    private readonly examGroupModel: Model<ExamGroupDocument>,
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly commerceAuditService: CommerceAuditService,
  ) {}

  async grant(
    dto: GrantEntitlementDto,
    options: GrantEntitlementOptions,
  ): Promise<EntitlementResponseDto> {
    await this.assertUserExists(dto.userId);
    await this.assertScopeExists(dto.scopeType, dto.scopeId);

    const startsAt = new Date();
    const expiresAt = expiresAtFromDurationPreset(dto.durationPreset, startsAt);
    const provisioningKey =
      options.provisioningKey ?? `admin:${options.actorUserId}:${randomUUID()}`;

    const doc = new this.entitlementModel({
      userId: new Types.ObjectId(dto.userId),
      scopeType: dto.scopeType,
      scopeId: new Types.ObjectId(dto.scopeId),
      status: EntitlementStatus.ACTIVE,
      startsAt,
      expiresAt,
      sourceType: EntitlementSourceType.ADMIN_GRANT,
      sourceId: options.actorUserId,
      productId: dto.productId ? new Types.ObjectId(dto.productId) : undefined,
      provisioningKey,
      metadata: dto.reason ? { reason: dto.reason } : undefined,
    });

    try {
      await doc.save();
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `Entitlement with provisioningKey "${provisioningKey}" already exists`,
        );
      }
      throw error;
    }

    const response = this.toResponseDto(doc);
    await this.commerceAuditService.log({
      actorUserId: options.actorUserId,
      action: 'ENTITLEMENT_GRANTED',
      resourceType: 'entitlement',
      resourceId: response.id,
      after: {
        userId: response.userId,
        scopeType: response.scopeType,
        scopeId: response.scopeId,
        durationPreset: dto.durationPreset,
        expiresAt: response.expiresAt,
        provisioningKey: response.provisioningKey,
      },
    });

    return response;
  }

  async revoke(
    entitlementId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<EntitlementResponseDto> {
    if (!Types.ObjectId.isValid(entitlementId)) {
      throw new BadRequestException('Invalid entitlement id');
    }

    const entitlement = await this.entitlementModel.findById(entitlementId);
    if (!entitlement) {
      throw new NotFoundException(
        `Entitlement with ID "${entitlementId}" not found`,
      );
    }

    if (entitlement.status === EntitlementStatus.REVOKED) {
      return this.toResponseDto(entitlement);
    }

    const before = {
      status: entitlement.status,
      revokedAt: entitlement.revokedAt,
      revokeReason: entitlement.revokeReason,
    };

    entitlement.status = EntitlementStatus.REVOKED;
    entitlement.revokedAt = new Date();
    entitlement.revokeReason = reason ?? 'admin_revoke';
    await entitlement.save();

    const response = this.toResponseDto(entitlement);
    await this.commerceAuditService.log({
      actorUserId,
      action: 'ENTITLEMENT_REVOKED',
      resourceType: 'entitlement',
      resourceId: response.id,
      before,
      after: {
        status: response.status,
        revokedAt: response.revokedAt,
        revokeReason: response.revokeReason,
      },
    });

    return response;
  }

  /**
   * Revokes PAYMENT entitlements created for this order.
   * ADMIN_GRANT and other orders are left unchanged.
   */
  async revokePaymentEntitlementsForOrder(
    orderId: string,
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order id');
    }

    const docs = await this.entitlementModel
      .find({
        orderId: new Types.ObjectId(orderId),
        sourceType: EntitlementSourceType.PAYMENT,
      })
      .exec();

    for (const doc of docs) {
      await this.revoke(this.idOf(doc), actorUserId, reason);
    }
  }

  async listByUser(
    userId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<EntitlementResponseDto[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const docs = await this.entitlementModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    const now = new Date();
    const mapped = docs.map(doc => this.toResponseDto(doc));
    await this.attachProductNames(mapped);

    if (options.includeInactive) {
      return mapped;
    }

    return mapped.filter(entitlement =>
      isEntitlementCurrentlyActive(
        {
          status: entitlement.status,
          expiresAt: entitlement.expiresAt,
        },
        now,
      ),
    );
  }

  /**
   * Active entitlements for access decisions (lazy expiry applied).
   */
  async findActiveForUser(userId: string): Promise<EntitlementDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }

    const docs = await this.entitlementModel
      .find({
        userId: new Types.ObjectId(userId),
        status: EntitlementStatus.ACTIVE,
      })
      .exec();

    const now = new Date();
    return docs.filter(doc =>
      isEntitlementCurrentlyActive(
        { status: doc.status, expiresAt: doc.expiresAt },
        now,
      ),
    );
  }

  private async assertUserExists(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(userId).select('_id').lean();
    if (!user) {
      throw new BadRequestException(`User with ID "${userId}" not found`);
    }
  }

  private async assertScopeExists(
    scopeType: EntitlementScopeType,
    scopeId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(scopeId)) {
      throw new BadRequestException('Invalid scopeId');
    }

    let exists = false;
    switch (scopeType) {
      case EntitlementScopeType.EXAM:
        exists = !!(await this.examModel
          .findById(scopeId)
          .select('_id')
          .lean());
        break;
      case EntitlementScopeType.EXAM_GROUP:
        exists = !!(await this.examGroupModel
          .findById(scopeId)
          .select('_id')
          .lean());
        break;
      case EntitlementScopeType.MOCK_TEST:
        exists = !!(await this.mockTestModel
          .findById(scopeId)
          .select('_id')
          .lean());
        break;
      default:
        throw new BadRequestException(`Unsupported scopeType: ${scopeType}`);
    }

    if (!exists) {
      throw new BadRequestException(
        `${scopeType} with ID "${scopeId}" not found`,
      );
    }
  }

  private async attachProductNames(
    rows: EntitlementResponseDto[],
  ): Promise<void> {
    const ids = [
      ...new Set(
        rows
          .map(row => row.productId)
          .filter((id): id is string =>
            Boolean(id && Types.ObjectId.isValid(id)),
          ),
      ),
    ];
    if (ids.length === 0) {
      return;
    }

    const products = await this.productModel
      .find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) } })
      .select('name code')
      .exec();
    const byId = new Map(
      products.map(product => [
        String(product._id),
        { name: product.name, code: product.code },
      ]),
    );
    for (const row of rows) {
      if (!row.productId) {
        continue;
      }
      const product = byId.get(row.productId);
      if (!product) {
        continue;
      }
      row.productName = product.name;
      row.productCode = product.code;
    }
  }

  private idOf(doc: EntitlementDocument): string {
    const withVirtual = doc as EntitlementDocument & { id?: string };
    return withVirtual.id ? String(withVirtual.id) : String(doc._id);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    );
  }

  private toResponseDto(doc: EntitlementDocument): EntitlementResponseDto {
    const obj = doc.toObject({ virtuals: true }) as Entitlement & {
      id: string;
      userId: Types.ObjectId | string;
      scopeId: Types.ObjectId | string;
      productId?: Types.ObjectId | string;
      orderId?: Types.ObjectId | string;
    };

    return new EntitlementResponseDto({
      id: obj.id,
      userId: String(obj.userId),
      scopeType: obj.scopeType,
      scopeId: String(obj.scopeId),
      status: obj.status,
      startsAt: obj.startsAt,
      expiresAt: obj.expiresAt ?? null,
      sourceType: obj.sourceType,
      sourceId: obj.sourceId,
      productId: obj.productId ? String(obj.productId) : undefined,
      productVersion: obj.productVersion,
      orderId: obj.orderId ? String(obj.orderId) : undefined,
      provisioningKey: obj.provisioningKey,
      revokedAt: obj.revokedAt,
      revokeReason: obj.revokeReason,
      metadata: obj.metadata,
      createdAt: obj.createdAt as Date,
      updatedAt: obj.updatedAt as Date,
    });
  }
}
