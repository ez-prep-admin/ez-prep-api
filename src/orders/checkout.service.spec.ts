import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { calculateInclusiveTax } from '../common/commerce/calculate-inclusive-tax';
import { DurationPreset } from '../common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { ProductStatus } from '../common/enums/product-status.enum';
import { Offer } from '../offers/schemas/offer.schema';
import { FakeGateway } from '../payments/infrastructure/fake/fake.gateway';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { Payment } from '../payments/schemas/payment.schema';
import { ProductsService } from '../products/products.service';
import { TaxService } from '../tax/tax.service';
import { CheckoutService } from './checkout.service';
import { ORDER_PAID_HANDLER } from './domain/order-paid-handler';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';

describe('CheckoutService', () => {
  const userId = new Types.ObjectId().toHexString();
  const otherUserId = new Types.ObjectId().toHexString();
  const offerId = new Types.ObjectId();
  const productId = new Types.ObjectId();
  const examId = new Types.ObjectId();

  const orders: Array<Record<string, any>> = [];
  const payments: Array<Record<string, any>> = [];
  let taxRate = 18;

  const orderModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const paymentModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };
  const offerModel = { findById: jest.fn() };
  const productsService = { findDocumentById: jest.fn() };
  const taxService = { calculateForCheckout: jest.fn() };
  const paidHandler = { onOrderPaid: jest.fn() };
  const registry = { get: jest.fn() };

  const offer = {
    _id: offerId,
    productId,
    status: OfferStatus.ACTIVE,
    currency: 'INR',
    taxIncluded: true,
    durationPreset: DurationPreset.THREE_MONTHS,
    listAmount: 99900,
    saleAmount: 79900 as number | undefined,
  };

  const product = {
    _id: productId,
    id: productId.toHexString(),
    status: ProductStatus.PUBLISHED,
    isDeleted: false,
    version: 2,
    code: 'SSC-CGL',
    name: 'SSC CGL',
    description: 'Pack',
    grants: [{ scopeType: EntitlementScopeType.EXAM, scopeId: examId }],
  };

  let service: CheckoutService;

  function billing(stateCode = '32') {
    return {
      name: 'Asha Nair',
      stateCode,
      addressLine1: '12 Marine Drive',
      addressLine2: null as string | null,
      city: 'Kochi',
      pincode: '682001',
    };
  }

  beforeEach(async () => {
    orders.length = 0;
    payments.length = 0;
    orderModel.create.mockClear();
    orderModel.findOne.mockClear();
    orderModel.findById.mockClear();
    paymentModel.create.mockClear();
    paymentModel.findOne.mockClear();
    taxRate = 18;
    offer.status = OfferStatus.ACTIVE;
    offer.listAmount = 99900;
    offer.saleAmount = 79900;
    offer.currency = 'INR';
    offer.taxIncluded = true;
    product.status = ProductStatus.PUBLISHED;
    product.isDeleted = false;
    paidHandler.onOrderPaid.mockReset();
    paidHandler.onOrderPaid.mockResolvedValue(undefined);
    registry.get.mockReset();
    registry.get.mockReturnValue(new FakeGateway());

    orderModel.create.mockImplementation(
      async (doc: Record<string, unknown>) => {
        const _id = new Types.ObjectId();
        const order = {
          ...doc,
          _id,
          id: _id.toHexString(),
          save: jest.fn(async function save(this: Record<string, unknown>) {
            return this;
          }),
        };
        orders.push(order);
        return order;
      },
    );
    orderModel.findOne.mockImplementation(
      (filter: { idempotencyKey: string }) => ({
        exec: async () =>
          orders.find(
            order => order.idempotencyKey === filter.idempotencyKey,
          ) ?? null,
      }),
    );
    orderModel.findById.mockImplementation((id: string) => ({
      exec: async () =>
        orders.find(
          order => order.id === String(id) || String(order._id) === String(id),
        ) ?? null,
    }));

    paymentModel.create.mockImplementation(
      async (doc: Record<string, unknown>) => {
        const payment = {
          ...doc,
          _id: new Types.ObjectId(),
          save: jest.fn(async function save(this: Record<string, unknown>) {
            return this;
          }),
        };
        payments.push(payment);
        return payment;
      },
    );
    paymentModel.findOne.mockImplementation(
      (filter: { orderId: { toString(): string } }) => ({
        exec: async () =>
          payments.find(
            payment => String(payment.orderId) === String(filter.orderId),
          ) ?? null,
      }),
    );

    offerModel.findById.mockImplementation((id: string) => ({
      exec: async () => (String(id) === String(offerId) ? offer : null),
    }));
    productsService.findDocumentById.mockImplementation(async (id: string) => {
      if (id !== String(productId)) {
        throw new NotFoundException('Product not found');
      }
      return product;
    });
    taxService.calculateForCheckout.mockImplementation(
      async (gross: number, buyer: string) =>
        calculateInclusiveTax({
          grossAmount: gross,
          taxRate,
          sellerStateCode: '32',
          buyerStateCode: buyer,
        }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: getModelToken(Offer.name), useValue: offerModel },
        { provide: ProductsService, useValue: productsService },
        { provide: TaxService, useValue: taxService },
        { provide: PaymentGatewayRegistry, useValue: registry },
        { provide: ORDER_PAID_HANDLER, useValue: paidHandler },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  it('creates a pending order at the offer effective price with an initiated payment', async () => {
    const created = await service.createOrder(userId, {
      offerId: offerId.toHexString(),
      billing: billing(),
      idempotencyKey: 'key-1',
    });

    expect(created.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(created.amount).toBe(79900);
    expect(created.currency).toBe('INR');
    expect(created.provider).toBe('fake');
    expect(created.providerData).toMatchObject({
      fakeOrderId: `fake_${created.id}`,
      amount: 79900,
      currency: 'INR',
    });
    expect(created.billing).toMatchObject({
      name: 'Asha Nair',
      state: 'Kerala',
      stateCode: '32',
      addressLine1: '12 Marine Drive',
      city: 'Kochi',
      pincode: '682001',
    });
    expect(created.tax.grossAmount).toBe(79900);
    expect(orders[0].items[0].grants).toEqual([
      { scopeType: EntitlementScopeType.EXAM, scopeId: String(examId) },
    ]);
    expect(orders[0].orderNumber).toMatch(/^ORD-/);
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe(PaymentStatus.INITIATED);
    expect(payments[0].amount).toBe(79900);
    expect(taxService.calculateForCheckout).toHaveBeenCalledWith(79900, '32');
  });

  it('returns the same order when the idempotency key is replayed', async () => {
    const first = await service.createOrder(userId, {
      offerId: offerId.toHexString(),
      billing: billing(),
      idempotencyKey: 'key-1',
    });
    const second = await service.createOrder(userId, {
      offerId: offerId.toHexString(),
      billing: billing('27'),
      idempotencyKey: 'key-1',
    });

    expect(second.id).toBe(first.id);
    expect(orderModel.create).toHaveBeenCalledTimes(1);
    expect(payments).toHaveLength(1);
    expect(second.billing.stateCode).toBe('32');
  });

  it('does not reveal an order when another user replays the key', async () => {
    await service.createOrder(userId, {
      offerId: offerId.toHexString(),
      billing: billing(),
      idempotencyKey: 'key-1',
    });

    await expect(
      service.createOrder(otherUserId, {
        offerId: offerId.toHexString(),
        billing: billing(),
        idempotencyKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orderModel.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an inactive offer', async () => {
    offer.status = OfferStatus.INACTIVE;
    await expect(
      service.createOrder(userId, {
        offerId: offerId.toHexString(),
        billing: billing(),
        idempotencyKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orders).toHaveLength(0);
  });

  it('rejects an unpublished product', async () => {
    product.status = ProductStatus.DRAFT;
    await expect(
      service.createOrder(userId, {
        offerId: offerId.toHexString(),
        billing: billing(),
        idempotencyKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orders).toHaveLength(0);
  });

  it('rejects totals under 100 paise', async () => {
    offer.listAmount = 50;
    offer.saleAmount = undefined;
    await expect(
      service.createOrder(userId, {
        offerId: offerId.toHexString(),
        billing: billing(),
        idempotencyKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orders).toHaveLength(0);
  });

  it('does not let another user fetch the order', async () => {
    const created = await service.createOrder(userId, {
      offerId: offerId.toHexString(),
      billing: billing(),
      idempotencyKey: 'key-1',
    });

    await expect(
      service.getOrder(otherUserId, created.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps the tax snapshot after live tax config changes', async () => {
    const created = await service.createOrder(userId, {
      offerId: offerId.toHexString(),
      billing: billing(),
      idempotencyKey: 'key-1',
    });
    const snapshot = { ...created.tax };
    taxRate = 5;

    const loaded = await service.getOrder(userId, created.id);
    expect(loaded.tax).toEqual(snapshot);
    expect(loaded.tax.taxRate).toBe(18);
  });

  it('marks the payment captured and the order paid without entitlements', async () => {
    const created = await service.createOrder(userId, {
      offerId: offerId.toHexString(),
      billing: billing(),
      idempotencyKey: 'key-1',
    });

    const paid = await service.verifyPayment(userId, created.id, {
      fakePaymentId: 'pay_test_1',
    });

    expect(paid.status).toBe(OrderStatus.PAID);
    expect(paid.paidAt).toBeInstanceOf(Date);
    expect(payments[0].status).toBe(PaymentStatus.CAPTURED);
    expect(payments[0].providerPaymentId).toBe('pay_test_1');
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
    expect(paidHandler.onOrderPaid).toHaveBeenCalledWith({
      orderId: created.id,
      userId,
      amount: 79900,
    });

    await service.verifyPayment(userId, created.id, {
      fakePaymentId: 'pay_test_1',
    });
    expect(paidHandler.onOrderPaid).toHaveBeenCalledTimes(1);
  });
});
