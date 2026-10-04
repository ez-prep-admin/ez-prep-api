# Phase 02 — Entitlements + AccessControlService

## Objective

Introduce the Entitlement collection and `AccessControlService` with full hierarchy resolution and unit tests. Expose minimal admin/user read/grant APIs needed to exercise the service. **Do not** wire into `startAttempt` yet (that is phase 03). Default enforcement config exists as `LEGACY`.

## Prerequisites

- Phase 01 done (`accessMode` exists).

## Source documents

`../domain-model.md` §6, `../access-control.md`, `../api-contracts.md` §2 §8, `../decisions.md` D-05 D-06 D-16, `../state-machines.md` §5 §9.

## Code references (ez-prep-api)

- `src/mock-test-attempts/mock-test-attempts.service.ts` (read only — do not wire yet)
- `src/mock-tests/schemas/mock-test.schema.ts`
- `src/exams/schemas/exam.schema.ts`
- `src/users/` (do not use subscription for auth)
- `src/app.module.ts` module registration patterns
- `src/common/` enums, filters

## Target behavior

1. Entitlement CRUD internals + admin grant/revoke + user `GET /me/entitlements`.
2. `AccessControlService.canAccessMockTest(userId, mockTestId)` implements algorithm in access-control.md.
3. Config `ACCESS_ENFORCEMENT_MODE=LEGACY|ENFORCED` (default LEGACY).
4. Pure helpers for “is entitlement currently active”.

## Files to create

```
src/entitlements/
src/access/
```

Schemas, DTOs, services, controllers (admin grant under `admin/entitlements`, user me entitlements), specs.

## Files that may be modified

- `app.module.ts`
- Enums exports
- `.env.example` for `ACCESS_ENFORCEMENT_MODE`

## Do-not-touch boundaries

- Do not modify `startAttempt` / resume yet.
- No products, orders, Razorpay.
- Do not remove `User.subscription` fields yet (deprecate usage only).

## Implementation tasks

1. Entitlement schema + indexes + provisioningKey unique.
2. EntitlementsService: grant, revoke, listByUser, findActiveForUser.
3. AccessControlService with mocked exam/mock/entitlement deps in tests.
4. Admin grant/revoke endpoints + audit stub log method (full audit collection can wait until phase 12; at minimum structured logger + TODO hook — **prefer writing to commerce_audit_logs skeleton if cheap**).
5. User GET entitlements.
6. Comprehensive Jest matrix from testing-strategy access rows (except startAttempt integration).

## Requirements

- Multiple entitlements can coexist.
- EXAM_GROUP match uses live exam.examGroup.
- expiresAt null = lifetime.
- Revoked/expired never allow under ENFORCED.

## Acceptance criteria

- Service unit tests cover FREE, MOCK_TEST, EXAM, EXAM_GROUP, expired, revoked, unrelated, LEGACY vs ENFORCED.
- Admin can grant entitlement to a user; user can list it.
- startAttempt still ungated (document explicitly in STATUS.md).

## Tests (Jest)

1. FREE → allow regardless of entitlements / mode.
2. ENTITLED + MOCK_TEST entitlement → allow.
3. ENTITLED + EXAM entitlement → allow.
4. ENTITLED + EXAM_GROUP entitlement → allow.
5. ENTITLED + none + ENFORCED → deny ENTITLEMENT_REQUIRED.
6. ENTITLED + none + LEGACY → allow LEGACY_ALLOW.
7. Expired / revoked → deny under ENFORCED.
8. Wrong exam entitlement → deny.
9. Grant + revoke API tests with mocks.
10. Unique provisioningKey conflict handled.

## Risks

R-13 (subscription confusion) — document in code comments that subscription is not SoT.

## Rollback / isolation

Unused by attempts until phase 03; safe revert.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] Modules registered
- [ ] Access matrix tests green
- [ ] Env flag documented
- [ ] startAttempt untouched


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Access decisions are implemented and tested in isolation; ready to wire gates.
