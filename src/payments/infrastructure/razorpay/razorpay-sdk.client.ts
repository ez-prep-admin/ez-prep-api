import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import Razorpay from 'razorpay';
import {
  RazorpayCreatedOrder,
  RazorpayFetchedOrder,
  RazorpayFetchedPayment,
  RazorpayOrderCreateInput,
  RazorpayOrdersClient,
  RazorpayRefundInput,
  RazorpayRefundResult,
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

  async refundPayment(
    input: RazorpayRefundInput,
  ): Promise<RazorpayRefundResult> {
    try {
      const refund = await this.sdk().payments.refund(input.paymentId, {
        amount: input.amount,
      });
      const amount =
        typeof refund.amount === 'number'
          ? refund.amount
          : Number(refund.amount);
      return {
        id: refund.id,
        amount,
        currency: refund.currency,
        status: refund.status,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      const description = razorpayErrorDescription(error);
      this.logger.warn(
        `Razorpay refund failed (status ${statusCodeOf(error)}): ${description ?? 'no description'}`,
      );
      const balance = await this.availableBalancePaise();
      throw new BadGatewayException(
        refundFailureMessage(description, input.amount, balance),
      );
    }
  }

  async fetchRefund(refundId: string): Promise<RazorpayRefundResult> {
    try {
      const refund = await this.sdk().refunds.fetch(refundId);
      const amount =
        typeof refund.amount === 'number'
          ? refund.amount
          : Number(refund.amount);
      return {
        id: refund.id,
        amount,
        currency: refund.currency,
        status: refund.status,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.warn(
        `Razorpay refund fetch failed (status ${statusCodeOf(error)})`,
      );
      throw new BadGatewayException('Payment provider request failed');
    }
  }

  async fetchOrder(orderId: string): Promise<RazorpayFetchedOrder> {
    try {
      const order = await this.sdk().orders.fetch(orderId);
      return {
        id: order.id,
        amount: integerAmount(order.amount),
        currency: order.currency,
        status: order.status,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.warn(
        `Razorpay order fetch failed (status ${statusCodeOf(error)})`,
      );
      throw new BadGatewayException('Payment provider request failed');
    }
  }

  async fetchPayments(orderId: string): Promise<RazorpayFetchedPayment[]> {
    try {
      const result = await this.sdk().orders.fetchPayments(orderId);
      return (result.items ?? []).map(payment => ({
        id: payment.id,
        amount: integerAmount(payment.amount),
        currency: payment.currency,
        status: payment.status,
      }));
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.warn(
        `Razorpay order payments fetch failed (status ${statusCodeOf(error)})`,
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

  private async availableBalancePaise(): Promise<number | null> {
    try {
      const api = (this.sdk() as unknown as RazorpayBalanceApi).api;
      const body = await api.get({ url: '/balance' });
      return typeof body?.balance === 'number' ? body.balance : null;
    } catch {
      return null;
    }
  }
}

interface RazorpayBalanceApi {
  api: {
    get(input: { url: string }): Promise<{ balance?: number }>;
  };
}

export function razorpayErrorDescription(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('error' in error)) {
    return undefined;
  }
  const description = (error as { error?: { description?: unknown } }).error
    ?.description;
  if (typeof description !== 'string') {
    return undefined;
  }
  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function refundFailureMessage(
  description: string | undefined,
  refundAmount: number,
  balancePaise: number | null,
): string {
  if (
    description === 'invalid request sent' &&
    balancePaise != null &&
    balancePaise < refundAmount
  ) {
    return 'Razorpay could not refund this payment because the account balance is lower than the refund. Capture another test payment, then try again.';
  }
  const safe = description?.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (safe) {
    return `Razorpay could not refund this payment: ${safe}`;
  }
  return 'Payment provider request failed';
}

function integerAmount(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
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
