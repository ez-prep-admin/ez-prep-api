# Phase 12 — Reconciliation + Commerce Audit

## Objective

Add a reconciliation mechanism for orders stuck in `PENDING_PAYMENT` past TTL (query provider via gateway `fetchOrderStatus`), and a durable `commerce_audit_logs` trail for admin commerce/access actions. Correctness must not require Redis; BullMQ optional if Redis available (match import-queue pattern).

## Prerequisites

- Phases 07–09 done; 11 preferred for refund audit events.

## Source documents

`../PAYMENT_GATEWAY.md` §27–29 (brief), `../domain-model.md` §10, `../state-machines.md`, `../engineering-rules.md`, `docs/REDIS.md` patterns.

## Code references (ez-prep-api)

- `src/queues/`, `src/redis/` optional scheduling
- PaymentGateway port — add `fetchOrderStatus` if not present
- Admin product/entitlement/refund services — emit audit events

## Target behavior

1. Scheduled job (cron or BullMQ repeatable): find PENDING_PAYMENT where `createdAt < now - X` (configurable, e.g. 45–120 min).
2. For each, fetch provider status; if paid → markOrderPaid + provision (idempotent); if failed/expired → transition FAILED/EXPIRED.
3. Never corrupt PAID orders.
4. Audit log writes for: product publish/archive, offer changes, entitlement grant/revoke, refund initiate/complete, invoice issue (best effort).
5. Admin read API optional (`GET /admin/commerce-audit`) — include if small; else Mongo inspection OK for v1 but prefer list API.

## Files to create

```
src/commerce-audit/
src/orders/reconciliation.service.ts
```

Worker/cron registration.

## Files that may be modified

- PaymentGateway interface
- Razorpay + Fake adapters implement fetchOrderStatus
- Services that should audit

## Do-not-touch boundaries

- Do not make Redis mandatory for paid path.
- No user UI.

## Implementation tasks

1. Extend gateway port + adapters.
2. Reconciliation service + tests with FakeGateway.
3. Audit schema + helper `CommerceAuditService.record`.
4. Instrument existing admin mutations.
5. Document cron enablement in STATUS.md.

## Requirements

- Reconciliation itself idempotent.
- Audit before/after payloads avoid secrets.

## Acceptance criteria

- Stuck order that FakeGateway reports paid becomes PAID + provisioned.
- Audit rows created for grant and refund in tests.
- Suite green.

## Tests (Jest)

1. Reconcile paid → provision once.
2. Reconcile failed → FAILED.
3. Already PAID skipped.
4. Audit record shape + redaction.
5. Fake fetchOrderStatus mapping.

## Risks

R-06, R-09.

## Rollback / isolation

Disable cron via env `RECONCILIATION_ENABLED=false`.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] Job + env flag
- [ ] Audit collection used by key mutations
- [ ] Tests green


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Production hardening path for lost browser callbacks + operable audit trail.
