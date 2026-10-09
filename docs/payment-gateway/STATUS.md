# Commerce / Payments — STATUS

**Single source of truth** for implementation progress, developer ops (scripts, instance config, Razorpay, migrations), and **phase completion confirmation**.

Update this file at the **end of every phase session**. A phase is not `done` until the developer confirmation block is filled.

Related: [`engineering-rules.md`](engineering-rules.md) · [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md) · [`unknowns.md`](unknowns.md) · [`phases/README.md`](phases/README.md)  
Legacy alias: [`PAYMENT_STATUS.md`](PAYMENT_STATUS.md) points here.

---

## Program snapshot

| Field | Value |
| --- | --- |
| Pack locked for development | **LOCKED** 2026-10-04 — owner ack; CA items via GOLIVE_TODOS (non-blocking) |
| Current phase | 07 **in_progress** — awaiting developer confirmation |
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
| 07 | Orders + TaxService + FakeGateway | **in_progress** | | Pending: seed **local** seller/taxConfig; `PAYMENT_PROVIDER=fake` |
| 08 | Razorpay adapter | pending | | Pending: test keys in `.env`; optional tunnel |
| 09 | Provisioning + stacking | pending | | Pending: verify access after fake pay |
| 10 | GST invoices | pending | | Pending: local PDF smoke; FY series |
| 11 | Admin refunds | pending | | Pending: document Zoho credit-note step (U-GST-04) |
| 12 | Reconciliation + audit | pending | | Pending: recon env flag noted |
| 13 | User access UI | pending | | Pending: manual UI checklist |
| 14 | Checkout + subscriptions | pending | | Pending: address+state checkout; test key id |
| 15 | Rollout hardening | pending | | Pending: GOLIVE_TODOS cleared; prod seed; ENFORCED |

---

## Standing developer / owner ops (by theme)

### A. Scripts (API repo)

| Script / command | When | Record in session log |
| --- | --- | --- |
| `npm run commerce:backfill-access-mode-free` | Phase 01 — each DB (local, later prod) | Counts updated (`matchedCount` / `modifiedCount`) |
| `npm run commerce:report-exam-category-mismatches` | Phase 01 | Zero mismatches or fixes applied |
| `npm run commerce:seed-local-tax-config` | Phase 07 local; phase 15 prod | `matchedCount` / `modifiedCount`. Same owner-confirmed payload |
| Optional ENTITLED manifest | Phase 15 only if used | Manifest path |

### B. Instance config (Mongo)

| When | What |
| --- | --- |
| Phase 07 local | Seed owner-confirmed seller + taxConfig (`EzPrep - Powered by Clustream`, GSTIN `32BIAPD6927L1ZC`, Kochi, Kerala / `32`, 18%, SAC `999293`) |
| Phase 15 prod | Re-run the same seed against production Mongo — `U-OPS-01` |

### C. Env / Razorpay

| When | What |
| --- | --- |
| Phase 02+ | `ACCESS_ENFORCEMENT_MODE` |
| Phase 08/14 local | Test Razorpay keys in local `.env` (`rzp_test_...`); optional webhook tunnel. Names in `.env.example` |
| Phase 15 prod | Live keys in the production env (`rzp_live_...`) + webhook URL — `U-OPS-02`. Do not commit keys |

### D. Accounting (Zoho)

| When | What |
| --- | --- |
| Every filing-relevant refund | Credit note outside app until U-GST-04 cleared — log here |

---

## Compliance / go-live gate

Tracked in detail in [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md). Phase 15 cannot mark production live while that board has open **must-clear** rows (unless CA waiver logged).

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

**Shipped (not closed):**
- Optional `taxConfig` and `seller` on the instance-config singleton (schema version stays `1`; admin DTOs unchanged — Phase 10 owns edits). GSTIN replacement stays allowed (D-17, 2026-10-09)
- `npm run commerce:seed-local-tax-config` writes **local test** seller/tax placeholders. It does not create the singleton and does not write a production GSTIN
- `POST /api/v1/checkout/orders` and `GET /api/v1/checkout/orders/:id` (JWT). Amount from the offer in paise. Billing requires name, stateCode, address line, city, and 6-digit pincode. Unknown state codes are rejected
- Order `CREATED` → `PENDING_PAYMENT` via FakeGateway, Payment `INITIATED`, 30-minute `expiresAt`, order numbers `ORD-…`
- Idempotent replay for the same user; another user with the same key gets 409 and does not see the order; another user’s GET is 404
- Client `amount` is rejected by `forbidNonWhitelisted`
- Totals under 100 paise rejected. Tax snapshot is integer paise (₹999 @ 18% → taxable 84661, tax 15239; same-state CGST 7619 / SGST 7620; interstate IGST 15239)
- `PAYMENT_PROVIDER=fake` default. `markOrderPaid` plus `FakeGateway.verifyPayment` can reach CAPTURED/PAID and call a no-op paid handler. No entitlement provisioning. Verify/webhook HTTP routes stay in Phase 08. `GET /meta/indian-states` stays in Phase 10
- `TODO(golive): U-GST-05` and `TODO(golive): U-OPS-01` on the tax path and local seed

**Developer ops (manual) — confirm each:**
- [ ] Run `npm run commerce:seed-local-tax-config` against **local** Mongo. The instance-config singleton must already exist. Record `matchedCount` / `modifiedCount` below. Confirm the log shows `taxRate: 18`, `sellerStateCode: "32"`, and the local-test note (not a production GSTIN)
- [ ] Confirm local `.env` has `PAYMENT_PROVIDER=fake` (add it if missing; `.env.example` already documents the default)
- [ ] N/A — Razorpay keys, webhook tunnel, admin UI, ezprep-app, production seller/GSTIN (`U-OPS-01`)

**Seed counts:** pending developer run  

**Developer confirmation:**  
Pending. Do not mark this phase done until the ops above are checked and confirmed.  

**DoD:** pending developer confirmation  
**Deviations:** HTTP verify is Phase 08 (internal `verifyPayment` / `markOrderPaid` covered by Jest). Public Indian-states route is Phase 10 (checkout resolves `state` from an internal GST code list). Checkout window is 30 minutes. Tax breakdown is stored in paise.  
**Regression audit (existing specs):** instance-config specs were not edited and stayed green. `app.module.ts` only registers the new modules. No existing test cases rewritten.  
**GOLIVE_TODOS touched:** referenced existing `U-GST-05` and `U-OPS-01` (still open)  
**Next:** developer confirmation, then phase 08

### 2026-10-09 — Go-live values recorded (does not close phase 07)

**Owner confirmed:**
- GST **18%**, SAC **`999293`**. Editable later by changing instance `taxConfig` and re-seeding (`U-GST-05` owner-confirmed, no CA letter on file).
- Seller: legal name `EzPrep - Powered by Clustream`; GSTIN `32BIAPD6927L1ZC`; address `Kochi, Kerala`; state Kerala / `32`.
- Razorpay: test keys in local `.env`, live keys in the production env. `.env.example` lists `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` blank. Real keys are not committed.

**Local re-seed:** matchedCount=1 modifiedCount=1 (replaced the earlier test GSTIN).  
**Code:** seed script now writes those seller/tax values. Checkout and `TaxService` still read the database.  
**GOLIVE_TODOS touched:** `U-GST-05` owner-confirmed. `U-OPS-01` values known, production database seed still phase 15. `U-OPS-02` still open until live keys and the prod webhook URL are in place.

**GSTIN edits (owner, 2026-10-09):** `seller.gstin` may be replaced if the legal entity changes. Phase 10 must not reject a new GSTIN for a checksum or state-prefix mismatch. Invoices already issued keep the seller snapshot from issue time. See D-17.
