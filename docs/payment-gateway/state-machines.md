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

Idempotent: repeated PAID signals no-op if already PAID.

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

---

## 5. Entitlement.status

```text
ACTIVE ──► EXPIRED   (time-based; expiresAt < now)
ACTIVE ──► REVOKED   (admin or refund)
```

Expired may be lazy-evaluated in AccessControlService (treat as inactive if `expiresAt < now`) and optionally flipped by a job later.

---

## 6. WebhookEvent.status

```text
RECEIVED ──► PROCESSED
RECEIVED ──► FAILED
RECEIVED ──► IGNORED   (duplicate or irrelevant type)
```

Unique `(provider, providerEventId)` prevents double insert; duplicate delivery returns 200 after IGNORED/PROCESSED.

---

## 7. Refund.status

```text
INITIATED ──► COMPLETED
INITIATED ──► FAILED
```

On COMPLETED: Payment → REFUNDED, Order → REFUNDED, entitlements for order → REVOKED.

---

## 8. TaxInvoice

v1: created as `ISSUED` once; no void/credit-note transitions in v1.

---

## 9. Access enforcement mode (config)

Not a document status — runtime config:

| Mode | Behavior |
| --- | --- |
| `LEGACY` | If paper ENTITLED and no entitlement → allow (log reason LEGACY_ALLOW) |
| `ENFORCED` | If paper ENTITLED and no entitlement → deny |

FREE always allows authenticated access regardless of mode.
