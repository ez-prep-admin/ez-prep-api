import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildProductVersionSnapshot } from '../common/commerce/product-version-snapshot';
import { resolveEffectiveAmount } from '../common/commerce/resolve-effective-amount';
import { indianStateByCode } from '../common/commerce/indian-states';
import {
  MIN_ORDER_AMOUNT_PAISE,
  ORDER_PAYMENT_WINDOW_MS,
} from '../common/commerce/checkout.constants';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { ProductStatus } from '../common/enums/product-status.enum';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { CommerceConfigService } from '../commerce/commerce-config.service';
import { CoverageService } from '../entitlements/coverage.service';
import {
  ProductVersion,
  ProductVersionDocument,
} from '../products/schemas/product-version.schema';
import { ProductsService } from '../products/products.service';
import { TaxService } from '../tax/tax.service';
import { CheckoutBillingDto } from './dto/create-checkout-order.dto';
import { CheckoutOrderDataDto } from './dto/checkout-order-response.dto';
import { duplicateField } from './domain/duplicate-key';
import { OrdersService } from './orders.service';
import { OrderBillingSnapshot, OrderDocument } from './schemas/order.schema';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly ordersService: OrdersService,
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    private readonly productsService: ProductsService,
    @InjectModel(ProductVersion.name)
    private readonly productVersionModel: Model<ProductVersionDocument>,
    private readonly taxService: TaxService,
    private readonly registry: PaymentGatewayRegistry,
    private readonly commerceConfig: CommerceConfigService,
    private readonly coverageService: CoverageService,
  ) {}

  async createOrder(
    userId: string,
    dto: {
      offerId: string;
      billing: CheckoutBillingDto;
      idempotencyKey: string;
    },
  ): Promise<CheckoutOrderDataDto> {
    const billing = this.toBilling(dto.billing);
    const existing = await this.ordersService.findByIdempotencyKey(
      dto.idempotencyKey,
    );
    if (existing) {
      return this.replay(existing, userId);
    }

    const priced = await this.priceOffer(dto.offerId);
    if (
      await this.coverageService.isCoveredForLife(userId, priced.item.grants)
    ) {
      throw new ConflictException({
        message: 'This product is already covered for life',
        details: { code: 'ALREADY_COVERED' },
      });
    }

    const openOrders = await this.ordersService.countOpenCheckoutOrders(
      userId,
      new Date(Date.now() - ORDER_PAYMENT_WINDOW_MS),
    );
    if (openOrders >= this.commerceConfig.settings.maxOpenOrdersPerUser) {
      throw new HttpException(
        {
          message: 'Too many open orders',
          details: { code: 'TOO_MANY_OPEN_ORDERS' },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const tax = await this.taxService.calculateForCheckout(
      priced.amount,
      billing.stateCode,
    );
    const gateway = this.registry.get();

    let order: OrderDocument;
    try {
      order = await this.ordersService.insertCreated({
        userId: new Types.ObjectId(userId),
        items: [priced.item],
        amount: priced.amount,
        currency: 'INR',
        tax: { ...tax },
        billing,
        paymentProvider: gateway.provider,
        idempotencyKey: dto.idempotencyKey,
        expiresAt: new Date(Date.now() + ORDER_PAYMENT_WINDOW_MS),
      });
    } catch (error) {
      if (duplicateField(error) === 'idempotencyKey') {
        const raced = await this.ordersService.findByIdempotencyKey(
          dto.idempotencyKey,
        );
        if (!raced) {
          throw error;
        }
        return this.replay(raced, userId);
      }
      throw error;
    }

    return this.openProviderOrder(order);
  }

  async getOrder(
    userId: string,
    orderId: string,
  ): Promise<CheckoutOrderDataDto> {
    const order = await this.requireOwned(userId, orderId);
    return this.toView(order);
  }

  /**
   * Verify a provider payload and mark the order paid.
   * The first transition to PAID provisions entitlements through the paid handler.
   */
  async verifyPayment(
    userId: string,
    orderId: string,
    providerPayload: Record<string, unknown>,
    provider?: string,
  ): Promise<CheckoutOrderDataDto> {
    const order = await this.requireOwned(userId, orderId);
    if (provider && provider !== order.paymentProvider) {
      throw new BadRequestException(
        'Payment provider does not match this order',
      );
    }
    if (order.status === OrderStatus.PAID) {
      return this.toView(order);
    }
    if (order.paymentProvider === 'razorpay') {
      const claimedOrderId = providerPayload.razorpay_order_id;
      if (
        typeof claimedOrderId !== 'string' ||
        claimedOrderId !== order.providerOrderId
      ) {
        throw new BadRequestException('Payment does not match this order');
      }
    }

    const gateway = this.registry.get(order.paymentProvider);
    const result = await gateway.verifyPayment({
      orderId: this.ordersService.idOf(order),
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: order.currency,
      providerPayload,
    });

    if (
      !result.verified ||
      result.status !== 'CAPTURED' ||
      !result.providerPaymentId
    ) {
      throw new BadRequestException(
        result.failureReason ?? 'Payment verification failed',
      );
    }

    const paid = await this.ordersService.markOrderPaid(
      this.ordersService.idOf(order),
      { providerPaymentId: result.providerPaymentId },
    );
    return this.toView(paid);
  }

  private async replay(
    order: OrderDocument,
    userId: string,
  ): Promise<CheckoutOrderDataDto> {
    if (String(order.userId) !== userId) {
      throw new ConflictException('This idempotencyKey is already in use');
    }
    if (order.status === OrderStatus.CREATED) {
      return this.openProviderOrder(order);
    }
    return this.toView(order);
  }

  private async openProviderOrder(
    order: OrderDocument,
  ): Promise<CheckoutOrderDataDto> {
    if (order.status !== OrderStatus.CREATED) {
      return this.toView(order);
    }
    if (order.currency !== 'INR') {
      throw new BadRequestException('Only INR orders can be paid');
    }

    const gateway = this.registry.get(order.paymentProvider);
    const providerOrder = await gateway.createOrder({
      orderId: this.ordersService.idOf(order),
      amount: order.amount,
      currency: 'INR',
      receipt: order.orderNumber,
    });
    const pending = await this.ordersService.markPendingPayment(order, {
      provider: gateway.provider,
      providerOrderId: providerOrder.providerOrderId,
    });
    await this.ordersService.ensureInitiatedPayment(pending);
    return this.toView(pending, providerOrder.providerData);
  }

  private async requireOwned(
    userId: string,
    orderId: string,
  ): Promise<OrderDocument> {
    const order = await this.ordersService.findById(orderId);
    if (!order || String(order.userId) !== userId) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async priceOffer(offerId: string): Promise<{
    amount: number;
    item: OrderDocument['items'][number];
  }> {
    if (!Types.ObjectId.isValid(offerId)) {
      throw new NotFoundException('Offer not found');
    }

    const offer = await this.offerModel.findById(offerId).exec();
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    if (offer.status !== OfferStatus.ACTIVE) {
      throw new BadRequestException('Offer is not active');
    }
    if (offer.currency !== 'INR' || offer.taxIncluded === false) {
      throw new BadRequestException('Offer price must be inclusive INR');
    }

    const product = await this.productsService.findDocumentById(
      String(offer.productId),
    );
    if (product.status !== ProductStatus.PUBLISHED || product.isDeleted) {
      throw new BadRequestException('Product is not published');
    }

    const version = await this.productVersionModel
      .findOne({ productId: product._id, version: product.version })
      .exec();
    if (!version || (version.grants ?? []).length === 0) {
      throw new BadRequestException({
        message: 'Product is not purchasable',
        details: { code: 'PRODUCT_NOT_PURCHASABLE' },
      });
    }

    const amount = resolveEffectiveAmount(offer);
    if (!Number.isInteger(amount) || amount < MIN_ORDER_AMOUNT_PAISE) {
      throw new BadRequestException(
        `Order amount must be at least ${MIN_ORDER_AMOUNT_PAISE} paise`,
      );
    }

    const snapshot = buildProductVersionSnapshot({
      id: String((product as { id?: string }).id ?? product._id),
      version: version.version,
      code: version.code,
      name: version.name,
      description: version.description,
      grants: (version.grants ?? []).map(grant => ({
        scopeType: grant.scopeType,
        scopeId: String(grant.scopeId),
      })),
    });

    return {
      amount,
      item: {
        productId: product._id,
        productVersion: snapshot.version,
        productCode: snapshot.code,
        productName: snapshot.name,
        offerId: offer._id,
        durationPreset: offer.durationPreset,
        listAmount: offer.listAmount,
        amount,
        grants: snapshot.grants,
      },
    };
  }

  private toBilling(dto: CheckoutBillingDto): OrderBillingSnapshot {
    const state = indianStateByCode(dto.stateCode);
    if (!state) {
      throw new BadRequestException('Unknown billing stateCode');
    }

    const addressLine2 = dto.addressLine2?.trim();
    return {
      name: dto.name.trim(),
      state: state.name,
      stateCode: state.code,
      addressLine1: dto.addressLine1.trim(),
      ...(addressLine2 ? { addressLine2 } : {}),
      city: dto.city.trim(),
      pincode: dto.pincode,
    };
  }

  private toView(
    order: OrderDocument,
    providerData?: Record<string, unknown>,
  ): CheckoutOrderDataDto {
    return {
      id: this.ordersService.idOf(order),
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      provider: order.paymentProvider ?? 'fake',
      providerData: providerData ?? this.providerData(order),
      expiresAt: order.expiresAt,
      tax: {
        grossAmount: order.tax.grossAmount,
        taxableAmount: order.tax.taxableAmount,
        taxAmount: order.tax.taxAmount,
        cgst: order.tax.cgst,
        sgst: order.tax.sgst,
        igst: order.tax.igst,
        taxRate: order.tax.taxRate,
        ...(order.tax.supplyType ? { supplyType: order.tax.supplyType } : {}),
        ...(order.tax.sellerStateCode
          ? { sellerStateCode: order.tax.sellerStateCode }
          : {}),
        ...(order.tax.buyerStateCode
          ? { buyerStateCode: order.tax.buyerStateCode }
          : {}),
      },
      billing: {
        name: order.billing.name,
        state: order.billing.state,
        stateCode: order.billing.stateCode,
        addressLine1: order.billing.addressLine1,
        addressLine2: order.billing.addressLine2,
        city: order.billing.city,
        pincode: order.billing.pincode,
      },
      paidAt: order.paidAt,
    };
  }

  private providerData(order: OrderDocument): Record<string, unknown> {
    return this.registry.get(order.paymentProvider).clientProviderData({
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: order.currency,
    });
  }
}
