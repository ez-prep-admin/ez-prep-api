# Phase 15 — Rollout Hardening

## Objective

Operationally enable paid access: keep/confirm papers are `FREE` via backfill unless admins intentionally mark `ENTITLED`, prepare `ACCESS_ENFORCEMENT_MODE=ENFORCED` for production, remove temporary LEGACY allow-path reliance after soak, harden rate limits/logging/checklists, and document the production seller/tax seed and live Razorpay credentials. The go-live sign-off is phase 16.

## Prerequisites

- Phases 01–14 done with successful **local** test-mode payments, invoices, refunds, recon + signed webhook fixture tests.
- Ad-hoc phases 14A–14E done ([`../PRE_RELEASE_REVIEW.md`](../PRE_RELEASE_REVIEW.md)).
- Production steps for both instances live only in [`../GO_LIVE_GUIDE.md`](../GO_LIVE_GUIDE.md), the single source of truth for go-live. This phase does not write a separate runbook. If the phase changes an operational detail (a key, a check, a command), update the guide in the same change.
- [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) board cleared, CA-waived, or pointing at a guide step, and logged in `STATUS.md`.
- Admins, not mass user entitlements, control which papers become `ENTITLED` after launch (D-20 / U-MIG-01; guide Steps 14 and 22).

## Source documents

`../decisions.md` D-02 D-16 D-18 D-20, `../unknowns.md`, `../risk-register.md`, `../testing-strategy.md`, `../engineering-rules.md`, `../gst-invoicing.md`.

## Code references

- API env / config for enforcement mode
- AccessControlService LEGACY branch — keep until after soak, then remove or hard-disable
- Admin tools to set `accessMode`
- ezprep-app “Free Early Access” messaging in header/sidebar
- Instance-config seller/taxConfig production values

## Target behavior

1. Local ENFORCED soak with mixed FREE/ENTITLED papers. The production order (seed, webhook, switch on, smoke, ENFORCED, flip papers) is `GO_LIVE_GUIDE.md` Stages 3–5.
2. **No staging deployment** (D-18).
3. Monitoring: LEGACY_ALLOW count (~0 after ENFORCED), payment/webhook/recon failures.
4. Gate LEGACY so it cannot stay on in prod unnoticed.
5. Update user messaging (no perpetual Free Early Access once selling).
6. Confirm: FREE papers stay playable; ENTITLED without purchase denied; no automatic user pack entitlements.

## Files to create

- None for docs. `GO_LIVE_GUIDE.md` already exists; keep it current.

## Files that may be modified

- API: default env samples; optional LEGACY removal after soak
- Admin: accessMode tooling if needed (script acceptable)
- App: header/sidebar badges; subscriptions copy

## Do-not-touch boundaries

- Do not invent mass user entitlements.
- Do not enable coupons/credit notes scope.
- Do not require a staging environment.

## Implementation tasks

1. Launch copy ("Free Early Access" → paid wording) and the LEGACY guard.
2. Local ENFORCED soak with FREE + some ENTITLED papers.
3. Re-read `GO_LIVE_GUIDE.md` against the implemented code (key names, commands, log lines, admin labels) and correct any drift.
4. Update STATUS.md with the soak result. Leave “Payments live” as No until phase 16 is signed and production ops are actually done.

## Requirements

- Rollback: `ACCESS_ENFORCEMENT_MODE=LEGACY` and/or paper `accessMode: FREE`; document RTO.
- Hostile `startAttempt` still denied for ENTITLED without grant.
- Invoices only after CAPTURED; tax snapshots immutable.

## Acceptance criteria

- Paid launch criteria from executive-summary met.
- Ops unknowns closed or accepted with seeded config.
- Checklists below signed in STATUS.md.

## Tests

**API Jest / Admin Vitest:** green.

**Manual:**

- [ ] FREE paper startable when ENFORCED
- [ ] ENTITLED without purchase denied (UI + raw API)
- [ ] Purchase → access → invoice (test mode before live)
- [ ] Stacking repurchase
- [ ] Admin grant/revoke
- [ ] Admin refund revokes
- [ ] Webhook fixture + optional tunnel E2E
- [ ] Recon on stuck pending order
- [ ] Seller address/GSTIN/SAC on PDF from config
- [ ] No secrets in client bundles
- [ ] Messaging updated
- [ ] No blanket entitlements granted to all users

## Risks

R-01, R-16, R-17.

## Rollback / isolation

```text
ACCESS_ENFORCEMENT_MODE=LEGACY
# and/or accessMode FREE on affected papers
```

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] `GO_LIVE_GUIDE.md` checked against the implemented code
- [ ] Local ENFORCED soak signed off
- [ ] Production steps are run from `GO_LIVE_GUIDE.md` only after phase 16 is signed
- [ ] STATUS.md records the soak; live switch stays with phase 16 close-out


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Launch copy and the LEGACY guard ship, the local ENFORCED soak passes, and `GO_LIVE_GUIDE.md` matches the code. The program is not marked live here. Phase 16 ([`../E2E_TEST_STATUS.md`](../E2E_TEST_STATUS.md)) is the last gate before go-live.
