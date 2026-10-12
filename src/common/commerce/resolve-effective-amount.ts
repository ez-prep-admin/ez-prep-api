/**
 * Sale-window effective amount in integer paise (GST-inclusive).
 * If now is inside [saleValidFrom, saleValidUntil] (inclusive bounds when set)
 * and saleAmount is a number → saleAmount; else listAmount.
 */
export interface EffectiveAmountOfferInput {
  listAmount: number;
  saleAmount?: number | null;
  saleValidFrom?: Date | string | null;
  saleValidUntil?: Date | string | null;
}

export function resolveEffectiveAmount(
  offer: EffectiveAmountOfferInput,
  now: Date = new Date(),
): number {
  const saleAmount = offer.saleAmount;
  if (saleAmount == null || typeof saleAmount !== 'number') {
    return offer.listAmount;
  }

  const from = offer.saleValidFrom ? new Date(offer.saleValidFrom) : null;
  const until = offer.saleValidUntil ? new Date(offer.saleValidUntil) : null;

  if (from && now.getTime() < from.getTime()) {
    return offer.listAmount;
  }
  if (until && now.getTime() > until.getTime()) {
    return offer.listAmount;
  }

  // Sale amount set but no window → treat as always on sale when amount present
  return saleAmount;
}
