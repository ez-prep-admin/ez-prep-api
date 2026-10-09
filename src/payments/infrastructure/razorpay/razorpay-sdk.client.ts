import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import Razorpay from 'razorpay';
import {
  RazorpayCreatedOrder,
  RazorpayOrderCreateInput,
  RazorpayOrdersClient,
} from './razorpay-orders.client';

/**
 * The only file that imports the Razorpay SDK.
 * Domain and application code must stay on the PaymentGateway port.
 */
@Injectable()
export class RazorpaySdkOrdersClient implements RazorpayOrdersClient {
  private readonly logger = new Logger(RazorpaySdkOrdersClient.name);
  private client: Razorpay | null = null;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
  ) {}

  async createOrder(
    input: RazorpayOrderCreateInput,
  ): Promise<RazorpayCreatedOrder> {
    try {
      const order = await this.sdk().orders.create({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
      });
      const amount =
        typeof order.amount === 'number' ? order.amount : Number(order.amount);
      return {
        id: order.id,
        amount,
        currency: order.currency,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.warn(
        `Razorpay order create failed (status ${statusCodeOf(error)})`,
      );
      throw new BadGatewayException('Payment provider request failed');
    }
  }

  private sdk(): Razorpay {
    if (!this.client) {
      this.client = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
    }
    return this.client;
  }
}

function statusCodeOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number') {
      return String(code);
    }
  }
  return 'unknown';
}
