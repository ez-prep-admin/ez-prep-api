# Executive Summary

## Goal

Redesign EZ Prep so access to exams and mock tests is **entitlement-driven**, products/offers are **admin-managed**, payments go through a **provider-neutral port** (Razorpay first), and historical purchases stay correct when catalogs change. Admin UI, user UI, and backend have clear responsibilities; the backend is the only authority for price and access.

## Why this exists

Today **[Verified]**:

- Any authenticated student can start any active mock test (`MockTestAttemptsService.startAttempt` checks `isActive` / retake only).
- `User.subscription` exists but is never used for gating.
- There is no Product, Offer, Order, Payment, Entitlement, invoice, or Razorpay module in `ez-prep-api`.
- Admin can view (not edit) subscription summary fields; no commerce CRUD.
- User app shows “Free Early Access”; subscriptions page is Coming Soon; no paywall.

## Architecture in one paragraph

Academic content (Category → ExamGroup → Exam → MockTest) stays payment-agnostic. Admins publish **Products** with grants (`EXAM_GROUP` / `EXAM` / `MOCK_TEST`) and **Offers** (INR, duration preset, optional sale window). Checkout creates an **Order**, talks to a **PaymentGateway** (Razorpay adapter), and on verified capture **provisions Entitlements** (with duration stacking). **AccessControlService** is the only place that answers “can user X access mock test Y?”. FREE papers skip entitlements; ENTITLED papers require a matching active entitlement. GST tax invoices (B2C PDF) generate after capture.

## Locked product shape (v1)

| Topic | Decision |
| --- | --- |
| Rollout | Existing papers default `FREE` via DB script; admins mark `ENTITLED` later |
| Purchase | One-time INR only |
| Duration | `1M \| 3M \| 6M \| 12M \| LIFETIME` on Offer |
| Pricing | GST-inclusive; one ACTIVE offer per `(productId, durationPreset)`; optional limited sale |
| Stacking | Repurchase extends from current `expiresAt` |
| Refunds | Admin-only full refund → revoke entitlements; no user refund UI |
| Invoice | PDF after CAPTURED only; FY series `EZPREP/YYYY-YY/####`; TaxService + snapshots; seller/SAC from instance DB; Zoho credit notes on refund until in-app |
| Environments | local + production only (Razorpay test vs live); no staging |
| UX | Tabs stay open; free tests playable; paid tests locked + View plans |

## Implementation sequence

```text
00 docs → 01 accessMode/invariants → 02 entitlements/access service
→ 03 enforce gates (flagged) → 04 products/offers API → 05 admin commerce UI
→ 06 admin entitlements → 07 orders/payments port → 08 Razorpay
→ 09 provisioning/stacking → 10 GST invoices → 11 admin refunds
→ 12 reconciliation/audit → 13 user access UI → 14 checkout/subscriptions
→ 15 rollout hardening
```

Do **not** start with Razorpay. Access and commerce foundations first.

## Top risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-01 | Silent flip from all-access to deny breaks learners | Soft FREE default + LEGACY/ENFORCED flag + phase 15 only |
| R-02 | Double webhook → duplicate entitlements | Idempotent webhook_events + provision keys |
| R-03 | Frontend trusted for price/access | Backend loads offer; AccessControlService on start/resume |
| R-04 | GST/seller config missing in prod DB | Instance tax/seller config required; seed before live invoices (`U-OPS-01`) |
| R-05 | Exam.category ≠ ExamGroup.category breaks group packs | Phase 01 invariant enforcement |
| R-06 | Mega-session scope creep | One phase per session; DoD gates |

## Success criteria (program)

- Admin can create SSC CGL / SSC Pack / mock-test bundles and priced duration offers without code changes.
- User without entitlement cannot start an ENTITLED paper even if they bypass the UI.
- User with exam-group entitlement automatically gets newly added exams in that group.
- Successful Razorpay payment (verify or webhook) yields exactly one entitlement provision per order grant set, with stacking on repurchase.
- Tax invoice PDF downloadable by user and admin after capture.
- Admin full refund revokes access; no user-facing refund.
- Historical orders unchanged when product/price edits publish as new versions.

## Out of scope for v1

Recurring mandates, coupons, **in-app** credit notes (Zoho/CA credit notes still required on refund — U-GST-04), email invoice delivery, B2B buyer GSTIN, e-invoice IRN, Cashfree/Stripe adapters (port must allow them), mobile native checkout (web `ezprep-app` only).
