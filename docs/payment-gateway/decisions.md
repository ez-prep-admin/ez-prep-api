# Locked Decisions

These decisions were confirmed with the product owner before this pack was written. Implementation sessions must not reopen them without an explicit update here and in [`STATUS.md`](STATUS.md).

Compliance review (2026-10-04) adjusted D-11 numbering to **financial year** and flagged billing address / credit-note ops — see [`unknowns.md`](unknowns.md).

Evidence label: **[Decision]**.

---

## D-01 — Four-domain separation

Separate completely:

1. Academic content (Category → ExamGroup → Exam → MockTest)
2. Commercial products (Product + Offer)
3. Orders / Payments
4. Entitlements → AccessControlService

No special-case code on product names, exam names, or payment provider names in business logic.

---

## D-02 — Soft rollout of access modes

- Existing mock tests (topic-wise, full exam, sprint — all `mocktests` papers) default to `accessMode: FREE`.
- A one-time DB script marks existing papers FREE at rollout (acceptable because this is a greenfield commerce cutover).
- After go-live, admins set papers to `ENTITLED` manually; enforcement is automatic thereafter.
- No mass entitlement migration for existing users.

---

## D-03 — What is sold in v1

| Item | Decision |
| --- | --- |
| Purchase type | One-time only (no recurring Razorpay mandates) |
| Currency | INR only |
| Duration presets | `1M`, `3M`, `6M`, `12M`, `LIFETIME` (admin select, not free-text) |
| Coupons / discount codes | Deferred; keep extension points |
| Credit notes | Deferred |
| Email invoice | Deferred; keep extension points |

---

## D-04 — Product and Offer model

- One **Product**, many **Offers**.
- Each Offer: `{ listAmount, amount/effective, saleAmount?, saleValidFrom?, saleValidUntil?, currency: INR, durationPreset, status }`.
- Constraint: at most one **ACTIVE** Offer per `(productId, durationPreset)`.
- Limited-period sale = same Offer with sale window (list ₹299, sale ₹199), not a second ACTIVE offer for the same duration.
- No permanent dual prices for identical content+duration.
- Bundles are Products with multiple grants — no separate Bundle/Package/Plan collection.
- Grant scopes: `EXAM_GROUP`, `EXAM`, `MOCK_TEST`.
- Product edits that change commercial meaning create a **new version**; existing orders/entitlements keep snapped grants. Forward effect only.

---

## D-05 — Dynamic exam-group access

An `EXAM_GROUP` entitlement is resolved dynamically against the live academic hierarchy. New exams added to that group are covered without migrating user rows. Do not store `purchasedExamIds[]` / `purchasedMockTestIds[]` on User as source of truth.

---

## D-06 — User model

- Do **not** use `User.subscription` or `membershipTier` for authorization.
- Those fields may remain as non-authoritative display/cache later; entitlements are SoT.
- Do not add purchase arrays onto User.

---

## D-07 — Access UX (ezprep-app)

- Keep `/dashboard` exam-by-category listing.
- Do **not** lock users out of exam tabs (overview / topic-wise / full mocks / sprint).
- FREE papers: take normally.
- ENTITLED papers without access: show title/meta + locked affordance + “View plans”.
- Overview tab cleanly indicates when the user lacks a covering subscription; entitled users see no friction.
- `/dashboard/subscriptions` shows the user’s **active entitlements / purchases** (ownership), not only a marketing catalog.
- “View plans” returns any **PUBLISHED** product whose grants cover that exam or mock test (including exam-group packs).

---

## D-08 — Attempt lifecycle vs entitlement

Once an attempt has **legitimately started**, loss/expiry/revocation of entitlement must not invalidate that attempt.

| Operation | Rule |
| --- | --- |
| `startAttempt` | Requires currently valid access |
| Resume / continue `IN_PROGRESS` | Allowed; do **not** re-check entitlement |
| `submitAttempt` | Allowed for already-started attempt; do **not** re-check entitlement |
| New attempt | Requires currently valid access |

Fraud/security/system invariants may still apply. See [`access-control.md`](access-control.md).

---

## D-09 — Stacking

Same product purchased again while an overlapping entitlement is still active: **extend** — new period starts at current `expiresAt` (stack). Lifetime remains lifetime.

**Addendum 2026-10-10:**

- A stacked row grants nothing before its `startsAt`.
- When an earlier purchase in the stack is revoked or refunded, later purchases are re-anchored (D-23).
- A repurchase while covered for life is blocked (D-24).
- Provisioning of one user × product is serialized so that concurrent orders stack back to back.

---

## D-10 — Billing identity

Checkout **always** collects:

- billing **name**
- Indian **state** + **stateCode** (CGST/SGST vs IGST + place of supply)
- billing **address** (line1, optional line2, city, pincode)

Reuse last saved billing profile; allow edit. Address is required (product decision 2026-10-04 for Rule 46 readiness).

---

## D-11 — GST invoices (v1)

| Item | Decision |
| --- | --- |
| Buyer type | B2C only |
| Price basis | GST-inclusive amounts entered by admin (paise; e.g. ₹999 → `99900`) |
| Rate / classification | 18% GST, SAC `999293`, owner-confirmed 2026-10-09 (`U-GST-05`). Central instance `taxConfig` only — **not** per-offer. Edit config if this changes |
| Timing | Generate only after payment `CAPTURED` / order `PAID` |
| Never invoice | Failed, abandoned, cancelled, or expired orders |
| Numbering | `EZPREP/YYYY-YY/####` **Indian financial year** (IST), sequence resets each FY — Rule 46 alignment (`U-GST-09`) |
| Artifacts | **One** GST tax invoice PDF, downloaded in the user app and admin. No second payment-receipt PDF. Owner locked 2026-10-09. Razorpay’s own payment email is a dashboard option, not an app file |
| PDF extras | Place of supply (buyer state); reverse charge = `No` |
| Email | Not in v1 |
| Credit notes | **Not in app v1** — every refund must still get a Zoho/CA credit note (`U-GST-04`) |
| Idempotency | One invoice per order |
| Snapshots | Order + Invoice store tax breakdown and seller/SAC at issue time; never recalculate history from live config |

Required PDF fields and `TaxService.calculateInclusiveTax` — see [`gst-invoicing.md`](gst-invoicing.md).

---

## D-17 — Instance tax / seller config (DB, not hardcoded)

Stable commerce/tax identity lives in **instance-config (or nested commerce config in Mongo)**:

- `taxConfig`: enabled, type GST, rate 18, inclusive prices, currency INR, `sacCode`, `sacDescription`, invoice prefix
- `seller`: legalName, gstin, registeredAddress, state, stateCode (current: Kerala / `32`)

`seller.gstin` may be replaced later if the legal entity changes. Do not freeze `32BIAPD6927L1ZC`, and do not reject a new GSTIN for a checksum or state-prefix mismatch. Seller `state` / `stateCode` stay explicit fields; do not derive them from the GSTIN at runtime. Invoices already issued keep the seller snapshot from issue time.

Do not hardcode SAC `999293` or seller identity in source. Do not make SAC/rate per-product admin fields in v1. Change rate, classification, or GSTIN only via config updates.

---

## D-18 — Environments (no staging)

- Environments: **local** and **production** only. No staging deployment prerequisite.
- Local: Razorpay **test** keys + optional tunnel for webhook E2E; signed fixtures for automated tests.
- Production: Razorpay **live** keys + permanent HTTPS webhook.
- Env var names (both envs): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- Never commit secrets; never send secret/webhook secret to browser/Next.js.

---

## D-19 — Indian states API

Backend owns canonical GST state/UT list. Expose `GET /api/v1/meta/indian-states` → `{ code, name }[]`. Frontends must not maintain a parallel table. Checkout requires state.

---

## D-20 — Launch migration = paper FREE, not user entitlements

- Idempotent script marks existing papers `accessMode: FREE`.
- Existing users do **not** get blanket paid entitlements.
- After go-live, admins mark papers `ENTITLED` / sell via products; access follows entitlements.
- Optional explicit migration manifest for exceptions only; never hardcode user IDs in app logic.

---

## D-12 — Refunds

- No refund option in user UI.
- Admin initiates **full** refund only (no partial amount in v1).
- On successful refund: **always revoke** entitlements sourced from that order.

---

## D-13 — Backend authority

Frontend never authoritative for amount, grants, payment status, or access. Clever UI bypass must receive a clear backend denial (e.g. entitlement required) on `startAttempt` and other protected operations.

---

## D-14 — Payment provider abstraction

- Business logic never imports Razorpay SDK.
- `PaymentGateway` port + registry; `RazorpayGateway` is the first adapter; FakeGateway for tests.
- Frontend checkout uses a provider-neutral `CheckoutService` + adapter registry.

---

## D-15 — Engineering quality bar

Scalable structure, separation of concerns, proper design patterns, and best engineering practices are **strict and non-negotiable** on API and both frontends. Automated tests required for `ez-prep-api` and `mock-app-admin` at each relevant phase. `ezprep-app` uses manual checklists (no test infra).

---

## D-16 — Enforcement feature flag

Access enforcement supports temporary modes:

- `LEGACY` — resolver may allow when no entitlement (migration safety)
- `ENFORCED` — deny without FREE or matching entitlement

Default during build: `LEGACY` until phase 15. There must eventually be no hidden “no entitlement → allow” path.

---

## D-21 — Non-blocking compliance TODOs + STATUS confirmation

- CA/ops unknowns that are not schema-critical **must not block** phase coding. Track them in [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md) and mark code with `TODO(golive): <id>`.
- Bake in now (not TODO): billing address, paise + tax snapshots, FY invoice series, POS + RCM on PDF, config-driven seller/SAC, idempotent invoices, core commerce/access architecture — see GOLIVE_TODOS “must NOT be deferred”.
- Every phase **must** update [`STATUS.md`](STATUS.md) and obtain **explicit developer confirmation** of manual ops before the phase is marked `done`.

---

Owner decisions of **2026-10-10** (D-22…D-29), from [`PRE_RELEASE_REVIEW.md`](PRE_RELEASE_REVIEW.md). Implemented in ad-hoc phases 14A–14E.

## D-22 — Late payments are accepted

- **Rule.** A capture that arrives after the app expired or failed the order is **accepted**. The order becomes `PAID`, is provisioned and invoiced, and is marked `lateCaptureAt`.
- **Proof required.** The `EXPIRED/FAILED → PAID` edge needs provider proof: a signed webhook, a verify that fetched a `captured` payment, or a reconciliation fetch, with amount and currency equal to the order. Every transition is a compare-and-set, and only the winner provisions.
- **Load bound.**
  - The webhook is the primary path.
  - Reconciliation rechecks an expired order on a fixed backoff (1h, 3h, 6h, 12h, 24h, 48h, 72h) for `LATE_CAPTURE_WATCH_HOURS` (default 72): at most 7 provider calls per abandoned order.
  - The client polls at most 5 times after a success callback.
- **No premature `FAILED`.** One failed attempt does not make a Razorpay order `FAILED`.
- **Related rules.** D-11 "never invoice expired orders" still holds, because only `PAID` orders are invoiced. Checkout.js `timeout` closes the modal before the app window ends, to keep late captures rare.
- **Razorpay settings (owner, 2026-10-10).** Automatic capture with no admin step, and late-authorized payments **captured automatically**, not auto-refunded. If Razorpay refunds a late authorization anyway, the order stays unpaid, and the refund event is ignored without revoking anything.

## D-23 — Refunding an earlier purchase moves later purchases to now

- **Rule.** When `PAYMENT` entitlements of an order are revoked (refund, admin revoke, external refund), every later stacked purchase of the same user × product is re-anchored. It starts at `max(now, end of remaining earlier coverage)` with its **full original duration**.
- **Mechanics.** It needs `durationPreset` stored on the entitlement. It runs under the per user × product lock and is written compare-and-set on the old `startsAt`. A start only ever moves earlier. Each moved purchase writes `ENTITLEMENT_REANCHORED`.
- **Exclusions.** `ADMIN_GRANT` rows are never moved.

## D-24 — Repurchase while covered for life is blocked

- **Rule.** Checkout returns 409 `ALREADY_COVERED` when every grant of the product's published version is already covered for life by an active entitlement of the user, from any source, scope-matched as access matches. A version that adds an uncovered scope is purchasable.
- **Catalog.** Exposes `coveredForLife` and `ownedUntil`, so the UI hides Buy.
- **Race.** If coverage appears between create and payment, the paid order still provisions. It is marked `redundantPurchase` and listed in health for an admin refund.

## D-25 — Invoice date is the payment date

- **Rule.** `issuedAt = order.paidAt`, always, including invoices issued late by a repair sweep, queue retry, or admin repair. The FY series is taken from `paidAt` in IST.
- **Numbering.** Numbers are allocated at issue time, so the series stays gap-free. A repaired invoice may carry a higher number than an invoice dated after it (`U-GST-13`, CA-accepted 2026-10-10).

## D-26 — GST supply type and equal intra-state split

- **Seller state.** Per instance, from instance config. EZ Prep is registered in **Kerala** (`32`). ExamFlex uses its own GSTIN's state, and the same rule applies with its state code.
- **Rates.** A buyer whose billing state code equals the seller's is **intra-state**: CGST `rate/2` + SGST `rate/2`, which is 9% + 9%, in **equal paise**. Any other state is **inter-state**: IGST at the full rate (18%).
- **Rounding.** `half = round_half_up(gross × rate / (2 × (100 + rate)))`, `taxable = gross − 2 × half`. Inter-state keeps `taxable = round_half_up(gross × 100 / (100 + rate))`.
- **Snapshot.** The order snapshots `supplyType`, `sellerStateCode`, and `buyerStateCode`. The invoice copies the supply type and refuses to issue if the live seller state differs from the order's.
- **Address.** The EZ Prep seller registered address on new invoices is `Kerala`. The CA accepted this and the rounding (`U-GST-11`, `U-GST-12`, 2026-10-10).
- **History.** Existing snapshots are never recalculated.

## D-27 — Production commerce config fails closed

- `COMMERCE_ENABLED` (default `false`) gates checkout, verify, me/orders, me/invoices, webhook, and the schedulers, so a `main` deploy to an instance without commerce env is inert.
- It is independent of `ACCESS_ENFORCEMENT_MODE`. The first says whether the instance can **sell**; the second says whether `ENTITLED` papers **require** a purchase.
- With it on in production, boot fails unless:
  - the provider is exactly `razorpay` with all keys, and the key id is `rzp_live_`
  - `INSTANCE_ID` and `INSTANCE_NAME` are set
  - `INVOICES_ENABLED` and `RECONCILIATION_ENABLED` are `true`
  - the enforcement mode parses
- The fake gateway does not exist in production. An unknown provider is an error, never a fallback.
- `trust proxy` is set by `TRUST_PROXY_HOPS`: `1` in production, because nginx is the only proxy (confirmed 2026-10-10).

## D-29 — ExamFlex sells on the same code, with its own seller identity

- **Same code, own data.** Both instances run the same commerce code and configuration shape. Each has its own database, seller identity, GSTIN, invoice series prefix, Razorpay keys, webhook URL on its own API host, and invoice bucket or prefix.
- **Seeding.** Seller and tax values come only from the per-instance seed file, which refuses to write to another instance's database (14E).
- **Provider tagging.** Razorpay orders carry `notes.instanceId`. A webhook event tagged for the other instance is ignored at once, so the instances may share one Razorpay account or use separate ones.
- **Display name.** The payment modal shows the instance name (`INSTANCE_NAME`).
- **No Redis in the money path.** Invoices and schedulers behave the same with or without Redis. EZ Prep has Redis; ExamFlex does not.
- **ExamFlex switch-on.** ExamFlex enables `COMMERCE_ENABLED` only once its web deployment shows ExamFlex branding, terms, and support contact (`U-OPS-04`).

## D-28 — Duplicate captures are refunded automatically

- **Rule.** A second captured payment on an order that is already paid is recorded as a `DUPLICATE` payment (idempotent on the provider payment id) and refunded automatically through a `DUPLICATE_CAPTURE` refund keyed by that payment.
- **No change to the order.** The order, its entitlements, and its invoice are untouched. A duplicate is a payment error, not a purchase.
- **Uniqueness.** Refund uniqueness is one refund per payment.
