# Phase 09 — Provisioning and Stacking

## Objective

On order PAID / payment CAPTURED, idempotently provision entitlements from order item grant snapshots, with duration stacking (extend from current `expiresAt`). Ensure verify and webhook paths share one provisioning pipeline.

## Prerequisites

- Phases 02, 07, 08 done.

## Source documents

`../domain-model.md` §3 duration table §6, `../decisions.md` D-05 D-09, `../access-control.md`, `../state-machines.md`.

## Code references (ez-prep-api)

- `markOrderPaid` / payment success handlers from 07–08
- `EntitlementsService` from 02
- Order item snapshots from 07

## Target behavior

1. Single `EntitlementProvisioningService.provisionForPaidOrder(orderId)`:
   - No-op if already provisioned (detect via provisioningKeys / order flag).
   - For each grant in snapshot: create ACTIVE entitlement with correct scope.
   - Duration from offer snapshot; stacking per productId + overlapping active entitlement.
   - Lifetime handling.
2. Both verify and webhook call this once inside transactional/ordered flow after PAID.
3. ACCESS works immediately under ENFORCED for granted scopes.

## Files to create

- `src/entitlements/entitlement-provisioning.service.ts` (+ spec)
- Possibly `order.provisionedAt` field

## Files that may be modified

- Payment success orchestration
- Entitlements module exports

## Do-not-touch boundaries

- No invoice PDF (phase 10) — may call empty notifier hook.
- No refunds.

## Implementation tasks

1. Implement stacking date math with IST/UTC policy documented + tested.
2. provisioningKey format e.g. `order:{orderId}:grant:{scopeType}:{scopeId}:v{productVersion}`.
3. Wire into paid pipeline.
4. Exhaustive Jest matrix.

## Requirements

- Double webhook + verify race: still one entitlement set (unique keys / mutex).
- Grants come from **order snapshot**, not live product (forward-edit safety).

## Acceptance criteria

- Fake/Razorpay paid order grants EXAM_GROUP access; startAttempt allows under ENFORCED.
- Second purchase extends expiresAt.
- Replay provision is no-op.

## Tests (Jest)

1. Provision creates N entitlements for N grants.
2. Idempotent second call.
3. Stacking: active +1M extends from expiresAt.
4. No active → starts at now.
5. Lifetime expiresAt null.
6. Uses snapshot grants even if live product grants changed.
7. Concurrent double invoke does not duplicate (unique index behavior).

## Risks

R-02, R-07, R-11.

## Rollback / isolation

Paid orders without provision flag can be repaired by admin re-run job (document).

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] Shared provision pipeline
- [ ] Stacking tested
- [ ] Snapshot-based grants verified


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Money → access path complete without invoices/UI.
