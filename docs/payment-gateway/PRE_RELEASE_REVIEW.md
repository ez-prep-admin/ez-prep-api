# Pre-release review — commerce, entitlements, payments

**Date:** 2026-10-10 (revision 4, final before implementation: all owner questions answered, ExamFlex selling, PR-35…PR-40, legal copy locked, single go-live guide) · **Scope:** phases 00–14 as shipped (`ez-prep-api` @ `dcc353d`, `ezprep-app` @ `b0b1146`, `mock-app-admin` @ `b83d552`)

Related: [`STATUS.md`](STATUS.md) · [`decisions.md`](decisions.md) D-22…D-28 · [`state-machines.md`](state-machines.md) · [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md) · [`risk-register.md`](risk-register.md) · [`E2E_TEST_STATUS.md`](E2E_TEST_STATUS.md)

---

## TL;DR

The architecture is sound: four separated domains, a provider port with the SDK isolated, integer paise, grant and tax snapshots on the order, idempotent provisioning, one invoice per order, a gap-free FY invoice series, and a single access authorizer. Commerce Jest is green (53 suites, 323 tests; `npx jest --config jest.config.js`).

The gaps are in **money-path robustness**. Three are release-blocking:

1. **The payment provider fails open to the fake gateway** (PR-01).
2. **A capture that arrives after the app expired or failed the order is lost.** The customer has paid and has no access (PR-02). A webhook that keeps failing gets the endpoint disabled after 24 hours (verified Razorpay policy, below).
3. **Two concurrent replays of a new order can open two Razorpay orders** (PR-03).

The root cause behind several races is that **no state transition is atomic** (PR-04).

GST place of supply is **already correct** in principle: Kerala buyers get CGST + SGST, every other state gets IGST, decided from the seller and buyer state codes. Two details need fixing: an odd-paise tax splits 9% / 9% unequally by one paisa (₹76.19 / ₹76.20 on ₹999), and the supply type is inferred rather than stored (PR-29, PR-30).

Plan: five ad-hoc phases, **14A → 14E → 14B → 14C → 14D**, then phase 15 (launch copy and LEGACY guard) and phase 16 (local manual pass). Every finding and every agreed item maps to a phase section (see [Traceability](#traceability-every-agreed-item--phase-section)). After those, go-live is production configuration only, run from [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md).

---

## Inputs confirmed by the owner (2026-10-10)

| Topic | Fact | Effect |
| --- | --- | --- |
| Late payments | Accept and give access. No races, no heavy polling | D-22; 14B, 14C |
| Refund of an order that a later purchase extends | Move the later purchase to start now | D-23; 14A |
| Buying again while already covered for life | Block with an error | D-24; 14A, 14D |
| Invoice date when issued late by a repair | Payment date | D-25; 14C |
| `api.ezpre.in` | Behind an nginx reverse proxy | PR-18 is confirmed, and likely already live (see PR-18) |
| Razorpay webhook policy | Failed deliveries are retried with exponential backoff. A webhook whose delivery keeps failing for 24 hours is disabled automatically and must be re-enabled manually in the Dashboard after the cause is fixed | PR-05 retry window, PR-34 visibility, `GO_LIVE_GUIDE.md` Playbook P1 |
| GST | Seller registered in Kerala (`32`). Inside Kerala: CGST 9% + SGST 9% split equally. Other states: IGST 18% | D-26; 14E |
| Seller address on invoice | `Kerala` (was `Kochi, Kerala`) | 14E; GOLIVE `U-GST-11` |

### Owner answers (2026-10-10, revision 3); no open questions remain

| # | Question | Answer | Effect on the plan |
| --- | --- | --- | --- |
| Q1 | nginx headers and what sits in front | Nothing in front of nginx (no Cloudflare). Owner will update nginx at go-live | `TRUST_PROXY_HOPS=1` (14A). The nginx header lines are a go-live step (`U-OPS-03`) |
| Q2 | Razorpay Payment Capture settings | Automatic, no admin intervention. Late payments handled to the standard | Go-live setting (`U-OPS-02`): **automatic capture**, and late-authorized payments **captured automatically** (not auto-refunded), which matches D-22. Verify tolerates the seconds between authorize and auto-capture (14B §4). If Razorpay ever refunds a late authorization instead, the order simply stays unpaid (14C §6) |
| Q3 | Other uses of the Razorpay account | None. All actions go through the admin app; nobody acts in the Dashboard (except webhook settings) | External-refund handling stays as a cheap safety net, not a workflow. Lookup through the payment id is still needed for the race where `refund.processed` arrives before the app saved the refund id (14C §6) |
| Q4 | Will ExamFlex sell | Yes. Same configuration, with its own seller identity and GSTIN | `COMMERCE_ENABLED=true` on both instances. Per-instance seed (PR-36), instance-tagged Razorpay notes (PR-37), merchant name from the instance (PR-35); D-29 |
| Q5 | `REDIS_URL` in production | Set for EZ Prep, not for ExamFlex (can be added) | Invoice issuance and scheduler locking **do not use Redis** on either instance. One code path everywhere: in-process trigger after commit + sweep (14C §8–§9). Redis stays optional |
| Q6 | Production commerce data | None; commerce code is not in production | Every backfill and index change runs against local data only. Production boots onto empty collections |
| Q7 | CA on the `Kerala` address, equal-split rounding, date vs number order | All accepted and verified by the CA | `U-GST-11`, `U-GST-12`, `U-GST-13` closed |

---

## How this review was done

- Read the whole pack, the STATUS session logs, GOLIVE, and the phase 15/16 files.
- Read the money path in the API end to end, including every commerce controller's guards and the `startAttempt` gate.
- Read the student checkout, the Razorpay adapter and subscriptions page, and the admin proxy, session cookie, and order/refund page.
- Checked deployment: one PM2 fork per droplet; push to `main` deploys **both** EZ Prep and ExamFlex; `.env.example`.
- Revision 2: re-read `calculate-inclusive-tax.ts`, `tax.service.ts`, the PDF tax rows, the seed script, and every doc mentioning the seller address; checked test tooling (`mongodb-memory-server` and `supertest` are already dev dependencies; `test/jest-e2e.json` exists).
- Revision 3: checked what ExamFlex selling touches.
  - The seed script hardcodes the EZ Prep seller.
  - The Razorpay modal `name` is hardcoded.
  - The ExamFlex web app is the same ezprep-app codebase on a second Vercel project (`EZ_PREP_MULTI_INSTANCE_ARCHITECTURE_PLAN.md`).
  - `instance-config` is admin-only.
  - The admin proxy already allows every `admin/*` route, so the new admin endpoints need no proxy change.
  - Read the app Terms and Privacy pages.

Severity: **Critical** = loses customer money or gives away paid access in normal production use. **High** = likely stuck order, wrong grant, or support incident at real volume. **Medium** = correctness or operability gap with a workaround. **Low** = hygiene.

---

## What is solid (keep as is)

| Area | Why it holds |
| --- | --- |
| Domain separation | No product, exam, or provider names in business logic. The Razorpay SDK is imported in one file. |
| Server-side pricing | Amount comes from the offer; `forbidNonWhitelisted` rejects a client amount; Razorpay create checks the returned amount. |
| Signatures | Checkout and webhook HMACs use `timingSafeEqual` with a length guard; the webhook needs an event id; `rawBody` is enabled. |
| Idempotent provisioning | Unique `provisioningKey` per order × grant × version; `provisionedAt` set last. |
| Invoices | Unique `orderId` and `invoiceNumber`; the sequence is allocated at insert, so a lost race retries and does not burn a number; seller/SAC snapshotted; FY computed in IST. |
| GST place of supply | `sellerStateCode === buyerStateCode` → CGST + SGST, else IGST; the PDF prints "CGST @ 9%" / "SGST @ 9%" or "IGST @ 18%", the place of supply, and reverse charge "No". |
| Access | One authorizer, batch resolution, FREE always allowed, D-08 respected. Question bodies are admin-only. |
| AuthZ | Every `admin/*` route has JWT + ADMIN role; every `me/*` and checkout read is owner-scoped and returns 404 for another user's id. |
| Admin proxy | Path allowlist, traversal checks, httpOnly `SameSite=Lax` cookie. |

---

## Findings

### Critical

#### PR-01 — Payment provider fails open to the fake gateway

**Where:** `payment-gateway.registry.ts` L15–33, `payments.module.ts` L17–19, `fake.gateway.ts` L83–100, `.env.example` L45–47.

`registry.get()` falls back to `fake` when `PAYMENT_PROVIDER` is blank. `FakeGateway` is always registered and returns `CAPTURED` for any non-empty `fakePaymentId`. Razorpay keys are validated only when `razorpay` is selected, and the verify DTO accepts `provider: 'fake'`. A production boot without the variable (new droplet, reset env, a typo, or ExamFlex, which the same `main` push deploys) lets any logged-in user call create, then verify with `{ provider: 'fake', providerPayload: { fakePaymentId: 'x' } }`, and receive entitlements and a real GST invoice number.

**Fix → 14A:** production refuses to boot unless the provider is exactly `razorpay`; `fake` cannot be resolved or requested in production; an unknown provider is an error, never a fallback.

#### PR-02 — Late capture on an `EXPIRED` or `FAILED` order is unrecoverable

**Where:** `order-transitions.ts` L10–23, `payment-transitions.ts` L10–20, `orders.service.ts` L208–254, `razorpay-webhook.service.ts` L137–148, `reconciliation.service.ts` L112–118.

The app window is 30 minutes, reconciliation expires at 60, and one failed attempt makes reconciliation mark the order `FAILED`. A Razorpay order has no expiry and keeps accepting attempts: a modal left open, UPI or netbanking completing late, or a retry inside the modal. When the capture lands, `markOrderPaid` throws an illegal transition. Verify returns 500 to a customer who has just paid. The webhook returns 500 on every retry, and Razorpay disables the endpoint after 24 hours of failures, which breaks payment confirmation for everyone until someone re-enables it by hand.

**Fix → 14B (transitions, verify) + 14C (late-capture watch):** D-22.

#### PR-03 — Concurrent replay of a `CREATED` order opens two provider orders

**Where:** `checkout.service.ts` L49–90 and L155–191, `orders.service.ts` L171–200, `payment.schema.ts` L63.

Request A inserts `CREATED`. Request B with the same key replays, sees `CREATED`, and also calls `gateway.createOrder`. Both `markPendingPayment` saves succeed; the last `providerOrderId` wins, and two `payments` rows can exist (`orderId` is not unique). The client holding the losing id pays an order the database no longer has. Verify then says "Payment does not match", the webhook can't find the order, and reconciliation expires it.

**Fix → 14B:** atomic claim before calling the provider; unique primary payment per order; `notes.orderId` on every Razorpay order.

### High

#### PR-04 — No atomic state transitions

Every transition is read → mutate → `save()` with `versionKey: false`. Races that exist today:

- Reconciliation expiry overwrites `PAID` with `EXPIRED`. Entitlements and the invoice remain, and the order can no longer be refunded.
- Verify, `payment.captured`, and `order.paid` all run the paid handler at once.
- Refund POST and `refund.processed` both settle, and the loser throws.
- Two refund retries both call the provider.

**Fix → 14B:** a compare-and-set helper; side effects run only for the winner.

#### PR-05 — Webhook returns 500 forever on unresolvable events

**Where:** `razorpay-webhook.service.ts` L118–148, L164–197.

"Order not found", "Refund not found", and any `markOrderPaid` exception return `retry: true`. A payment the app did not create, a PR-03 orphan, a PR-02 late capture, or a dashboard refund never heals. Under the verified 24-hour rule, such a stream gets the endpoint disabled.

**Fix → 14C:** bounded retry window (default 30 minutes, far inside 24 hours), then 200 with a recorded failure; lookup fallbacks; health visibility.

#### PR-06 — Refund outcome ambiguity and refunds made outside the app

**Where:** `refunds.service.ts` L264–277, L332–383, L510–548.

A provider timeout after Razorpay created the refund marks the row `FAILED` with no id. The retry is rejected, the real `refund.processed` misses the lookup, and the customer is refunded **and keeps access**. A dashboard refund never revokes access and loops on the webhook.

**Fix → 14C:** an unknown-outcome state resolved by listing refunds for the payment; webhook fallback through `payment_id`; external refunds recorded and settled.

#### PR-07 — Published product grants are edited in place and sold unversioned

**Where:** `products.service.ts` L134–156, `checkout.service.ts` L223–259.

`update` edits grants on a `PUBLISHED` product without validation; checkout snapshots the live grants under the old version number. Zero grants can be sold: the customer pays and receives nothing, and the order still invoices.

**Fix → 14A:** checkout and catalog read the frozen `product_versions` row; zero grants are not purchasable.

#### PR-08 — No repair path for paid orders that did not provision or invoice

Repair is "the next paid signal". After verify has returned and webhook retries stop, a `PAID` order with `provisionedAt` unset stays stuck. If production forgets `INVOICES_ENABLED`, every paid order is silently left without an invoice.

**Fix → 14A (boot guard) + 14C (sweeps) + 14D (admin action).**

#### PR-09 — Invoice PDF and S3 upload run inside the payment request

The paid handler renders the PDF and uploads it to S3 inside verify and the webhook. A slow S3 call means slow webhook acknowledgements. A failed upload makes verify throw after entitlements exist: "Payment could not be confirmed" for a customer who has access.

**Fix → 14C:** invoicing becomes best effort after provisioning, via queue or sweep; verify never fails because of invoicing.

#### PR-10 — Verify marks the payment captured from the signature alone

The `order_id|payment_id` HMAC proves Razorpay authored the callback, not that the payment is `captured` or the amount right. With manual or delayed capture, access and a GST invoice are granted for an `authorized` payment that may be auto-refunded.

**Fix → 14B:** fetch the payment and require captured + matching order id and amount; also record the capture setting (Q2).

#### PR-11 — Student checkout gives up when one attempt fails inside the modal

The adapter settles on the first `payment.failed`, but Razorpay keeps the modal open for retries. A later success is ignored (verify never called), the page shows a failure, and a second modal can open.

**Fix → 14D.**

#### PR-33 — A second captured payment on the same order is unhandled (new)

Late-authorized payments can produce a second captured payment on an order that is already `PAID`. `markOrderPaid` treats it as a repeat and keeps the first payment id. The extra money is kept with nothing delivered, and nothing records it.

**Fix → 14B (duplicate payment row) + 14C (auto-refund of the duplicate).** D-28.

#### PR-36 — The tax seed writes EZ Prep's seller identity into any database (new, revision 3)

**Where:** `scripts/seed-local-tax-config.ts` L22–39 hardcodes `legalName`, GSTIN `32BIAPD6927L1ZC`, address, state, and prefix `EZPREP`. The admin app has no seller form, and `PUT /instance-config` is the only other path.

ExamFlex sells with its own seller and GSTIN (Q4). Running the documented go-live seed (`U-OPS-01`) against the ExamFlex database would issue ExamFlex invoices under EZ Prep's GSTIN and series.

**Fix → 14E:** a per-instance seed file that refuses to run against a database of another instance.

#### PR-39 — Terms describe a billing model the product does not have (new, revision 3)

**Where:** `ezprep-app/app/terms/page.tsx` L135–164 (Subscriptions and payments), L242–250 (Cancellation), L252–263 (Refunds).

The Terms promise or describe:

- "monthly or annual subscriptions"
- payment through Apple or Google
- a free trial that "may automatically convert to a paid plan" and charges "the payment method on file"
- "Automatic renewal … recurring billing"

What ships is one-time web payments through Razorpay for a fixed period or lifetime, with no renewal, no stored cards, and no trials (D-03, D-09). Checkout shows no terms link and no "does not renew" line. The same page is served on ExamFlex's site, with EZ Prep's name and support address.

Charging under terms that describe a different billing model is a consumer-protection and payment-gateway compliance risk.

**Fix → 14D:** rewrite those sections to match the product; add a consent line and a "one-time payment, no auto-renewal" line at checkout. The wording is locked in [`LEGAL_COPY.md`](LEGAL_COPY.md).

#### PR-40 — Legal entity and grievance details on the site do not match the seller (new, revision 4)

**Where:** `ezprep-app/app/terms/page.tsx` L52–58 (General) and L345–366 (Grievance redressal).

- The Terms name the operator as "EzPrep Technologies Pvt. Ltd., Kochi". The CA-verified invoices name the seller as "EzPrep - Powered by Clustream", Kerala (`U-OPS-01`). A buyer would see one legal entity on the site and another on the tax invoice.
- The grievance block has a designation but no officer name and no customer-care phone. Consumer Protection (E-Commerce) Rules, 2020, rule 4(2) and 4(4) require the legal name, principal address, customer-care contact details, and the grievance officer's name and designation.
- The block is hardcoded, so the ExamFlex site would show EZ Prep's entity.

**Fix → 14D §10:** seven per-deployment public values (`LEGAL_COPY.md`), with the legal name required to equal the seed file's `legalName`. The officer name and phone are go-live inputs (`GO_LIVE_GUIDE.md` step 1).

### Medium

| ID | Finding | Fix |
| --- | --- | --- |
| PR-12 | `ACCESS_ENFORCEMENT_MODE` is not trimmed; any unknown value means `LEGACY` | 14A |
| PR-13 | Reconciliation selects the 50 oldest pending orders every pass; permanently skipped orders block everything newer. `CREATED` orders are never expired | 14C |
| PR-14 | `RECONCILIATION_ENABLED` defaults to `false` and controls both order and refund reconciliation; the bare `setInterval` has no overlap guard | 14A (boot), 14C (scheduler) |
| PR-15 | Access ignores `startsAt`, so a stacked purchase grants from now; refunding the anchor leaves policy undefined | 14A (D-23) |
| PR-16 | Repurchase while lifetime-covered is charged for nothing; concurrent provisioning of two orders of one product loses a period | 14A (D-24), 14D (UI) |
| PR-17 | Idempotency replay ignores the request body; the client key ignores `offerId` and survives plan switches | 14B (API), 14D (client) |
| PR-18 | No `trust proxy` behind nginx: every client has nginx's IP, so the global 100/min and checkout 10/min limits are **shared by all users**. This already applies to every production endpoint today (including OTP), so check nginx/PM2 logs for 429s. No cap on open orders per user | 14A |
| PR-19 | No operational visibility; per-paper `LEGACY_ALLOW` / `ENTITLEMENT_REQUIRED` warnings flood logs on every list request | 14C (API), 14D (admin) |
| PR-20 | Merge to `main` deploys commerce to EZ Prep **and** ExamFlex with whatever env each has | 14A (`COMMERCE_ENABLED`) |
| PR-29 | Intra-state split is unequal on odd-paise tax (₹999 → CGST 76.19 / SGST 76.20) where the owner expects equal 9% / 9% (new) | 14E (D-26) |
| PR-30 | Supply type is not stored. The PDF picks its layout from `igst > 0`. The seller state used at checkout is not snapshotted on the order, so a seller-state edit between payment and invoice could pair a CGST/SGST split with a seller block from another state (new) | 14E |
| PR-34 | A wrong `RAZORPAY_WEBHOOK_SECRET` makes every delivery 400; under the 24-hour rule the endpoint is disabled with no signal anywhere (new) | 14C (health), runbook |
| PR-37 | If ExamFlex and EZ Prep ever share one Razorpay account, each instance's webhook receives the other's events. Today those take the "order not found" path (retry, then 500). Razorpay `notes` carry no instance tag (new, revision 3) | 14B (`notes.instanceId`), 14C (ignore other instance first) |

### Low

| ID | Finding | Fix |
| --- | --- | --- |
| PR-21 | `GET /admin/invoices` is unpaginated | 14C |
| PR-22 | Invoice date is issue time; a delayed repair can date it in the next FY | 14C (D-25: payment date) |
| PR-23 | Offer allows `saleAmount > listAmount` and an inverted sale window | 14A |
| PR-24 | Checkout aborts payment if saving the billing profile fails after the order exists | 14D |
| PR-25 | A direct `MOCK_TEST` grant is not honored when the paper's exam row is missing | 14A |
| PR-26 | Drift: `.env.example` lists two of the four webhook events; two Jest configs make bare `npx jest` fail; the phase 10 file still describes calendar numbering | 14A |
| PR-27 | Retention: no versioning or lifecycle guidance for the invoices bucket; admin hard delete is allowed for users with paid orders | 14A (hard delete), `GO_LIVE_GUIDE.md` Step 5 (bucket) |
| PR-28 | Any admin can refund with one click plus a reason | 14D (type the order number to confirm) |
| PR-31 | The buyer never sees the GST breakdown before paying; admin order detail shows no tax (new) | 14E |
| PR-32 | Seller address should read `Kerala` (owner request, new) | 14E |
| PR-35 | Razorpay modal merchant name is hardcoded `'EzPrep'` (`ezprep-app/lib/checkout/adapters/razorpay.ts` L111). ExamFlex buyers would see EZ Prep (new, revision 3) | 14E (API sends the instance name; app uses it) |
| PR-38 | A `refund.processed` for a payment on an order that never became `PAID` (Razorpay refunding a late authorization, or an uncaptured payment) has no defined handling. It must not revoke anything or retry (new, revision 3) | 14C §6 |

---

## Late-payment design (D-22), in one place

Goal: every provider-proven capture ends as exactly one paid order, with no races and bounded load.

1. **Atomic transitions (14B).** `PENDING_PAYMENT | EXPIRED | FAILED → PAID` is one conditional update. Only the winner provisions. `EXPIRED/FAILED → PAID` is allowed only with provider proof: a signed webhook, a verify that fetched a `captured` payment, or a reconciliation fetch, with amount and currency matching. The order gets `lateCaptureAt` and an `ORDER_LATE_CAPTURE` audit row.
2. **Push first (14C).** The webhook is the primary late path and costs nothing extra. Lookup falls back to `notes.orderId` (set at order create in 14B).
3. **Bounded pull (14C).** An `EXPIRED` order gets `lateWatchUntil = expiredAt + LATE_CAPTURE_WATCH_HOURS` (default 72). Reconciliation rechecks it on a backoff schedule of 1h, 3h, 6h, 12h, 24h, 48h, 72h: at most 7 provider calls per abandoned order, ever. Selection is an indexed query on `{ status, nextReconAt }` with a batch limit, so load scales with abandoned orders and not with traffic.
4. **No premature `FAILED` (14B).** A Razorpay order has no terminal failed state, so reconciliation stops marking orders `FAILED` after one failed attempt. They go to `EXPIRED` at the age window and stay under the late watch.
5. **Fewer late captures (14D).** Checkout.js `timeout` closes the modal before the app window ends.
6. **Duplicates (14B + 14C).** A second captured payment on a `PAID` order becomes a `DUPLICATE` payment row (idempotent on the provider payment id). It is auto-refunded through a refund row keyed by that payment. The order and entitlements are untouched, and health counts it.
7. **Client (14D).** After a success callback the page never says "failed". If verify fails it polls the order with backoff (2s, 4s, 8s, 16s, 30s): five reads, not a tight loop.

---

## GST and seller-address verification (revision 2)

| Check | Result |
| --- | --- |
| Intra vs inter-state decided from seller and buyer state | **Correct.** `calculate-inclusive-tax.ts` L47–50 compares `sellerStateCode` (config, `32`) with the buyer `stateCode` from checkout |
| Kerala buyer → CGST 9% + SGST 9% | **Correct labels, unequal amounts on odd tax.** PDF prints `CGST @ 9%` / `SGST @ 9%` (`render-tax-invoice-pdf.ts` L382–384). ₹999 gives 7619 / 7620 paise (PR-29) |
| Other state → IGST 18% | **Correct.** PDF prints `IGST @ 18%` when `igst > 0` (L378–380) |
| Place of supply and reverse charge on PDF | **Present** (L119–120) |
| Supply type persisted | **No** (PR-30) |
| Seller address | `Kochi, Kerala` in `scripts/seed-local-tax-config.ts` L37, the local Mongo row, and five docs. Issued invoices keep their snapshot and are not rewritten (PR-32) |
| Shown to the buyer before paying | **No** (PR-31) |

Equal-split rule chosen for 14E (D-26): `half = round_half_up(gross × rate / (2 × (100 + rate)))`, `cgst = sgst = half`, `taxable = gross − 2 × half`. Interstate stays `taxable = round_half_up(gross × 100 / (100 + rate))`, `igst = gross − taxable`. ₹999 intra → taxable 846.62, CGST 76.19, SGST 76.19. ₹999 inter → taxable 846.61, IGST 152.39. The one-paisa difference in taxable value between the two cases is inherent to paise rounding of an inclusive price. It applies to new orders only; existing snapshots are never recalculated.

---

## Coverage matrix (every finding has an owner)

| Phase | Findings |
| --- | --- |
| [14A](phases/phase-14a-fail-closed-config-and-catalog-integrity.md) Fail-closed config, catalog and entitlement integrity | PR-01, 07, 08 (boot), 12, 14 (boot), 15, 16, 18, 20, 23, 25, 26, 27 (hard delete) |
| [14E](phases/phase-14e-gst-supply-type-and-seller-address.md) GST, seller identity, per-instance commerce | PR-29, 30, 31, 32, 35, 36 |
| [14B](phases/phase-14b-payment-state-integrity.md) Payment state integrity | PR-02 (transitions, verify), 03, 04, 10, 17 (API), 33 (rows), 37 (notes) |
| [14C](phases/phase-14c-webhook-refund-repair-robustness.md) Webhook, refund, and repair robustness | PR-02 (late watch), 05, 06, 08 (sweeps), 09, 13, 14 (scheduler), 19 (API), 21, 22, 33 (refund), 34, 37 (ignore), 38 |
| [14D](phases/phase-14d-checkout-client-and-admin-ops.md) Checkout client, terms, and admin ops | PR-08 (admin action), 11, 16 (UI), 17 (client), 19 (admin page), 24, 28, 39 |
| [Phase 15](phases/phase-15-rollout-hardening.md) runbook | PR-27 (bucket retention), PR-34 (re-enable procedure), capture settings, nginx headers, merge and enable order (PR-20), production smoke |

## Traceability (every agreed item → phase section)

Every item below has a numbered section in a phase file with acceptance criteria and tests. "Agreed" covers the findings, the owner decisions, the owner facts, and the simplifications made in revision 3.

| Item | Where it is implemented |
| --- | --- |
| Commerce regression harness before any change | 14A §0 |
| Production fail-closed config; `COMMERCE_ENABLED` (D-27) | 14A §1 |
| Fake gateway unreachable in production (PR-01) | 14A §2 |
| Frozen product version at checkout and in catalog (PR-07) | 14A §3 |
| `startsAt` enforced; `durationPreset` stored (PR-15) | 14A §4 |
| Refunded anchor → later purchases start now (D-23) | 14A §4 re-anchor; called from 14B §7 settle and 14C §6 external refunds |
| Lifetime repurchase blocked with `ALREADY_COVERED` (D-24, PR-16) | 14A §5 (API), 14D §4 (UI) |
| Concurrent provisioning stacks back to back (PR-16) | 14A §6 |
| `trust proxy` = 1 for nginx (PR-18, Q1) | 14A §7; nginx header lines in `U-OPS-03` |
| Open-order cap, per-user checkout throttle (PR-18) | 14A §7 |
| Offer validation, MOCK_TEST match, hard-delete refusal, env and Jest drift (PR-23, 25, 26, 27) | 14A §8 |
| Equal CGST 9% + SGST 9%, IGST 18% (D-26, PR-29) | 14E §1 |
| Supply type and seller state snapshotted; PDF by supply type (PR-30) | 14E §2 |
| Seller address `Kerala` (PR-32) | 14E §3 |
| GST breakdown for buyer and admin (PR-31) | 14E §4 |
| Per-instance seed; ExamFlex seller and GSTIN (PR-36, D-29) | 14E §5 |
| Merchant name from the instance (PR-35, D-29) | 14E §6 |
| Atomic transitions everywhere (PR-04) | 14B §1 |
| One provider order per checkout; `notes` with `instanceId` (PR-03, PR-37) | 14B §2 |
| Idempotency compares the request (PR-17) | 14B §3 (API), 14D §3 (client) |
| Verify proves capture; tolerates auto-capture delay (PR-10, Q2) | 14B §4 |
| Late payments accepted with proof (D-22, PR-02) | 14B §5 (edges), 14C §3 (watch), 14D §1–§2 (client) |
| Duplicate captures recorded and refunded (D-28, PR-33) | 14B §6 (rows), 14C §5 (refund) |
| Refund claim and settle atomic (PR-04) | 14B §7 |
| Webhook never 5xx past 30 minutes; other-instance events ignored (PR-05, PR-37) | 14C §1 |
| Webhook-disable visibility (PR-34, verified 24-hour policy) | 14C §2 (API), 14D §7 (admin), `GO_LIVE_GUIDE.md` Playbook P1 (re-enable) |
| Pending-order backoff, `CREATED` expiry (PR-13) | 14C §4 |
| Refund unknown outcome, payment-id fallback, refund on an unpaid order (PR-06, PR-38) | 14C §6 |
| Repair sweeps + admin repair (PR-08) | 14C §7 (API), 14D §8 (admin) |
| Scheduler overlap guard (PR-14) | 14C §8 |
| Invoice off the request, no Redis needed, dated at payment (PR-09, PR-22, D-25, Q5) | 14C §9 |
| Health read model; per-paper log noise (PR-19) | 14C §10 (API), 14D §7 (admin) |
| Admin invoice paging (PR-21) | 14C §11 |
| Modal lifecycle, Checkout.js timeout (PR-11) | 14D §1 |
| Bounded client polling (D-22) | 14D §2 |
| Billing profile never blocks payment (PR-24) | 14D §5 |
| Refund requires typing the order number (PR-28) | 14D §9 |
| Terms, privacy, and checkout consent match the product (PR-39) | 14D §10; wording locked in `LEGAL_COPY.md` |
| Legal entity, address, support and grievance contacts per deployment (PR-40) | 14D §10; values in `GO_LIVE_GUIDE.md` step 1 |
| App hides Buy when the API has commerce off | 14D §10 |
| Admin health answers while commerce is off | 14C §10 |
| Invoice bucket retention (PR-27) | Phase 15 runbook |
| Razorpay automatic capture + late-authorization capture (Q2) | `GO_LIVE_GUIDE.md` Step 3 |
| "Free Early Access" copy, LEGACY gate, ENFORCED soak | Phase 15 (unchanged scope) |
| Full manual pass incl. every 14A–14E row and a second-instance smoke | Phase 16 |

Order: **14A → 14E → 14B → 14C → 14D → 15 → 16.** 14A is first because PR-01 is cheap and is the only finding a hostile user can exploit without timing luck. 14A also builds the regression harness that every later phase runs. 14E is small and changes the tax snapshot, so it lands before the bigger phases build tests on top of that snapshot. 14C depends on 14B's transition helper.

---

## Compatibility and regression contract (applies to every ad-hoc phase)

The system is stable today. These rules keep it that way.

### 1. Characterization harness first (14A, task 0)

Before any behavior changes, 14A adds `test/commerce/*.e2e-spec.ts`: a full Nest app over `mongodb-memory-server` with `supertest`, the fake gateway, and the Razorpay adapter on a stubbed SDK client with signed webhook fixtures. It pins **current** behavior for:

- create, replay, and verify
- webhook capture, duplicate, and amount mismatch
- provisioning and stacking
- invoice issue and download authorization
- refund processed and pending
- order and refund reconciliation passes
- `startAttempt` FREE/ENTITLED × LEGACY/ENFORCED
- catalog for-exam and for-mock
- `me/*` owner scoping

It must pass on the current code before 14A changes anything. Each later phase may change a pinned expectation **only** if that change is listed in the phase's "Behavior changes" table, in the same change set.

### 2. Gate for every ad-hoc phase

1. API: `npm run test`, `npm run test:e2e` (includes the harness), `tsc -p tsconfig.build.json --noEmit`, ESLint on touched files.
2. Admin: Vitest + `tsc --noEmit` when touched. App: `npm run typecheck` + ESLint on touched files when touched.
3. Concurrency specs that run real parallel calls against `mongodb-memory-server` for every race the phase claims to close. Mocks alone are not enough for these.
4. Boot check: the API boots against a copy of the local database with no index-build errors. Each new unique index has a pre-check that reports duplicates instead of failing the boot (the `PaymentIndexRepair` pattern).
5. Manual smoke, non-commerce included: OTP login; start and submit a FREE paper; admin question edit; J1 (buy → access → invoice) and J5 (refund) in Razorpay test mode; FREE paper under ENFORCED; ENTITLED denied without purchase.
6. STATUS session log lists every pinned expectation that changed, and why.

### 3. Compatibility rules

- **Additive schemas only.** New fields are optional, or defaulted, or backfilled by an idempotent boot repair. No field is renamed or removed. Production has no commerce rows (Q6, confirmed), so backfills touch local data only.
- **API contracts.** New error codes are additive (`details.code`). Existing success shapes keep every field. New fields (`ownedUntil`, `supplyType`, `lateCaptureAt`) are optional on the client.
- **Order of deploy.** API before clients for every phase. The phase 14 app and admin keep working against every intermediate API. The only intended block is `ALREADY_COVERED` (D-24).
- **Non-commerce surface.** Only two changes touch it: `trust proxy` (all throttles become per real client IP, fixing PR-18 for every route) and the per-paper log level. Both are listed in 14A/14C with their effect.
- **Flags stay reversible.** `COMMERCE_ENABLED`, `RECONCILIATION_ENABLED`, `WEBHOOK_RETRY_WINDOW_MINUTES`, and `LATE_CAPTURE_WATCH_HOURS` each turn their behavior off or back toward today's.
- **Scalability bar.** Every new query is indexed and batched. Every scheduler pass is bounded (batch limits, backoff, overlap guard). No per-request provider calls are added except `fetchPayment` in verify (at most 3 when auto-capture lags). Locks are per user × product and short-lived.
- **Same behavior on both instances.** Nothing in the money path depends on Redis, so EZ Prep (with Redis) and ExamFlex (without it) run identical code paths.

---

## Go-live path

**Answer: yes.** Implement 14A → 14E → 14B → 14C → 14D (each passes the gate above), then phase 15 (launch copy, LEGACY guard, local ENFORCED soak) and phase 16 (local manual pass, including a second-instance smoke with `INSTANCE_ID=examflex`). After that, no further code is needed to go live. What remains is production configuration.

Every production step, for both EZ Prep and ExamFlex, is in **[`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md)**, the single source of truth for go-live. This review does not repeat them.

### Not covered by these phases (outside the payment program)

- **ExamFlex header, logo, and non-legal pages.** 14D makes the legal pages, checkout lines, and Razorpay modal per deployment. The rest of the app's branding belongs to the multi-instance plan (`docs/EZ_PREP_MULTI_INSTANCE_ARCHITECTURE_PLAN.md`). It gates only ExamFlex switch-on (`GO_LIVE_GUIDE.md` step 0B).
