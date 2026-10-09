export interface CreatePaymentOrderInput {
  orderId: string;
  amount: number;
  currency: 'INR';
  receipt: string;
}

export interface ProviderOrder {
  providerOrderId: string;
  amount: number;
  currency: string;
  providerData: Record<string, unknown>;
}

export interface VerifyPaymentInput {
  orderId: string;
  providerOrderId?: string;
  amount: number;
  currency: string;
  providerPayload: Record<string, unknown>;
}

export interface PaymentVerificationResult {
  verified: boolean;
  status: 'CAPTURED' | 'FAILED';
  providerPaymentId?: string;
  failureReason?: string;
}

export interface ProviderWebhookInput {
  rawBody: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
}

export interface NormalizedPaymentEvent {
  providerEventId: string;
  eventType: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: 'CAPTURED' | 'FAILED' | 'IGNORED';
  amount?: number;
}

export interface RefundInput {
  providerPaymentId: string;
  amount: number;
  currency: string;
}

export interface ProviderRefund {
  providerRefundId: string;
  status: string;
  amount: number;
}

export interface PaymentGateway {
  readonly provider: string;
  createOrder(input: CreatePaymentOrderInput): Promise<ProviderOrder>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerificationResult>;
  parseWebhook(input: ProviderWebhookInput): Promise<NormalizedPaymentEvent>;
  refund(input: RefundInput): Promise<ProviderRefund>;
  fetchOrderStatus?(providerOrderId: string): Promise<NormalizedPaymentEvent>;
}
