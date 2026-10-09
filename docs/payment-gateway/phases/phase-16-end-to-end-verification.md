# Phase 16 — End-to-end verification

## Objective

Run one thorough manual pass of everything built in phases 00–15, in the student app and admin, including negative cases and edge cases. This is the last phase before go-live. Automated tests stay in their own phases. The checklist is [`../E2E_TEST_STATUS.md`](../E2E_TEST_STATUS.md).

## Prerequisites

- Phases 00–15 implemented. Phase 10 PDF smoke, phase 11 refund UI (J5), phase 12 recon (J6), and phase 13’s detailed access UI stay on this pass. Phase 13’s broad smoke is already signed (owner, 2026-10-10). The ordered script, including product and offer setup and invalidation, is the **Full pass** section of `E2E_TEST_STATUS.md`.
- Each of phases 11–15 has appended its real UI steps to `E2E_TEST_STATUS.md`.
- Local API, ezprep-app, and mock-app-admin running. Razorpay **test** mode. `INVOICES_ENABLED=true` and `AWS_S3_INVOICES_BUCKET` set.

## Source documents

`../E2E_TEST_STATUS.md`, `../STATUS.md`, `../testing-strategy.md`, `../GOLIVE_TODOS.md`, `phase-15-rollout-hardening.md`.

## Target behavior

1. Execute every journey and negative case in `E2E_TEST_STATUS.md`.
2. Fix failures found in this pass and re-run the affected rows.
3. Sign the close-out in that file and in `STATUS.md`.
4. Sign phase 16 in `STATUS.md`. Phase 10 is already done. Production go-live stays a separate step.

## Do-not-touch boundaries

- Do not add product features in this phase.
- Do not require Postman for flows the UI now covers.
- Do not flip production to live as a side effect of the local pass.

## Implementation tasks

1. Read `E2E_TEST_STATUS.md` and confirm phases 11–15 filled their UI notes.
2. Run the journeys, then the negative and edge list.
3. Record N/A rows with a reason.
4. Update `STATUS.md` and the close-out block.

## Acceptance criteria

- `E2E_TEST_STATUS.md` close-out is signed.
- Invoice section is signed as the deferred phase 10 UI proof.
- J5 is signed as the deferred phase 11 UI-integrated refund proof.
- Payments live remains No until the production ops in journey J8 are done.

## Completion checklist

- [ ] `E2E_TEST_STATUS.md` signed
- [ ] `STATUS.md` phase board: 16 `done` only after that signature
- [ ] Failures from the pass fixed and re-checked

## Definition of done

The manual board is signed, phase 10’s deferred invoice proof and phase 11’s deferred refund UI integration (J5) are included, and go-live is a separate production action recorded in `STATUS.md` — not an automatic result of finishing the local UI pass.
