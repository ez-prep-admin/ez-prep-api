import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Offer } from '../offers/schemas/offer.schema';
import { PaymentGatewayRegistry } from '../payments/domain/payment-gateway.registry';
import { ProductsService } from '../products/products.service';
import { TaxService } from '../tax/tax.service';
import { CheckoutService } from './checkout.service';
import { OrdersService } from './orders.service';

describe('CheckoutService razorpay verify', () => {
  const userId = new Types.ObjectId().toHexString();
  const ordersService = {
    findById: jest.fn(),
    idOf: jest.fn(),
    markOrderPaid: jest.fn(),
  };
  const registry = { get: jest.fn() };
  const gateway = {
    provider: 'razorpay',
    verifyPayment: jest.fn(),
    clientProviderData: jest.fn().mockReturnValue({
      razorpayOrderId: 'order_rzp',
      amount: 79900,
      currency: 'INR',
      keyId: 'rzp_test_key',
    }),
  };

  const order = {
    id: 'order1',
    userId,
    status: OrderStatus.PENDING_PAYMENT,
    paymentProvider: 'razorpay',
    providerOrderId: 'order_rzp',
    amount: 79900,
    currency: 'INR',
    expiresAt: new Date('2026-10-09T12:30:00.000Z'),
    tax: {
      grossAmount: 79900,
      taxableAmount: 67712,
      taxAmount: 12188,
      cgst: 6094,
      sgst: 6094,
      igst: 0,
      taxRate: 18,
    },
    billing: {
      name: 'Asha Nair',
      state: 'Kerala',
      stateCode: '32',
      addressLine1: '12 Marine Drive',
      city: 'Kochi',
      pincode: '682001',
    },
  };

  let service: CheckoutService;

  beforeEach(async () => {
    ordersService.findById.mockReset();
    ordersService.markOrderPaid.mockReset();
    gateway.verifyPayment.mockReset();
    ordersService.idOf.mockReturnValue('order1');
    ordersService.findById.mockResolvedValue(order);
    registry.get.mockReturnValue(gateway);
    order.status = OrderStatus.PENDING_PAYMENT;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: OrdersService, useValue: ordersService },
        { provide: getModelToken(Offer.name), useValue: {} },
        { provide: ProductsService, useValue: {} },
        { provide: TaxService, useValue: {} },
        { provide: PaymentGatewayRegistry, useValue: registry },
      ],
    }).compile();
    service = module.get(CheckoutService);
  });

  const payload = {
    razorpay_order_id: 'order_rzp',
    razorpay_payment_id: 'pay_1',
    razorpay_signature: 'sig',
  };

  it('rejects a provider that does not match the order', async () => {
    await expect(
      service.verifyPayment(userId, 'order1', payload, 'fake'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ordersService.markOrderPaid).not.toHaveBeenCalled();
    expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
  });

  it('rejects a payload for a different Razorpay order', async () => {
    await expect(
      service.verifyPayment(
        userId,
        'order1',
        { ...payload, razorpay_order_id: 'order_other' },
        'razorpay',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.verifyPayment).not.toHaveBeenCalled();
    expect(ordersService.markOrderPaid).not.toHaveBeenCalled();
  });

  it('does not mark the order paid when the signature is rejected', async () => {
    gateway.verifyPayment.mockResolvedValue({
      verified: false,
      status: 'FAILED',
      failureReason: 'Invalid payment signature',
    });

    await expect(
      service.verifyPayment(userId, 'order1', payload, 'razorpay'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ordersService.markOrderPaid).not.toHaveBeenCalled();
    expect(order.status).toBe(OrderStatus.PENDING_PAYMENT);
  });

  it('marks the order paid and returns the public key id', async () => {
    gateway.verifyPayment.mockResolvedValue({
      verified: true,
      status: 'CAPTURED',
      providerPaymentId: 'pay_1',
    });
    ordersService.markOrderPaid.mockImplementation(async () => ({
      ...order,
      status: OrderStatus.PAID,
      paidAt: new Date('2026-10-09T12:00:00.000Z'),
    }));

    const paid = await service.verifyPayment(
      userId,
      'order1',
      payload,
      'razorpay',
    );

    expect(ordersService.markOrderPaid).toHaveBeenCalledWith('order1', {
      providerPaymentId: 'pay_1',
    });
    expect(paid.status).toBe(OrderStatus.PAID);
    expect(paid.providerData).toEqual({
      razorpayOrderId: 'order_rzp',
      amount: 79900,
      currency: 'INR',
      keyId: 'rzp_test_key',
    });
  });
});
