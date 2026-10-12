# Phase 11 — Admin Refunds

## Objective

Admin-only full refund of a paid order via PaymentGateway.refund (Razorpay adapter), transitioning payment/order to REFUNDED and **revoking all entitlements** sourced from that order. No user-facing refund UI. Admin UI action + Vitest; API Jest.

## Prerequisites

- Phases 08–09 done; 10 optional but invoice remains ISSUED (no credit note).

## Source documents

`../decisions.md` D-12, `../state-machines.md` §3 §4 §7, `../api-contracts.md` §9, `../domain-model.md` §8.

## Code references

**API:** payments refund port method; entitlements revoke-by-order; orders admin get.

**Admin:** user/order surfaces — add Orders list or refund button on order detail; reuse ConfirmModal.

## Target behavior

1. `POST /admin/orders/:id/refunds` with reason; only PAID orders; full amount only.
2. Call provider refund; on success revoke entitlements (`sourceType PAYMENT` + orderId).
3. Idempotent: second refund attempt fails clearly if already REFUNDED.
4. Admin UI: find order → Refund → confirm → success/error.
5. Access under ENFORCED denied after revoke.

## Files to create/modify

- `src/refunds/` module
- RazorpayGateway.refund implementation (if stubbed in 08)
- Admin: `app/admin/orders/` pages + API client + tests
- Nav entry Orders (optional invoices download link if phase 10 API exists)

## Do-not-touch boundaries

- No partial refunds.
- No user refund routes.
- No credit notes.

## Implementation tasks

1. Refund application service + state transitions.
2. Revoke entitlements by orderId.
3. Admin UI + Vitest.
4. Jest for success, failure, double refund, revoke side effects.

## Requirements

- Audit log action REFUND_INITIATED / REFUND_COMPLETED (skeleton OK if phase 12 completes audit — write to commerce_audit_logs if present).
- Never revoke unrelated entitlements.

## Acceptance criteria

- Admin refund with FakeGateway / Razorpay test mode restores deny on startAttempt for that pack.
- Tests green both repos.

## Tests

**Jest:** full refund happy path; provider failure leaves order PAID; double refund rejected; entitlements REVOKED; non-admin 403.

**Vitest:** refund button confirm; API error shown; success message.

## Risks

R-15, R-02 (refund webhook later — handle provider async if needed; document Razorpay sync vs webhook).

## Rollback / isolation

Disable admin route via role already; feature flag optional.

## Completion checklist

- [x] `STATUS.md` updated with ops + **developer confirmation** (extensive UI-integrated J5 pass deferred to phase 16)
- [x] API refund + revoke
- [x] Admin UI
- [x] Tests both sides
- [x] Note: app has no credit note — Zoho/CA credit-note step recorded in `STATUS.md` (`U-GST-04`)


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Support can reverse access after offline refund request.
