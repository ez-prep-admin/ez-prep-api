# Phase 08 — Razorpay Adapter

## Objective

Implement `RazorpayGateway` behind the PaymentGateway port: create order, verify payment signature, parse/verify webhooks, refund method stub/real for later phase. Isolate all SDK/API usage under `payments/infrastructure/razorpay/`.

## Prerequisites

- Phase 07 done.
- Local Razorpay **test** keys in `.env` when doing live SDK calls; unit tests use **signed fixtures** without external webhooks (D-18, U-RZ-01/02 resolved).
- No staging environment.

## Source documents

`../api-contracts.md` §4 §5 §12, `../decisions.md` D-14 D-18, `../engineering-rules.md` §4, `../unknowns.md` (U-RZ resolved; U-OPS-02 for prod).

## Code references (ez-prep-api)

- Phase 07 port/registry
- `src/main.ts` (raw body for webhooks — Nest raw body technique)
- Helmet/CORS — webhook path must work server-to-server

## Target behavior

1. When `PAYMENT_PROVIDER=razorpay`, checkout uses RazorpayGateway.createOrder (amount in paise).
2. Adapter calls Razorpay Orders API `POST /v1/orders` with `{ amount, currency: 'INR', receipt }` where `amount` is the **server-computed** order total in paise and `receipt` maps to our internal order id (or short stable receipt string). Never trust a client-supplied amount.
3. Reject create if amount `< 100` paise (Razorpay minimum). Prefer also preventing such offers at catalog/admin validation.
4. `POST /checkout/orders/:id/verify` maps `providerPayload` through adapter.verifyPayment; on success → mark paid path.
5. **Verify signature algorithm (Razorpay Standard Checkout):**  
   `HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)`  
   Compare digest to `razorpay_signature` (timing-safe compare). Mismatch → **400**, do **not** mark paid / provision.
6. Missing verify fields (`razorpay_order_id` / `razorpay_payment_id` / `razorpay_signature`) → **400**.
7. `POST /webhooks/payments/razorpay` verifies webhook signature (`RAZORPAY_WEBHOOK_SECRET`), records webhook_events, idempotent process, mark paid if capture event. (Prompt’s Standard Checkout checklist omits webhooks — **we still require them** as authoritative backup when the browser never hits verify.)
8. Invalid signatures → 400/401; no state change. Razorpay API/auth failures from createOrder → map to 502/500 (or 401 only if our keys are wrong at boot — prefer fail-fast config validation).
9. Secrets from env only: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. SDK (`razorpay` npm) installed in **API only**.

## Files to create

```
src/payments/infrastructure/razorpay/
src/webhooks/  (or payments/webhooks)
```

Fixture JSON for tests; signature helper tests.

## Files that may be modified

- Registry wiring
- `main.ts` / middleware for raw body on webhook route
- `.env.example`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_PROVIDER`

## Do-not-touch boundaries

- No entitlement provisioning beyond calling existing markOrderPaid (phase 09 expands).
- No frontend Checkout.js yet (phase 14).
- No Cashfree/Stripe adapters (interface only).

## Implementation tasks

1. Add official Razorpay SDK dependency in API only (`npm install razorpay`).
2. Implement adapter methods: createOrder, verifyPayment (HMAC as above), webhook parse/verify, refund stub/real for phase 11.
3. Webhook controller + idempotency.
4. Wire verify endpoint; DTO validates required Razorpay payload keys when `provider=razorpay`.
5. Jest with mocked HTTP/SDK + signature fixtures (valid + tampered HMAC).
6. Document local tunnel webhook setup (ngrok/Cloudflare) in STATUS.md; production webhook is permanent HTTPS on prod API only.

## Requirements

- Adapter-internal mapping from Razorpay statuses → normalized enums.
- Do not log secrets or full webhook PII.
- Webhook returns 200 on duplicate after ignore.
- **Route mapping vs Razorpay quickstart:** their sample uses `POST /api/create-order` + `POST /api/verify-payment`. Ours map to `POST /api/v1/checkout/orders` and `POST /api/v1/checkout/orders/:id/verify` (JWT + offer/billing/idempotency). Do **not** add parallel naive endpoints.

## Acceptance criteria

- Unit tests prove bad signature rejected.
- Duplicate providerEventId does not double-transition order.
- Domain/application services still have no razorpay imports (eslint boundary optional).
- Local E2E webhook via tunnel documented (optional); automated tests do not depend on it.

## Tests (Jest)

1. createOrder builds correct paise amount; amount `< 100` rejected.
2. verifyPayment success → CAPTURED (HMAC of `order_id|payment_id` with test secret).
3. verifyPayment bad signature → fail; order unchanged.
4. verifyPayment missing fields → 400; order unchanged.
5. webhook valid → PROCESSED + order PAID (if pending).
6. webhook duplicate → IGNORED, single PAID.
7. webhook invalid signature → error, order unchanged.
8. Registry selects razorpay vs fake by config.

## Risks

R-02, R-06, R-08.

## Rollback / isolation

Set `PAYMENT_PROVIDER=fake`; feature-flag webhook route if needed.

## Completion checklist

- [x] `STATUS.md` updated with ops + **developer confirmation**
- [x] Adapter isolated
- [x] Verify + webhook paths
- [x] Env example updated
- [x] Signature tests green


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Razorpay can complete paid order state without UI; provisioning still phase 09.
