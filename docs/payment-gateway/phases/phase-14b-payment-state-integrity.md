# Phase 14B — Payment state integrity (ad-hoc)

Ad-hoc phase from [`../PRE_RELEASE_REVIEW.md`](../PRE_RELEASE_REVIEW.md). Runs after 14E and before 14C.

## Objective

1. Make every order, payment, and refund transition atomic.
2. Map one checkout to exactly one provider order.
3. Make verify prove a real capture.
4. Make the state machine accept a provider-proven late capture (D-22).
5. Record a second captured payment as a duplicate instead of losing it (D-28).

Findings: PR-02 (transitions, verify), PR-03, PR-04, PR-10, PR-17 (API), PR-33 (rows), PR-37 (notes).

## Prerequisites

- 14A done (harness, `CommerceConfig`). 14E done (tax snapshot shape settled).
- D-22 and D-28 in `../decisions.md`.
- Razorpay capture is automatic, and late-authorized payments are captured automatically (owner, 2026-10-10; set at go-live in `U-OPS-02`).

## Source documents

`../PRE_RELEASE_REVIEW.md` (late-payment design, compatibility contract), `../state-machines.md`, `../decisions.md` D-11 D-13 D-14 D-22 D-28, `../engineering-rules.md`.

## Code references (ez-prep-api)

- `src/orders/domain/order-transitions.ts`, `src/payments/domain/payment-transitions.ts`
- `src/orders/orders.service.ts` (all `mark*` methods, `ensureInitiatedPayment`)
- `src/orders/checkout.service.ts` (`createOrder`, `replay`, `openProviderOrder`, `verifyPayment`)
- `src/orders/reconciliation.service.ts`
- `src/refunds/refunds.service.ts` (`beginRefund`, `settleProcessed`, `settleFailed`), `src/refunds/schemas/refund.schema.ts`
- `src/payments/domain/payment-gateway.ts`, `src/payments/infrastructure/razorpay/razorpay.gateway.ts`, `razorpay-sdk.client.ts`, `razorpay-orders.client.ts`, fake gateway
- `src/payments/schemas/payment.schema.ts`, `src/payments/payment-index.repair.ts`, `src/orders/schemas/order.schema.ts`

## Target behavior

### 1. Compare-and-set transitions (PR-04)

- **Helper.** One per aggregate: `transition(id, from[], to, $set)` → `findOneAndUpdate({ _id, status: { $in: from } }, { $set: { status: to, ...set } }, { new: true })` → `{ won, doc }`.
- **Allowed lists.** The pure transition tables stay the only source of the `from` lists. Same-status no-ops (`PAID → PAID`) return `won: false` with the current doc.
- **Callers.** All `mark*` methods and the refund claim and settle use the helper.
- **Side effects.** The paid handler, revoke, re-anchor, and audit run **only for the winner**.
- **Repair path.** A loser on `PAID` that sees `provisionedAt` unset does not provision inline. That is the 14C sweep's job, which prevents a thundering herd.
- No multi-document transactions; no replica-set dependency.

### 2. One provider order per checkout (PR-03), no new status

- **Claim.** `findOneAndUpdate({ _id, status: CREATED, $or: [{ providerOpenClaimAt: null }, { providerOpenClaimAt: { $lt: now − 30s } }] }, { $set: { providerOpenClaimAt: now } })`. Only the winner calls `gateway.createOrder`, then transitions `CREATED → PENDING_PAYMENT` with the provider order id.
- **Loser.** Re-reads every 250 ms for up to 3 seconds and returns the opened order. Otherwise it returns 409 `CHECKOUT_IN_PROGRESS`, which the client retries (14D).
- **Status set unchanged.** No new `OrderStatus`, so admin filters, app mapping, and reports are untouched.
- **Notes.** Every Razorpay order carries `notes: { instanceId, orderId, orderNumber, userId }`, where `instanceId` is the `INSTANCE_ID` env (`ezprep` / `examflex`).
  - If a winner crashes after Razorpay created the order but before saving it, the orphan is still mappable by `notes.orderId` (14C lookup) and its capture is honored.
  - `instanceId` lets each instance ignore the other's webhook events at once if they ever share a Razorpay account (PR-37, 14C §1). It costs nothing if they don't.
- **Payment role.** `payments` gets `role: PRIMARY | DUPLICATE`; a boot repair sets existing rows to `PRIMARY`. Partial unique index `{ orderId: 1 }` where `role = PRIMARY`.
- **Index repair.** `PaymentIndexRepair` runs the backfill, then counts duplicates. On duplicates it logs them and skips the index instead of crashing the boot. Health shows "index missing" (14C).

### 3. Idempotency compares the request (PR-17)

- `requestHash = sha256(offerId | normalized billing)` is stored on the order.
- A replay with the same key and a different hash returns 409 `IDEMPOTENCY_KEY_REUSED`.
- Orders without a hash (created before this phase) replay as today.

### 4. Verify proves capture (PR-10)

- `fetchPayment(providerPaymentId)` is added to the port and to both adapters.
- **Razorpay verify:** HMAC check, then fetch, then require all of:
  - `status === 'captured'`
  - `order_id` equals `order.providerOrderId`, or the fetched order's `notes.orderId` equals the order (orphan case)
  - amount and currency equal to the order
- **`authorized`.** With automatic capture, Razorpay captures within seconds of authorization, so the success callback can arrive before the capture.
  - Verify re-fetches up to 2 more times, 1 second apart: at most 3 provider reads and about 2 seconds of added latency, and only in this case.
  - Still `authorized` → no state change. Respond with 200, the order still `PENDING_PAYMENT`, and `confirmation: 'PENDING_CAPTURE'` in the data, keeping the existing envelope. The `payment.captured` webhook completes it moments later, and the 14D client polls.
- `failed` or a mismatch → 400 as today.
- Fake gateway: unchanged outside production (it cannot exist in production after 14A).
- Cost: one extra provider read per checkout (three in the rare capture-lag case), and none on the webhook path.

### 5. Late capture (PR-02, D-22)

| Edge | Allowed when |
| --- | --- |
| Order `EXPIRED → PAID`, `FAILED → PAID` | Called with `proof: { source: VERIFY_FETCH \| WEBHOOK \| RECON_FETCH, providerPaymentId, amount, currency }`, where the amount and currency match the order |
| Payment `FAILED → CAPTURED`, `INITIATED/AUTHORIZED → CAPTURED` (existing) | Same proof |

Other rules:

- **Proof is mandatory.** `markOrderPaid` without proof keeps today's `from = [PENDING_PAYMENT]`.
- **Marking.** A late win sets `lateCaptureAt` and writes `ORDER_LATE_CAPTURE` (payload: previous status, minutes since `expiredAt`).
- **Verify on a closed order.** Verify accepts `EXPIRED` and `FAILED` orders and goes through the same proof path.
- **No premature `FAILED`.** Reconciliation no longer marks a Razorpay order `FAILED` because one attempt failed. It goes `EXPIRED` at the age window and sets `expiredAt`. `FAILED` stays for the fake gateway and for a provider-terminal state.
- **New order fields** (all optional): `expiredAt`, `lateCaptureAt`, `providerOpenClaimAt`, `requestHash`. The 14C scheduler fields are added in 14C.

### 6. Duplicate capture rows (PR-33, D-28)

- **Detection.** A proven capture whose provider payment id differs from the `PRIMARY` payment of an order already `PAID` (or `REFUNDED`) inserts a `DUPLICATE` payment row. The insert is idempotent on the existing unique `(provider, providerPaymentId)`.
- **No change to the order.** Order, entitlements, and invoice stay as they are. Audit `PAYMENT_DUPLICATE_CAPTURED`.
- **Refund schema (additive).**
  - New fields: `kind: ORDER | DUPLICATE_CAPTURE` (default `ORDER`) and `paymentId`, backfilled from the order's `PRIMARY` payment.
  - Unique index moves from `{ orderId }` to `{ paymentId }`, which means one refund per payment. Local data has at most one refund per order, so it converts cleanly. The repair checks first.
- The auto-refund itself is 14C.

### 7. Refund claim and settle (PR-04)

- **Claim.** `beginRefund` claims with `findOneAndUpdate({ paymentId, kind: ORDER, status: FAILED }, → INITIATED)`, or inserts. A concurrent second claim gets 409 `REFUND_IN_PROGRESS` without calling the provider.
- **Settle.** `settleProcessed` claims `INITIATED → COMPLETED`, then the order `PAID → REFUNDED`, both through the helper. The POST/webhook race no longer throws; the loser returns the settled refund.

## Behavior changes (harness rows that change, all intentional)

| Before | After | Consumer impact |
| --- | --- | --- |
| Capture on `EXPIRED`/`FAILED` → 500 | `PAID`, provisioned, `lateCaptureAt` set | App, after 14D, shows success. Before 14D the app already calls verify and shows the returned order |
| One failed attempt → order `FAILED` | Stays pending, then `EXPIRED` | Admin and app already handle both statuses |
| Verify on `authorized` → paid | Up to 2 re-fetches; then 200, order `PENDING_PAYMENT`, `confirmation: 'PENDING_CAPTURE'` | The phase 14 app shows "Payment could not be confirmed." (`CheckoutClient.tsx` L168) in that case, and access appears once the webhook lands. 14D replaces this with polling. Rare, because automatic capture usually completes within the re-fetch window |
| Concurrent replay → two provider orders | One; loser waits or 409 `CHECKOUT_IN_PROGRESS` | 14D retries; the phase 14 app shows its generic retry message |
| Same key, different plan → old order | 409 `IDEMPOTENCY_KEY_REUSED` | 14D fixes the key. Before 14D a plan switch on the same page errors instead of buying the wrong plan, which is safer |

## Files to create

- `src/orders/domain/compare-and-set.ts` (generic helper) + memory-Mongo spec
- `src/payments/domain/payment-role.enum.ts`, `src/refunds/domain/refund-kind.enum.ts`
- Repair steps in `payment-index.repair.ts` and a refund index repair

## Files that may be modified

Everything under Code references, `../state-machines.md`, `../domain-model.md` (new fields).

## Do-not-touch boundaries

- Webhook retry window, lookup fallbacks, late-watch scheduler, auto-refund, and sweeps are 14C.
- No frontend changes (14D).
- Tax and invoice rendering untouched.

## Implementation tasks

1. Compare-and-set helper + memory-Mongo concurrency specs.
2. Port every `mark*` and refund mutation; winner-only side effects.
3. Provider-open claim, `notes`, `role`, partial unique index + repair.
4. Request hash.
5. `fetchPayment`; verify requires captured; 202 path.
6. Late-capture edges with proof; reconciliation stops premature `FAILED`; `expiredAt`.
7. Duplicate payment rows; refund `kind`/`paymentId` + index move.
8. `state-machines.md` §3–§5 and `domain-model.md`.
9. Regression gate; update the harness rows listed above.

## Acceptance criteria

- Concurrent replay of a `CREATED` order → one `gateway.createOrder`, one `PRIMARY` payment.
- Expire vs pay race cannot end `EXPIRED` with a captured payment.
- A captured payment on an `EXPIRED` order provisions and invoices once, and shows `lateCaptureAt`.
- Verify + `payment.captured` + `order.paid` in parallel → paid handler exactly once.
- Refund POST and `refund.processed` together settle once, with no 500.
- Verify on an `authorized` payment grants nothing.
- A second captured payment on a `PAID` order creates one `DUPLICATE` row and changes nothing else.

## Tests

1. Helper: winner and loser, illegal `from`, no-op.
2. **Concurrency (memory Mongo, real parallel calls):** `markOrderPaid` ×3; expire vs paid; replay ×2 on `CREATED`; refund claim ×2; settle POST vs webhook.
3. Hash mismatch → 409; legacy order without a hash replays.
4. Razorpay verify: captured / authorized then captured on re-fetch / authorized throughout (3 reads, then `PENDING_CAPTURE`) / amount mismatch / wrong order id / orphan via notes. `notes.instanceId` present on create.
5. Late capture from `EXPIRED` and `FAILED` via verify, webhook, and reconciliation fetch; no proof → rejected.
6. Duplicate capture row; refund index move on a database holding one refund.
7. Boot repair on a database with a duplicate `PRIMARY` payment: logs and boots.

**Manual (append to `../E2E_TEST_STATUS.md`, do not tick):**

- With test keys, let the order pass its 30-minute window with the modal open, then pay. Access unlocks and admin shows the late-capture marker.
- Fail one method in the modal, then succeed with another: one paid order.
- Double-click Buy: one Razorpay order in the dashboard, with `notes.orderId`.

## Risks

R-02, R-06, R-22 (late capture), R-23 (concurrent signals), R-26 (duplicate capture).

## Rollback / isolation

Revert the phase. New fields are additive. The partial unique index and the refund `paymentId` index can be dropped, and the old `orderId` refund index re-created. Today's data satisfies both.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] `state-machines.md` and `domain-model.md` updated
- [ ] Indexes verified on local Mongo after boot
- [ ] Tests green; regression gate run and logged

## STATUS.md update (mandatory)

Same five steps as every phase. Developer ops:

- Confirm the indexes locally.
- Confirm `notes.orderId` and `notes.instanceId` on a new test-mode Razorpay order.
- In the Razorpay **test** dashboard, set the same capture settings as production will use (automatic; late authorizations captured), so local testing matches.

## Definition of done

No interleaving of verify, webhook, reconciliation, and refund can leave money and access disagreeing, and every captured rupee maps to exactly one paid order or one recorded duplicate.
