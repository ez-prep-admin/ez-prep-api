import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { stackEntitlementWindow } from '../common/commerce/stack-entitlement-window';
import { EntitlementSourceType } from '../common/enums/entitlement-source-type.enum';
import { EntitlementStatus } from '../common/enums/entitlement-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CoverageService } from './coverage.service';
import { EntitlementLockService } from './entitlement-lock.service';
import { PAID_ORDER_NOTIFIER, PaidOrderNotifier } from './paid-order-notifier';
import { Entitlement, EntitlementDocument } from './schemas/entitlement.schema';

export type ProvisionPaidOrderResult = {
  orderId: string;
  created: number;
  alreadyProvisioned: boolean;
};

export function buildProvisioningKey(input: {
  orderId: string;
  scopeType: string;
  scopeId: string;
  productVersion: number;
}): string {
  return `order:${input.orderId}:grant:${input.scopeType}:${input.scopeId}:v${input.productVersion}`;
}

/**
 * Grants entitlements from a paid order's item snapshots.
 * Safe to call again: unique provisioning keys and `order.provisionedAt`
 * keep a replay from inserting a second set.
 * Grants are inserted, then `provisionedAt` is saved. The invoice notifier
 * runs after that and must not throw into verify or the webhook. A missing
 * invoice is repaired by the sweep.
 */
@Injectable()
export class EntitlementProvisioningService {
  private readonly logger = new Logger(EntitlementProvisioningService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Entitlement.name)
    private readonly entitlementModel: Model<EntitlementDocument>,
    private readonly commerceAuditService: CommerceAuditService,
    @Inject(PAID_ORDER_NOTIFIER)
    private readonly paidOrderNotifier: PaidOrderNotifier,
    private readonly entitlementLock: EntitlementLockService,
    private readonly coverageService: CoverageService,
  ) {}

  async provisionForPaidOrder(
    orderId: string,
  ): Promise<ProvisionPaidOrderResult> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }

    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Order is not paid');
    }

    const canonicalOrderId = String(order._id);
    if (order.provisionedAt) {
      return {
        orderId: canonicalOrderId,
        created: 0,
        alreadyProvisioned: true,
      };
    }

    this.assertGrantIds(order);

    const grants = order.items.flatMap(item =>
      (item.grants ?? []).map(grant => ({
        scopeType: grant.scopeType,
        scopeId: String(grant.scopeId),
      })),
    );
    const redundant = await this.coverageService.isCoveredForLife(
      String(order.userId),
      grants,
    );

    const now = new Date();
    let created = 0;
    for (const item of order.items) {
      const inserted = await this.entitlementLock.withLock(
        String(order.userId),
        String(item.productId),
        () => this.provisionItem(order, canonicalOrderId, item, now),
      );
      created += inserted;
    }

    if (redundant) {
      order.redundantPurchase = true;
      await this.commerceAuditService.log({
        actorUserId: String(order.userId),
        action: 'REDUNDANT_PURCHASE',
        resourceType: 'order',
        resourceId: canonicalOrderId,
        after: { redundantPurchase: true },
      });
    }

    order.provisionedAt = new Date();
    const paidAt = order.paidAt ?? order.provisionedAt;
    order.nextRepairAt = new Date(paidAt.getTime() + 2 * 60 * 1000);
    await order.save();

    try {
      await this.paidOrderNotifier.onOrderProvisioned(canonicalOrderId);
    } catch (error) {
      this.logger.warn(
        `Invoice schedule failed for order ${canonicalOrderId}: ${
          error instanceof Error ? error.message : 'unexpected error'
        }`,
      );
    }

    await this.commerceAuditService.log({
      actorUserId: String(order.userId),
      action: 'ORDER_PROVISIONED',
      resourceType: 'order',
      resourceId: canonicalOrderId,
      after: { created },
    });
    this.logger.log(`Provisioned order ${canonicalOrderId} created=${created}`);

    return {
      orderId: canonicalOrderId,
      created,
      alreadyProvisioned: false,
    };
  }

  private async provisionItem(
    order: OrderDocument,
    orderId: string,
    item: OrderDocument['items'][number],
    now: Date,
  ): Promise<number> {
    const overlapping = await this.entitlementModel
      .find({
        userId: order.userId,
        productId: item.productId,
        status: EntitlementStatus.ACTIVE,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .exec();
    const window = stackEntitlementWindow(
      item.durationPreset,
      now,
      overlapping.map(row => ({ expiresAt: row.expiresAt })),
    );
    let created = 0;
    for (const grant of item.grants ?? []) {
      const inserted = await this.insertGrant({
        order,
        orderId,
        productId: item.productId,
        productVersion: item.productVersion,
        scopeType: grant.scopeType,
        scopeId: String(grant.scopeId),
        startsAt: window.startsAt,
        expiresAt: window.expiresAt,
        durationPreset: item.durationPreset,
      });
      if (inserted) {
        created += 1;
      }
    }
    return created;
  }

  private assertGrantIds(order: OrderDocument): void {
    for (const item of order.items) {
      for (const grant of item.grants ?? []) {
        if (!Types.ObjectId.isValid(grant.scopeId)) {
          throw new BadRequestException('Order grant scopeId is invalid');
        }
      }
    }
  }

  private async insertGrant(input: {
    order: OrderDocument;
    orderId: string;
    productId: Types.ObjectId;
    productVersion: number;
    scopeType: Entitlement['scopeType'];
    scopeId: string;
    startsAt: Date;
    expiresAt: Date | null;
    durationPreset: OrderDocument['items'][number]['durationPreset'];
  }): Promise<boolean> {
    const provisioningKey = buildProvisioningKey({
      orderId: input.orderId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      productVersion: input.productVersion,
    });

    try {
      await this.entitlementModel.create({
        userId: input.order.userId,
        scopeType: input.scopeType,
        scopeId: new Types.ObjectId(input.scopeId),
        status: EntitlementStatus.ACTIVE,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        durationPreset: input.durationPreset,
        sourceType: EntitlementSourceType.PAYMENT,
        sourceId: input.orderId,
        productId: input.productId,
        productVersion: input.productVersion,
        orderId: input.order._id,
        provisioningKey,
      });
      return true;
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: number }).code === 11000
  );
}
