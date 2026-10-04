# Phase 03 — Enforce Access Gates

## Objective

Wire `AccessControlService` into student attempt **start** (and resume policy), and attach backend-computed `access` DTOs on student mock-test list/get responses. Hostile clients without entitlement must be denied when mode is ENFORCED. Keep default mode **LEGACY** so production behavior stays open until phase 15.

## Prerequisites

- Phase 02 done.

## Source documents

`../access-control.md` §3 §8, `../api-contracts.md` §1 §10 §11, `../decisions.md` D-08 D-13 D-16 (U-LEG-01 resolved).

## Code references (ez-prep-api)

- `src/mock-test-attempts/mock-test-attempts.service.ts` (`startAttempt`, resume)
- `src/mock-test-attempts/mock-test-attempts.controller.ts`
- `src/mock-tests/`, `src/full-mock-tests/`, `src/sprint-tests/` student list/get mappers
- Phase 02 `AccessControlService`

## Target behavior

1. `startAttempt`: if deny → HTTP 403 with stable `details.code = ENTITLEMENT_REQUIRED` (and message safe for UI).
2. Resume / continue `IN_PROGRESS` and `submitAttempt`: allow for owned already-started attempts **without** re-checking entitlement (D-08). New `startAttempt` always re-checks.
3. List/get paper DTOs include `accessMode` + `access: { allowed, reason }`.
4. Default env LEGACY: existing users unaffected.
5. Integration/unit tests prove bypass of UI still hits service denial under ENFORCED.

## Files to create

- Shared access response mapper helper
- Specs for attempts service access branching

## Files that may be modified

- Attempts module (inject AccessControlService)
- Mock/full/sprint student serializers
- Exception mapping if needed for details.code

## Do-not-touch boundaries

- No Razorpay, products UI, or flipping default to ENFORCED.
- Do not hide papers from lists.

## Implementation tasks

1. Inject access service into attempts service.
2. Map AccessDecision → HTTP error.
3. Attach access DTO on list/get (batch entitlements efficiently — avoid N+1; load user entitlements once per request).
4. Tests with ENFORCED and LEGACY.
5. Document how to temporarily set ENFORCED in local `.env` (no staging env — D-18).

## Requirements

- Performance: for list endpoints, resolve access without per-item full DB explosion (single entitlements query + in-memory match).
- Logging: deny reasons without PII spam.

## Acceptance criteria

- Under ENFORCED, start on ENTITLED paper without grant fails.
- Under ENFORCED, FREE paper succeeds.
- Under LEGACY, ENTITLED without grant succeeds with LEGACY_ALLOW on DTO.
- Resume in-progress after lapse succeeds.
- Suite green.

## Tests (Jest)

1. startAttempt ENFORCED deny.
2. startAttempt ENFORCED allow with exam entitlement.
3. startAttempt FREE allow.
4. startAttempt LEGACY allow without entitlement.
5. resume IN_PROGRESS after lapse/revoke allow (no entitlement re-check).
5b. submitAttempt after lapse/revoke allow.
6. List DTO includes access.allowed false under ENFORCED without grant.
7. Controller/e2e optional: 403 body contains ENTITLEMENT_REQUIRED.

## Risks

R-01, R-03.

## Rollback / isolation

Set LEGACY; or revert wire-up PR. Access DTOs are additive.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] start gated
- [ ] resume policy implemented
- [ ] list access DTOs
- [ ] default LEGACY confirmed in .env.example


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Backend is source of truth for attempt authorization; UI can be built against access DTOs in phase 13.
