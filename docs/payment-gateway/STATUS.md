# Commerce / Payments — STATUS

**Single source of truth** for implementation progress, developer ops (scripts, instance config, Razorpay, migrations), and **phase completion confirmation**.

Update this file at the **end of every phase session**. A phase is not `done` until the developer confirmation block is filled.

Related: [`engineering-rules.md`](engineering-rules.md) · [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md) · [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md) · [`unknowns.md`](unknowns.md) · [`phases/README.md`](phases/README.md) · [`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md)  
Legacy alias: [`PAYMENT_STATUS.md`](PAYMENT_STATUS.md) points here.

---

## Program snapshot

| Field | Value |
| --- | --- |
| Pack locked for development | **LOCKED** 2026-10-04 — owner ack; CA items via GOLIVE_TODOS (non-blocking) |
| Current phase | 14E **pending** — phase 14A closed 2026-10-10. Ad-hoc order continues 14E → 14B → 14C → 14D, before phase 15 |
| Enforcement mode | Config live: `ACCESS_ENFORCEMENT_MODE` (default `LEGACY`); wired into `startAttempt` (deny only when ENFORCED) |
| Money unit | Integer **paise** in Mongo + API JSON (`99900` = ₹999). Frontends convert to ₹ for display. |
| Payments live | No |
| Environments | local + production only |
| GST invoices live | No |
| Billing address | **Always required** at checkout (D-10) |

---

## How to close a phase (mandatory)

1. Finish code + tests per the phase file.
2. Append a **Session log** entry using the template below.
3. Complete the **Developer ops** checkboxes for that phase (or mark N/A with reason).
4. Add **Developer confirmation** (name + date). Without this, status stays `pending` / `in_progress`.
5. Only then set the phase board row to `done` and set “Next phase”.
6. If any CA/compliance item was deferred, ensure [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md) has it and code has `TODO(golive): <id>` where relevant.

### Session log template

```markdown
### YYYY-MM-DD — Phase NN — <title>

**Code:** repos / branches / PRs  
**Tests:** api Jest / admin Vitest / app checklist — pass/fail  

**Developer ops (manual) — confirm each:**
- [ ] <script or config step from phase>
- [ ] <env / dashboard step>
- [ ] N/A items listed with reason: …

**Developer confirmation:**  
I, <name>, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: YYYY-MM-DD

**DoD:** met  
**Deviations:** …  
**GOLIVE_TODOS touched:** … / none  
**Next:** phase NN+1
```

---

## Phase board

| # | Phase | Status | Completed | Developer confirmation |
| --- | --- | --- | --- | --- |
| 00 | Foundation docs | **done** | 2026-10-04 | Docs-only; no runtime ops |
| 01 | Access mode + invariants | **done** | 2026-10-05 | Sharun — local backfill + mismatch report |
| 02 | Entitlements + access service | **done** | 2026-10-05 | Sharun — review + `ACCESS_ENFORCEMENT_MODE=LEGACY`; API smoke deferred to Phase 06 |
| 03 | Enforce access gates | **done** | 2026-10-06 | Sharun — local ENFORCED smoke verified; LEGACY restored |
| 04 | Products + Offers API | **done** | 2026-10-07 | Sharun — indexes verified; paise convention recorded |
| 05 | Admin commerce UI | **done** | 2026-10-07 | Sharun — local smoke create/offer/publish |
| 06 | Admin entitlements UI | **done** | 2026-10-08 | Sharun — grant/revoke UI + local ENFORCED smoke |
| 07 | Orders + TaxService + FakeGateway | **done** | 2026-10-09 | Sharun — local seller/tax seed + `PAYMENT_PROVIDER=fake` |
| 08 | Razorpay adapter | **done** | 2026-10-09 | Sharun — test keys in `.env`; webhook URL deferred to phase 14 |
| 09 | Provisioning + stacking | **done** | 2026-10-09 | Sharun — fake pay provisions access; ENFORCED start verified; LEGACY restored |
| 10 | GST invoices | **done** | 2026-10-09 | Sharun — code + Jest; PDF smoke deferred to phase 16 |
| 11 | Admin refunds | **done** | 2026-10-09 | Sharun — broad admin refund smoke; full UI-integrated J5 pass is phase 16 |
| 12 | Reconciliation + audit | **done** | 2026-10-10 | Sharun — Jest; UI recon + audit list deferred to phase 16 |
| 13 | User access UI | **done** | 2026-10-10 | Sharun — broad lock / View plans / checkout shell smoke; detailed pass is phase 16 |
| 14 | Checkout + subscriptions | **done** | 2026-10-10 | Sharun — local Razorpay purchase, refund, invoice, and subscriptions smoke |
| 14A | Fail-closed config + catalog integrity (ad-hoc) | **done** | 2026-10-10 | Sharun — production boot guard, frozen grants, re-anchor, and lifetime block verified locally |
| 14E | GST, seller identity, per-instance commerce (ad-hoc) | pending | | Runs second. PR-29–32, 35, 36; D-26, D-29; seller address `Kerala` |
| 14B | Payment state integrity (ad-hoc) | pending | | PR-02, 03, 04, 10, 17, 33, 37; D-22, D-28 |
| 14C | Webhook, refund, repair robustness (ad-hoc) | pending | | PR-02 watch, 05, 06, 08, 09, 13, 14, 19, 21, 22, 33, 34, 37, 38; D-22, D-25, D-28 |
| 14D | Checkout client + admin ops (ad-hoc) | pending | | PR-08 action, 11, 16 UI, 17 client, 19 page, 24, 28, 39 |
| 15 | Rollout hardening | pending | | Go-live steps are listed in GOLIVE_TODOS. Prod seed, live webhook, and ENFORCED soak are not done. Not the live switch |
| 16 | End-to-end verification | pending | | Last gate before go-live. Full script in E2E_TEST_STATUS.md: admin catalog, offer invalidation, user flow, plus phase 10 PDF, phase 11 J5, phase 12 J6, phase 13 detailed UI |

---

## Standing developer / owner ops (by theme)

### A. Scripts (API repo)

| Script / command | When | Record in session log |
| --- | --- | --- |
| `npm run commerce:backfill-access-mode-free` | Phase 01 — each DB (local, later prod) | Counts updated (`matchedCount` / `modifiedCount`) |
| `npm run commerce:report-exam-category-mismatches` | Phase 01 | Zero mismatches or fixes applied |
| `npm run commerce:seed-local-tax-config` | Phase 07 local; phase 15 prod | `matchedCount` / `modifiedCount`. Same owner-confirmed payload. From 14E, `npm run commerce:seed-tax-config` reads `scripts/commerce-seed/<INSTANCE_ID>.json`, dry run by default (the old name stays as an alias) |
| Optional ENTITLED manifest | Phase 15 only if used | Manifest path |

### B. Instance config (Mongo)

| When | What |
| --- | --- |
| Phase 07 local | Seed owner-confirmed seller + taxConfig (`EzPrep - Powered by Clustream`, GSTIN `32BIAPD6927L1ZC`, address `Kerala`, state Kerala / `32`, 18%, SAC `999293`). The address was `Kochi, Kerala` until 2026-10-10; 14E re-seeds it |
| Phase 15 prod | Re-run the same seed against production Mongo — `U-OPS-01` |

### C. Env / Razorpay

| When | What |
| --- | --- |
| Phase 02+ | `ACCESS_ENFORCEMENT_MODE` |
| Phase 12 | `RECONCILIATION_ENABLED` must be the string `true` or the job does not run. Default `false`. `RECONCILIATION_MIN_AGE_MINUTES` (default 60), `RECONCILIATION_INTERVAL_MS` (default 300000). No Redis |
| Phase 08/14 local | Test Razorpay keys in local `.env` (`rzp_test_...`); optional webhook tunnel. Names in `.env.example` |
| Phase 15 prod | Live keys in the production env (`rzp_live_...`) + webhook URL — `U-OPS-02`. Do not commit keys |
| 14A–14C (new API keys) | `COMMERCE_ENABLED` (must be `true` wherever commerce runs, including local; separate from `ACCESS_ENFORCEMENT_MODE`), `TRUST_PROXY_HOPS` (production 1 for nginx, U-OPS-03), `MAX_OPEN_ORDERS_PER_USER`, `WEBHOOK_RETRY_WINDOW_MINUTES`, `LATE_CAPTURE_WATCH_HOURS`, `RECONCILIATION_BATCH`, `RECONCILIATION_MAX_ATTEMPTS`, `REFUND_UNKNOWN_WINDOW_MINUTES`. `INSTANCE_ID` and `INSTANCE_NAME` become required when commerce is on. Names and defaults go in `.env.example` |
| 14D (new app keys) | `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL` (public, per Vercel project) |
| PM2 | Stays in fork mode (one process per droplet). Cluster mode would need a distributed scheduler lock first (14C §8) |
| Razorpay webhook (verified 2026-10-10) | Razorpay retries failed deliveries with exponential backoff and disables the webhook after 24 hours of continuous failure. Re-enable it by hand in Dashboard → Webhooks after fixing the cause. Admin Commerce health (14C/14D) shows when it has gone silent |

### D. Accounting (Zoho)

| When | What |
| --- | --- |
| Every filing-relevant refund | Credit note outside app until U-GST-04 cleared — log here |

---

## Compliance / go-live gate

Every production go-live step, for EZ Prep and ExamFlex, is in [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md), the single source of truth for go-live. Compliance status is tracked in [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md). Production cannot go live while that board has open **must-clear** rows (unless a CA waiver is logged).

Development of phases 01–14 **continues** while those rows are open.

---

## Session log

### 2026-10-04 — Phase 00 — Foundation docs + compliance + STATUS/GOLIVE policy

**Code:** `docs/payment-gateway/**` only  
**Tests:** n/a  

**Developer ops (manual) — confirm each:**
- [x] N/A — documentation phase only

**Developer confirmation:**  
Phase 00 is docs-only; no runtime developer ops. Marked done as pack authoring complete.  
Date: 2026-10-04

**DoD:** met  
**Deviations:** FY invoice series; always collect billing address; GOLIVE_TODOS non-blocking policy (D-21)  
**GOLIVE_TODOS touched:** created board  
**Next:** phase 01

### 2026-10-04 — Plan lock

- Owner locked the execution pack for development.
- CA confirmation proceeds in parallel against [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md) / [`unknowns.md`](unknowns.md); does not block phase 01+.
- Start implementation at [`phases/phase-01-access-mode-and-invariants.md`](phases/phase-01-access-mode-and-invariants.md).

### 2026-10-05 — Phase 01 — Access mode + invariants

**Code:** `ez-prep-api` on developer branch `payment-gateway` (git ops owned by developer)  
**Tests:** Jest — exams invariant, accessMode DTO, backfill/report helpers, mock-tests service — pass  

**Shipped:**
- `AccessMode` enum (`FREE` \| `ENTITLED`); MockTest `accessMode` default `FREE` + index
- Threaded through topic-wise create/update DTOs + response/list DTOs; full/sprint publish
- Exam create/update rejects `exam.category !== examGroup.category`
- Kept ops tools (not throwaway):
  - `src/common/commerce/*` pure helpers (Jest-tested)
  - `scripts/backfill-mocktest-access-mode-free.ts` + `scripts/report-exam-category-mismatches.ts`
  - npm scripts `commerce:backfill-access-mode-free`, `commerce:report-exam-category-mismatches`

**Developer ops (manual) — confirm each:**
- [x] Run `npm run commerce:backfill-access-mode-free` against **local** Mongo; record `matchedCount` / `modifiedCount` below
- [x] Run `npm run commerce:report-exam-category-mismatches` against **local** Mongo; confirm zero mismatches or apply intentional fixes and re-run
- [x] N/A — no `.env` flags for this phase; no admin/app UI; no Razorpay/GST

**Backfill counts:** matchedCount=169 modifiedCount=169  
**Mismatch report:** 0 mismatches (after owner data fix: assigned missing examGroup/category on RRB exams; scannedExams=19)

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-05

**DoD:** met  
**Deviations:** schema default FREE until phase 15; mismatch report hardened for missing examGroup  
**GOLIVE_TODOS touched:** none  
**Next:** phase 02

### 2026-10-05 — Phase 02 — Entitlements + AccessControlService

**Code:** `ez-prep-api` on branch `payment-gateway`  
**Tests:** Jest — access matrix, entitlements grant/revoke/provisioningKey, duration/active helpers — **pass** (25 tests)

**Shipped:**
- Entitlement collection + indexes + unique `provisioningKey`
- `EntitlementsService` grant / revoke / listByUser / findActiveForUser
- Admin APIs: `POST /admin/entitlements/grant`, `POST /admin/entitlements/:id/revoke`, `GET /admin/users/:userId/entitlements`
- User API: `GET /me/entitlements` (active by default; `includeInactive=true` optional)
- `AccessControlService.canAccessMockTest` (FREE / MOCK_TEST / EXAM / EXAM_GROUP + LEGACY vs ENFORCED)
- `ACCESS_ENFORCEMENT_MODE` in `.env.example` (default LEGACY)
- Minimal `commerce_audit_logs` skeleton on grant/revoke
- **Explicit:** `startAttempt` **untouched** / still ungated (phase 03)

**Developer ops (manual) — confirm each:**
- [x] Confirm local `.env` has `ACCESS_ENFORCEMENT_MODE=LEGACY` (added during this session if missing)
- [x] N/A — no DB backfill scripts for this phase
- [x] N/A — no admin/app UI; no Razorpay/GST
- [x] N/A — startAttempt intentionally not wired
- [ ] **Deferred manual API smoke (no UI yet):** grant / revoke / `GET /me/entitlements` / `GET /admin/users/:userId/entitlements` against a running local API — **remaining**; not blocking phase close. Revisit when Phase 06 (admin entitlements UI) or earlier if desired. Jest unit matrix already covered.

**Admin auth / admin app impact:** none. Phase 02 did not touch `auth` (admin username/password login), admin guards, or mock-app-admin. Admins continue to log in and use existing admin features as before.

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-05

**DoD:** met  
**Deviations:** none  
**GOLIVE_TODOS touched:** none  
**Next:** phase 03

### 2026-10-06 — Phase 03 — Enforce access gates

**Code:** `ez-prep-api` on branch `payment-gateway`  
**Tests:** Jest — access helpers/batch, attempts start gate + resume/submit no re-check, mock-tests list `access` DTO, full/sprint suites — **pass** (165 tests in focused suites); `tsc -p tsconfig.build.json --noEmit` — pass  

**Shipped:**
- `AccessControlService.resolveAccessForMockTests` (single entitlements query + batch exam load)
- Pure `entitlementCoversPaper` + `toAccessDto` / `AccessResponseDto`
- `startAttempt` gated → HTTP 403 with `details.code = ENTITLEMENT_REQUIRED` when denied
- Resume / submit **do not** re-check entitlement (D-08)
- Student list/get: `accessMode` + `access: { allowed, reason }` on topic-wise, full-mock, and sprint published DTOs (papers not hidden)
- Default `ACCESS_ENFORCEMENT_MODE=LEGACY` confirmed in `.env.example`

**How to temporarily set ENFORCED locally (no staging — D-18):**
1. In local `.env`, set `ACCESS_ENFORCEMENT_MODE=ENFORCED` and restart the API.
2. Ensure a paper is `accessMode: ENTITLED` (admin) and the test user has **no** covering entitlement.
3. `POST /api/v1/mock-test-attempts/start` with that `mockTestId` → expect **403** and `details.code = ENTITLEMENT_REQUIRED`.
4. Start a `FREE` paper → expect success.
5. Restore `ACCESS_ENFORCEMENT_MODE=LEGACY` and restart.

**Developer ops (manual) — confirm each:**
- [x] Confirm `.env.example` still has `ACCESS_ENFORCEMENT_MODE=LEGACY` (default)
- [x] Local ENFORCED smoke: temporarily set `ACCESS_ENFORCEMENT_MODE=ENFORCED`, verify deny on ENTITLED start without grant + allow on FREE, then restore `LEGACY`. Record outcome below.
- [x] N/A — no DB backfill scripts; no admin/app UI; no Razorpay/GST

**Local ENFORCED smoke note:** Verified by developer — ENTITLED start without grant returns 403 `ENTITLEMENT_REQUIRED`; FREE start succeeds; mode restored to `LEGACY`.  

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-06

**DoD:** met  
**Deviations:** none  
**Regression audit (existing specs):** additive tests only in attempts/mock-tests; structural DI provider wiring only in full/sprint/attempts/mock-tests specs (`AccessControlService` mock). `access-control.service.spec.ts`: structural `examModel.find` mock update (batch API) + additive batch cases. Reverted unrelated cosmetic edit to `duration-preset.spec.ts`.  
**Zero-regression rule:** recorded in [`engineering-rules.md`](engineering-rules.md) §6a for Phase 04+.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 04

### 2026-10-07 — Phase 04 — Products + Offers API (Option B)

**Code:** `ez-prep-api` on branch `payment-gateway`  
**Tests:** Jest — resolve-effective-amount, product-version-snapshot, products.service, offers.service, catalog.service — **pass** (25); `tsc -p tsconfig.build.json --noEmit` — pass  

**Shipped:**
- `src/products/` — Product + immutable `product_versions` (Option B); admin CRUD, publish (version bump + freeze), archive, duplicate, soft-delete, `GET .../versions`
- `src/offers/` — Offer with integer paise; partial unique ACTIVE per `(productId, durationPreset)`; admin create/patch/get
- `src/catalog/` — user JWT list/detail/for-exam/for-mock with ACTIVE offers + `effectiveAmount`
- Pure helpers: `resolveEffectiveAmount`, `buildProductVersionSnapshot` / `grantsEqual`, `assertPaise`
- Money convention: **API + storage = integer paise**; UI converts to ₹ (record below)

**Money unit (public JSON):** integer paise only (e.g. `listAmount: 99900` = ₹999). No rupee floats in API. Frontends (admin Phase 05, app Phase 14) format with ₹ symbol for display.

**Developer ops (manual) — confirm each:**
- [x] Confirm schema indexes exist after local API boot / first use: unique `products.code`; `{ grants.scopeType, grants.scopeId }`; unique `{ productId, version }` on `product_versions`; partial unique `{ productId, durationPreset }` where `status: ACTIVE` on `offers`
- [x] Money unit recorded in this STATUS.md session log + program snapshot
- [x] N/A — no `.env` changes; no admin/app UI; no Razorpay/GST; no DB backfill scripts

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-07

**DoD:** met  
**Deviations:** none (Option B product_versions chosen; routes `/admin/products` not `admin/commerce`)  
**Regression audit (existing specs):** new modules only; `app.module.ts` registration only among existing files. No edits to prior `*.spec.ts` cases.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 05

### 2026-10-07 — Phase 05 — Admin Commerce UI

**Code:** `mock-app-admin` on branch `payment-gateway` (API contracts from Phase 04 unchanged)  
**Tests:** Vitest — commerce-money, productsApi, offersApi, products list/detail pages, index export, layout — **pass** (34 in focused suites); `tsc --noEmit` — pass for new files  

**Shipped:**
- `app/services/ezprep-api/products.ts` + `offers.ts` + `commerce-money.ts` (₹ ↔ paise)
- Admin pages: `/admin/products` list/create; `/admin/products/[id]` edit, publish/archive/duplicate/delete, nested offers editor
- Grant UX: one row per scope type with multi-select targets; expand/collapse + dedupe to API `{ scopeType, scopeId }[]`; table shows resolved names
- Nav: Products in `app/admin/layout.tsx` (`admin` proxy root already allowed — no allowlist change)
- Amounts: UI in ₹; API payloads integer paise
- Primary actions (Publish / Add Offer) use solid blue styling consistent with other admin pages

**Developer ops (manual) — confirm each:**
- [x] Optional smoke: create a DRAFT product with ≥1 grant, add a duration offer (₹ → paise), publish — against local API the admin app points to
- [x] N/A — no `.env` changes; no Razorpay/GST; no DB scripts; ez-prep-api / ezprep-app untouched
- [x] N/A — proxy `ALLOWED_V1_ROOTS` unchanged (`admin` already present)

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-07

**DoD:** met  
**Deviations:** none (versions history UI omitted per plan; soft-delete + duplicate included; grant multi-select is UI-only convenience)  
**Regression audit (existing specs):** additive only — `index.test.ts` export asserts; `layout.tsx` nav/selectedKeys. No existing test cases rewritten.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 06

### 2026-10-08 — Phase 06 — Admin Entitlements UI

**Code:** `ez-prep-api` + `mock-app-admin` on branch `payment-gateway` (ezprep-app untouched)  
**Tests:** API Jest entitlements suites — pass (14); admin Vitest entitlements client/section/user-detail/index — pass (16); `tsc --noEmit` for touched admin files — pass; `tsc -p tsconfig.build.json --noEmit` — pass  

**Shipped:**
- API additive Jest: grant `3M` → `expiresAt` ≈ now+3 months; revoke flips `REVOKED`; admin controller roles/guards + non-admin `RolesGuard` denial
- Admin `entitlementsApi` (`listForUser` / `grant` / `revoke`) + Vitest
- User detail **Entitlements** section: table, grant modal (multi-select scope + duration + reason, no productId), revoke confirm
- Grant modal fans out one `ADMIN_GRANT` per selected scope target
- MOCK_TEST picker merges topic-wise + sprint + full published papers (`Topic ·` / `Sprint ·` / `Full ·` labels)
- R-13: legacy subscription/plan labeled “Legacy … (not used for access)” — read-only, separate from entitlements
- Reused Phase 05 `loadGrantScopeOptions` for scope picker + name resolution
- Proxy allowlist unchanged (`admin` already present)

**Local ENFORCED smoke (how to verify grant/revoke removes access):**
1. In API `.env`, set `ACCESS_ENFORCEMENT_MODE=ENFORCED` and restart.
2. Ensure a paper is `accessMode: ENTITLED` under an exam the test user will be granted.
3. Admin UI → Learners → user detail → **Grant access** (scope + duration) → row(s) appear as ACTIVE.
4. As that user, start that paper → expect success.
5. Admin UI → **Revoke** that entitlement → status `REVOKED`.
6. Same start → expect **403** with `details.code = ENTITLEMENT_REQUIRED`.
7. Restore `ACCESS_ENFORCEMENT_MODE=LEGACY` and restart.

**Developer ops (manual) — confirm each:**
- [x] Grant access (e.g. EXAM / MOCK_TEST, 3M) on a test user via admin UI; confirm listed in entitlements table
- [x] Revoke that entitlement; confirm status `REVOKED`
- [x] Local ENFORCED smoke above (grant allows start; revoke denies start); restore `LEGACY` when done testing
- [x] N/A — no permanent `.env` commerce changes required for phase close; no Razorpay/GST; no DB scripts; ezprep-app untouched; proxy allowlist unchanged
- [x] Closes Phase 02 deferred API smoke (grant/revoke/`GET .../entitlements`) via UI + ENFORCED steps above

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-08

**DoD:** met  
**Deviations:** none (no productId on grant modal per plan; pure ADMIN_GRANT). Scope multi-select + sprint/full papers in MOCK_TEST picker added during smoke polish. Remote search-as-you-type for large paper catalogs deferred (separate non-commerce follow-up).  
**Regression audit (existing specs):** additive only — `entitlements.service.spec.ts` new cases; new `admin-entitlements.controller.spec.ts`; admin `index.test.ts` export assert; `users/[id]/page.test.tsx` mock wiring + one additive case; new `grant-options.test.ts`. No existing test cases rewritten.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 07

### 2026-10-08 — Phase 07 — Orders + Payments port

**Code:** `ez-prep-api` on branch `payment-gateway` (admin and ezprep-app untouched)  
**Tests:** Jest — inclusive tax, indian states, TaxService, FakeGateway, registry, order transitions, checkout DTO, checkout service, existing instance-config suites — **pass** (53); `tsc -p tsconfig.build.json --noEmit` — pass  

**Shipped:**
- Optional `taxConfig` and `seller` on the instance-config singleton (schema version stays `1`; admin DTOs unchanged — Phase 10 owns edits). GSTIN replacement stays allowed (D-17, 2026-10-09)
- `npm run commerce:seed-local-tax-config` writes the owner-confirmed seller and taxConfig. Re-run the same script against production Mongo at phase 15
- `POST /api/v1/checkout/orders` and `GET /api/v1/checkout/orders/:id` (JWT). Amount from the offer in paise. Billing requires name, stateCode, address line, city, and 6-digit pincode. Unknown state codes are rejected
- Order `CREATED` → `PENDING_PAYMENT` via FakeGateway, Payment `INITIATED`, 30-minute `expiresAt`, order numbers `ORD-…`
- Idempotent replay for the same user; another user with the same key gets 409 and does not see the order; another user’s GET is 404
- Client `amount` is rejected by `forbidNonWhitelisted`
- Totals under 100 paise rejected. Tax snapshot is integer paise (₹999 @ 18% → taxable 84661, tax 15239; same-state CGST 7619 / SGST 7620; interstate IGST 15239)
- `PAYMENT_PROVIDER=fake` default. `markOrderPaid` plus `FakeGateway.verifyPayment` can reach CAPTURED/PAID and call a no-op paid handler. No entitlement provisioning. Verify/webhook HTTP routes stay in Phase 08. `GET /meta/indian-states` stays in Phase 10
- Seller and tax values stay in instance config. `U-GST-05` owner-confirmed. Production Mongo seed remains `U-OPS-01` for phase 15

**Developer ops (manual) — confirm each:**
- [x] Run `npm run commerce:seed-local-tax-config` against **local** Mongo. Singleton already existed. First run matchedCount=1 modifiedCount=1 (test placeholder). Re-seed after owner-confirmed seller values: matchedCount=1 modifiedCount=1
- [x] Local `.env` has `PAYMENT_PROVIDER=fake`
- [x] N/A — Razorpay adapter, webhook tunnel, admin UI, ezprep-app. Production Mongo seed and live Razorpay keys stay phase 15 (`U-OPS-01`, `U-OPS-02`)

**Seed counts:** matchedCount=1 modifiedCount=1 (final local row: legal name `EzPrep - Powered by Clustream`, GSTIN `32BIAPD6927L1ZC`, Kochi, Kerala / `32`, taxRate 18, SAC `999293`)

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-09

**DoD:** met  
**Deviations:** HTTP verify is Phase 08 (internal `verifyPayment` / `markOrderPaid` covered by Jest). Public Indian-states route is Phase 10 (checkout resolves `state` from an internal GST code list). Checkout window is 30 minutes. Tax breakdown is stored in paise. Local seed uses the owner-confirmed seller identity, not a fake GSTIN.  
**Regression audit (existing specs):** instance-config specs were not edited and stayed green. `app.module.ts` only registers the new modules. No existing test cases rewritten.  
**GOLIVE_TODOS touched:** `U-GST-05` owner-confirmed. `U-OPS-01` values known, production database seed still phase 15. `U-OPS-02` still open  
**Next:** phase 08

### 2026-10-09 — Go-live values recorded (phase 07 closed the same day)

**Owner confirmed:**
- GST **18%**, SAC **`999293`**. Editable later by changing instance `taxConfig` and re-seeding (`U-GST-05` owner-confirmed, no CA letter on file).
- Seller: legal name `EzPrep - Powered by Clustream`; GSTIN `32BIAPD6927L1ZC`; address `Kochi, Kerala`; state Kerala / `32`.
- Razorpay: test keys in local `.env`, live keys in the production env. `.env.example` lists `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` blank. Real keys are not committed.

**Local re-seed:** matchedCount=1 modifiedCount=1 (replaced the earlier test GSTIN).  
**Code:** seed script now writes those seller/tax values. Checkout and `TaxService` still read the database.  
**GOLIVE_TODOS touched:** `U-GST-05` owner-confirmed. `U-OPS-01` values known, production database seed still phase 15. `U-OPS-02` still open until live keys and the prod webhook URL are in place.

**GSTIN edits (owner, 2026-10-09):** `seller.gstin` may be replaced if the legal entity changes. Phase 10 must not reject a new GSTIN for a checksum or state-prefix mismatch. Invoices already issued keep the seller snapshot from issue time. See D-17.

### 2026-10-09 — Phase 08 — Razorpay adapter

**Code:** `ez-prep-api` on branch `payment-gateway` (admin and ezprep-app untouched)  
**Tests:** Jest — Razorpay HMAC/create/webhook, registry, checkout verify, existing checkout/fake suites — **pass** (45 in focused suites); `tsc -p tsconfig.build.json --noEmit` — pass  

**Shipped:**
- `RazorpayGateway` under `src/payments/infrastructure/razorpay/`. SDK import is isolated to `razorpay-sdk.client.ts`. `PAYMENT_PROVIDER=razorpay` selects it; unknown providers still 503. Boot fails only when that provider is selected and `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, or `RAZORPAY_WEBHOOK_SECRET` is blank. Default `fake` still boots with blank keys.
- `POST /api/v1/checkout/orders/:id/verify` (JWT). Razorpay payload requires `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. HMAC-SHA256 of `order_id|payment_id` with `RAZORPAY_KEY_SECRET`. Mismatch, missing fields, or a different Razorpay order id → 400 and the order stays unpaid. Success uses existing `markOrderPaid`. No entitlement provisioning.
- `POST /api/v1/webhooks/payments/razorpay` (no JWT, throttling skipped). Raw body HMAC with `RAZORPAY_WEBHOOK_SECRET` (`X-Razorpay-Signature`). Idempotent on `X-Razorpay-Event-Id` in `webhook_events`. `payment.captured` and `order.paid` mark PAID when amount and INR match. Other events, including `payment.failed`, are IGNORED. Duplicate event id returns 200 and does not pay twice. Invalid signature → 400, no state change. Amount mismatch → FAILED and 200, order unchanged. Missing order → 500 so Razorpay can retry.
- Checkout GET / replay rebuilds `providerData` from the adapter. Razorpay responses include public `keyId` only. Refund stays a stub for phase 11.
- `.env.example` already named the three secrets; comments now include the webhook path.

**Local webhook tunnel (optional — automated tests use signed fixtures and do not need this):**
1. Run the API locally (`PORT`, default 3000).
2. Point a tunnel at that port: `ngrok http 3000` or `cloudflared tunnel --url http://localhost:3000`.
3. In the Razorpay **test** dashboard → Webhooks, add `https://<tunnel-host>/api/v1/webhooks/payments/razorpay`.
4. Subscribe to `payment.captured` and `order.paid`. Paste that endpoint’s secret into local `RAZORPAY_WEBHOOK_SECRET`.
5. Put test key id/secret in local `.env`, set `PAYMENT_PROVIDER=razorpay`, and restart. Leave `PAYMENT_PROVIDER=fake` for ordinary local work.
6. Production webhook is permanent HTTPS on the prod API in phase 15 (`U-OPS-02`). Do not register a tunnel URL on the live account.

**Developer ops (manual) — confirm each:**
- [x] Local `.env` has Razorpay **test** `RAZORPAY_KEY_ID` (`rzp_test_...`) and `RAZORPAY_KEY_SECRET`. Values are not committed.
- [x] `PAYMENT_PROVIDER=fake` for normal local work. Live test-mode smoke waits until checkout UI (phase 14).
- [x] N/A — webhook secret and tunnel. Razorpay issues `RAZORPAY_WEBHOOK_SECRET` only after a webhook URL is created, and that URL is useful once the UI can complete a payment. Signed Jest fixtures cover verify and webhook processing. Create the test-mode webhook during phase 14.
- [x] N/A — admin UI, ezprep-app, entitlement provisioning (phase 09), refund API (phase 11). Production live keys and the prod webhook URL stay `U-OPS-02`.

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-09

**DoD:** met  
**Deviations:** Registry spec “razorpay throws” became “unknown provider (`stripe`) throws” plus new razorpay selection cases — structural, because the adapter is now registered. `payment.failed` does not move the order to FAILED (phase 12). Refund is a stub. Live Razorpay payment and webhook URL are phase 14, not a blocker here.  
**Regression audit (existing specs):** checkout, fake gateway, and order suites were not rewritten. Registry spec: one existing case retargeted from `razorpay` to `stripe` (structural; razorpay is now a real provider) plus additive razorpay cases. New specs only otherwise.  
**GOLIVE_TODOS touched:** `U-OPS-02` still open  
**Next:** phase 09

### 2026-10-09 — Phase 09 — Provisioning and stacking

**Code:** `ez-prep-api` on branch `payment-gateway` (admin and ezprep-app untouched)  
**Tests:** Jest — stacking window, entitlement provisioning, markOrderPaid repair, existing checkout / webhook / entitlements / access suites — **pass** (76 in `src/entitlements`, `src/access`, `src/orders`, `src/webhooks`); `tsc -p tsconfig.build.json --noEmit` — pass  

**Shipped:**
- `stackEntitlementWindow` uses the existing UTC calendar-month helper. Lifetime on either side stays lifetime (`expiresAt = null`). A second purchase of the same product starts at the latest future `expiresAt`. `31 Jan + 1M` still overflows to `3 Mar` (same rule as admin grants, R-11). IST is not used here.
- `EntitlementProvisioningService.provisionForPaidOrder` creates one `PAYMENT` entitlement per order-item grant snapshot. Key: `order:{orderId}:grant:{scopeType}:{scopeId}:v{productVersion}`. Duplicate key is success. `order.provisionedAt` is set only after every grant is inserted or already present. Replay is a no-op.
- Verify and webhook still share `markOrderPaid`. The paid handler provisions on the first transition to PAID. A later PAID signal does not call the handler again. If `provisionedAt` is still unset, that signal calls `provisionForPaidOrder` directly.
- No-op `PaidOrderNotifier` after a successful provision. Phase 10 replaces it. No invoice PDF, refunds, or UI.
- Grants are read from the order snapshot. Live product edits do not change what a paid order grants.

**Repair (no admin HTTP route in this phase):** call `EntitlementProvisioningService.provisionForPaidOrder(orderId)` again for a `PAID` order whose `provisionedAt` is unset. The next webhook `markOrderPaid` does the same. A repeated checkout verify on an already PAID order returns the order and does not re-enter `markOrderPaid`.

**Local ENFORCED smoke (how to verify fake pay grants access):**
1. Keep `PAYMENT_PROVIDER=fake`. Publish a product whose grant is an exam group (or exam) that covers a paper, with an ACTIVE offer.
2. Set that paper to `accessMode: ENTITLED`.
3. Create a checkout order for a user who has no covering entitlement and verify it with the fake provider so the order reaches PAID.
4. Confirm entitlements exist for that user and `orders.provisionedAt` is set.
5. In API `.env`, set `ACCESS_ENFORCEMENT_MODE=ENFORCED` and restart.
6. As that user, `POST /api/v1/mock-test-attempts/start` for the paper → expect success.
7. Pay a second order for the same product → the new entitlement `startsAt` equals the previous `expiresAt`, and the new `expiresAt` is one preset further out.
8. Restore `ACCESS_ENFORCEMENT_MODE=LEGACY` and restart.

**Developer ops (manual) — confirm each:**
- [x] Fake-pay smoke above: PAID order provisions the snapshot grant
- [x] Local ENFORCED `startAttempt` succeeds for that grant, then restore `LEGACY`
- [x] Second purchase of the same product extends `expiresAt`
- [x] N/A — no new env vars, DB scripts, Razorpay tunnel, admin UI, or ezprep-app changes. Invoice PDF stays phase 10. Production keys stay `U-OPS-02`

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-09

**DoD:** met  
**Deviations:** no Mongo transaction (unique `provisioningKey` + `provisionedAt`). Checkout verify does not retry provisioning after the order is already PAID. `PaidOrderNotifier` is provided by `EntitlementsModule` so orders can import it without a module cycle. Minor admin/app UI polish noticed during smoke is deferred; this phase has no UI scope.  
**Regression audit (existing specs):** checkout and webhook suites gained an `EntitlementProvisioningService` mock provider (structural; `OrdersService` now depends on it). Existing assertions were not rewritten. New specs: stacking window, provisioning service, markOrderPaid repair.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 10

### 2026-10-09 — Phase 10 — GST invoices

**Code:** `ez-prep-api` on branch `payment-gateway` (admin and ezprep-app untouched)  
**Tests:** Jest — invoice format, PDF fields, issue/idempotency/authZ, notifier flag, indian-states, instance-config GSTIN update, provisioning retry, existing entitlements/orders/webhooks/tax/instance-config — **pass** (119 in those suites); `tsc -p tsconfig.build.json --noEmit` — pass  

**Shipped:**
- `src/invoices/` issues one tax invoice after entitlements are inserted and before `order.provisionedAt` is saved. A failed issue leaves `provisionedAt` unset so the next paid signal retries. `INVOICES_ENABLED` must be the string `true`; any other value skips issue and still provisions.
- Numbering is the Indian FY series from `taxConfig.invoiceSeriesPrefix` (`SERIES/2026-27/0001` shape). Tax amounts are copied from `order.tax`. Seller, SAC, and the full billing address are snapshotted at issue time. A later GSTIN edit does not change the issued row.
- PDF via `pdfkit`, stored with `S3Service` at `{userId}/{orderId}.pdf` in `AWS_S3_INVOICES_BUCKET` and no public ACL. `GET /api/v1/me/invoices` and `GET /api/v1/me/invoices/:id/pdf` (owner, otherwise 404). `GET /api/v1/admin/invoices` and `GET /api/v1/admin/invoices/:id/pdf` (admin).
- `GET /api/v1/meta/indian-states` is public. Admin `PUT /instance-config` can set nested `seller` and `taxConfig`, including a replacement GSTIN with no checksum or state-prefix check. Optional signatory fields print when set. The PDF always says it is computer-generated.
- `TODO(golive): U-GST-07`, `U-GST-08`, `U-GST-10` on the invoice path. Production seller seed stays `U-OPS-01` (phase 15).

**Manual proof:** deferred to phase 16. Owner 2026-10-09 — Postman is a poor fit (student OTP, no profile UI yet). Steps live in [`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md) (journey J1 and the invoice negative list). That pass re-checks the PDF; it does not reopen this phase.

**Local PDF smoke (how to verify, when phase 16 runs):**
1. In API `.env`, set `INVOICES_ENABLED=true` and restart. Seller/tax config is already seeded locally.
2. With `PAYMENT_PROVIDER=fake`, create a checkout order and verify it so the order reaches PAID. The only commerce PDF is the GST invoice in `AWS_S3_INVOICES_BUCKET` at `{userId}/{orderId}.pdf` (private, no public ACL). Owner locked 2026-10-09: no separate payment-receipt PDF.
3. As that user, `GET /api/v1/me/invoices` and `GET /api/v1/me/invoices/:id/pdf`. Confirm the FY number, seller block, SAC, billing address, and tax lines.
4. `PUT /api/v1/instance-config` with a different `seller.gstin` (admin JWT). Download the same PDF again and confirm the GSTIN on it did not change.
5. Another user's download of that invoice id should be 404. An admin `GET /api/v1/admin/invoices/:id/pdf` should succeed.

**Developer ops (manual) — confirm each:**
- [x] N/A for this close — `INVOICES_ENABLED`, `AWS_S3_INVOICES_BUCKET`, fake-pay PDF, and GSTIN snapshot immutability are verified in phase 16 ([`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md)), not Postman. Owner 2026-10-09.
- [x] N/A — production Mongo seed (`U-OPS-01`, phase 15), email, credit notes, admin UI, ezprep-app, Razorpay tunnel

**Developer confirmation:**  
I, Sharun, confirm the manual PDF smoke is deferred to phase 16 with reason, and this phase may be marked done.  
Date: 2026-10-09

**DoD:** met  
**Deviations:** Phase file objective still says calendar `EZPREP/YYYY/####`; implementation follows D-11 Indian FY `PREFIX/YYYY-YY/####`. Invoice billing stores the full checkout address, plus `orderNumber`, `financialYear`, and `sequence`. The paid notifier runs before `provisionedAt` so a failed PDF can be retried by the existing repair path. Manual PDF smoke is phase 16, not a Postman gate on this phase.  
**Regression audit (existing specs):** instance-config DTO and service specs gained additive cases only. Provisioning spec gained one case for notifier failure. No existing assertions rewritten. EntitlementsModule now imports InvoicesModule; no prior spec boots that module.  
**GOLIVE_TODOS touched:** comments for `U-GST-07`, `U-GST-08`, `U-GST-10`. `U-OPS-01` still open for production seed. `U-GST-09` still open for CA/Zoho confirmation; FY series is what shipped.  
**Next:** phase 11

### 2026-10-09 — Phase 11 — Admin refunds

**Code:** `ez-prep-api` and `mock-app-admin` on branch `payment-gateway` (ezprep-app untouched)  
**Tests:** API Jest refunds / orders refund transition / fake + razorpay refund / entitlements revoke-by-order / invoices find-by-order — pass. Admin Vitest order detail refund + proxy PDF stream + orders API export — pass. `tsc -p tsconfig.build.json --noEmit` and admin `tsc --noEmit` — pass.

**Shipped:**
- `POST /api/v1/admin/orders/:id/refunds` with `{ reason }` only. Full amount in paise from the captured payment. Admin JWT. A second refund of a completed or in-progress refund is 409 and does not call the provider again.
- Provider `processed` moves payment and order to `REFUNDED` and revokes `PAYMENT` entitlements for that `orderId` only. Provider failure marks the refund `FAILED` and leaves the order `PAID`. Provider `pending` leaves the refund `INITIATED`, the order `PAID`, and does not revoke access.
- `GET /api/v1/admin/orders` and `GET /api/v1/admin/orders/:id` (order number search, status, page). Detail includes payment, refund, and the issued invoice id when one exists. The invoice stays `ISSUED`. No credit note.
- FakeGateway refunds return `processed`. Razorpay `payments.refund` uses normal speed (not `optimum`) through the existing SDK client. A `pending` create response stays `INITIATED`. `refund.processed` and `refund.failed` webhooks, and the refund tick behind `RECONCILIATION_ENABLED`, finish that row later (2026-10-10).
- Audit actions `REFUND_INITIATED` and `REFUND_COMPLETED`. `TODO(golive): U-GST-04` on the refund service.
- Admin `/admin/orders` and `/admin/orders/[id]`. Button label **Refund**. Confirm title `Refund this order?`. Success copy `Order refunded`. Pending copy `Refund is pending at the payment provider. Access was not revoked.` Invoice link `Download invoice` streams the phase 10 admin PDF.

**Razorpay sync vs webhook:** a normal refund API response of `processed` completes in this request. `pending` does not revoke access in that request. A later `refund.processed` webhook, or the refund tick when `RECONCILIATION_ENABLED=true`, runs the same completion. `refund.failed` marks the refund `FAILED` and leaves the order `PAID`. Do not treat an in-progress refund as finished until one of those paths settles it.

**Zoho / U-GST-04:** the app does not issue a credit note. Every later filing-relevant (production) refund still needs a credit note in Zoho or the CA workflow for the same invoice, recorded in this log. This local phase does not create a filing-relevant refund.

**Developer ops (manual) — confirm each:**
- [x] Broad local admin smoke (owner, 2026-10-09): `/admin/orders` refund of a paid order with a reason. Entitlements from that order revoked, invoice still issued, second refund errors.
- [x] N/A for this close — the extensive UI-integrated pass (J5: confirm modal, ENFORCED lock again, unrelated grants still active, student UI has no refund, invoice unchanged) is phase 16 ([`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md)). Owner 2026-10-09.
- [x] N/A — production Zoho credit note. No filing-relevant refund in this session. Standing rule above (`U-GST-04`)
- [x] N/A — Razorpay dashboard refund and `refund.processed` webhook. Pending-provider completion is not this phase

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-09

**DoD:** met  
**Deviations:** `GET /admin/orders` list and detail shipped with the refund POST so support can find an order. Second refund is 409, not a silent success. A provider `pending` refund does not revoke access. Confirm modal is unchanged; the reason is a field on the order page. Invoice PDF download goes through the admin proxy as raw PDF bytes. Extensive integrated UI proof is phase 16, not a gate on this phase.  
**Regression audit (existing specs):** additive cases in order transitions, fake gateway, entitlements, and invoices. Razorpay gateway spec: the “leaves refunds for phase 11” assertion was replaced because `refund` is now implemented (structural). Admin `index.test.ts`: one added export assert. No existing assertions rewritten otherwise.  
**GOLIVE_TODOS touched:** `U-GST-04` still open; `TODO(golive): U-GST-04` on `RefundsService.refund`  
**Next:** phase 12

### 2026-10-09 — Phase 12 — Reconciliation + commerce audit

**Code:** `ez-prep-api` on branch `payment-gateway` (admin and ezprep-app untouched)  
**Tests:** Jest — orders, payments, products, offers, invoices, entitlements, refunds, commerce-audit, webhooks, catalog — **pass** (167); `tsc -p tsconfig.build.json --noEmit` — pass

**Shipped:**
- `fetchOrderStatus` is required on the payment port. FakeGateway stages a status for tests; an unstaged id is `IGNORED`. Razorpay fetches the order and its payments. Captured (or order `paid`) → `CAPTURED`. A failed payment with no capture → `FAILED`. Otherwise `IGNORED`.
- In-process reconciliation when `RECONCILIATION_ENABLED` is the string `true`. It does not use Redis or BullMQ. Each pass loads up to 50 `PENDING_PAYMENT` orders with `createdAt` older than `RECONCILIATION_MIN_AGE_MINUTES` (default 60). Captured amount and `INR` match → existing `markOrderPaid` (provision once). Provider failure → order and payment `FAILED`. Still unpaid → order `EXPIRED`, payment stays `INITIATED`. Amount mismatch or a provider error leaves the order pending. Already `PAID` orders are not selected. `EXPIRED` and `FAILED` stay terminal. `payment.failed` webhooks are unchanged.
- Audit writes now redact secret-like keys. New actions: `PRODUCT_PUBLISHED`, `PRODUCT_ARCHIVED`, `OFFER_CREATED`, `OFFER_UPDATED`, `INVOICE_ISSUED` (first issue only). Grant, revoke, and refund actions were already written. `GET /api/v1/admin/commerce-audit` (admin JWT). No admin UI page.

**Local pass (how to run one tick):**
1. In API `.env`, set `RECONCILIATION_ENABLED=true`.
2. Set `RECONCILIATION_MIN_AGE_MINUTES=0` so a pending order is eligible immediately. Default is 60.
3. Restart the API. The interval is `RECONCILIATION_INTERVAL_MS` (default 300000). A captured fake/Razorpay order becomes paid; an unpaid one becomes `EXPIRED`; a provider-failed one becomes `FAILED`.
4. `GET /api/v1/admin/commerce-audit` lists the trail.
5. Set `RECONCILIATION_ENABLED=false` and restore `RECONCILIATION_MIN_AGE_MINUTES=60` when finished.

**Developer ops (manual) — confirm each:**
- [x] `.env.example` keeps `RECONCILIATION_ENABLED=false` unless someone opts in. Age default 60. Interval default 300000.
- [x] N/A for this close — the local tick (flag off leaves a checkout pending; flag on with age 0 expires an unpaid order, fails a provider failure, repairs a missed Razorpay capture, leaves a paid order alone; then restore the flag and the 60 minute age) is phase 16 ([`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md) J6 and the Phase 12 note). Postman skipped. Owner 2026-10-10.
- [x] N/A for this close — `GET /api/v1/admin/commerce-audit` is checked in that same phase 16 pass. No admin page.
- [x] N/A — Razorpay dashboard, webhook subscription, Zoho credit note, ezprep-app, Redis

**Developer confirmation:**  
I, Sharun, confirm the manual recon and audit-list pass is deferred to phase 16 with reason, and this phase may be marked done.  
Date: 2026-10-10

**DoD:** met  
**Deviations:** scheduler is an in-process interval, not BullMQ. `payment.failed` webhooks stay ignored; recon closes those orders after the age window. `PRODUCT_CREATED` is not logged. No admin UI page. Manual tick and audit-list proof are phase 16, not a Postman gate on this phase.  
**Regression audit (existing specs):** products, offers, and invoice specs gained a `CommerceAuditService` mock provider (structural; those services now depend on it). Razorpay gateway spec mock gained `fetchOrder` / `fetchPayments` (structural; the client interface grew). Existing assertions were not rewritten. New specs: reconciliation, scheduler, commerce audit, admin audit controller. Additive cases: fake/razorpay fetch mapping, product publish audit, offer update audit, invoice issue-once audit.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 13

### 2026-10-10 — Phase 13 — User access UI

**Code:** `ezprep-app` (locked cards, View plans, overview CTA, launch-error banner, `/dashboard/checkout` shell). `ez-prep-api` docs only. No API or admin behavior change.  
**Tests:** ezprep-app `npm run typecheck` — pass. ESLint on the phase files — 0 errors (two pre-existing `exhaustive-deps` warnings in the full-mock and sprint clients). Full `npm run lint` still fails on pre-existing unescaped-entity errors outside this phase. No new test runner (D-15).

**Shipped:**
- Paper types read sibling `accessMode` and `access: { allowed, reason }`
- Denied Start/Retake cards show a Locked chip and **View plans**. Resume stays when `userAttemptAction` is `RESUME` and `resumeAttemptId` is set
- View plans loads `GET /catalog/products/for-mock-test/:id` from a card and `GET /catalog/products/for-exam/:id` from the overview CTA. **Buy** goes to `/dashboard/checkout?offerId=`
- Checkout page is a shell: heading `Checkout enabling soon`. No Razorpay and no order call
- `startAttempt` `details.code = ENTITLEMENT_REQUIRED` shows the API message and **View plans**
- Overview CTA only when a paper list returns `access.allowed === false`. Hidden while that probe loads or if it fails
- Subscriptions stays Coming Soon. “Free Early Access” copy is unchanged. `NEXT_PUBLIC_ACCESS_UI` was not added

**Developer ops (manual) — confirm each:**
- [x] Broad local smoke (owner, 2026-10-10): locked cards, View plans, and the checkout shell behave as shipped
- [x] N/A for this close — the detailed pass (FREE vs ENTITLED, overview CTA, grant/revoke, Resume, launch banner, mobile, offer invalidation, and the full admin-to-student script) is phase 16 ([`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md) run order plus J1, J4, J7). Do not check those boxes here
- [x] N/A — no DB scripts, Razorpay dashboard, Zoho, or admin code. Restore `LEGACY` after any ENFORCED check during the phase 16 pass

**Developer confirmation:**  
I, Sharun, confirm the broad access UI smoke works, the remaining detailed and end-to-end cases are recorded for phase 16, and this phase may be marked done.  
Date: 2026-10-10

**DoD:** met  
**Deviations:** live access JSON is `accessMode` plus `access: { allowed, reason }`, not `access.accessMode`. Overview CTA is derived from paper `access.allowed`, not from `GET /me/entitlements`. Resume is kept on a denied paper (D-08). No `NEXT_PUBLIC_ACCESS_UI` flag. Detailed UI proof is phase 16, not a gate on this phase.  
**Regression audit (existing specs):** ezprep-app has no test suite. Full-mock and sprint `useEffect` dependency warnings were already present.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 14

### 2026-10-10 — Phase 14 — Checkout and subscriptions

**Code:** `ez-prep-api` (`GET`/`PATCH /me/billing-profile`, `GET /me/orders`, `GET /me/orders/:id`) and `ezprep-app` (checkout, Razorpay adapter, subscriptions). Admin untouched.  
**Tests:** API Jest users + orders — pass (116). `tsc -p tsconfig.build.json --noEmit` — pass. ezprep-app `tsc --noEmit` — pass. ESLint on the phase files — pass. No new app test runner (D-15).

**Shipped:**
- Optional `billingProfile` on the user, separate from `location`. It is omitted from `GET /users/me`.
- Checkout page replaces the shell. Billing name, state, address, **Pay securely**, Razorpay Checkout.js, verify, and subscriptions ownership with invoice download.
- No checkout feature flag, same as phase 13. Rollback is reverting the phase.

**Developer ops (manual) — confirm each:**
- [x] App `.env`: `NEXT_PUBLIC_RAZORPAY_KEY_ID` only. The key secret and webhook secret are not in the app env. Owner 2026-10-10.
- [x] API `.env`: `PAYMENT_PROVIDER=razorpay`, test key id and secret, `INVOICES_ENABLED=true`, invoice bucket set. Used for the local smoke.
- [x] Razorpay test webhook URL via ngrok. `POST /api/v1/webhooks/payments/razorpay` returned 200. The owner chooses the webhook secret in the dashboard and copies it into `RAZORPAY_WEBHOOK_SECRET`.
- [x] Prefill, success pay, payment-stage error does not unlock, modal dismiss, UPI failure, double-click, expired copy, new-student subscriptions, pending order stays pending, invoice PDF, no refund control, mobile width, inactive offers hidden. Recorded in [`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md). The wider phase 16 board stays open.
- [x] `PAYMENT_PROVIDER` stays `razorpay` for production. The fake provider was checked locally and is not the production provider.

**Local smoke 2026-10-10:** test card payment, billing prefill, invoice download, mobile layout, no student refund control, manual grant and revoke, free papers still start, entitled papers deny without payment. Refund tick completed `ORD-MV28B89M-P9LA`. A new invoice shows ₹. Double-click no longer opens a second payment window.

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above (or marked N/A with reason) and this phase may be marked done.  
Date: 2026-10-10

**DoD:** met  
**Deviations:** no `NEXT_PUBLIC` checkout flag (same as phase 13). `GET /me/orders` is a history view and does not replace `GET /checkout/orders/:id`. Remaining catalog, stacking, S3, and audit rows stay in phase 16.  
**GOLIVE_TODOS touched:** decisions recorded 2026-10-10. Execution of the production seed, live keys, and live webhook stays phase 15. Credit notes stay deferred. Place of supply stays a later confirmation.  
**Next:** phase 15 (superseded the same day: ad-hoc phases 14A–14E come first, see the next entry)

### 2026-10-10 — Pre-release review + owner decisions (docs only)

**Code:** docs only. No runtime change.

- New: [`PRE_RELEASE_REVIEW.md`](PRE_RELEASE_REVIEW.md), with 34 findings PR-01…PR-34, a coverage matrix, the late-payment design, and the compatibility and regression contract.
- New: phase files 14A–14E.
- Updated: `decisions.md`, `state-machines.md`, `gst-invoicing.md`, `domain-model.md`, `risk-register.md`, `GOLIVE_TODOS.md`, `phases/README.md`, and phase 15 prerequisites.

**Tests:** baseline `npx jest --config jest.config.js` → 53 suites / 323 tests pass. Bare `npx jest` fails on the duplicate Jest config (PR-26).

**Owner decisions → decisions.md:**
- **D-22** Late payments are accepted with provider proof. Bounded load: webhook first, and a late watch of at most 7 provider calls per abandoned order.
- **D-23** Refunding an earlier purchase moves later stacked purchases to start now, with their full duration.
- **D-24** Repurchase while covered for life → 409 `ALREADY_COVERED`.
- **D-25** Invoice date = payment date, even when a repair issues it late.
- **D-26** Kerala buyer → CGST 9% + SGST 9% in equal paise; any other state → IGST 18%. Supply type snapshotted.
- **D-27** Production commerce config fails closed; `COMMERCE_ENABLED` gate.
- **D-28** Duplicate captures are refunded automatically.

**Owner facts:**
- `api.ezpre.in` is behind nginx (U-OPS-03; hop count still to confirm).
- Razorpay webhook auto-disable after 24 hours of failure, then manual re-enable (U-OPS-02).
- Seller address → `Kerala` (U-OPS-01; CA check U-GST-11).

**GST verification:**
- Place of supply and the CGST/SGST vs IGST selection were already correct.
- Gaps: unequal split by one paisa on an odd tax amount; supply type not stored; no breakdown shown to the buyer or admin. These are fixed in 14E.

**Open questions:** review Q1–Q7. None blocks 14A.

**Developer confirmation:** n/a (docs only). The owner reviews the review and phase files before 14A starts.  
**GOLIVE_TODOS touched:** U-OPS-01, U-OPS-02 updated; U-OPS-03, U-GST-11, U-GST-12, U-GST-13 added.  
**Next:** phase 14A

### 2026-10-10 — Final pre-implementation pass (docs only)

**Code:** docs only. No runtime change.

**Owner answers:**
1. **Proxy.** nginx is the only proxy (no Cloudflare), so `TRUST_PROXY_HOPS=1`. The header lines are a go-live step (U-OPS-03).
2. **Capture.** Razorpay capture automatic, with late authorizations captured.
3. **Account use.** The account is used only by this app, and nobody acts in the Dashboard.
4. **ExamFlex sells.** Same code, own seller identity and GSTIN (D-29, U-OPS-04).
5. **Redis.** On EZ Prep, not on ExamFlex. The money path now uses no Redis anywhere.
6. **Production data.** Production has no commerce data.
7. **CA.** Accepted U-GST-11/12/13.

**New findings, each assigned to a phase:**
- PR-35: merchant name hardcoded → 14E
- PR-36: seed hardcodes the EZ Prep seller → 14E
- PR-37: cross-instance webhook events → 14B/14C
- PR-38: refund on an unpaid order → 14C
- PR-39: Terms describe auto-renewal and trials → 14D

**Design simplifications:**
- No BullMQ invoice job and no Redis scheduler lock. An in-process trigger plus the sweep gives identical behavior on both instances.
- No `COMMERCE_SYSTEM_USER_ID`: refunds record `initiatedBySource` instead.
- No test-key override in production.

**Traceability:** `PRE_RELEASE_REVIEW.md` § Traceability maps every agreed item to a phase section. § Go-live path lists the remaining non-code steps.

**Developer confirmation:** n/a (docs only).  
**GOLIVE_TODOS touched:** U-GST-11/12/13 CA-verified; U-OPS-01/02/03 finalized; U-OPS-04 added.  
**Next:** phase 14A

### 2026-10-10 — Legal copy locked + single go-live guide (docs only)

**Code:** docs only. No runtime change.

**Unknowns check:** no implementation unknowns remain. Phases 14A–14E, 15, and 16 can start. The open items are owner inputs needed only at go-live:
- customer-care phone and grievance officer name for each site (U-OPS-05)
- ExamFlex seller values and API host, needed only before the ExamFlex B steps

**Added:**
- `LEGAL_COPY.md`: locked wording for Terms (General, Plans and payments, Cancellation, Refunds, Contact and grievance redressal, Governing law), the Privacy "Payments and billing" paragraph, checkout lines, and in-app payment messages. Seven public per-deployment values.
- `GO_LIVE_GUIDE.md`: the single source of truth for go-live. Steps 0–23, with A/B variants where EZ Prep and ExamFlex differ, plus playbooks P1–P7 and rollback R1–R4.

**New finding:** PR-40. The Terms name "EzPrep Technologies Pvt. Ltd., Kochi", which does not match the invoice seller "EzPrep - Powered by Clustream", Kerala. They also lack the grievance officer name and a customer-care phone (E-Commerce Rules 2020, rule 4). Fixed in 14D §10.

**Plan edits:**
- 14D §10 now implements `LEGAL_COPY.md` word for word, and the app hides Buy when the API has commerce off.
- 14C §10: admin health answers while commerce is off.
- Phase 15 no longer writes a separate runbook; it checks the guide against the code.
- `PRE_RELEASE_REVIEW.md` § Go-live path and the GOLIVE_TODOS U-OPS rows point to the guide.

**Developer confirmation:** n/a (docs only).  
**GOLIVE_TODOS touched:** U-OPS-01 to U-OPS-04 point to the guide; U-OPS-05 added.  
**Next:** phase 14A

### 2026-10-10 — Phase 14A — Fail-closed config and catalog integrity

**Code:** ez-prep-api only. ezprep-app and mock-app-admin were not changed.

**Tests:** API Jest 191 suites / 1526 tests pass. Commerce e2e 6 suites / 13 tests pass. `tsc -p tsconfig.build.json --noEmit` pass. ESLint on the phase files pass. Admin Vitest and the app typecheck were not run (out of scope).

**What shipped:**
- `COMMERCE_ENABLED` is the exact string `true`. Checkout, verify, my orders, my invoices, and the Razorpay webhook return 404 `COMMERCE_DISABLED` otherwise. Catalog stays up with `commerceEnabled` on the response envelope.
- Production boot refuses to start when commerce is on and the provider, live key, secrets, instance id, instance name, invoices, reconciliation, or access mode is wrong. The error names the key.
- `fake` is not registered in production. A blank `PAYMENT_PROVIDER` no longer falls back to fake.
- Checkout sells the frozen `product_versions` row. Catalog matching and the grants payload use `publishedGrants`.
- An entitlement is active only after `startsAt`. Payment rows store `durationPreset`. Revoking a payment row re-anchors later stacks. A lifetime repurchase returns 409 `ALREADY_COVERED`.
- Trust proxy hops, per-user checkout throttles, and the open-order cap are in place.

**Structural spec edits (engineering rule 6a):**
- Payment gateway registry spec now expects a blank provider to throw. It injects `CommerceConfigService` instead of reading `ConfigService` per call.
- Active-entitlement fixtures that expect true now pass an explicit `startsAt`. The assertions are unchanged.
- Scheduler specs pass commerce settings and set `COMMERCE_ENABLED=true` on the enabled case so the new gate still starts the timer.
- Checkout, access, entitlements, users, catalog, and controller specs gained providers for the new constructor arguments. Assertions were not rewritten except the blank-provider case above.

**Developer ops (manual) — confirm each:**
- [x] Local `.env` has `COMMERCE_ENABLED=true` and `TRUST_PROXY_HOPS=0`. Without the first, local checkout returns 404.
- [x] `GO_LIVE_GUIDE.md` Step 13 key names match what shipped (`COMMERCE_ENABLED`, `TRUST_PROXY_HOPS`, `MAX_OPEN_ORDERS_PER_USER`). Droplet env is still a go-live step, not this phase.
- [x] One-off `NODE_ENV=production` boot with a bad env fails with a message naming the key, then the env is restored.
- [x] A published grant edit without republish leaves catalog and checkout on the previous grants.
- [x] Refunding the earlier of two stacked purchases moves the later window earlier.
- [x] A lifetime grant blocks buying that same scope again.

**Developer confirmation:**  
I, Sharun, confirm I completed the developer ops above and this phase may be marked done.  
Date: 2026-10-10

**DoD:** met  
**Deviations:** the app still shows a generic pay error for a commerce 404. The "not available" string is only for a missing offer until phase 14D.  
**GOLIVE_TODOS touched:** none  
**Next:** phase 14E
