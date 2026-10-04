# API Contracts

All paths under global prefix `api/v1`. Envelope: `{ message, data, pagination? }`. Errors: existing `HttpExceptionFilter` shape. Admin routes: JWT + `role: admin`. User routes: JWT student (or any authenticated user).

Amounts in API request/response: document chosen unit in phase 04 OpenAPI (recommend rupees with 2 decimal places in JSON **or** integer paise — pick one and stay consistent; internal storage paise).

---

## 1. Access DTOs (embedded on content)

Returned on mock-test list/get items when access module is live:

```json
{
  "access": {
    "allowed": false,
    "reason": "ENTITLEMENT_REQUIRED",
    "accessMode": "ENTITLED"
  }
}
```

| reason | Meaning |
| --- | --- |
| `ALLOWED` | Free or entitled |
| `ENTITLEMENT_REQUIRED` | Need purchase/grant |
| `LEGACY_ALLOW` | Flag LEGACY and no entitlement (temporary) |
| `INACTIVE` | Paper not active |

---

## 2. Access / me

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/me/entitlements` | user | Active (and optionally expired) entitlements |
| GET | `/me/orders` | user | Order history |
| GET | `/me/orders/:id` | user | Order detail (own only) |
| GET | `/me/invoices` | user | Invoice list |
| GET | `/me/invoices/:id/pdf` | user | PDF download |
| GET | `/me/billing-profile` | user | Saved name + state |
| PATCH | `/me/billing-profile` | user | Update saved profile |

---

## 3. Catalog (user)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/catalog/products` | user | PUBLISHED products (optional filters) |
| GET | `/catalog/products/:id` | user | Product + ACTIVE offers (effective prices) |
| GET | `/catalog/products/for-exam/:examId` | user | Covering products for exam (View plans) |
| GET | `/catalog/products/for-mock-test/:mockTestId` | user | Covering products for paper |
| GET | `/meta/indian-states` | public or user | Canonical GST state/UT list: `{ code, name }[]` (D-19). Frontends must not hardcode. |

Covering = PUBLISHED product whose grants include:

- `EXAM` = examId, or
- `EXAM_GROUP` = exam’s group, or
- `MOCK_TEST` = mockTestId (and for exam endpoint, any mock under exam — or restrict to exam/group grants only for exam endpoint; **implement:** exam endpoint matches EXAM + EXAM_GROUP; mock endpoint matches those plus MOCK_TEST)

---

## 4. Checkout / payments (user)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/checkout/orders` | user | Create order from `{ offerId, billing, idempotencyKey }` |
| POST | `/checkout/orders/:id/verify` | user | Client-side success verify payload |
| GET | `/checkout/orders/:id` | user | Poll status |

### Create order body

```json
{
  "offerId": "...",
  "billing": {
    "name": "...",
    "stateCode": "32",
    "addressLine1": "...",
    "addressLine2": null,
    "city": "...",
    "pincode": "..."
  },
  "idempotencyKey": "client-generated-uuid"
}
```

Address fields + `stateCode` are **always required** (D-10). Reject checkout if missing.

Server loads Offer + Product, computes effective **inclusive** amount (paise), runs `TaxService.calculateInclusiveTax` with seller state from instance config + buyer `stateCode`, snapshots grants + tax breakdown on the order, creates provider order via PaymentGateway, returns checkout payload (provider-neutral + provider-specific fields under `providerData`).

**Never accept `amount` from client as authoritative.** State list comes from `GET /meta/indian-states` only.

### Verify body (Razorpay shape isolated in adapter mapping)

Provider-neutral:

```json
{
  "provider": "razorpay",
  "providerPayload": { }
}
```

---

## 5. Webhooks

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/webhooks/payments/:provider` | signature | Razorpay (and future) webhooks |

Raw body verification. No user JWT.

---

## 6. Admin — products

Prefer under `admin/commerce/...` or `admin/products` (root `admin` already proxied).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/products` | List/filter |
| POST | `/admin/products` | Create DRAFT |
| GET | `/admin/products/:id` | Detail + offers |
| PATCH | `/admin/products/:id` | Edit draft / metadata |
| POST | `/admin/products/:id/publish` | Publish / version bump rules |
| POST | `/admin/products/:id/archive` | Archive |
| POST | `/admin/products/:id/duplicate` | Duplicate to new DRAFT |

Grant payloads validate scope existence.

---

## 7. Admin — offers

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/admin/products/:productId/offers` | Create offer |
| PATCH | `/admin/offers/:id` | Update amounts/sale/status |
| GET | `/admin/offers/:id` | Detail |

Enforce unique ACTIVE per product+duration.

---

## 8. Admin — entitlements

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/users/:userId/entitlements` | List |
| POST | `/admin/entitlements/grant` | Manual grant |
| POST | `/admin/entitlements/:id/revoke` | Revoke |

### Grant body

```json
{
  "userId": "...",
  "scopeType": "EXAM",
  "scopeId": "...",
  "durationPreset": "3M",
  "reason": "support",
  "productId": null
}
```

`sourceType: ADMIN_GRANT`. Audit log required.

---

## 9. Admin — orders / refunds / invoices

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/orders` | Search |
| GET | `/admin/orders/:id` | Detail |
| POST | `/admin/orders/:id/refunds` | Full refund |
| GET | `/admin/invoices` | List |
| GET | `/admin/invoices/:id/pdf` | PDF |

---

## 10. Attempts (behavior change)

Existing:

- `POST /mock-test-attempts/start`
- resume endpoints as today

**New behavior:** before creating/resuming per policy, call AccessControlService. On deny:

- HTTP **403** (or **402** if you standardize — prefer **403** with stable error code)
- `error` / `message` clear
- `details.code = ENTITLEMENT_REQUIRED` (or similar) for clients

Do not rely on UI hiding the Start button.

---

## 11. Mock test / catalog list fields

Extend student-facing list/get DTOs:

- `accessMode`
- `access: { allowed, reason }`

Admin list/get should allow viewing/editing `accessMode`.

---

## 12. PaymentGateway port (internal, not HTTP)

```typescript
interface PaymentGateway {
  readonly provider: string;
  createOrder(input: CreatePaymentOrderInput): Promise<ProviderOrder>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerificationResult>;
  parseWebhook(input: ProviderWebhookInput): Promise<NormalizedPaymentEvent>;
  refund(input: RefundInput): Promise<ProviderRefund>;
  fetchOrderStatus?(providerOrderId: string): Promise<NormalizedPaymentEvent>; // reconciliation
}
```

Registry: `get(provider: string): PaymentGateway`.
