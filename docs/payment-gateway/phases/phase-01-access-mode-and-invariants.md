# Phase 01 — Access Mode and Invariants

## Objective

Add `accessMode` to mock-test papers, provide a one-time FREE backfill script for existing papers, and enforce `Exam.category === ExamGroup.category` so exam-group entitlements cannot drift. No payment or entitlement logic yet.

## Prerequisites

- Phase 00 done.
- Owner OK with DB script for FREE backfill (D-02 / D-20): marks **papers** FREE — does not grant users pack entitlements.

## Source documents

`../domain-model.md` §1, `../decisions.md` D-02, `../access-control.md` §5, `../risk-register.md` R-01 R-04.

## Code references (ez-prep-api)

- `src/mock-tests/schemas/mock-test.schema.ts`
- `src/mock-tests/` DTOs + service create/update
- `src/full-mock-tests/`, `src/sprint-tests/` publish paths into `mocktests`
- `src/exams/schemas/exam.schema.ts`, `src/exams/exams.service.ts`
- `src/exam-groups/schemas/exam-group.schema.ts`
- Admin-facing mock test DTOs if `accessMode` must be editable later (minimal: field on schema + admin patch path)

## Target behavior

1. Every paper in `mocktests` has `accessMode: FREE | ENTITLED`.
2. Script `scripts/backfill-mocktest-access-mode-free.ts` (or nest command) sets all existing papers to `FREE` (idempotent).
3. New papers: default documented in code (recommend `FREE` until paid launch ops, or `ENTITLED` — **use `FREE` as schema default for safety until phase 15**).
4. Exam create/update rejects mismatched category vs examGroup.category with clear validation error.
5. Existing mismatched exams: script or report listing conflicts; do not silently “fix” without owner review — provide `scripts/report-exam-category-mismatches.ts`.

## Files to create

- Enum for access mode under `src/common/enums/`
- Backfill + report scripts under `scripts/` or `src/cli/`
- Unit tests for exam invariant and schema default

## Files that may be modified

- Mock test schema + create/update DTOs + admin update paths
- Full/sprint publish mapping to include `accessMode`
- Exam service validation
- `.env.example` only if script needs flags (prefer none)

## Do-not-touch boundaries

- No AccessControlService, products, Razorpay, or startAttempt gating yet.
- No ezprep-app / admin UI required (admin can see field in next phases; API field enough now). Optionally expose on admin mock-test edit if trivial — only if it does not expand scope.

## Implementation tasks

1. Add enum + schema field + indexes if needed.
2. Thread field through create/update/publish DTOs.
3. Enforce exam category invariant with tests.
4. Write idempotent FREE backfill script; document runbook in `STATUS.md`.
5. Write mismatch report script.
6. Jest tests.

## Requirements

- Soft-delete middleware unchanged.
- Script safe to re-run.
- Swagger reflects new field on relevant DTOs.

## Acceptance criteria

- New mock test persists `accessMode`.
- Backfill sets existing docs to FREE.
- Creating exam with wrong category fails.
- All new/changed unit tests pass; suite green.

## Tests (Jest)

1. Schema/DTO accepts FREE and ENTITLED; rejects invalid.
2. Exam create: matching categories succeed.
3. Exam create: mismatched categories → 400/validation.
4. Exam update cannot break invariant.
5. Backfill script logic unit-tested with mocked collection (or integration if project pattern allows): already-FREE unchanged; missing field → FREE.

## Risks

R-01, R-04.

## Rollback / isolation

Revert PR; field unused by access logic yet. Script is additive.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] Field + enum shipped
- [ ] Invariant enforced + tested
- [ ] Scripts documented in STATUS.md
- [ ] No gating wired yet


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Academic layer ready for entitlements; existing content remains effectively free once backfilled.
