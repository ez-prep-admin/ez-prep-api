import { createHmac } from 'crypto';

export function signWebhook(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function captureWebhookBody(input: {
  orderId: string;
  paymentId: string;
  amount: number;
}): string {
  return JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: input.paymentId,
          order_id: input.orderId,
          amount: input.amount,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });
}
