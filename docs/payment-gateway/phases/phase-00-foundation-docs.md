# Phase 00 — Foundation Docs

## Objective

Create the execution documentation pack under `ez-prep-api/docs/payment-gateway/` so later sessions can implement commerce without rediscovering architecture or reopening locked decisions.

## Prerequisites

- Product decisions recorded (legacy FREE rollout, offers, GST, UX, refunds, stacking).
- Three-repo discovery complete.

## Source documents

`../PAYMENT_GATEWAY.md` (brief), `ezprep-app/docs/mobile-migration/` (format reference).

## Code references

Read-only discovery only; no code changes required in this phase.

## Files to create

All files listed in [`../README.md`](../README.md) document map, including `phases/phase-00` … `phase-15`.

## Files that may be modified

`STATUS.md` (mark 00 done).

## Do-not-touch boundaries

- No application code in any of the three repos.
- Do not rewrite `PAYMENT_GATEWAY.md` except optional one-line pointer to this pack (optional; not required).

## Implementation tasks

1. Write index, decisions, unknowns, engineering rules, status.
2. Write current-architecture + gap-analysis from verified discovery.
3. Write domain, API, state machines, access, GST, testing, risks.
4. Write phase briefs 00–15 with independent-session structure and tests.
5. Mark phase 00 done in `STATUS.md`.

## Requirements

- Evidence labels used where claims about current code are made.
- Locked decisions match owner answers; unknowns not invented away.
- Each later phase is startable after previous DoD without a mega-session.

## Acceptance criteria

- Doc pack exists and is internally cross-linked.
- Phase board in `STATUS.md` shows 00 done, 01 next.

## Tests

Documentation review only (links resolve; phase list matches README).

## Risks

R-09 (scope creep into coding) — this phase is docs-only.

## Rollback / isolation

Delete or revert the `docs/payment-gateway/` folder.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [x] Pack written
- [x] Status updated


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Future sessions can execute phase 01 using only this pack + listed source files.
