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
| Current phase | 03 **done** — next **04** |
| Enforcement mode | Config live: `ACCESS_ENFORCEMENT_MODE` (default `LEGACY`); wired into `startAttempt` (deny only when ENFORCED) |
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
| 04 | Products + Offers API | pending | | Pending: record paise convention |
| 05 | Admin commerce UI | pending | | Pending: optional smoke create product |
| 06 | Admin entitlements UI | pending | | Pending: grant/revoke on test user |
| 07 | Orders + TaxService + FakeGateway | pending | | Pending: seed **local** seller/taxConfig; billing includes address |
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
| Optional ENTITLED manifest | Phase 15 only if used | Manifest path |

### B. Instance config (Mongo)

| When | What |
| --- | --- |
| Phase 07/10 local | Seed test `seller` + `taxConfig` (not production GSTIN unless intentional) |
| Phase 15 prod | Real values — `U-OPS-01` / GOLIVE_TODOS |

### C. Env / Razorpay

| When | What |
| --- | --- |
| Phase 02+ | `ACCESS_ENFORCEMENT_MODE` |
| Phase 08/14 local | Test Razorpay keys; optional webhook tunnel |
| Phase 15 prod | Live keys + webhook — `U-OPS-02` |

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
