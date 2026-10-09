import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MIN_ORDER_AMOUNT_PAISE } from '../../../common/commerce/checkout.constants';
import {
  ClientProviderDataInput,
  CreatePaymentOrderInput,
  NormalizedPaymentEvent,
  PaymentGateway,
  PaymentVerificationResult,
  ProviderOrder,
  ProviderWebhookInput,
  RefundInput,
  ProviderRefund,
  VerifyPaymentInput,
} from '../../domain/payment-gateway';
import { normalizeRazorpayEvent } from './normalize-razorpay-event';
import {
  RAZORPAY_ORDERS_CLIENT,
  RazorpayOrdersClient,
} from './razorpay-orders.client';
import {
  headerValue,
  hmacSha256Hex,
  signaturesMatch,
} from './razorpay-signature';

const RECEIPT_MAX = 40;

@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly provider = 'razorpay';
  private readonly logger = new Logger(RazorpayGateway.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(RAZORPAY_ORDERS_CLIENT)
    private readonly orders: RazorpayOrdersClient,
  ) {}

  async createOrder(input: CreatePaymentOrderInput): Promise<ProviderOrder> {
    if (
      !Number.isInteger(input.amount) ||
      input.amount < MIN_ORDER_AMOUNT_PAISE
    ) {
      throw new BadRequestException(
        `Order amount must be at least ${MIN_ORDER_AMOUNT_PAISE} paise`,
      );
    }
    if (input.currency !== 'INR') {
      throw new BadRequestException('Only INR orders can be paid');
    }
    const receipt = input.receipt?.trim() ?? '';
    if (!receipt || receipt.length > RECEIPT_MAX) {
      throw new BadRequestException(
        `Payment receipt must be 1-${RECEIPT_MAX} characters`,
      );
    }

    let created: { id: string; amount: number; currency: string };
    try {
      created = await this.orders.createOrder({
        amount: input.amount,
        currency: 'INR',
        receipt,
      });
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(
        `Razorpay order create failed (status ${statusCodeOf(error)})`,
      );
      throw new BadGatewayException('Payment provider request failed');
    }

    if (
      !created.id ||
      created.amount !== input.amount ||
      created.currency !== 'INR'
    ) {
      this.logger.warn('Razorpay order create returned an unexpected amount');
      throw new BadGatewayException('Payment provider request failed');
    }

    return {
      providerOrderId: created.id,
      amount: input.amount,
      currency: 'INR',
      providerData: this.clientProviderData({
        providerOrderId: created.id,
        amount: input.amount,
        currency: 'INR',
      }),
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<PaymentVerificationResult> {
    const orderId = payloadString(input.providerPayload, 'razorpay_order_id');
    const paymentId = payloadString(
      input.providerPayload,
      'razorpay_payment_id',
    );
    const signature = payloadString(
      input.providerPayload,
      'razorpay_signature',
    );
    if (!orderId || !paymentId || !signature) {
      return {
        verified: false,
        status: 'FAILED',
        failureReason: 'Missing razorpay verify fields',
      };
    }
    if (input.providerOrderId && orderId !== input.providerOrderId) {
      return {
        verified: false,
        status: 'FAILED',
        failureReason: 'Payment does not match this order',
      };
    }

    const secret = this.secret('RAZORPAY_KEY_SECRET');
    const expected = secret
      ? hmacSha256Hex(secret, `${orderId}|${paymentId}`)
      : '';
    if (!secret || !signaturesMatch(expected, signature)) {
      return {
        verified: false,
        status: 'FAILED',
        failureReason: 'Invalid payment signature',
      };
    }

    return {
      verified: true,
      status: 'CAPTURED',
      providerPaymentId: paymentId,
    };
  }

  async parseWebhook(
    input: ProviderWebhookInput,
  ): Promise<NormalizedPaymentEvent> {
    const signature = headerValue(input.headers, 'x-razorpay-signature');
    const eventId = headerValue(input.headers, 'x-razorpay-event-id')?.trim();
    const secret = this.secret('RAZORPAY_WEBHOOK_SECRET');
    const raw = Buffer.isBuffer(input.rawBody)
      ? input.rawBody
      : Buffer.from(input.rawBody);
    const expected = secret ? hmacSha256Hex(secret, raw) : '';
    if (!signature || !secret || !signaturesMatch(expected, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    if (!eventId) {
      throw new BadRequestException('Missing webhook event id');
    }

    let body: unknown;
    try {
      body = JSON.parse(raw.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Invalid webhook body');
    }
    return normalizeRazorpayEvent(body, eventId);
  }

  async refund(input: RefundInput): Promise<ProviderRefund> {
    if (
      !Number.isInteger(input.amount) ||
      input.amount < MIN_ORDER_AMOUNT_PAISE
    ) {
      throw new BadRequestException(
        `Order amount must be at least ${MIN_ORDER_AMOUNT_PAISE} paise`,
      );
    }
    if (input.currency !== 'INR') {
      throw new BadRequestException('Only INR orders can be refunded');
    }
    const paymentId = input.providerPaymentId?.trim();
    if (!paymentId) {
      throw new BadRequestException('Missing provider payment id');
    }

    let created: {
      id: string;
      amount: number;
      currency: string;
      status: string;
    };
    try {
      created = await this.orders.refundPayment({
        paymentId,
        amount: input.amount,
      });
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(
        `Razorpay refund failed (status ${statusCodeOf(error)})`,
      );
      throw new BadGatewayException('Payment provider request failed');
    }

    const status = created.status.trim().toLowerCase();
    if (status !== 'processed' && status !== 'pending') {
      this.logger.warn(`Razorpay refund returned status ${created.status}`);
      throw new BadGatewayException('Payment provider request failed');
    }
    if (
      !created.id ||
      created.amount !== input.amount ||
      created.currency !== 'INR'
    ) {
      this.logger.warn('Razorpay refund returned an unexpected amount');
      throw new BadGatewayException('Payment provider request failed');
    }

    return {
      providerRefundId: created.id,
      status,
      amount: created.amount,
    };
  }

  async fetchOrderStatus(
    providerOrderId: string,
  ): Promise<NormalizedPaymentEvent> {
    const id = providerOrderId.trim();
    if (!id) {
      throw new BadRequestException('Missing provider order id');
    }

    let order: { amount: number; currency: string; status: string };
    let payments: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
    }>;
    try {
      order = await this.orders.fetchOrder(id);
      payments = await this.orders.fetchPayments(id);
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(
        `Razorpay order status fetch failed (status ${statusCodeOf(error)})`,
      );
      throw new BadGatewayException('Payment provider request failed');
    }

    const captured = payments.find(payment => payment.status === 'captured');
    if (order.status === 'paid' || captured) {
      return {
        providerEventId: `recon:${id}`,
        eventType: 'order.fetch',
        providerOrderId: id,
        providerPaymentId: captured?.id,
        status: 'CAPTURED',
        amount: captured?.amount ?? order.amount,
        currency: captured?.currency ?? order.currency,
      };
    }

    if (payments.some(payment => payment.status === 'failed')) {
      return {
        providerEventId: `recon:${id}`,
        eventType: 'order.fetch',
        providerOrderId: id,
        status: 'FAILED',
        amount: order.amount,
        currency: order.currency,
      };
    }

    return {
      providerEventId: `recon:${id}`,
      eventType: 'order.fetch',
      providerOrderId: id,
      status: 'IGNORED',
      amount: order.amount,
      currency: order.currency,
    };
  }

  clientProviderData(input: ClientProviderDataInput): Record<string, unknown> {
    if (!input.providerOrderId) {
      return {};
    }
    return {
      razorpayOrderId: input.providerOrderId,
      amount: input.amount,
      currency: input.currency,
      keyId: this.secret('RAZORPAY_KEY_ID'),
    };
  }

  private secret(name: string): string {
    return this.configService.get<string>(name)?.trim() ?? '';
  }
}

function payloadString(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = payload[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
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
