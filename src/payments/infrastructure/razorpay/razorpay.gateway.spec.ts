import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RazorpayOrdersClient } from './razorpay-orders.client';
import { RazorpayGateway } from './razorpay.gateway';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

function config(): ConfigService {
  const values: Record<string, string> = {
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  };
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

function paymentSignature(orderId: string, paymentId: string): string {
  return createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

function webhookSignature(body: Buffer): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function fixture(name: string): Buffer {
  return readFileSync(join(__dirname, 'fixtures', name));
}

describe('RazorpayGateway', () => {
  const orders: jest.Mocked<RazorpayOrdersClient> = {
    createOrder: jest.fn(),
    refundPayment: jest.fn(),
    fetchOrder: jest.fn(),
    fetchPayments: jest.fn(),
    fetchRefund: jest.fn(),
  };
  const gateway = new RazorpayGateway(config(), orders);

  beforeEach(() => {
    orders.createOrder.mockReset();
    orders.refundPayment.mockReset();
    orders.fetchOrder.mockReset();
    orders.fetchPayments.mockReset();
    orders.fetchRefund.mockReset();
  });

  it('creates an order with the server amount in paise', async () => {
    orders.createOrder.mockResolvedValue({
      id: 'order_1',
      amount: 99900,
      currency: 'INR',
    });

    const created = await gateway.createOrder({
      orderId: 'abc',
      amount: 99900,
      currency: 'INR',
      receipt: 'ORD-1',
    });

    expect(orders.createOrder).toHaveBeenCalledWith({
      amount: 99900,
      currency: 'INR',
      receipt: 'ORD-1',
    });
    expect(created).toMatchObject({
      providerOrderId: 'order_1',
      amount: 99900,
      providerData: {
        razorpayOrderId: 'order_1',
        amount: 99900,
        currency: 'INR',
        keyId: 'rzp_test_key',
      },
    });
    expect(created.providerData).not.toHaveProperty('merchantName');
  });

  it('sends the instance name as the Checkout.js merchant name', async () => {
    const named = new RazorpayGateway(
      {
        get: (key: string) =>
          key === 'INSTANCE_NAME' ? 'ExamFlex' : config().get(key),
      } as ConfigService,
      orders,
    );
    orders.createOrder.mockResolvedValue({
      id: 'order_1',
      amount: 99900,
      currency: 'INR',
    });

    const created = await named.createOrder({
      orderId: 'abc',
      amount: 99900,
      currency: 'INR',
      receipt: 'ORD-1',
    });

    expect(created.providerData.merchantName).toBe('ExamFlex');
  });

  it('rejects totals under 100 paise before calling Razorpay', async () => {
    await expect(
      gateway.createOrder({
        orderId: 'abc',
        amount: 50,
        currency: 'INR',
        receipt: 'ORD-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orders.createOrder).not.toHaveBeenCalled();
  });

  it('maps provider failures to a 502 without the secret', async () => {
    orders.createOrder.mockRejectedValue({
      statusCode: 401,
      key_secret: KEY_SECRET,
    });

    await expect(
      gateway.createOrder({
        orderId: 'abc',
        amount: 99900,
        currency: 'INR',
        receipt: 'ORD-1',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    try {
      await gateway.createOrder({
        orderId: 'abc',
        amount: 99900,
        currency: 'INR',
        receipt: 'ORD-1',
      });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(KEY_SECRET);
    }
  });

  it('verifies a Standard Checkout signature', async () => {
    const signature = paymentSignature('order_1', 'pay_1');
    await expect(
      gateway.verifyPayment({
        orderId: 'abc',
        providerOrderId: 'order_1',
        amount: 99900,
        currency: 'INR',
        providerPayload: {
          razorpay_order_id: 'order_1',
          razorpay_payment_id: 'pay_1',
          razorpay_signature: signature,
        },
      }),
    ).resolves.toEqual({
      verified: true,
      status: 'CAPTURED',
      providerPaymentId: 'pay_1',
    });
  });

  it('rejects a tampered payment signature', async () => {
    const valid = paymentSignature('order_1', 'pay_1');
    const signature = `${valid[0] === 'a' ? 'b' : 'a'}${valid.slice(1)}`;
    const result = await gateway.verifyPayment({
      orderId: 'abc',
      providerOrderId: 'order_1',
      amount: 99900,
      currency: 'INR',
      providerPayload: {
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: signature,
      },
    });
    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe('Invalid payment signature');
  });

  it('rejects missing verify fields', async () => {
    const result = await gateway.verifyPayment({
      orderId: 'abc',
      providerOrderId: 'order_1',
      amount: 99900,
      currency: 'INR',
      providerPayload: { razorpay_order_id: 'order_1' },
    });
    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe('Missing razorpay verify fields');
  });

  it('rejects a signature for a different Razorpay order', async () => {
    const result = await gateway.verifyPayment({
      orderId: 'abc',
      providerOrderId: 'order_1',
      amount: 99900,
      currency: 'INR',
      providerPayload: {
        razorpay_order_id: 'order_other',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: paymentSignature('order_other', 'pay_1'),
      },
    });
    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe('Payment does not match this order');
  });

  it('parses a signed payment.captured webhook', async () => {
    const rawBody = fixture('payment-captured.json');
    const event = await gateway.parseWebhook({
      rawBody,
      headers: {
        'x-razorpay-signature': webhookSignature(rawBody),
        'x-razorpay-event-id': 'evt_captured',
      },
    });
    expect(event).toMatchObject({
      providerEventId: 'evt_captured',
      eventType: 'payment.captured',
      providerOrderId: 'order_test_1',
      providerPaymentId: 'pay_test_captured',
      status: 'CAPTURED',
      amount: 79900,
      currency: 'INR',
    });
  });

  it('parses order.paid as a capture and ignores payment.failed', async () => {
    const paid = fixture('order-paid.json');
    await expect(
      gateway.parseWebhook({
        rawBody: paid,
        headers: {
          'x-razorpay-signature': webhookSignature(paid),
          'x-razorpay-event-id': 'evt_paid',
        },
      }),
    ).resolves.toMatchObject({ status: 'CAPTURED', eventType: 'order.paid' });

    const failed = fixture('payment-failed.json');
    await expect(
      gateway.parseWebhook({
        rawBody: failed,
        headers: {
          'x-razorpay-signature': webhookSignature(failed),
          'x-razorpay-event-id': 'evt_failed',
        },
      }),
    ).resolves.toMatchObject({
      status: 'IGNORED',
      eventType: 'payment.failed',
    });
  });

  it('parses refund.processed and refund.failed', async () => {
    const processed = fixture('refund-processed.json');
    await expect(
      gateway.parseWebhook({
        rawBody: processed,
        headers: {
          'x-razorpay-signature': webhookSignature(processed),
          'x-razorpay-event-id': 'evt_refund_ok',
        },
      }),
    ).resolves.toMatchObject({
      status: 'REFUND_PROCESSED',
      eventType: 'refund.processed',
      providerRefundId: 'rfnd_test_processed',
      amount: 12900,
      currency: 'INR',
    });

    const failed = fixture('refund-failed.json');
    await expect(
      gateway.parseWebhook({
        rawBody: failed,
        headers: {
          'x-razorpay-signature': webhookSignature(failed),
          'x-razorpay-event-id': 'evt_refund_failed',
        },
      }),
    ).resolves.toMatchObject({
      status: 'REFUND_FAILED',
      eventType: 'refund.failed',
      providerRefundId: 'rfnd_test_failed',
    });
  });

  it('fetches a provider refund status', async () => {
    orders.fetchRefund.mockResolvedValue({
      id: 'rfnd_1',
      amount: 12900,
      currency: 'INR',
      status: 'processed',
    });

    await expect(gateway.fetchRefundStatus('rfnd_1')).resolves.toEqual({
      providerRefundId: 'rfnd_1',
      status: 'processed',
      amount: 12900,
      currency: 'INR',
    });
  });

  it('rejects an invalid webhook signature', async () => {
    const rawBody = fixture('payment-captured.json');
    await expect(
      gateway.parseWebhook({
        rawBody,
        headers: {
          'x-razorpay-signature': 'deadbeef',
          'x-razorpay-event-id': 'evt_captured',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a processed Razorpay refund', async () => {
    orders.refundPayment.mockResolvedValue({
      id: 'rfnd_1',
      amount: 99900,
      currency: 'INR',
      status: 'processed',
    });

    await expect(
      gateway.refund({
        providerPaymentId: 'pay_1',
        amount: 99900,
        currency: 'INR',
      }),
    ).resolves.toEqual({
      providerRefundId: 'rfnd_1',
      status: 'processed',
      amount: 99900,
    });
    expect(orders.refundPayment).toHaveBeenCalledWith({
      paymentId: 'pay_1',
      amount: 99900,
    });
  });

  it('maps a pending Razorpay refund without treating it as processed', async () => {
    orders.refundPayment.mockResolvedValue({
      id: 'rfnd_2',
      amount: 99900,
      currency: 'INR',
      status: 'pending',
    });

    await expect(
      gateway.refund({
        providerPaymentId: 'pay_1',
        amount: 99900,
        currency: 'INR',
      }),
    ).resolves.toMatchObject({ status: 'pending', providerRefundId: 'rfnd_2' });
  });

  it('maps a captured Razorpay order to CAPTURED', async () => {
    orders.fetchOrder.mockResolvedValue({
      id: 'order_1',
      amount: 99900,
      currency: 'INR',
      status: 'paid',
    });
    orders.fetchPayments.mockResolvedValue([
      {
        id: 'pay_1',
        amount: 99900,
        currency: 'INR',
        status: 'captured',
      },
    ]);

    await expect(gateway.fetchOrderStatus('order_1')).resolves.toMatchObject({
      status: 'CAPTURED',
      providerOrderId: 'order_1',
      providerPaymentId: 'pay_1',
      amount: 99900,
      currency: 'INR',
    });
  });

  it('maps a failed Razorpay payment with no capture to FAILED', async () => {
    orders.fetchOrder.mockResolvedValue({
      id: 'order_1',
      amount: 99900,
      currency: 'INR',
      status: 'attempted',
    });
    orders.fetchPayments.mockResolvedValue([
      {
        id: 'pay_failed',
        amount: 99900,
        currency: 'INR',
        status: 'failed',
      },
    ]);

    await expect(gateway.fetchOrderStatus('order_1')).resolves.toMatchObject({
      status: 'FAILED',
      providerOrderId: 'order_1',
    });
  });

  it('maps an unpaid Razorpay order to IGNORED', async () => {
    orders.fetchOrder.mockResolvedValue({
      id: 'order_1',
      amount: 99900,
      currency: 'INR',
      status: 'created',
    });
    orders.fetchPayments.mockResolvedValue([]);

    await expect(gateway.fetchOrderStatus('order_1')).resolves.toMatchObject({
      status: 'IGNORED',
      providerOrderId: 'order_1',
    });
  });

  it('prefers a captured payment when another attempt failed', async () => {
    orders.fetchOrder.mockResolvedValue({
      id: 'order_1',
      amount: 99900,
      currency: 'INR',
      status: 'paid',
    });
    orders.fetchPayments.mockResolvedValue([
      {
        id: 'pay_failed',
        amount: 99900,
        currency: 'INR',
        status: 'failed',
      },
      {
        id: 'pay_ok',
        amount: 99900,
        currency: 'INR',
        status: 'captured',
      },
    ]);

    await expect(gateway.fetchOrderStatus('order_1')).resolves.toMatchObject({
      status: 'CAPTURED',
      providerPaymentId: 'pay_ok',
    });
  });

  it('surfaces a Razorpay refund error as a gateway failure', async () => {
    orders.refundPayment.mockRejectedValue(new Error('sdk down'));

    await expect(
      gateway.refund({
        providerPaymentId: 'pay_1',
        amount: 99900,
        currency: 'INR',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
