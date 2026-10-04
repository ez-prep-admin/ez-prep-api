
# EZ Prep — Users, Commerce, Entitlements & Payments

> **Execution pack:** Implement via [`payment-gateway/`](./payment-gateway/README.md) (phased sessions, locked decisions, status tracker). Where that pack conflicts with this brief, the pack wins.

## 1. Objective

Redesign the current user/access/payment architecture so that:

- users are authenticated and authorized securely
- access to exams and mock tests is entitlement-driven
- admins can create and manage purchasable plans/bundles without developer intervention
- a product can grant access to an individual exam, an entire exam group, or specific mock tests
- free/demo/promotional mock tests are supported
- purchasing an exam does not grant unrelated exams
- purchasing an exam group grants access to all applicable exams in that group
- newly created exams automatically inherit access from an active exam-group entitlement
- payments are completely decoupled from access logic
- Razorpay is only one payment-provider implementation
- Cashfree/Stripe/other providers can be added or removed without changing downstream business logic
- historical purchases remain correct even when products, prices, exams or bundles are changed later
- the system is secure, idempotent, auditable and observable
- Admin UI, User UI and Backend have clear responsibilities

The architecture must avoid special cases such as:

```text
if product === "SSC PACK"
if exam === "SSC CGL"
if paymentProvider === "razorpay"
```

Business rules must be represented as data and domain abstractions.

---

# 2. Fundamental Architecture Decision

## Separate four concepts completely

### Academic content

Existing domain:

```text
Category
    ↓
ExamGroup
    ↓
Exam
    ↓
MockTest
```

These entities describe what EZ Prep teaches/tests.

They must NOT know which payment gateway was used.

They must NOT contain user-specific purchase information.

---

### Commercial products

A commercial Product describes something EZ Prep sells.

Examples:

```text
SSC CGL Complete Access
SSC Complete Pack
RRB NTPC Complete Access
RRB Complete Pack
10 Mock Test Starter Pack
```

There is no special business logic for "pack".

A pack is simply a Product with multiple or broad access grants.

---

### Orders / Payments

An Order represents the user's intention to purchase a Product.

A Payment represents an attempt/transaction with an external payment provider.

An Order may have multiple payment attempts.

Example:

```text
Order
  ├── Payment Attempt #1 → failed
  └── Payment Attempt #2 → successful
```

Therefore Order and Payment must be separate concepts.

---

### Entitlements

An Entitlement is the authoritative record of what the user is allowed to access.

Payments do not directly unlock mock tests.

Instead:

```text
successful payment
       ↓
verified order
       ↓
entitlement provisioning
       ↓
access resolver
       ↓
mock test access
```

This is the central architectural boundary.

---

# 3. Existing Academic Relationships

Keep the existing academic hierarchy:

```text
Category
  └── ExamGroup
        └── Exam
              └── MockTest
```

The exact relationships must be audited by Cursor before implementation.

For example, verify:

```text
Exam.examGroup → valid ExamGroup
Exam.category → consistent with ExamGroup.category
MockTest.examId → valid Exam
```

Any duplicated relationship such as `Exam.category` must have a documented invariant.

If `Exam.category` can always be derived from `ExamGroup.category`, consider treating ExamGroup as the source of truth.

Do not make broad schema changes until the current data is analyzed.

---

# 4. Product / Commercial Catalog

Create a dedicated commercial Product collection.

Suggested conceptual model:

```text
Product
├── _id
├── code
├── name
├── description
├── status
├── version
├── grants[]
├── display
├── metadata
├── createdBy
├── updatedBy
├── createdAt
└── updatedAt
```

Example:

```json
{
  "code": "SSC_CGL_COMPLETE",
  "name": "SSC CGL Complete Access",
  "status": "PUBLISHED",
  "version": 1,
  "grants": [
    {
      "scopeType": "EXAM",
      "scopeId": "SSC_CGL_EXAM_ID"
    }
  ]
}
```

SSC Pack:

```json
{
  "code": "SSC_COMPLETE_PACK",
  "name": "SSC Complete Pack",
  "status": "PUBLISHED",
  "version": 1,
  "grants": [
    {
      "scopeType": "EXAM_GROUP",
      "scopeId": "SSC_GROUP_ID"
    }
  ]
}
```

Specific mock-test product:

```json
{
  "code": "MOCK_123_ACCESS",
  "grants": [
    {
      "scopeType": "MOCK_TEST",
      "scopeId": "MOCK_TEST_ID"
    }
  ]
}
```

A product can contain multiple grants.

Therefore a bundle is naturally supported.

---

# 5. Product Grants

Do not encode product types into access logic.

Use generic scopes:

```text
EXAM_GROUP
EXAM
MOCK_TEST
```

The system should conceptually understand:

```text
EXAM_GROUP entitlement
        ↓
all exams inside group
        ↓
all mock tests belonging to those exams
```

and:

```text
EXAM entitlement
        ↓
all mock tests belonging to that exam
```

and:

```text
MOCK_TEST entitlement
        ↓
only that mock test
```

This gives the following behavior automatically:

| Purchase | Access |
|---|---|
| SSC CGL | SSC CGL mock tests |
| SSC Pack | All exams currently/future belonging to SSC group |
| RRB NTPC | RRB NTPC only |
| RRB Pack | RRB exam-group contents |
| Specific Mock Test | Only that test |
| Free Mock Test | No entitlement required |

---

# 6. Dynamic Exam-Group Access

This is an important design decision.

An entitlement to:

```text
EXAM_GROUP = SSC
```

should be dynamic.

Therefore:

```text
Existing SSC Pack buyer
        ↓
new SSC exam created
        ↓
exam belongs to SSC group
        ↓
existing SSC Pack entitlement automatically grants access
```

No migration or user update is required.

This is one of the major reasons the access model should be hierarchical rather than storing lists such as:

```text
user.purchasedExamIds[]
user.purchasedMockTestIds[]
```

Never maintain those arrays as the source of truth.

---

# 7. Product Versioning

Published product definitions must not silently rewrite historical purchases.

Example:

Today:

```text
SSC Pack
  → SSC Group
```

Later an admin changes the product.

Existing purchases must retain their original commercial meaning.

Therefore products must have a version.

Recommended workflow:

```text
Draft Product
      ↓
Publish v1
      ↓
Users purchase v1
      ↓
Admin edits
      ↓
Create v2
      ↓
Publish v2
```

New purchases use v2.

Existing entitlements remain based on the grants captured when they were purchased.

Do not mutate historical order/entitlement meaning by editing the live Product document.

---

# 8. Offers / Pricing

Separate the thing being sold from its monetary offer.

Recommended concept:

```text
Product
   ↓
Offer
```

An Offer contains:

```text
amount
currency
paymentMode
status
validFrom
validUntil
```

Example:

```text
Product:
SSC Complete Pack

Offer:
₹999
INR
ONE_TIME
ACTIVE
```

This allows future support for:

```text
₹999 one-time
₹499 introductory offer
monthly subscription
annual subscription
limited-time pricing
```

without changing Product semantics.

Historical Orders must snapshot:

```text
productId
productVersion
productName
offerId
amount
currency
grants
```

The snapshot is critical.

Changing the current price must never change the amount associated with an old order.

---

# 9. Order Collection

Create an `orders` collection.

Conceptually:

```text
Order
├── _id
├── orderNumber
├── userId
├── items[]
├── amount
├── currency
├── status
├── paymentProvider
├── providerOrderId
├── idempotencyKey
├── expiresAt
├── createdAt
└── updatedAt
```

Order states should be controlled by a state machine, not arbitrary updates.

Suggested:

```text
CREATED
   ↓
PENDING_PAYMENT
   ├──→ PAID
   ├──→ FAILED
   ├──→ EXPIRED
   └──→ CANCELLED
```

An order is an internal EZ Prep entity.

It should not become a Razorpay-specific object.

---

# 10. Payment Collection

Create a separate `payments` collection.

Purpose:

Track provider transactions/payment attempts.

Example:

```text
Payment
├── _id
├── orderId
├── userId
├── provider
├── providerPaymentId
├── providerOrderId
├── amount
├── currency
├── status
├── method
├── failureCode
├── failureReason
├── capturedAt
├── createdAt
└── updatedAt
```

Suggested normalized state:

```text
INITIATED
AUTHORIZED
CAPTURED
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

Provider-specific status must not leak into the rest of the application.

---

# 11. Entitlement Collection

This is the most important new collection.

Suggested model:

```text
Entitlement
├── _id
├── userId
├── scopeType
├── scopeId
├── status
├── startsAt
├── expiresAt
├── sourceType
├── sourceId
├── productId
├── productVersion
├── orderId
├── createdAt
├── revokedAt
└── metadata
```

Example:

```json
{
  "userId": "...",
  "scopeType": "EXAM_GROUP",
  "scopeId": "...SSC_GROUP_ID...",
  "status": "ACTIVE",
  "sourceType": "PAYMENT",
  "sourceId": "...order...",
  "productId": "...",
  "productVersion": 1,
  "orderId": "..."
}
```

Another user may have:

```text
EXAM → SSC CGL
```

without having:

```text
EXAM_GROUP → SSC
```

Both are valid.

Multiple entitlements can coexist.

---

# 12. Entitlement Sources

Do not assume every entitlement originates from a payment.

Support:

```text
PAYMENT
ADMIN_GRANT
PROMOTION
TRIAL
SYSTEM
```

Examples:

```text
Payment → user bought SSC Pack
Admin Grant → support team manually granted access
Promotion → free campaign
Trial → 7-day access
System → legacy migration
```

This makes promotions and support operations possible without corrupting payment data.

---

# 13. Free Mock Tests

A free test must not require a fake payment.

Mock tests should have an explicit access policy.

Conceptually:

```text
accessMode:
  FREE
  ENTITLED
```

For `FREE`:

```text
authenticated user
      ↓
allowed
```

For `ENTITLED`:

```text
Access Resolver
      ↓
check entitlement hierarchy
```

Later, time-limited promotions can use entitlements rather than modifying the test itself.

The access rules should not be:

```text
if mockTest.isFree
else if user.subscription.plan === premium
```

The latter becomes unmaintainable.

---

# 14. Access Resolver

Create a dedicated domain service:

```text
AccessControlService
```

or:

```text
EntitlementAccessService
```

This becomes the ONLY place responsible for answering:

```text
Can user X access resource Y?
```

Example:

```text
canAccessMockTest(userId, mockTestId)
```

Internally:

```text
MockTest
   ↓
Exam
   ↓
ExamGroup

Candidate scopes:

MOCK_TEST
EXAM
EXAM_GROUP
```

Then check active entitlements.

Therefore:

```text
FREE test
    → allow

MOCK_TEST entitlement
    → allow

EXAM entitlement
    → allow

EXAM_GROUP entitlement
    → allow

none
    → deny
```

Every backend feature that serves protected content uses this service.

No controller should implement its own access logic.

---

# 15. User Model Changes

Current:

```text
membershipTier
subscription
preferences
interactions
```

Do NOT turn the User document into the user's commerce database.

Do NOT add:

```text
purchasedExamIds
purchasedMockTests
purchasedProducts
```

Those belong in Entitlements/Orders.

### Keep

```text
preferences
interactions
```

if they are useful to the product.

### Deprecate as source-of-truth

```text
membershipTier
subscription
```

These are currently placeholders.

For one-time exam/test purchases they are conceptually incorrect as authorization data.

Later, if EZ Prep introduces an actual recurring membership, create a dedicated:

```text
subscriptions
```

collection.

The User document may contain a small derived summary if the UI needs it, but it must never be the authorization source.

---

# 16. User Role / Authorization

Current:

```text
role: "user"
```

Keep role-based authorization initially.

At minimum:

```text
USER
ADMIN
```

Build authorization through guards/decorators:

```text
AuthenticationGuard
AuthorizationGuard
Permission/Role metadata
```

Admin endpoints must never rely on frontend UI hiding buttons.

For example:

```text
POST /admin/products
POST /admin/products/:id/publish
POST /admin/entitlements/grant
POST /admin/refunds
```

must be protected server-side.

---

# 17. Admin Product Management

The Admin UI should become the operational control plane.

Admin should be able to:

### Products

```text
Create Product
Edit Draft
Duplicate Product
Publish
Archive
View versions
```

### Access grants

Admin can select:

```text
Exam Group
Exam
Mock Test
```

without developer involvement.

For example:

```text
Product: SSC Complete Pack

Access:
[x] SSC Exam Group
```

or:

```text
Product: SSC CGL

Access:
[x] SSC CGL Exam
```

or:

```text
Product: SSC Starter Pack

Access:
[x] Mock Test A
[x] Mock Test B
[x] Mock Test C
```

### Offers

Admin can define:

```text
₹999
ONE_TIME
ACTIVE
```

and later create another offer without rewriting purchases.

---

# 18. Do Not Create a Separate "Mock Test Bundle" Concept Yet

If "mock test group" simply means:

> "these ten tests should be sold together"

then Product already solves this.

Example:

```text
Product
  ├── Mock Test #1
  ├── Mock Test #2
  ├── Mock Test #3
  └── Mock Test #4
```

Do not introduce:

```text
MockTestGroup
Bundle
Package
Plan
Collection
```

all as separate overlapping concepts.

Use Product + Grants.

A separate editorial MockTestGroup should only be added later if there is an independent content-management requirement.

---

# 19. Payment Provider Abstraction

This should be designed before implementing Razorpay.

Business logic must never directly call:

```text
Razorpay SDK
```

Instead define a provider port/interface.

Conceptually:

```typescript
interface PaymentGateway {
  createOrder(input: CreatePaymentOrderInput): Promise<ProviderOrder>;

  verifyPayment(
    input: VerifyPaymentInput
  ): Promise<PaymentVerificationResult>;

  parseWebhook(
    input: ProviderWebhookInput
  ): Promise<NormalizedPaymentEvent>;

  refund(
    input: RefundInput
  ): Promise<ProviderRefund>;
}
```

The exact interface should be finalized after Cursor analyzes the existing code.

Implement:

```text
RazorpayGateway
```

behind this interface.

Later:

```text
CashfreeGateway
StripeGateway
```

can implement the same contract.

---

# 20. Provider Registry / Strategy Pattern

Use a provider registry/factory.

Conceptually:

```text
PaymentGatewayRegistry

razorpay → RazorpayGateway
cashfree → CashfreeGateway
stripe   → StripeGateway
```

Business service:

```text
PaymentService
      ↓
PaymentGatewayRegistry
      ↓
selected provider
```

Business logic never asks:

```text
if razorpay...
else cashfree...
```

Provider-specific logic stays inside its adapter.

Use:

```text
Strategy Pattern
Adapter Pattern
Registry/Factory
```

where appropriate.

Do not build an enormous abstraction framework before it is needed.

---

# 21. Frontend Payment Abstraction

The same principle should exist in Next.js.

The UI should conceptually call:

```text
CheckoutService.startCheckout(order)
```

not:

```text
RazorpayCheckout.start(...)
```

The frontend can use a provider adapter registry:

```text
razorpay → RazorpayCheckoutAdapter
cashfree → CashfreeCheckoutAdapter
stripe   → StripeCheckoutAdapter
```

Therefore replacing Razorpay does not require rewriting the product/pricing UI.

The product UI should remain provider-neutral.

---

# 22. Payment Lifecycle

Correct production flow:

```text
User selects Product
        ↓
Next.js → Backend
        ↓
Backend loads Product + active Offer
        ↓
Backend calculates authoritative amount
        ↓
Backend creates internal Order
        ↓
Backend calls PaymentGateway
        ↓
Provider Order created
        ↓
Backend returns checkout data
        ↓
Next.js opens provider checkout
        ↓
User pays
        ↓
Provider returns result
        ↓
Frontend sends verification request
        ↓
Backend verifies provider signature
        ↓
Payment state updated
        ↓
Entitlement provisioned
```

Separately:

```text
Provider
   ↓
Webhook
   ↓
Backend
   ↓
Verify webhook signature
   ↓
Deduplicate event
   ↓
Normalize event
   ↓
Update Payment / Order
   ↓
Provision entitlement if appropriate
```

Webhook processing must be authoritative enough that a browser disappearing does not lose a successful payment.

---

# 23. Never Trust Frontend Payment Data

The frontend must never be authoritative for:

```text
amount
product price
product grants
payment status
entitlement
```

For example, frontend sends:

```json
{
  "productId": "..."
}
```

Backend loads:

```text
Product
Offer
Price
Grants
```

from the database.

Never accept:

```json
{
  "productId": "...",
  "amount": 1
}
```

as an authoritative payment amount.

---

# 24. Idempotency

Payment systems require strong idempotency.

Protect:

### Order creation

Use a client/request idempotency key.

Repeated requests must not create unlimited orders.

### Webhooks

Store a unique provider event ID:

```text
provider
providerEventId
```

with a unique index.

If the same webhook arrives twice:

```text
first → process
second → safely ignore
```

### Entitlements

Provisioning must also be idempotent.

A payment event must never give a user duplicate access because a webhook was delivered twice.

---

# 25. Payment Security

Required controls:

```text
Provider secret only on backend
Webhook signature verification
Payment signature verification
DTO validation
Authentication/authorization guards
Rate limiting
Idempotency
Strict state transitions
Secure secrets management
No payment secrets in Git
Audit logging
Structured security logs
```

Webhook endpoint must correctly preserve and verify the provider's raw request body.

Do not log:

```text
API secrets
payment secrets
full authentication tokens
sensitive payment details
```

Use payment/order IDs in logs for correlation.

---

# 26. Refund Architecture

Create refund support from the beginning even if Admin UI exposes it later.

Conceptually:

```text
Order
  ↓
Payment
  ↓
Refund
```

Refund should be provider-neutral:

```text
PaymentService.refund(...)
```

Razorpay adapter handles Razorpay API details.

Cashfree adapter later handles Cashfree.

Refund events must update the internal order/payment state.

Entitlement revocation policy must be explicit.

Recommended:

```text
refund completed
      ↓
entitlement revoked
```

unless a partial/refund-specific business policy says otherwise.

---

# 27. Reconciliation

Do not rely only on synchronous browser callbacks.

Create a reconciliation mechanism for orders stuck in ambiguous states.

Example:

```text
PENDING_PAYMENT
older than X minutes
        ↓
reconciliation worker
        ↓
query payment provider
        ↓
normalize status
        ↓
repair internal state
```

This can eventually use BullMQ/Redis, but correctness must not depend on Redis.

MongoDB + provider APIs should remain the source of truth for financial state.

---

# 28. Webhook Event Collection

Create:

```text
webhook_events
```

with concepts like:

```text
provider
providerEventId
eventType
receivedAt
processedAt
status
payloadHash
error
```

This provides:

- idempotency
- troubleshooting
- replay/recovery
- auditability

Keep retained payload data minimal and avoid unnecessary sensitive information.

---

# 29. Audit Log

Admin operations affecting commerce/access should be auditable.

Examples:

```text
PRODUCT_CREATED
PRODUCT_PUBLISHED
PRODUCT_ARCHIVED
OFFER_CREATED
ENTITLEMENT_GRANTED
ENTITLEMENT_REVOKED
REFUND_INITIATED
REFUND_COMPLETED
```

Store:

```text
actorUserId
action
resourceType
resourceId
before/after where appropriate
timestamp
request correlation ID
```

Do not rely solely on generic application logs for this.

---

# 30. User-Facing UI

The User UI should ultimately expose three concepts.

### Catalog

```text
SSC CGL
₹499
12 mock tests
Performance analytics
...
[Buy Now]
```

### Ownership

Purchased products should clearly show:

```text
Owned
Continue Practice
```

Not:

```text
Buy Now
```

### Locked content

A locked mock test should show:

```text
🔒 Premium Mock Test

Available with:
SSC CGL Complete Access
or
SSC Complete Pack

[View Plans]
```

The backend should provide the access state; the frontend should not calculate it itself.

---

# 31. User Access API

The backend should expose access information in a reusable way.

Examples:

```text
GET /me/access
GET /me/orders
GET /me/entitlements
GET /catalog/products
GET /catalog/products/:id
```

For content responses, consider returning:

```json
{
  "id": "...",
  "name": "SSC CGL Mock 05",
  "access": {
    "allowed": false,
    "reason": "ENTITLEMENT_REQUIRED"
  }
}
```

The frontend should not need to understand the entire entitlement hierarchy.

---

# 32. User "Membership Tier"

Do not use:

```text
membershipTier = premium
```

as the access mechanism.

It is too coarse.

A user may have:

```text
SSC CGL
+ RRB NTPC
```

but not:

```text
NEET
```

A single membership tier cannot represent this correctly.

If the UI wants a label such as:

```text
Free
Premium
```

derive it as a presentation summary.

It must never authorize access.

---

# 33. Migration from Current Architecture

Current users already see everything.

Do not silently switch from:

```text
no entitlement → allow
```

to:

```text
no entitlement → deny
```

without a migration plan.

Recommended rollout:

### Stage 1

Implement AccessControlService.

Support:

```text
LEGACY
ENFORCED
```

temporarily behind a feature flag/configuration.

### Stage 2

Create products and offers.

### Stage 3

Create entitlements for test/admin accounts.

### Stage 4

Validate complete purchase/access flow.

### Stage 5

Determine what existing users should retain.

If required, create explicit migration entitlements:

```text
sourceType = SYSTEM
```

### Stage 6

Enable enforced access.

### Stage 7

Remove the temporary legacy-access path.

There must eventually be no hidden fallback of:

```text
no entitlement → allow
```

---

# 34. Database Indexing

Indexes must be part of the implementation, not a later optimization.

At minimum review:

### Products

```text
code
status
```

### Offers

```text
productId
status
```

### Orders

```text
userId
status
providerOrderId
idempotencyKey
createdAt
```

### Payments

```text
orderId
providerPaymentId
providerOrderId
status
```

### Entitlements

```text
userId
scopeType
scopeId
status
expiresAt
```

### Webhooks

```text
provider
providerEventId
```

Use unique indexes wherever the business invariant requires uniqueness.

---

# 35. Separation of Concerns

Backend should ultimately resemble:

```text
modules/
  auth/
  users/

  academic/
    categories/
    exam-groups/
    exams/
    mock-tests/

  commerce/
    products/
    offers/
    orders/
    entitlements/

  payments/
    application/
    domain/
    infrastructure/
      razorpay/
      cashfree/
      stripe/

  access/
  refunds/
  webhooks/
  audit/
```

Exact folder naming can be adapted to the existing architecture.

The important part is the boundaries, not the folders themselves.

---

# 36. Dependency Direction

Desired direction:

```text
Controllers
    ↓
Application Services
    ↓
Domain Services
    ↓
Repository/Port interfaces
    ↓
Infrastructure implementations
```

Payment provider SDKs belong at the infrastructure boundary.

Example:

```text
PaymentApplicationService
        ↓
PaymentGateway interface
        ↓
RazorpayGateway
        ↓
Razorpay SDK/API
```

Never:

```text
Controller
   ↓
Razorpay SDK
   ↓
MongoDB
```

---

# 37. Cursor Phase 0 — Architecture Discovery

Before modifying any code, Cursor must inspect all three applications.

Do not allow implementation in this phase.

Create:

```text
docs/current-architecture.md
docs/users-commerce-gap-analysis.md
docs/data-model-map.md
```

Cursor should inspect:

### Backend

- NestJS modules
- controllers
- services
- repositories/models
- auth/JWT
- user schema
- exam-group schema
- exam schema
- mock-test schema
- existing admin endpoints
- existing user endpoints
- existing API response patterns
- MongoDB indexes
- error handling
- logging
- configuration/secrets
- existing background jobs
- existing Redis/BullMQ usage
- test structure

### Admin UI

Inspect:

- authentication
- admin authorization
- exam-group management
- exam management
- mock-test management
- API services
- state management
- UI/component conventions

### User UI

Inspect:

- authentication
- route guards
- exam pages
- mock-test pages
- current premium/free UI
- API calls
- existing user/profile state
- design system/theme
- notification/toast patterns

No code changes during discovery.

---

# 38. Cursor Phase 1 — Domain/Data Design

After discovery:

Finalize:

```text
Product
Offer
Order
Payment
Entitlement
WebhookEvent
Refund
AuditLog
```

plus modifications to:

```text
User
MockTest
Exam
ExamGroup
```

Produce:

```text
docs/domain-model.md
docs/api-contracts.md
docs/state-machines.md
```

Review all relationships before implementation.

---

# 39. Cursor Phase 2 — Access-Control Foundation

Implement first:

```text
Entitlement
AccessControlService
Access scope hierarchy
Mock-test access policy
Admin/user authorization
```

No Razorpay yet.

Build tests around:

```text
free test
mock-test entitlement
exam entitlement
exam-group entitlement
expired entitlement
revoked entitlement
unrelated exam
```

This establishes the core business capability before money enters the system.

---

# 40. Cursor Phase 3 — Commerce/Admin

Implement:

```text
Products
Offers
Product versioning
Admin product CRUD
Admin publishing
Admin pricing
Admin entitlement management
```

Again, no Razorpay-specific business logic.

At this point an admin should be able to configure:

```text
SSC CGL product
SSC Pack
RRB NTPC product
RRB Pack
specific mock-test bundle
```

without developer intervention.

---

# 41. Cursor Phase 4 — Payment Core

Implement the generic payment domain:

```text
Order
Payment
Payment states
Idempotency
Provider interface
Provider registry
Webhook events
Refund abstraction
```

Still keep provider-specific implementation behind the interface.

---

# 42. Cursor Phase 5 — Razorpay Adapter

Only now implement:

```text
RazorpayGateway
Razorpay webhook handler
Razorpay signature verification
Razorpay order creation
Razorpay payment verification
Razorpay refund
```

All Razorpay SDK/API code stays isolated.

---

# 43. Cursor Phase 6 — User Checkout UI

Implement provider-neutral checkout UI.

Flow:

```text
Product
 ↓
Offer
 ↓
Order creation
 ↓
Checkout
 ↓
Payment result
 ↓
Verification
 ↓
Access refresh
```

The UI should handle:

```text
loading
payment success
payment failure
cancelled checkout
already-paid
network errors
duplicate clicks
expired order
```

---

# 44. Cursor Phase 7 — Production Hardening

Before enabling real payments:

### Backend

- unit tests
- integration tests
- E2E payment tests
- authorization tests
- idempotency tests
- webhook duplication tests
- signature failure tests
- entitlement provisioning tests
- refund tests
- database indexes
- rate limiting
- structured logging

### Admin

- unauthorized-access tests
- product version tests
- entitlement grant/revoke tests

### User UI

- locked/free/purchased states
- checkout failure states
- refresh-after-payment
- duplicate-click prevention
- mobile responsiveness

---

# 45. Critical Business Invariants

These are non-negotiable.

### Invariant 1

User document is NOT the source of entitlement truth.

### Invariant 2

Frontend cannot define price.

### Invariant 3

Frontend cannot grant access.

### Invariant 4

Payment provider cannot directly modify academic entities.

### Invariant 5

Successful payment must result in an idempotent entitlement provisioning operation.

### Invariant 6

Webhook processing must be idempotent.

### Invariant 7

Historical orders must never change because the current product/price changes.

### Invariant 8

Exam-group access is resolved dynamically from the academic hierarchy.

### Invariant 9

Free tests do not require payment.

### Invariant 10

Razorpay-specific code cannot leak into domain/application services.

### Invariant 11

No business logic should depend on product names such as "SSC Pack".

### Invariant 12

No access decision should depend on `membershipTier`.

---

# 46. Target End-to-End Architecture

The final architecture should look like:

```text
                         ┌─────────────────────┐
                         │      Admin UI       │
                         │ Products / Offers   │
                         │ Entitlements        │
                         └──────────┬──────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────┐
│                    NestJS Backend                      │
│                                                        │
│  Auth / Users                                          │
│       │                                                │
│  Academic Domain                                       │
│  Category → ExamGroup → Exam → MockTest               │
│       │                                                │
│  Commerce Domain                                       │
│  Product → Offer → Order                               │
│                  │                                     │
│  Payment Domain ──┤                                     │
│                  ▼                                     │
│       PaymentGateway interface                         │
│          │         │         │                         │
│      Razorpay   Cashfree   Stripe                      │
│                                                        │
│  Entitlement Domain                                    │
│       │                                                │
│  AccessControlService                                  │
│       │                                                │
└───────┼────────────────────────────────────────────────┘
        │
        ▼
     MongoDB

User UI
   │
   ├── Catalog
   ├── Exams
   ├── Mock Tests
   ├── Checkout
   └── Purchases
```

---

# 47. Final Design Principle

The most important dependency chain should be:

```text
Academic entities
      ↓
Commercial Product
      ↓
Order
      ↓
Payment
      ↓
Entitlement
      ↓
Access Resolver
      ↓
User can access resource
```

Never:

```text
Razorpay payment
      ↓
give SSC access
```

Instead:

```text
Razorpay confirms payment
      ↓
Order becomes paid
      ↓
Order's purchased Product grants are converted
      ↓
Entitlement created
      ↓
Access Resolver sees entitlement
      ↓
Access granted
```

That distinction is what keeps the system maintainable when EZ Prep grows from:

```text
SSC CGL
RRB NTPC
```

to:

```text
SSC Pack
RRB Pack
Kerala PSC Pack
NEET Pack
JEE Pack
individual exams
individual mock tests
free trials
promotional bundles
subscriptions
multiple payment gateways
```

without rewriting the authorization system each time.

# 48. Recommended Implementation Order

The implementation order is therefore fixed as:

```text
0. Current architecture discovery
1. Domain/data model
2. Access-control foundation
3. Product + Offer + Admin management
4. Order + Payment core
5. Payment provider abstraction
6. Razorpay adapter
7. Webhooks + reconciliation + refunds
8. User checkout/catalog UI
9. Migration from legacy all-access behavior
10. Production hardening
11. Real-payment rollout
```

Do not start by integrating Razorpay.

Build the **access and commerce foundation first**, then plug Razorpay into it.