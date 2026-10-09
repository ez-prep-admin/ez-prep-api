# Phase 13 — User Access UI

## Objective

Update ezprep-app so FREE papers stay seamless, ENTITLED papers without access show lock + View plans, exam overview shows a clean buy/owned state, and startAttempt entitlement errors map to a plans CTA. **No checkout/Razorpay yet** — View plans can navigate to a plans sheet/page listing catalog products (read-only) or deep-link placeholder to subscriptions/plans route.

## Prerequisites

- Phase 03 access DTOs on list/get + start errors.
- Phase 04 catalog covering APIs.
- Phase 06 admin grants useful for local testing without payments.

## Source documents

`../decisions.md` D-07 D-13, `../api-contracts.md` §1 §3 §10, `../current-architecture.md` §3, `../gap-analysis.md` §7.

## Code references (ezprep-app)

- `components/exam/PracticeTestCard.tsx`, `FullMockTestCard.tsx`, `SprintTestCard.tsx`
- `components/exam/PracticeTestsClient.tsx`, `FullMockTestsClient.tsx`, `SprintTestsClient.tsx`
- `components/exam/useLaunchAttempt.ts`
- `components/exam/` overview tab component(s) under exam layout
- `lib/api/exams.ts`, `full-mock-tests.ts`, `sprint-tests.ts`, `attempts.ts`
- `app/dashboard/subscriptions/page.tsx` (Coming Soon — leave ownership for phase 14; may add plans browse subsection)
- `components/study-materials/MaterialCard.tsx` (lock visual precedent)
- `lib/mockData.ts` navigationItems
- Design: teal/shadcn patterns

## Target behavior

1. Cards read `access.allowed` / `accessMode` from API (do not invent client-side hierarchy).
2. If not allowed: show lock affordance; primary action “View plans” not Start.
3. If allowed: existing START/RESUME/RETAKE unchanged; no lock chrome.
4. Overview: if user lacks any covering entitlement for the exam **and** exam has ENTITLED papers, show calm CTA; if fully entitled / only free content, seamless.
5. `useLaunchAttempt`: on ENTITLEMENT_REQUIRED, show banner + View plans (never silent fail).
6. View plans UI loads `GET /catalog/products/for-exam/:id` or for-mock-test; lists products/offers **without** paying yet (CTA “Continue” disabled or “Checkout coming” only if 14 not done — **prefer:** button routes to `/dashboard/checkout?offerId=` stub that phase 14 fills; if stub missing, show plans list + message that checkout lands in phase 14).

**Committed UX for this phase:** View plans opens a Dialog/Sheet with products+offers from API; primary button labeled “Buy” navigates to `/dashboard/checkout?offerId=...` which can be a temporary “Checkout enabling soon” page **or** empty route created for phase 14. Create the route shell in 13 so 14 only fills payment.

## Files to create

- `components/exam/access/` helpers, LockedTestBadge, ViewPlansDialog
- `lib/api/catalog.ts`
- `app/dashboard/checkout/page.tsx` shell (no Razorpay)

## Files that may be modified

- Test cards/clients, overview, useLaunchAttempt, API types
- Optional header “Free Early Access” copy softening (do not remove until phase 15)

## Do-not-touch boundaries

- No Razorpay Checkout.js.
- No entitlement math on client beyond displaying API fields.
- Do not add Jest/Vitest infra to ezprep-app.

## Implementation tasks

1. Extend API types for access fields.
2. Card UI states.
3. ViewPlansDialog + catalog client.
4. Overview CTA.
5. Error mapping in useLaunchAttempt.
6. Checkout route shell.
7. typecheck + lint + manual checklist.

## Requirements

- Tabs remain usable; free tests startable.
- Mobile responsive.
- Teal/shadcn consistency; no purple/glow redesign.

## Acceptance criteria

- With ENFORCED + ENTITLED paper + no grant: lock visible; start via DevTools-equivalent still shows error if API called.
- With admin grant: seamless start.
- FREE paper: no lock.

## Tests

**Automated:** none (repo limitation). Run `typecheck` + `lint`.

**Manual checklist:**

- [ ] FREE paper START works
- [ ] ENTITLED locked card shows View plans
- [ ] View plans lists covering pack + exam products
- [ ] Overview CTA appears when locked content exists and user lacks access
- [ ] Entitled user: no CTA, no locks
- [ ] Launch error banner on ENTITLEMENT_REQUIRED
- [ ] Narrow mobile layout OK
- [ ] Sibling buttons disable/loading patterns preserved

## Risks

R-03 (client must not authorize).

## Rollback / isolation

Feature flag optional `NEXT_PUBLIC_ACCESS_UI=1`; revert PR.

## Completion checklist

- [x] `STATUS.md` updated with ops + **developer confirmation** (detailed UI pass deferred to phase 16)
- [x] Access UI shipped
- [x] Catalog client shipped
- [x] Checkout shell route exists
- [x] Manual checklist recorded in STATUS.md and the phase 16 run order in `E2E_TEST_STATUS.md`


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Users understand what is locked and what to buy; payment capture is phase 14.
