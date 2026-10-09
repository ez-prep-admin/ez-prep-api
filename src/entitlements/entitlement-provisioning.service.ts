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
 * keep a replay from inserting a second set. The paid notifier runs before
 * `provisionedAt` is saved. If it throws, the next paid signal retries.
 * Repair a PAID order whose `provisionedAt` is still unset by calling this
 * method again. There is no admin HTTP route for that in this phase.
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

    const now = new Date();
    const plans = [];
    for (const item of order.items) {
      const overlapping = await this.entitlementModel
        .find({
          userId: order.userId,
          productId: item.productId,
          status: EntitlementStatus.ACTIVE,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        })
        .exec();
      plans.push({
        item,
        window: stackEntitlementWindow(
          item.durationPreset,
          now,
          overlapping.map(row => ({ expiresAt: row.expiresAt })),
        ),
      });
    }

    let created = 0;
    for (const plan of plans) {
      for (const grant of plan.item.grants ?? []) {
        const inserted = await this.insertGrant({
          order,
          orderId: canonicalOrderId,
          productId: plan.item.productId,
          productVersion: plan.item.productVersion,
          scopeType: grant.scopeType,
          scopeId: grant.scopeId,
          startsAt: plan.window.startsAt,
          expiresAt: plan.window.expiresAt,
        });
        if (inserted) {
          created += 1;
        }
      }
    }

    await this.paidOrderNotifier.onOrderProvisioned(canonicalOrderId);

    order.provisionedAt = new Date();
    await order.save();

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
