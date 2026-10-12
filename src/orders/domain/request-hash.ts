import { createHash } from 'crypto';
import { OrderBillingSnapshot } from '../schemas/order.schema';

/** Stable hash of the checkout request. Billing is already trimmed by checkout. */
export function checkoutRequestHash(
  offerId: string,
  billing: Pick<
    OrderBillingSnapshot,
    'name' | 'stateCode' | 'addressLine1' | 'addressLine2' | 'city' | 'pincode'
  >,
): string {
  const canonical = [
    offerId,
    billing.name,
    billing.stateCode,
    billing.addressLine1,
    billing.addressLine2 ?? '',
    billing.city,
    billing.pincode,
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}
