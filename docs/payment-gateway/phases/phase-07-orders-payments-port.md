# Phase 07 — Orders + Payments Port

## Objective

Implement Order and Payment domain with strict state machines, idempotent order creation, billing snapshot, tax breakdown snapshot scaffolding, and a `PaymentGateway` port + registry with **FakeGateway** for tests. No Razorpay SDK yet.

## Prerequisites

- Phase 04 products/offers APIs.

## Source documents

`../domain-model.md` §4 §5 §12, `../api-contracts.md` §4 §12, `../state-machines.md` §3 §4, `../decisions.md` D-10 D-14, `../engineering-rules.md` §3.

## Code references (ez-prep-api)

- Nest module patterns
- `src/common/filters/http-exception.filter.ts`
- Throttler config for rate limits on checkout
- Phase 04 OffersService / ProductsService

## Target behavior

1. `POST /checkout/orders` with `{ offerId, billing, idempotencyKey }` → billing **must** include name, stateCode, addressLine1, city, pincode (D-10); server loads offer/product, computes effective **inclusive** amount (paise), calls `TaxService.calculateInclusiveTax`, snapshots grants + tax + billing, creates Order CREATED→PENDING_PAYMENT via FakeGateway.createOrder.
2. Idempotent replay returns same order.
3. Reject unpublished product / inactive offer / missing billing.
4. `PaymentGateway` interface + `PaymentGatewayRegistry` + `FakeGateway`.
5. Payment row INITIATED linked to order.
6. User can GET own order.
7. Never trust client amount.

## Files to create

```
src/orders/
src/payments/
  application/
  domain/payment-gateway.ts
  domain/payment-gateway.registry.ts
  infrastructure/fake/fake.gateway.ts
```

Checkout controller under user auth.

## Files that may be modified

- `app.module.ts`
- Throttler overrides for checkout if needed
- `.env.example` (`PAYMENT_PROVIDER=fake` default for test/dev)

## Do-not-touch boundaries

- No Razorpay package.
- No entitlement provisioning yet (phase 09) — FakeGateway verify may mark paid **or** leave paid transition for phase 09; **prefer:** phase 07 can transition to PAID via FakeGateway.verify for testability, but provisioning hook is no-op interface called in phase 09. Document clearly: if PAID without provision in 07, 09 wires provision on PAID.

**Committed approach:** Phase 07 implements `markOrderPaid` internal method without entitlements; phase 09 listens/calls provision from that path and webhook path.

## Implementation tasks

1. Schemas + indexes (idempotencyKey unique).
2. Order state transition service.
3. Checkout application service.
4. FakeGateway.
5. Implement `TaxService.calculateInclusiveTax` with ₹999 fixtures from [`../gst-invoicing.md`](../gst-invoicing.md) (phase 10 adds PDF; tax math belongs here so orders snapshot correctly).
6. Jest with FakeGateway + tax snapshot assertions.

## Requirements

- Single-item orders OK in v1 but `items[]` array used.
- Order expiry field set (e.g. 30–60 min).

## Acceptance criteria

- Creating order twice with same idempotencyKey yields one order.
- Amount matches offer effective price.
- Fake verify can mark CAPTURED/PAID without entitlements.
- Domain code has zero imports of razorpay.

## Tests (Jest)

1. Checkout happy path with FakeGateway.
2. Idempotency replay.
3. Reject inactive offer.
4. Reject unpublished product.
5. Ignore client-supplied amount if sent (forbidNonWhitelisted).
6. Illegal status transition throws.
7. User cannot fetch another user’s order.
8. Registry returns fake provider.
9. TaxService: ₹999 → taxable 846.61 / tax 152.39; same-state CGST/SGST split; interstate IGST.
10. Order persists tax snapshot; changing live taxConfig must not alter existing order.tax.

## Risks

R-03, R-14.

## Rollback / isolation

New modules; default provider fake.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] Port + FakeGateway
- [ ] Checkout order API
- [ ] State machine tests
- [ ] PAYMENT_PROVIDER documented


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Provider-neutral checkout backend ready for Razorpay adapter.
