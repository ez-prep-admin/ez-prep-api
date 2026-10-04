# Phase 15 — Rollout Hardening

## Objective

Operationally enable paid access: keep/confirm papers are `FREE` via backfill unless admins intentionally mark `ENTITLED`, switch `ACCESS_ENFORCEMENT_MODE=ENFORCED` in **production** when ready, remove temporary LEGACY allow-path reliance after soak, harden rate limits/logging/checklists, seed production seller/tax config and live Razorpay credentials, and sign off go-live.

## Prerequisites

- Phases 01–14 done with successful **local** test-mode payments, invoices, refunds, recon + signed webhook fixture tests.
- [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) board cleared or CA-waived and logged in `STATUS.md`.
- Ops: `U-OPS-01` (prod seller/tax seed), `U-OPS-02` (live Razorpay + webhook).
- FREE backfill already applied; admins (not mass user entitlements) control which papers become `ENTITLED` after launch (D-20 / U-MIG-01).

## Source documents

`../decisions.md` D-02 D-16 D-18 D-20, `../unknowns.md`, `../risk-register.md`, `../testing-strategy.md`, `../engineering-rules.md`, `../gst-invoicing.md`.

## Code references

- API env / config for enforcement mode
- AccessControlService LEGACY branch — keep until after soak, then remove or hard-disable
- Admin tools to set `accessMode`
- ezprep-app “Free Early Access” messaging in header/sidebar
- Instance-config seller/taxConfig production values

## Target behavior

1. Runbook: seed prod seller/taxConfig → register prod Razorpay webhook → local ENFORCED soak with mixed FREE/ENTITLED → production secrets → ENFORCED prod → admins flip selected papers to ENTITLED over time.
2. **No staging deployment** (D-18).
3. Monitoring: LEGACY_ALLOW count (~0 after ENFORCED), payment/webhook/recon failures.
4. Gate LEGACY so it cannot stay on in prod unnoticed.
5. Update user messaging (no perpetual Free Early Access once selling).
6. Confirm: FREE papers stay playable; ENTITLED without purchase denied; no automatic user pack entitlements.

## Files to create

- `docs/payment-gateway/runbooks/go-live.md`

## Files that may be modified

- API: default env samples; optional LEGACY removal after soak
- Admin: accessMode tooling if needed (script acceptable)
- App: header/sidebar badges; subscriptions copy

## Do-not-touch boundaries

- Do not invent mass user entitlements.
- Do not enable coupons/credit notes scope.
- Do not require a staging environment.

## Implementation tasks

1. Write go-live runbook (local vs production).
2. Local ENFORCED soak with FREE + some ENTITLED papers.
3. Production config verification (U-OPS-01, U-OPS-02).
4. Enable ENFORCED in production.
5. Post-go-live watch notes; admins manage ENTITLED flips.
6. Update STATUS.md → live.

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
- [ ] Runbook merged
- [ ] Local ENFORCED soak signed off
- [ ] Prod seller/tax + Razorpay live seeded
- [ ] Production ENFORCED
- [ ] STATUS.md → live


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Commerce is live, entitlement-enforced, operable by admins, recoverable via documented rollback — without a staging environment.
