export interface CreatePaymentOrderInput {
  orderId: string;
  amount: number;
  currency: 'INR';
  receipt: string;
  userId?: string;
  instanceId?: string;
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
  status: 'CAPTURED' | 'FAILED' | 'PENDING_CAPTURE';
  providerPaymentId?: string;
  failureReason?: string;
}

export interface FetchedProviderPayment {
  providerPaymentId: string;
  providerOrderId?: string;
  status: string;
  amount: number;
  currency: string;
  notesOrderId?: string;
}

export interface ProviderWebhookInput {
  rawBody: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
}

export interface ClientProviderDataInput {
  providerOrderId?: string;
  amount: number;
  currency: string;
}

export interface NormalizedPaymentEvent {
  providerEventId: string;
  eventType: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  status:
    | 'CAPTURED'
    | 'FAILED'
    | 'IGNORED'
    | 'REFUND_PROCESSED'
    | 'REFUND_FAILED';
  amount?: number;
  currency?: string;
  notesOrderId?: string;
  notesInstanceId?: string;
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
  currency?: string;
}

/** A definite provider rejection (HTTP 4xx). Transport errors and 5xx are not this. */
export class ProviderRefundRejectedError extends Error {
  constructor(message = 'Payment provider rejected the refund') {
    super(message);
    this.name = 'ProviderRefundRejectedError';
  }
}

export interface FetchedOrderPayment {
  providerPaymentId: string;
  status: string;
  amount: number;
  currency: string;
}

export interface ProviderOrderNotes {
  notesOrderId?: string;
  notesInstanceId?: string;
}

export interface PaymentGateway {
  readonly provider: string;
  createOrder(input: CreatePaymentOrderInput): Promise<ProviderOrder>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerificationResult>;
  parseWebhook(input: ProviderWebhookInput): Promise<NormalizedPaymentEvent>;
  refund(input: RefundInput): Promise<ProviderRefund>;
  /** Public checkout fields for GET and idempotent replay. Never includes secrets. */
  clientProviderData(input: ClientProviderDataInput): Record<string, unknown>;
  fetchOrderStatus(providerOrderId: string): Promise<NormalizedPaymentEvent>;
  fetchPayment(providerPaymentId: string): Promise<FetchedProviderPayment>;
  fetchRefundStatus(providerRefundId: string): Promise<ProviderRefund>;
  /** One read of the payments on a provider order. Used by the late-capture watch. */
  fetchOrderPayments(providerOrderId: string): Promise<FetchedOrderPayment[]>;
  /** Refunds already created for a payment. Used when a create times out. */
  listRefunds(providerPaymentId: string): Promise<ProviderRefund[]>;
  /** Notes on the provider order. One read. Used when a webhook has no local match. */
  fetchProviderOrderNotes(providerOrderId: string): Promise<ProviderOrderNotes>;
}
