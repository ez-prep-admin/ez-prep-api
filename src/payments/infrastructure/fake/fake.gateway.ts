import { Injectable } from '@nestjs/common';
import { MIN_ORDER_AMOUNT_PAISE } from '../../../common/commerce/checkout.constants';
import {
  ClientProviderDataInput,
  CreatePaymentOrderInput,
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

  async refund(_input: RefundInput): Promise<ProviderRefund> {
    throw new Error('FakeGateway refunds are not implemented (phase 11)');
  }
}
