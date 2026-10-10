# State Machines

Arbitrary status writes are forbidden. Transitions happen only through application services with guards.

---

## 1. Product.status

```text
DRAFT ──publish──► PUBLISHED ──archive──► ARCHIVED
  ▲                   │
  └───unpublish?*─────┘  (optional; if not supported, edit via new draft version flow)
```

v1 minimum: `DRAFT → PUBLISHED → ARCHIVED`. Republish of material grant changes bumps `version` and remains `PUBLISHED`.

---

## 2. Offer.status

```text
ACTIVE ◄──► INACTIVE
```

Creating a second ACTIVE for same `(productId, durationPreset)` must fail unique index / service check.

---

## 3. Order.status

```text
CREATED
   │
   ▼
PENDING_PAYMENT
   ├──► PAID
   ├──► FAILED
   ├──► EXPIRED
   └──► CANCELLED

PAID ──► REFUNDED   (full refund completed)
```

| From | To | Trigger |
| --- | --- | --- |
| (new) | CREATED | Order row inserted |
| CREATED | PENDING_PAYMENT | Provider order created |
| PENDING_PAYMENT | PAID | Verified capture (verify or webhook) |
| PENDING_PAYMENT | FAILED | Terminal provider failure |
| PENDING_PAYMENT | EXPIRED | TTL / reconciliation |
| PENDING_PAYMENT | CANCELLED | User/admin cancel before pay |
| PAID | REFUNDED | Admin full refund success |
| EXPIRED, FAILED | PAID | **Late capture (D-22, from 14B).** Only with provider proof (signed webhook, verify that fetched a `captured` payment, or a reconciliation fetch) and a matching amount and currency. Sets `lateCaptureAt` and audits `ORDER_LATE_CAPTURE` |

Idempotent: repeated PAID signals no-op if already PAID.

**From 14B:**

- Every transition is a compare-and-set on the current status (`findOneAndUpdate({ _id, status: { $in: from } })`). Side effects (provision, revoke, audit) run only for the caller that won.
- `CREATED → PENDING_PAYMENT` is preceded by a `providerOpenClaimAt` claim, so only one request opens the provider order. This is a field, not a new status.
- Reconciliation no longer moves a Razorpay order to `FAILED` because one attempt failed; it goes `EXPIRED` at the age window.

**From 14C:** an `EXPIRED` order stays under the late-capture watch until `lateWatchUntil` (default 72 hours) and is rechecked on a fixed backoff (1h, 3h, 6h, 12h, 24h, 48h, 72h).

---

## 4. Payment.status

```text
INITIATED
   ├──► AUTHORIZED  (if distinct from capture in provider)
   ├──► CAPTURED
   └──► FAILED

CAPTURED ──► REFUNDED
```

v1 Razorpay Checkout often goes INITIATED → CAPTURED or FAILED. Map provider statuses inside adapter only.

**From 14B:**

- `FAILED → CAPTURED` is allowed with the same provider proof as the order's late-capture edge.
- Each payment has a `role`. The `PRIMARY` payment is the one that paid the order, and there is at most one per order (partial unique index).
- A further captured payment on an order that is already paid is a `DUPLICATE` row. It is refunded automatically (D-28) and never changes the order.

---

## 5. Entitlement.status

```text
ACTIVE ──► EXPIRED   (time-based; expiresAt < now)
ACTIVE ──► REVOKED   (admin or refund)
```

Expired may be lazy-evaluated in AccessControlService (treat as inactive if `expiresAt < now`) and optionally flipped by a job later.

**From 14A:**

- **Window.** An entitlement is active only when `startsAt <= now` and `expiresAt` is null or in the future, so a stacked purchase grants nothing before it starts.
- **Re-anchor (D-23).** When `PAYMENT` rows of an order are revoked, later purchases of the same user × product move earlier to `max(now, end of remaining earlier coverage)` with their full duration. They are never moved later, and the move is audited as `ENTITLEMENT_REANCHORED`. This is a window change, not a status change.

---

## 6. WebhookEvent.status

```text
RECEIVED ──► PROCESSED
RECEIVED ──► FAILED
RECEIVED ──► IGNORED   (duplicate or irrelevant type)
```

Unique `(provider, providerEventId)` prevents double insert; duplicate delivery returns 200 after IGNORED/PROCESSED.

**Retry window (14C).** Razorpay retries a failed delivery with exponential backoff and **disables the webhook after 24 hours of continuous failure** (verified 2026-10-10); it must then be re-enabled by hand in the Dashboard.

- A retryable outcome returns 500 only while `now − receivedAt < WEBHOOK_RETRY_WINDOW_MINUTES` (default 30).
- After that the row is `FAILED` with a reason, and the response is 200.
- Events tagged with another instance's `notes.instanceId` are `IGNORED` with reason `other_instance`, before any lookup.
- Events for payments the app did not create are `IGNORED` with reason `foreign_payment`.
- Refund events for a payment whose order never became `PAID` are `IGNORED` with reason `refund_on_unpaid_order`, and nothing is revoked.
- Signature rejections are counted per hour for the health page.

---

## 7. Refund.status

```text
INITIATED ──► COMPLETED
INITIATED ──► FAILED
```

On COMPLETED: Payment → REFUNDED, Order → REFUNDED, entitlements for order → REVOKED.

**From 14B–14C:**

- **Kind.** A refund has a `kind`. `ORDER` is the admin or external full refund and does the above, plus the D-23 re-anchor. `DUPLICATE_CAPTURE` refunds only the duplicate payment and touches nothing else.
- **Uniqueness.** One refund per payment (`paymentId` unique).
- **Unknown outcome.** A transport error or provider 5xx on create leaves the refund `INITIATED` with `outcomeUnknownAt`. The refund tick resolves it by listing the payment's refunds: processed → `COMPLETED`; nothing within `REFUND_UNKNOWN_WINDOW_MINUTES` → `FAILED`.
- **Retry.** Only `FAILED` can be retried. The retry is claimed atomically.

---

## 8. TaxInvoice

v1: created as `ISSUED` once; no void/credit-note transitions in v1.

**From 14C:** issued after provisioning, best effort (queue or sweep), never inside verify or the webhook response. `issuedAt = order.paidAt` (D-25).

**From 14E:** the supply type is copied from the order, and issue is refused when the seller state in config differs from the order's.

---

## 9. Access enforcement mode (config)

Not a document status — runtime config:

| Mode | Behavior |
| --- | --- |
| `LEGACY` | If paper ENTITLED and no entitlement → allow (log reason LEGACY_ALLOW) |
| `ENFORCED` | If paper ENTITLED and no entitlement → deny |

FREE always allows authenticated access regardless of mode.
