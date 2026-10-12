import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommerceAuditService } from '../commerce-audit/commerce-audit.service';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { OrderStatus } from '../common/enums/order-status.enum';
import { EntitlementProvisioningService } from '../entitlements/entitlement-provisioning.service';
import { InvoiceService } from '../invoices/invoice.service';
import { nextRepairDelayMs } from './late-capture-watch';
import { OrdersService } from './orders.service';
import { Order, OrderDocument } from './schemas/order.schema';

const PROVISION_DELAY_MS = 10 * 60 * 1000;
const INVOICE_DELAY_MS = 2 * 60 * 1000;

@Injectable()
export class RepairSweepsService {
  private readonly logger = new Logger(RepairSweepsService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly ordersService: OrdersService,
    private readonly provisioning: EntitlementProvisioningService,
    private readonly invoiceService: InvoiceService,
    private readonly commerceConfig: CommerceConfigService,
    private readonly commerceAuditService: CommerceAuditService,
  ) {}

  async sweep(now: Date = new Date()): Promise<{ examined: number }> {
    const batch = this.commerceConfig.settings.reconciliationBatch ?? 50;
    const dueFilter = {
      status: { $in: [OrderStatus.PAID, OrderStatus.REFUNDED] },
      nextRepairAt: { $lte: now },
    };
    const due = await this.orderModel
      .find(dueFilter)
      .sort({ nextRepairAt: 1 })
      .limit(batch)
      .exec();
    let examined = 0;
    for (const row of due) {
      if (!(await this.needsRepair(row, now, false))) {
        await this.clearRepair(row);
        continue;
      }
      examined += 1;
      await this.repairDocument(row, now, false);
    }

    const unprovisioned = await this.orderModel
      .find({
        status: OrderStatus.PAID,
        provisionedAt: null,
        paidAt: { $lt: new Date(now.getTime() - PROVISION_DELAY_MS) },
        $or: [
          { nextRepairAt: null },
          { nextRepairAt: { $exists: false } },
          { nextRepairAt: { $lte: now } },
        ],
      })
      .sort({ paidAt: 1 })
      .limit(batch)
      .exec();
    for (const row of unprovisioned) {
      if (due.some(item => String(item._id) === String(row._id))) {
        continue;
      }
      examined += 1;
      await this.repairDocument(row, now, false);
    }
    return { examined };
  }

  async repairOrder(orderId: string, actorUserId?: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    await this.repairDocument(order, new Date(), true);
    await this.commerceAuditService.log({
      ...(actorUserId ? { actorUserId } : {}),
      action: 'ORDER_REPAIRED',
      resourceType: 'order',
      resourceId: this.ordersService.idOf(order),
    });
  }

  private async repairDocument(
    order: OrderDocument,
    now: Date,
    force: boolean,
  ): Promise<void> {
    const orderId = this.ordersService.idOf(order);
    try {
      if (order.status === OrderStatus.PAID && !order.provisionedAt) {
        if (this.ready(order.paidAt, PROVISION_DELAY_MS, now, force, order)) {
          await this.provisioning.provisionForPaidOrder(orderId);
        }
      }
      const fresh = (await this.orderModel.findById(order._id).exec()) ?? order;
      if (
        (fresh.status === OrderStatus.PAID ||
          fresh.status === OrderStatus.REFUNDED) &&
        fresh.provisionedAt &&
        this.commerceConfig.settings.invoicesEnabled
      ) {
        const state = await this.invoiceService.repairState(orderId);
        if (
          state === 'missing' &&
          this.ready(fresh.paidAt, INVOICE_DELAY_MS, now, force, fresh)
        ) {
          await this.invoiceService.issueForPaidOrder(orderId);
        } else if (state === 'needs-pdf') {
          await this.invoiceService.ensureStoredPdf(orderId);
        }
      }
      await this.clearRepair(order);
    } catch (error) {
      const attempts = (order.repairAttempts ?? 0) + 1;
      await this.orderModel
        .updateOne(
          { _id: order._id },
          {
            $set: {
              repairAttempts: attempts,
              nextRepairAt: new Date(
                now.getTime() + nextRepairDelayMs(attempts),
              ),
            },
          },
        )
        .exec();
      this.logger.warn(
        `Repair failed for order ${orderId}: ${
          error instanceof Error ? error.message : 'unexpected error'
        }`,
      );
    }
  }

  private async clearRepair(order: OrderDocument): Promise<void> {
    await this.orderModel
      .updateOne(
        { _id: order._id },
        { $unset: { nextRepairAt: '', repairAttempts: '' } },
      )
      .exec();
  }

  private async needsRepair(
    order: OrderDocument,
    now: Date,
    force: boolean,
  ): Promise<boolean> {
    if (order.status === OrderStatus.PAID && !order.provisionedAt) {
      return this.ready(order.paidAt, PROVISION_DELAY_MS, now, force, order);
    }
    if (!order.provisionedAt || !this.commerceConfig.settings.invoicesEnabled) {
      return false;
    }
    const state = await this.invoiceService.repairState(
      this.ordersService.idOf(order),
    );
    if (state === 'ready') {
      return false;
    }
    if (state === 'needs-pdf') {
      return force || this.due(order.nextRepairAt, now);
    }
    return this.ready(order.paidAt, INVOICE_DELAY_MS, now, force, order);
  }

  private ready(
    paidAt: Date | undefined,
    delayMs: number,
    now: Date,
    force: boolean,
    order: OrderDocument,
  ): boolean {
    if (force) {
      return true;
    }
    if (!paidAt) {
      return false;
    }
    if (now.getTime() - paidAt.getTime() < delayMs) {
      return false;
    }
    return this.due(order.nextRepairAt, now);
  }

  private due(nextRepairAt: Date | undefined, now: Date): boolean {
    return !nextRepairAt || nextRepairAt.getTime() <= now.getTime();
  }
}
