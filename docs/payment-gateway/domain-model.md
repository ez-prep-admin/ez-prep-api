# Domain Model

Target MongoDB collections and academic field additions. Adapt Nest schema naming to existing conventions (`id` virtual, soft delete where applicable).

---

## 1. Academic additions

### MockTest (`mocktests`) — new field

| Field | Type | Notes |
| --- | --- | --- |
| `accessMode` | enum `FREE` \| `ENTITLED` | Default for **new** docs: decide in phase 01 (recommend `ENTITLED` for new paid-era papers; backfill existing to `FREE` via script) |

Applies to all paper types in `mocktests` (topic-wise, full exam, sprint).

### Exam — invariant

On create/update: `exam.category` must equal `examGroup.category`. Reject otherwise. Required for safe `EXAM_GROUP` grants.

### User — optional billing profile (non-authorizing)

| Field | Type | Notes |
| --- | --- | --- |
| `billingProfile.name` | string | Last checkout billing name |
| `billingProfile.stateCode` | string | GST state code |
| `billingProfile.addressLine1` | string | Required at checkout |
| `billingProfile.addressLine2` | string? | |
| `billingProfile.city` | string | |
| `billingProfile.pincode` | string | |
| `billingProfile.updatedAt` | date | |

Do **not** add purchase ID arrays. Do not treat `subscription` / `membershipTier` as SoT.

---

## 2. Product

Collection: `products`

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string | Unique business code, e.g. `SSC_CGL_COMPLETE` |
| `name` | string | |
| `description` | string? | |
| `status` | enum | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| `version` | number | Increments on publish of material changes |
| `grants` | Grant[] | See below |
| `display` | object? | UI hints (sortOrder, badge, etc.) |
| `metadata` | object? | Non-authorizing extras |
| `createdBy` / `updatedBy` | ObjectId | Admin users |
| `createdAt` / `updatedAt` | date | |
| `isDeleted` | boolean | Soft delete consistent with platform |

### Grant

| Field | Type |
| --- | --- |
| `scopeType` | `EXAM_GROUP` \| `EXAM` \| `MOCK_TEST` |
| `scopeId` | ObjectId |

**Invariant:** At least one grant when publishing. All `scopeId`s must exist and match type.

### Versioning policy

- Editing a `DRAFT` mutates in place.
- Publishing from draft or publishing changes to a live product that alter `grants` / commercial meaning creates/increments `version` and freezes prior meaning for existing orders (orders store snapshots; live Product document holds current version for new purchases).
- Exact freeze strategy (version subdocuments vs snapshot-only on orders): **snapshot on Order/Entitlement is mandatory**; keeping historical ProductVersion docs is recommended if admin “view versions” is required (phase 04).

### Indexes

- unique `code`
- `status`
- `grants.scopeType` + `grants.scopeId` (for View plans queries)

---

## 3. Offer

Collection: `offers`

| Field | Type | Notes |
| --- | --- | --- |
| `productId` | ObjectId | |
| `durationPreset` | enum | `1M` \| `3M` \| `6M` \| `12M` \| `LIFETIME` |
| `currency` | string | Always `INR` in v1 |
| `listAmount` | number | Integer **paise**, GST-inclusive (₹999 → `99900`) |
| `saleAmount` | number? | Inclusive GST, paise |
| `taxIncluded` | boolean | `true` in v1 (mirrors central `pricesAreTaxInclusive`) |
| `saleValidFrom` / `saleValidUntil` | date? | |
| `status` | enum | `ACTIVE` \| `INACTIVE` |
| `createdAt` / `updatedAt` | date | |

**Effective amount (server-only):** if now ∈ sale window and `saleAmount` set → `saleAmount`, else `listAmount`.

**Invariant:** At most one `ACTIVE` offer per `(productId, durationPreset)`.

### Indexes

- unique partial: `{ productId: 1, durationPreset: 1 }` where `status: ACTIVE`
- `{ productId: 1, status: 1 }`

### Duration → entitlement length

| Preset | Rule |
| --- | --- |
| `1M` | +1 calendar month from start anchor |
| `3M` | +3 months |
| `6M` | +6 months |
| `12M` | +12 months |
| `LIFETIME` | `expiresAt = null` (or far-future — prefer `null` + status) |

Stacking anchor: if active entitlement for same product exists, start = current `expiresAt`; else start = provision time. Lifetime + anything = lifetime.

---

## 4. Order

Collection: `orders`

| Field | Type | Notes |
| --- | --- | --- |
| `orderNumber` | string | Human-friendly unique |
| `userId` | ObjectId | |
| `status` | enum | See state-machines |
| `items[]` | OrderItem | v1: single item OK but model as array |
| `amount` | number | Charged inclusive amount (paise) |
| `currency` | `INR` | |
| `tax` | TaxBreakdown | Snapshot from `TaxService.calculateInclusiveTax` at order create (never recalculate later from live config) |
| `billing` | `{ name, state, stateCode, addressLine1, addressLine2?, city, pincode }` | Snapshot; address always required (D-10) |
| `paymentProvider` | string? | e.g. `razorpay` |
| `providerOrderId` | string? | |
| `idempotencyKey` | string | Unique per user or globally unique |
| `expiresAt` | date? | Checkout window |
| `paidAt` | date? | |
| `createdAt` / `updatedAt` | date | |

### OrderItem snapshot (mandatory)

| Field | Notes |
| --- | --- |
| `productId` | |
| `productVersion` | |
| `productCode` / `productName` | |
| `offerId` | |
| `durationPreset` | |
| `listAmount` / `amount` | Amount charged for item |
| `grants[]` | Copy of grants at purchase |

### Indexes

- unique `orderNumber`
- unique `idempotencyKey`
- `{ userId: 1, createdAt: -1 }`
- `{ status: 1, createdAt: 1 }` (reconciliation)
- `{ providerOrderId: 1 }`

---

## 5. Payment

Collection: `payments`

| Field | Type | Notes |
| --- | --- | --- |
| `orderId` | ObjectId | |
| `userId` | ObjectId | |
| `provider` | string | |
| `providerPaymentId` | string? | |
| `providerOrderId` | string? | |
| `amount` / `currency` | | |
| `status` | enum | See state-machines |
| `method` | string? | |
| `failureCode` / `failureReason` | | |
| `rawStatus` | string? | Provider status for debug (not used by domain) |
| `capturedAt` | date? | |
| `createdAt` / `updatedAt` | date | |

### Indexes

- `{ orderId: 1 }`
- unique sparse `{ provider, providerPaymentId }`
- `{ providerOrderId: 1 }`
- `{ status: 1 }`

---

## 6. Entitlement

Collection: `entitlements`

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId | |
| `scopeType` / `scopeId` | | From grant |
| `status` | `ACTIVE` \| `EXPIRED` \| `REVOKED` | |
| `startsAt` / `expiresAt` | date / date? | null expiresAt = lifetime |
| `sourceType` | `PAYMENT` \| `ADMIN_GRANT` \| `PROMOTION` \| `TRIAL` \| `SYSTEM` | |
| `sourceId` | ObjectId/string? | orderId or admin action id |
| `productId` / `productVersion` | | |
| `orderId` | ObjectId? | |
| `provisioningKey` | string | Unique idempotency key for provision |
| `revokedAt` / `revokeReason` | | |
| `metadata` | object? | |
| `createdAt` / `updatedAt` | date | |

One paid order with N grants → N entitlements (or one entitlement record per grant). Prefer **one row per grant** for simple queries.

### Indexes

- `{ userId: 1, status: 1, scopeType: 1, scopeId: 1 }`
- `{ userId: 1, productId: 1, status: 1 }` (stacking lookup)
- unique `provisioningKey`
- `{ expiresAt: 1 }` (expiry job optional)

---

## 7. WebhookEvent

Collection: `webhook_events`

| Field | Type |
| --- | --- |
| `provider` | string |
| `providerEventId` | string |
| `eventType` | string |
| `status` | `RECEIVED` \| `PROCESSED` \| `FAILED` \| `IGNORED` |
| `payloadHash` | string |
| `error` | string? |
| `receivedAt` / `processedAt` | date |

### Indexes

- unique `{ provider: 1, providerEventId: 1 }`

---

## 8. Refund

Collection: `refunds`

| Field | Type | Notes |
| --- | --- | --- |
| `orderId` / `paymentId` | ObjectId | |
| `userId` | ObjectId | |
| `provider` | string | |
| `providerRefundId` | string? | |
| `amount` | number | Full payment amount in v1 |
| `status` | enum | See state-machines |
| `reason` | string? | Admin-entered |
| `initiatedBy` | ObjectId | Admin |
| `createdAt` / `updatedAt` | date | |

---

## 9. TaxInvoice

Collection: `tax_invoices`

| Field | Type | Notes |
| --- | --- | --- |
| `invoiceNumber` | string | `EZPREP/YYYY-YY/####` (Indian FY) unique |
| `orderId` / `userId` | ObjectId | |
| `status` | `ISSUED` | v1 |
| `billing` | name, state, stateCode | Snapshot |
| `seller` | legalName, gstin, registeredAddress, state, stateCode | Snapshot of instance seller config at issue |
| `sacCode` / `sacDescription` | string | Snapshot from taxConfig (not live re-read for history) |
| `lineItems` | description, amount | |
| `tax` | TaxBreakdown | gross, taxable, tax, cgst, sgst, igst, taxRate — from order snapshot |
| `issuedAt` | date | |
| `pdfStorageKey` | string? | S3 key or similar |
| `createdAt` | date | |

### Indexes

- unique `invoiceNumber`
- unique `orderId` (one invoice per order v1)
- `{ userId: 1, issuedAt: -1 }`

---

## 10. CommerceAuditLog

Collection: `commerce_audit_logs`

| Field | Type |
| --- | --- |
| `actorUserId` | ObjectId / system |
| `action` | string enum (PRODUCT_PUBLISHED, ENTITLEMENT_GRANTED, REFUND_COMPLETED, …) |
| `resourceType` / `resourceId` | |
| `before` / `after` | object? |
| `correlationId` | string? |
| `createdAt` | date |

---

## 11. Seller / tax config (instance DB)

Extend existing [`instance-config`](../../src/instance-config/schemas/instance-config.schema.ts) (or a dedicated nested commerce document on the same singleton pattern). **Not hardcoded** in source.

### taxConfig

| Field | Type / example |
| --- | --- |
| `taxEnabled` | `true` |
| `taxType` | `GST` |
| `taxRate` | `18` |
| `pricesAreTaxInclusive` | `true` |
| `currency` | `INR` |
| `sacCode` | `"999293"` |
| `sacDescription` | `"Commercial training and coaching services"` |
| `invoiceSeriesPrefix` | `EZPREP` |

### seller

| Field | Example |
| --- | --- |
| `legalName` | `EzPrep - Powered by Clustream` |
| `gstin` | `32BIAPD6927L1ZC` (prefix matches `stateCode`) |
| `registeredAddress` | `Kochi, Kerala` |
| `state` | `Kerala` |
| `stateCode` | `32` |

### TaxBreakdown (embedded on Order / Invoice)

`grossAmount`, `taxableAmount`, `taxAmount`, `cgst`, `sgst`, `igst`, `taxRate` — produced by `TaxService.calculateInclusiveTax`. See [`gst-invoicing.md`](gst-invoicing.md).

### Indian states reference

Canonical list owned by API (constant module or collection), exposed via `GET /meta/indian-states`. Not duplicated in frontends.

---

## 12. Money unit convention

Store all money as integer **paise** (₹1 = 100). APIs may accept/display rupees via DTO transform, but persistence and Razorpay amount fields must be paise-consistent and tested. Record the public JSON convention in `STATUS.md` during phase 04.

---

## 13. Module boundaries (Nest)

```text
src/
  access/           AccessControlService
  entitlements/
  products/
  offers/
  orders/
  payments/
    application/
    domain/           PaymentGateway port, registry
    infrastructure/
      razorpay/
      fake/
  tax/                TaxService.calculateInclusiveTax
  invoices/
  refunds/
  webhooks/           or under payments
  commerce-audit/
  meta/               indian-states endpoint (or under common)
```

Exact folder names may match Nest style used elsewhere; boundaries above are mandatory. Reuse/extend `instance-config` for seller/taxConfig.
