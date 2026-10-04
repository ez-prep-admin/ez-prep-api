# Phase 06 — Admin Entitlements UI

## Objective

Let admins view a user’s entitlements and grant/revoke access (support/promo) from mock-app-admin, backed by phase 02 APIs (extend API if grant UX needs durationPreset helpers). Vitest required.

## Prerequisites

- Phase 02 APIs; phase 05 patterns available. Phase 04 optional for linking productId on grants.

## Source documents

`../api-contracts.md` §8, `../decisions.md` D-12 (grant ≠ refund), `../domain-model.md` §6.

## Code references

**API:** `src/entitlements/` from phase 02 — extend DTOs if needed (durationPreset → expiresAt server-side).

**Admin:**

- `app/admin/users/[id]/page.tsx`, `user-detail-view.tsx`
- `app/services/ezprep-api/users.ts`
- `app/admin/users/` tests

## Target behavior

1. User detail section: table of entitlements (scope, status, dates, sourceType, product).
2. Grant modal: scope type + scope picker + duration preset + reason.
3. Revoke with confirm modal.
4. Do not present this as “edit User.subscription plan” — separate from legacy subscription fields (show legacy as deprecated/read-only or hide write).

## Files to create/modify

- Admin: entitlements section components + API module `entitlements.ts`
- API: any grant DTO gaps + tests
- User detail tests updated

## Do-not-touch boundaries

- No payment refund UI (phase 11).
- No user app.

## Implementation tasks

1. Confirm/extend grant API to accept durationPreset and compute expiresAt.
2. Wire user detail UI.
3. Vitest + Jest for new API bits.

## Requirements

- `sourceType: ADMIN_GRANT`
- Audit log entry if skeleton exists; else structured log + phase 12 follow-up noted.

## Acceptance criteria

- Support can grant EXAM access for 3M and see it listed; revoke removes access under ENFORCED (verify via API test or staging note).
- Tests green.

## Tests

**Jest (api):** grant with 3M sets expiresAt ≈ now+3 months; revoke flips REVOKED; unauthorized non-admin 403.

**Vitest (admin):** entitlements table render; grant submits payload; revoke confirms; error path.

## Risks

R-13.

## Rollback / isolation

UI section removable; entitlements data remains.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] User detail entitlements live
- [ ] Grant/revoke tested both sides
- [ ] STATUS.md notes how to smoke with ENFORCED locally


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Manual access operations possible without payment (unblocks phase 13 testing).
