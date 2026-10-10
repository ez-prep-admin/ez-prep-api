import { RazorpayOrdersClient } from '../../../src/payments/infrastructure/razorpay/razorpay-orders.client';

export const HARNESS_WEBHOOK_SECRET = 'harness_webhook_secret';
export const HARNESS_KEY_SECRET = 'harness_key_secret';

export function createRazorpayStub(): RazorpayOrdersClient & {
  refundPayment: jest.Mock;
} {
  return {
    createOrder: jest.fn(async input => ({
      id: `order_${input.receipt}`,
      amount: input.amount,
      currency: 'INR',
    })),
    refundPayment: jest.fn(async input => ({
      id: `rfnd_pending_${input.paymentId}`,
      amount: input.amount,
      currency: 'INR',
      status: 'pending',
    })),
    fetchOrder: jest.fn(),
    fetchPayments: jest.fn(async () => []),
    fetchRefund: jest.fn(async id => ({
      id,
      amount: 99900,
      currency: 'INR',
      status: 'pending',
    })),
  };
}
