import { NormalizedPaymentEvent } from '../../domain/payment-gateway';

const CAPTURE_EVENTS = new Set(['payment.captured', 'order.paid']);

export function normalizeRazorpayEvent(
  body: unknown,
  providerEventId: string,
): NormalizedPaymentEvent {
  const root = asRecord(body);
  const eventType = stringField(root, 'event') ?? 'unknown';
  const payload = asRecord(root?.payload);
  const refundEvent = normalizeRefundEvent(payload, eventType, providerEventId);
  if (refundEvent) {
    return refundEvent;
  }

  const payment = entity(payload, 'payment');
  const order = entity(payload, 'order');

  const providerOrderId =
    stringField(payment, 'order_id') ?? stringField(order, 'id');
  const providerPaymentId = stringField(payment, 'id');
  const amount =
    integerField(payment, 'amount') ?? integerField(order, 'amount');
  const currency =
    stringField(payment, 'currency') ?? stringField(order, 'currency');

  const paymentStatus = stringField(payment, 'status');
  const orderStatus = stringField(order, 'status');
  const captured =
    CAPTURE_EVENTS.has(eventType) &&
    (eventType === 'payment.captured'
      ? paymentStatus === 'captured'
      : paymentStatus === 'captured' || orderStatus === 'paid');
  const notes = readNotes(payment, order);

  return {
    providerEventId,
    eventType,
    providerOrderId,
    providerPaymentId,
    amount,
    currency,
    status: captured ? 'CAPTURED' : 'IGNORED',
    notesOrderId: notes.orderId,
    notesInstanceId: notes.instanceId,
  };
}

function normalizeRefundEvent(
  payload: Record<string, unknown> | undefined,
  eventType: string,
  providerEventId: string,
): NormalizedPaymentEvent | undefined {
  if (eventType !== 'refund.processed' && eventType !== 'refund.failed') {
    return undefined;
  }

  const refund = entity(payload, 'refund');
  const refundStatus = stringField(refund, 'status')?.toLowerCase();
  const processed =
    eventType === 'refund.processed' && refundStatus === 'processed';
  const failed = eventType === 'refund.failed' && refundStatus === 'failed';

  const notes = readNotes(refund, entity(payload, 'payment'));
  return {
    providerEventId,
    eventType,
    providerRefundId: stringField(refund, 'id'),
    providerPaymentId: stringField(refund, 'payment_id'),
    amount: integerField(refund, 'amount'),
    currency: stringField(refund, 'currency'),
    status: processed
      ? 'REFUND_PROCESSED'
      : failed
        ? 'REFUND_FAILED'
        : 'IGNORED',
    notesOrderId: notes.orderId,
    notesInstanceId: notes.instanceId,
  };
}

function readNotes(...records: Array<Record<string, unknown> | undefined>): {
  orderId?: string;
  instanceId?: string;
} {
  for (const record of records) {
    const notes = asRecord(record?.notes);
    const orderId = stringField(notes, 'orderId');
    const instanceId = stringField(notes, 'instanceId');
    if (orderId || instanceId) {
      return { orderId, instanceId };
    }
  }
  return {};
}

function entity(
  payload: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  const wrapper = asRecord(payload?.[key]);
  return asRecord(wrapper?.entity);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function stringField(
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function integerField(
  record: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = record?.[key];
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(amount)) {
    return undefined;
  }
  return amount;
}
