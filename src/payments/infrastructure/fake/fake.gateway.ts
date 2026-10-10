import { Injectable } from '@nestjs/common';
import { MIN_ORDER_AMOUNT_PAISE } from '../../../common/commerce/checkout.constants';
import {
  ClientProviderDataInput,
  CreatePaymentOrderInput,
  FetchedProviderPayment,
  NormalizedPaymentEvent,
  PaymentGateway,
  PaymentVerificationResult,
  ProviderOrder,
  ProviderRefund,
  ProviderWebhookInput,
  RefundInput,
  VerifyPaymentInput,
} from '../../domain/payment-gateway';

@Injectable()
export class FakeGateway implements PaymentGateway {
  readonly provider = 'fake';
  private readonly stagedStatus = new Map<string, NormalizedPaymentEvent>();

  /**
   * Test hook. Unstaged ids report IGNORED so reconciliation expires them.
   */
  stageOrderStatus(
    providerOrderId: string,
    event: Pick<NormalizedPaymentEvent, 'status'> &
      Partial<
        Pick<
          NormalizedPaymentEvent,
          | 'providerPaymentId'
          | 'amount'
          | 'currency'
          | 'providerEventId'
          | 'eventType'
        >
      >,
  ): void {
    this.stagedStatus.set(providerOrderId, {
      providerEventId: event.providerEventId ?? `fake:${providerOrderId}`,
      eventType: event.eventType ?? 'order.fetch',
      providerOrderId,
      providerPaymentId: event.providerPaymentId,
      status: event.status,
      amount: event.amount,
      currency: event.currency,
    });
  }

  async createOrder(input: CreatePaymentOrderInput): Promise<ProviderOrder> {
    if (
      !Number.isInteger(input.amount) ||
      input.amount < MIN_ORDER_AMOUNT_PAISE
    ) {
      throw new Error(
        `FakeGateway rejects amounts below ${MIN_ORDER_AMOUNT_PAISE} paise`,
      );
    }

    const providerOrderId = `fake_${input.orderId}`;
    return {
      providerOrderId,
      amount: input.amount,
      currency: input.currency,
      providerData: this.clientProviderData({
        providerOrderId,
        amount: input.amount,
        currency: input.currency,
      }),
    };
  }

  clientProviderData(input: ClientProviderDataInput): Record<string, unknown> {
    if (!input.providerOrderId) {
      return {};
    }
    return {
      fakeOrderId: input.providerOrderId,
      amount: input.amount,
      currency: input.currency,
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<PaymentVerificationResult> {
    const fakePaymentId = input.providerPayload?.fakePaymentId;
    if (typeof fakePaymentId !== 'string' || !fakePaymentId.trim()) {
      return {
        verified: false,
        status: 'FAILED',
        failureReason: 'Missing fakePaymentId',
      };
    }

    return {
      verified: true,
      status: 'CAPTURED',
      providerPaymentId: fakePaymentId.trim(),
    };
  }

  async parseWebhook(
    _input: ProviderWebhookInput,
  ): Promise<NormalizedPaymentEvent> {
    throw new Error('FakeGateway webhooks are not implemented (phase 08)');
  }

  async fetchPayment(
    providerPaymentId: string,
  ): Promise<FetchedProviderPayment> {
    const id = providerPaymentId.trim();
    return {
      providerPaymentId: id,
      status: id ? 'captured' : 'failed',
      amount: 0,
      currency: 'INR',
    };
  }

  async fetchOrderStatus(
    providerOrderId: string,
  ): Promise<NormalizedPaymentEvent> {
    const staged = this.stagedStatus.get(providerOrderId);
    if (staged) {
      return staged;
    }
    return {
      providerEventId: `fake:${providerOrderId}`,
      eventType: 'order.fetch',
      providerOrderId,
      status: 'IGNORED',
    };
  }

  async fetchRefundStatus(providerRefundId: string): Promise<ProviderRefund> {
    const id = providerRefundId.trim();
    if (id.includes('pending')) {
      return {
        providerRefundId: id,
        status: 'pending',
        amount: 0,
        currency: 'INR',
      };
    }
    if (id.includes('failed')) {
      return {
        providerRefundId: id,
        status: 'failed',
        amount: 0,
        currency: 'INR',
      };
    }
    return {
      providerRefundId: id,
      status: 'processed',
      amount: 0,
      currency: 'INR',
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefund> {
    if (
      !Number.isInteger(input.amount) ||
      input.amount < MIN_ORDER_AMOUNT_PAISE
    ) {
      throw new Error(
        `FakeGateway rejects amounts below ${MIN_ORDER_AMOUNT_PAISE} paise`,
      );
    }
    const providerPaymentId = input.providerPaymentId.trim();
    return {
      providerRefundId: `fake_rfnd_${providerPaymentId}`,
      status: 'processed',
      amount: input.amount,
    };
  }
}
