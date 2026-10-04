# Engineering Rules (Global Project Rules)

Every commerce/payments implementation session follows these rules. When a phase file conflicts with them, these rules win unless the phase file names an explicit, approved exception recorded in [`STATUS.md`](STATUS.md).

## 1. Session protocol

1. Read this file, then [`STATUS.md`](STATUS.md), then the phase file.
2. Read only the source files the phase lists (across the repo(s) named in the phase).
3. Implement **only** the current phase. Do not start the next phase or “just quickly” add Razorpay/checkout/enforcement early.
4. Validate per [`testing-strategy.md`](testing-strategy.md): API Jest and/or Admin Vitest as applicable; ezprep-app typecheck/lint + manual checklist.
5. Update [`STATUS.md`](STATUS.md): phase board, session log, **developer ops** (scripts, instance config, env, Razorpay/Zoho), deviations, unknowns.
6. **Developer confirmation gate:** List every manual step for this phase in `STATUS.md`. The developer must check them off and write an explicit confirmation (`Developer confirmed phase NN complete: <name/date>`). **Do not** mark the phase `done` until that confirmation exists.
7. **Non-blocking compliance unknowns:** If a CA/ops question is open but not in the “bake in now” list ([`GOLIVE_TODOS.md`](GOLIVE_TODOS.md)), do **not** stall the phase. Implement the extension point, add `TODO(golive): <id>`, update `GOLIVE_TODOS.md`. Only stop if the phase cannot meet DoD without inventing tax law or skipping a bake-in item.
8. GST/refund ops: after any filing-relevant refund, record Zoho/CA **credit note** completion (`U-GST-04`) in `STATUS.md`.

## 2. Repository boundaries

| Phase focus | May modify | Must not modify |
| --- | --- | --- |
| api | `ez-prep-api` | admin/app unless phase says dual-repo |
| admin | `mock-app-admin` (+ API only if phase lists contract tweaks) | ezprep-app |
| app | `ezprep-app` (+ consume existing API contracts) | invent backend authorization |
| all | listed repos only | unrelated refactors |

- Do not change product behavior outside [`decisions.md`](decisions.md) without recording a new decision.
- Do not expand scope into coupons, credit notes, email, B2B, or second payment providers unless a phase explicitly says so.

## 3. Architecture rules (non-negotiable)

- **Separation of concerns:** Controllers thin; application services orchestrate; domain services own invariants; infrastructure adapters own SDKs.
- **Dependency direction:** Controllers → application → domain → ports ← infrastructure implementations.
- **PaymentGateway port:** Domain/application code never imports `razorpay` package. Registry/strategy selects adapter.
- **AccessControlService** is the only authorizer for mock-test access. No controller/UI duplicates hierarchy logic.
- **User document is not the commerce database.** No `purchasedExamIds[]` as SoT.
- **Frontend never authoritative** for amount, grants, payment status, or access.
- **Idempotency** on order creation, webhook processing, and entitlement provisioning.
- **Snapshots** on orders/entitlements for product version, name, grants, amounts.
- **Soft deletes / existing Nest patterns:** match `ez-prep-api` conventions (`{ message, data }`, class-validator DTOs, JWT + `@Roles`, Mongoose schemas with `id` virtual).
- **Admin UI:** Ant Design list/edit CRUD patterns; proxy allowlist; Vitest.
- **User UI:** existing teal/shadcn patterns; provider-neutral checkout adapter; no new design system.

## 4. Security rules

- Provider secrets, webhook secrets, and GSTIN config only on backend / secure env. Never in git, admin bundle, or `NEXT_PUBLIC_*` except Razorpay **key id** if required by Checkout.js.
- Verify payment signatures and webhook signatures. Reject on failure; do not provision.
- Preserve raw body for webhook verification where required.
- Rate-limit checkout/order endpoints appropriately.
- Do not log API secrets, full cards/VPA, auth tokens, or unnecessary PII. Correlate with order/payment IDs.
- Admin commerce routes always `@Roles(ADMIN)` server-side.
- Assume hostile clients: forged amounts, unlocked buttons, replayed verify calls.

## 5. Code quality rules

- TypeScript strict; no `any` without justification.
- Explicit state machines for Order/Payment — no arbitrary status writes.
- Indexes defined with schemas (see [`domain-model.md`](domain-model.md)).
- Feature flag for `LEGACY` vs `ENFORCED` access until phase 15.
- Prefer small pure functions for grant matching, sale price resolution, GST reverse-calc, stacking — unit test them heavily.
- No drive-by refactors unrelated to the phase.

## 6. Quality gates (each phase)

- Phase acceptance criteria all met.
- New/changed API behavior has Jest unit tests (and e2e where the phase requires).
- New/changed admin UI has Vitest coverage for critical paths.
- ezprep-app: `typecheck` + `lint` + manual checklist in the phase file.
- `STATUS.md` updated.
- No hidden “no entitlement → allow” left behind after phase 15.

## 7. Change management

- One phase = one branch = one PR (or a small series). Branch name includes phase number, e.g. `commerce/phase-04-products-offers`.
- Cross-repo phases may use coordinated PRs; land API contracts before UI consumers when both change.
- Rollback = revert the phase PR(s). A phase must not leave earlier phases broken.
- Record deviations from phase files in `STATUS.md`.
