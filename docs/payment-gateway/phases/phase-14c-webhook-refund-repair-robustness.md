# Phase 14C — Webhook, refund, and repair robustness (ad-hoc)

Ad-hoc phase from [`../PRE_RELEASE_REVIEW.md`](../PRE_RELEASE_REVIEW.md). Runs after 14B and before 14D.

## Objective

1. Keep the webhook endpoint healthy no matter what Razorpay sends. A delivery that keeps failing for 24 hours gets the endpoint disabled (verified policy), so no event may return 5xx for long.
2. Honor late captures with a bounded pull (D-22).
3. Auto-refund duplicate captures (D-28).
4. Resolve refunds whose outcome is unknown or that were made outside the app.
5. Repair paid orders that did not provision or invoice.
6. Take invoice PDF/S3 work off the payment request, and date the invoice at payment (D-25).
7. Give the admin one health read model, including webhook delivery health.

Findings: PR-02 (late watch), PR-05, PR-06, PR-08 (sweeps), PR-09, PR-13, PR-14 (scheduler), PR-19 (API), PR-21, PR-22, PR-33 (refund), PR-34, PR-37 (ignore), PR-38.

## Prerequisites

- 14B done (compare-and-set helper, proof-based late edges, payment `role`, refund `kind`/`paymentId`, `notes.instanceId`).
- D-22, D-25, D-28, D-29 in `../decisions.md`.
- Owner answers (final):
  - The Razorpay account is used only by this app, and nobody acts in the Dashboard, so external refunds are a safety net only.
  - Redis exists on EZ Prep but not on ExamFlex, so nothing here depends on Redis.

## Source documents

`../PRE_RELEASE_REVIEW.md` (late-payment design, compatibility contract), `../state-machines.md` §6–§8, `../gst-invoicing.md`, `../decisions.md` D-11 D-12 D-22 D-25 D-28, `docs/REDIS.md`.

## Code references (ez-prep-api)

- `src/webhooks/razorpay-webhook.service.ts`, `src/webhooks/razorpay-webhook.controller.ts`, `src/webhooks/schemas/webhook-event.schema.ts`
- `src/refunds/refunds.service.ts`, `src/refunds/refund-reconciliation.scheduler.ts`
- `src/payments/infrastructure/razorpay/*` (list refunds and payments for an order or payment)
- `src/orders/reconciliation.service.ts`, `src/orders/reconciliation.scheduler.ts`, `src/orders/orders.service.ts` (`findStalePending`)
- `src/entitlements/entitlement-provisioning.service.ts`, `src/invoices/invoice-paid-order.notifier.ts`, `src/invoices/invoice.service.ts`, `src/invoices/admin-invoices.controller.ts`, `src/invoices/domain/*` (FY and number)
- `src/access/access-control.service.ts` (per-paper logging)
- `src/refunds/schemas/refund.schema.ts` (`initiatedBy` becomes optional for system refunds)

## Target behavior

### 1. Webhook: bounded retry, never stuck (PR-05)

- **Fields.** `webhook_events` gains `attempts`, `lastError`, `lastAttemptAt`.
- **Retry window.** A retryable outcome returns 500 only while `now − receivedAt < WEBHOOK_RETRY_WINDOW_MINUTES` (default 30). This is far inside Razorpay's 24-hour disable threshold, and the backoff gives several retries within it. After the window, the row is `FAILED` with a reason, the response is 200, and the row counts in health.
- **Catch-all.** Any exception inside `apply` is caught, recorded, and follows the same rule. A row never stays `RECEIVED` silently.
- **Instance check first (PR-37).** If `notes.instanceId` is present and differs from this instance's `INSTANCE_ID` → `IGNORED`, reason `other_instance`, 200, with no database lookups. This only matters if EZ Prep and ExamFlex ever share one Razorpay account.
- **Lookup order** for payment events:
  1. `providerOrderId`
  2. `payment.entity.notes.orderId` (14B)
  3. the payment's order fetched once from the provider, then its notes
- **Foreign payments.** No match and no notes → `IGNORED`, reason `foreign_payment`, 200, and counted in health. None are expected, since the account has no other uses (owner); a non-zero count is worth a look.
- **Paid path.** Capture events call `markOrderPaid` with `proof: WEBHOOK`. 14B's edges cover late captures; §3 below covers duplicates.

### 2. Webhook delivery visibility (PR-34)

- **Signature rejections.** A 400 for a bad signature increments `webhook_delivery_stats` (`_id = "rejected:<UTC hour>"`, `$inc` upsert, TTL 7 days). One small write per rejected request, already rate-limited per IP by 14A.
- **Health fields.**
  - `lastWebhookProcessedAt`
  - signature rejections in the last 1 and 24 hours
  - `FAILED` and `IGNORED` rows in the last 24 hours
  - `webhookSilentWhilePaid`: true when orders were paid by verify in the last 6 hours but no webhook was processed. This is the symptom of a disabled endpoint or a wrong secret.
- **Degraded log.** When the signature rejections in an hour exceed a threshold (default 5), or `webhookSilentWhilePaid` is true, the reconciliation tick logs `COMMERCE_DEGRADED` (one line per tick) so log-based alerting can catch it. Phase 15 wires the alert and documents the Dashboard re-enable procedure.

### 3. Late-capture watch (PR-02, D-22)

- **Fields.** When an order goes `EXPIRED` (14B sets `expiredAt`), set `lateWatchUntil = expiredAt + LATE_CAPTURE_WATCH_HOURS` (default 72) and `nextReconAt = expiredAt + 1h`.
- **Selection.** Each tick selects `{ status: EXPIRED, lateWatchUntil > now, nextReconAt <= now }` sorted by `nextReconAt`, limit `RECONCILIATION_BATCH` (default 50). Index `{ status, nextReconAt }`.
- **Per order.** One provider read (`fetchOrderPayments`).
  - Captured payment with matching amount → `markOrderPaid(proof: RECON_FETCH)`.
  - Otherwise the next check follows the fixed backoff from expiry: +1h, 3h, 6h, 12h, 24h, 48h, 72h.
  - After the last check, clear `nextReconAt`.
- **Load bound.** At most 7 provider calls per abandoned order, ever; nothing for orders that paid on time. The webhook stays the primary path; this is the safety net for a missed or disabled webhook.

### 4. Reconciliation backoff for pending orders (PR-13)

- **Selection.** Pending orders get `reconAttempts` and `nextReconAt`. Candidates are `nextReconAt <= now`, sorted by it, same index, so permanently skipped orders no longer block newer ones.
- **Cap.** After `RECONCILIATION_MAX_ATTEMPTS` (default 12), set `needsReview: true` and stop selecting.
- **Expiry.** `CREATED` orders past `expiresAt` → `EXPIRED`, using the compare-and-set helper.
- **Backfill.** Existing pending orders without `nextReconAt` get it on boot.

### 5. Duplicate capture auto-refund (PR-33, D-28)

- A `DUPLICATE` payment row (14B) with no refund gets a `kind: DUPLICATE_CAPTURE` refund created by the tick. It is keyed by `paymentId`, so it is idempotent, and it goes through the same provider refund call and unknown-outcome handling as §6.
- Settling it never touches the order, entitlements, or invoice. Audit `PAYMENT_DUPLICATE_REFUNDED`.
- Health counts duplicates and their refund status.

### 6. Refund resolution (PR-06)

- **Unknown outcome.** A provider transport error or 5xx on create leaves the refund `INITIATED` with `outcomeUnknownAt`. Only a definite 4xx rejection is `FAILED`.
- **Resolution.** The refund tick resolves `outcomeUnknownAt` rows by listing refunds for the payment. A processed match → `settleProcessed`. Nothing after `REFUND_UNKNOWN_WINDOW_MINUTES` (default 60) → `FAILED`, retryable by the admin.
- **Webhook lookup** falls back from refund id to `payment_id → payment → order`. This also covers the normal race where `refund.processed` arrives before the admin request has saved the provider refund id.
- **Refund actor.** Refunds gain `initiatedBySource: ADMIN | SYSTEM | PROVIDER` (default `ADMIN` for existing rows). `initiatedBy` becomes optional and is required only when the source is `ADMIN`. Audit rows for system and provider refunds use the `system` actor, and the refund DTO returns `initiatedBy: null` for them. No config user id is needed, so nothing differs per instance. The admin app does not read `initiatedBy` today.
- **External refunds (safety net).** Nobody acts in the Razorpay Dashboard (owner), so none are expected. If a processed refund still arrives for a `PAID` order with no app row, create one (`initiatedBySource: PROVIDER`, `reason: 'provider_dashboard'`) and settle it: revoke, re-anchor (D-23), audit `REFUND_EXTERNAL`.
- **Refund on an order that never paid (PR-38).** A refund event for a payment whose order is not `PAID`/`REFUNDED` and has no `DUPLICATE` row is `IGNORED`, reason `refund_on_unpaid_order`, 200. Examples: Razorpay refunding a late authorization, or an uncaptured payment. Nothing is revoked, and it is counted in health.
- **Partial refunds.** Only full refunds are supported (D-12). A partial refund made in the dashboard is recorded and flagged in health; it does not revoke access.

### 7. Repair sweeps (PR-08)

Inside the same tick, batched, each with its own `nextRepairAt` backoff:

- `PAID`, `provisionedAt` unset, `paidAt` older than 10 minutes → `provisionForPaidOrder` (idempotent keys, 14A lock).
- `PAID | REFUNDED`, provisioned, with no `tax_invoices` row → issue the invoice (when invoices are enabled).
- Invoice with no `pdfStorageKey` → `ensurePdf`.

Admin action used by 14D: `POST /api/v1/admin/orders/:id/repair` runs the same steps for one order, audits `ORDER_REPAIRED`, and returns the detail.

### 8. Scheduler hygiene (PR-14)

- An in-flight guard means a pass never overlaps the previous one.
- One startup log line with the effective intervals and batch sizes.
- One scheduler per instance: PM2 runs a single fork (`ecosystem.config.js`). No Redis lock is built, because both instances run one fork and ExamFlex has no Redis. The STATUS standing ops record that switching PM2 to cluster mode needs a distributed lock first. Every write is still compare-and-set, so an accidental second scheduler would duplicate work but not corrupt state.
- A tick-duration log line warns when a pass exceeds half the interval.

### 9. Invoice off the critical path, dated at payment (PR-09, PR-22, D-25)

- **Ordering.** Provisioning sets `provisionedAt` once grants are inserted. The invoice notifier runs after that, as **best effort**: errors are logged, picked up by the sweep, and never thrown into verify or the webhook.
- **Async path, identical on both instances.** No BullMQ and no Redis.
  - **Trigger.** Once the paid handler has committed, it schedules `issueForOrder(orderId)` in process (`setImmediate`, not awaited), so the invoice usually exists within seconds.
  - **Sweep.** The §7 sweep is the guarantee if the process restarts or S3 fails. It only picks orders whose `paidAt` is older than 2 minutes, so it rarely races the trigger.
  - **Race safety.** If both do run, the unique `orderId` index yields one invoice. A test proves no invoice number is consumed by the loser, so the series stays gap-free.
  - **Where the work happens.** PDF render and S3 upload run in the trigger or the sweep, never inside the request.
- **Invoice date.** `issuedAt = order.paidAt` **always**, and the FY series comes from `paidAt` in IST. A payment at 23:50 IST on 31 March that is repaired on 2 April is numbered in that FY's series and dated 31 March.
- **Numbering.** Numbers are still allocated at issue time from that FY's counter, so the series has no gaps. A repaired invoice can carry a later number than an invoice dated after it; the CA accepted this (`U-GST-13`).
- **Health.** Lists invoices issued more than 24 hours after `paidAt`.

### 10. Health read model (PR-19)

`GET /api/v1/admin/commerce/health` (admin) returns `status: ok | degraded`, and for each class a count, the oldest timestamp, and up to 5 order numbers:

- pending past window; `needsReview`
- under late watch; late captures (7d)
- `PAID` unprovisioned; `PAID` without invoice; invoice without PDF; invoices issued late
- redundant purchases (14A); duplicates and their refunds
- refunds with unknown outcome; external refunds (7d); partial external refunds; refunds on unpaid orders (7d)
- webhook rows ignored as `other_instance` or `foreign_payment` (24h)
- the webhook block from §2
- index-missing warnings from 14B repairs
- effective flags from 14A

Cost: one aggregation per class over indexed fields, cached 30 seconds in process.

The endpoint is not gated by `COMMERCE_ENABLED`. With commerce off it still answers, reporting `commerceEnabled: false` among the flags, so the go-live guide can check it before switch-on.

`GET /api/v1/admin/orders` gains an optional `flag` filter using the same queries: `needsReview`, `unprovisioned`, `uninvoiced`, `lateCapture`, `redundantPurchase`, `duplicate`. It is additive; without `flag` the response is unchanged. 14D links the health cards to it.

Per-paper `LEGACY_ALLOW` / `ENTITLEMENT_REQUIRED` logs in list resolution move to `debug`, replaced by one summary line per request. The `startAttempt` denial log stays.

### 11. Admin invoice list pagination (PR-21)

Same page and limit shape as admin orders. No current client calls the list (the admin only links the per-invoice PDF), so this is safe. The response keeps `data: Invoice[]` and adds `meta: { page, limit, total }`. Without query parameters the default limit is 50.

## Behavior changes (harness rows that change, all intentional)

| Before | After | Consumer impact |
| --- | --- | --- |
| Unresolvable webhook → 500 forever | 500 for 30 minutes, then 200 + `FAILED` | Razorpay stops retrying; health shows it |
| Invoice issued inside verify and webhook | Issued after, best effort | Verify returns faster. The invoice appears seconds later (in-process trigger) or within one tick (sweep). Until then the app subscriptions page lists no invoice for that order, which is the same state it already shows when invoicing fails today. 14D adds an "Invoice is being prepared" line for paid orders without one |
| `issuedAt` = issue time | `issuedAt` = `paidAt` | The PDF date changes only when issue is delayed |
| Refund timeout → `FAILED` | `INITIATED` + unknown, resolved by the tick | Admin shows "processing" (the existing label) |
| Dashboard refund → loop | Settled, access revoked | — |
| Refund event on an unpaid order → retry loop | `IGNORED`, 200 | — |
| Other instance's or foreign event → 500 loop | `IGNORED`, 200 | — |
| Refund `initiatedBy` always required | Required only for admin refunds | DTO may return `null`; no client reads it |
| `GET /admin/invoices` returns all | Default 50, plus `meta` | No current consumer |
| Per-paper warn logs | Debug + summary | Less log volume |

## Files to create

- `src/commerce-health/` (controller, service, spec)
- `src/webhooks/schemas/webhook-delivery-stat.schema.ts`
- `src/orders/late-capture-watch.ts` (pure schedule function) + spec
- `src/orders/repair-sweeps.service.ts` + spec

## Files that may be modified

Everything under Code references, `../state-machines.md` §6–§8, `../domain-model.md`, `.env.example`:

- `WEBHOOK_RETRY_WINDOW_MINUTES`
- `LATE_CAPTURE_WATCH_HOURS`
- `RECONCILIATION_BATCH`
- `RECONCILIATION_MAX_ATTEMPTS`
- `REFUND_UNKNOWN_WINDOW_MINUTES`

## Do-not-touch boundaries

- No Redis or BullMQ in the money path. Every repair works through the in-process tick, so EZ Prep and ExamFlex behave identically.
- No credit notes (U-GST-04 stays deferred).
- No frontend changes (14D consumes health, repair, and paging).
- Tax amounts and the invoice template are 14E.

## Implementation tasks

1. Webhook attempts and window, catch-all, instance check, lookup fallbacks, foreign payments.
2. Delivery stats, `webhookSilentWhilePaid`, `COMMERCE_DEGRADED`.
3. Late-capture watch (schedule function, selection, index).
4. Pending backoff, `needsReview`, `CREATED` expiry, backfill.
5. Duplicate auto-refund.
6. Refund actor source, unknown outcome, list-by-payment resolution, external and partial refunds, refund on unpaid order.
7. Repair sweeps and admin repair endpoint.
8. Scheduler guard, duration warning.
9. Best-effort notifier with in-process trigger, `issuedAt = paidAt`, FY from `paidAt`.
10. Health endpoint, log change, invoice paging.
11. Regression gate; update the harness rows above.

## Acceptance criteria

- A signed fixture for an unknown order: 500 inside the window, 200 + `FAILED` after it.
- A capture webhook missed entirely (simulated) on an expired order: the late watch marks it paid at the next scheduled check, with at most 7 provider calls in total.
- A second captured payment is auto-refunded once, and access is unchanged.
- A dashboard `refund.processed` for a paid order revokes its entitlements, re-anchors stacked purchases, and marks the order `REFUNDED`.
- A refund create that times out but succeeded at the provider ends `COMPLETED` after one refund tick.
- A `PAID` order with S3 down at payment time gets its invoice, dated at `paidAt`, on the first tick after S3 recovers. Verify returned success at payment time.
- Fifty permanently skipped orders do not block a newer pending order.
- A wrong webhook secret shows as signature rejections plus `webhookSilentWhilePaid` in health within an hour.

## Tests

1. Webhook window matrix; catch-all; `other_instance` short-circuit (no DB read); three-step lookup; foreign payment.
2. Delivery stats increment; silent-while-paid rule.
3. Late watch: schedule function table; selection respects `lateWatchUntil`; capture found → paid once; parallel webhook + watch → one winner (memory Mongo).
4. Backoff, `needsReview`, `CREATED` expiry.
5. Duplicate refund: idempotent across two ticks; unknown outcome.
6. Refund: timeout → unknown → processed or failed; `refund.processed` before the refund id is saved; external with `PROVIDER` source; partial flagged; refund on an unpaid order ignored; re-anchor called.
7. Sweeps; repair endpoint idempotent.
8. Scheduler overlap guard.
9. Notifier failure does not throw from verify; `issuedAt = paidAt`; FY boundary at 31 March 23:50 IST; **trigger + sweep racing on one order (memory Mongo) → one invoice, and the next order gets the next number with no gap**.
10. Health shape and counts; invoice paging with and without query.

**Manual (append to `../E2E_TEST_STATUS.md`, do not tick):**

- A refund from the Razorpay test dashboard revokes access within one webhook.
- Stop S3 credentials locally, pay, restore. One tick later the invoice exists, dated at payment.
- Set a wrong webhook secret locally and pay. Health turns degraded; restore.
- Health counts move as expected.

## Risks

R-06, R-12, R-18, R-22 (late capture), R-24 (webhook disabled after 24 hours), R-25 (refunds outside the app), R-26 (duplicate capture).

## Rollback / isolation

- `RECONCILIATION_ENABLED=false` stops the sweeps, watch, and duplicate refunds.
- A very high `WEBHOOK_RETRY_WINDOW_MINUTES` restores always-retry.
- `LATE_CAPTURE_WATCH_HOURS=0` disables the watch.
- Health is read-only.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] `.env.example` updated
- [ ] Tests green; regression gate run and logged

## STATUS.md update (mandatory)

Same five steps as every phase. Developer ops:

- Run one local tick with `RECONCILIATION_MIN_AGE_MINUTES=0` and confirm the sweep summary in the logs.
- Do one dashboard refund in Razorpay test mode.
- Check that health shows the webhook block.
- Restore the defaults.

## Definition of done

One bad event cannot get the webhook endpoint disabled. Every capture, duplicate, and refund converges with bounded provider load. Every paid order eventually has entitlements and an invoice dated at payment. Stuck states are visible in one place.
