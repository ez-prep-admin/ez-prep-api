# E2E test status — Phase 16

Living manual-test board for the commerce program. Automated Jest and Vitest stay in each phase. This file is the **one** UI pass, run after phases 00–15 are implemented, as [phase 16](phases/phase-16-end-to-end-verification.md) — the last gate before go-live.

Owner decision 2026-10-09: do not prove invoices (or later checkout) from Postman. Append each phase’s manual UI checks here when that phase finishes. Execute the whole board once, in the app and admin, then sign the close-out at the bottom.

Check a box only during the phase 16 session, with the app and admin running against the API. A box already confirmed in an earlier phase is marked **signed** so it is not treated as open work; re-run it here only if the row says **re-check**.

---

## How later phases update this file

At the end of phases 11–15, before that phase is marked done:

1. Add the exact clicks, routes, and expected screen copy under that phase’s section below. Replace the “planned” notes with what the UI actually shipped.
2. Add any new negative or edge case the phase introduced.
3. Do not check the boxes. Checking happens only in phase 16.
4. Phase 10 is already **done**. Its PDF proof stays on this board as a re-check. Signing this file does not reopen phase 10.

---

## Environment for the pass

Use **local** only. There is no staging environment.

| Item | Value |
| --- | --- |
| API | `http://localhost:3000`, prefix `/api/v1` |
| App | ezprep-app, student OTP login |
| Admin | mock-app-admin, admin login |
| Money | API JSON is integer paise. Screens show rupees. ₹999 is `99900`. |
| Access | Start in `ACCESS_ENFORCEMENT_MODE=LEGACY` only to confirm existing papers still open. The paid scenarios below require `ENFORCED`, then restore `LEGACY` unless this pass is the go-live soak. |
| Payments | `PAYMENT_PROVIDER=razorpay` with **test** keys for the UI journeys. `fake` is acceptable only for an API-only retry of a row already covered by Razorpay test mode. |
| Invoices | `INVOICES_ENABLED=true`. `AWS_S3_INVOICES_BUCKET` set to the private invoices bucket. Key `{userId}/{orderId}.pdf`. |
| Seller seed (local) | Legal name `EzPrep - Powered by Clustream`, GSTIN `32BIAPD6927L1ZC`, Kerala / `32`, SAC `999293`, prefix `EZPREP`, tax 18%. |
| Client secrets | App may contain `NEXT_PUBLIC_RAZORPAY_KEY_ID` only. Key secret and webhook secret stay on the API. |

Canonical tax for a ₹999 offer at 18% inclusive: taxable `84661`, tax `15239`. Same state (buyer `32`) splits CGST `7619` + SGST `7620`. Any other state is IGST `15239`.

---

## Already signed (do not block phase 16 on these)

These were confirmed in [`STATUS.md`](STATUS.md). Phase 16 re-checks the user-visible versions where noted.

| Phase | Signed | What was confirmed | Phase 16 |
| --- | --- | --- | --- |
| 01 | Sharun 2026-10-05 | Local FREE backfill + exam/mock category mismatch report | Re-check only if content was re-seeded |
| 02 | Sharun 2026-10-05 | Entitlement module; API smoke deferred to phase 06 | Covered by 06 and the journeys below |
| 03 | Sharun 2026-10-06 | Local ENFORCED smoke; LEGACY restored | **Re-check** in the app |
| 04 | Sharun 2026-10-07 | Catalog indexes; paise in API | **Re-check** prices on screen |
| 05 | Sharun 2026-10-07 | Admin create product, offer, publish | **Re-check** if UI changed |
| 06 | Sharun 2026-10-08 | Admin grant/revoke + ENFORCED smoke | **Re-check** in the app |
| 07 | Sharun 2026-10-09 | Local seller/tax seed; `PAYMENT_PROVIDER=fake` | Seller values re-check on the PDF |
| 08 | Sharun 2026-10-09 | Razorpay test keys in API `.env`; webhook URL deferred to checkout | **Re-check** with Checkout.js |
| 09 | Sharun 2026-10-09 | Fake pay provisions access; ENFORCED start; LEGACY restored | **Re-check** via the buy button |
| 10 | Sharun 2026-10-09 | Code + Jest. PDF smoke deferred here (no Postman) | **Re-check** on the invoice download |

---

## Journeys (run these first)

Each journey is the happy path. Negative and edge cases are in the next section and call back to the same setup.

### J1 — Sell one pack and unlock a paper

- [ ] Admin: create or reuse an active product that covers one known ENTITLED paper (or one exam). Publish it.
- [ ] Admin: create an offer at a known paise price (use ₹999 / `99900` so the tax lines are comparable). Publish the offer.
- [ ] Admin: set that paper `accessMode` to `ENTITLED`. Leave a different paper on the same exam `FREE`.
- [ ] App, student with no grant: FREE paper still starts. ENTITLED paper shows a lock and **View plans**, not Start.
- [ ] View plans lists the covering product and the published offer. Price on screen matches the offer (rupees).
- [ ] Buy opens checkout. Billing name, state, address line 1, city, and pincode are required. Address line 2 is optional. State list comes from `GET /meta/indian-states`.
- [ ] Choose Kerala (`32`). Pay with a Razorpay **test** success instrument.
- [ ] Order becomes paid. Subscriptions shows the entitlement (product, scope, start, end). The ENTITLED paper starts. The FREE paper still starts.
- [ ] Subscriptions offers one invoice download. The file is a GST tax invoice PDF, not a second receipt.
- [ ] PDF shows: Indian FY number `EZPREP/2026-27/####` (FY is 1 Apr–31 Mar, Asia/Kolkata), seller legal name, GSTIN `32BIAPD6927L1ZC`, SAC `999293`, full billing address, place of supply Kerala `32`, taxable ₹846.61, CGST and SGST (not IGST), total ₹999.00, “Computer-generated invoice”.
- [ ] S3 object is `{userId}/{orderId}.pdf` in `AWS_S3_INVOICES_BUCKET`, private. Downloading the API URL without the owner’s or an admin token does not return the file.
- [ ] Admin invoice list shows the same invoice. Admin can download it. A different student gets 404 on that invoice’s PDF route.

### J2 — Second purchase stacks

- [ ] Same student buys a second offer that covers the same paper (or the same offer again, if the catalog allows another order).
- [ ] A second entitlement exists. Access still works. The new window starts the day after the current `validUntil` (stack), it does not reset from today while the first grant is active.
- [ ] A second invoice is issued with the next sequence number. The first invoice number and PDF are unchanged.

### J3 — Interstate tax

- [ ] New checkout with buyer state Karnataka (`29`) or any code other than `32`. Pay successfully.
- [ ] PDF place of supply is that state. Tax line is IGST only. CGST and SGST are absent. Totals still match the inclusive snapshot. Seller block is unchanged.

### J4 — Admin grant and revoke without payment

- [ ] Student with no purchase sees the ENTITLED paper locked.
- [ ] Admin grants a covering entitlement. Student can start the paper without a new order and without a new invoice.
- [ ] Admin revokes that grant. Under `ENFORCED`, start is denied again and the card returns to the lock / View plans state.

### J5 — Refund

- [ ] Admin opens the paid order from J1 and refunds the full amount with a reason. Confirm modal. Success.
- [ ] Order/payment show refunded. Entitlements that came from that order are revoked. Under `ENFORCED` the paper locks again.
- [ ] Grants that did not come from that order are still active.
- [ ] The original invoice stays issued. The app does not offer a credit note and does not show a refund button to the student.
- [ ] Second refund of the same order fails with a clear admin error.
- [ ] Record the Zoho Books credit-note step for this refund (`U-GST-04`) in the phase 16 session log. The app does not generate that note.

### J6 — Failed, dismissed, and expired payment

Do this after checkout UI exists (phase 14). Reconciliation steps are spelled out under Phase 12 below. Do not check them early.

- [ ] With `RECONCILIATION_ENABLED` not the string `true`, start checkout and dismiss the Razorpay modal. No entitlement. No invoice. Order stays `PENDING_PAYMENT` even after several minutes. Subscriptions does not show it as paid.
- [ ] Start checkout and use a Razorpay test failure instrument. Error is visible. No entitlement. No invoice. The order stays pending until the reconciliation tick below; `payment.failed` webhooks do not move it by themselves.
- [ ] Tampered or missing verify payload does not mark the order paid and does not unlock the paper.
- [ ] Run the Phase 12 reconciliation pass (flag `true`, age `0`, interval `10000`, restart). The dismissed unpaid order becomes `EXPIRED`. Its payment stays `INITIATED`. Still no entitlement and no invoice. Subscriptions does not show it as paid.
- [ ] Same pass: a Razorpay test failure that the provider reports as failed becomes order `FAILED` and payment `FAILED`. No entitlement. No invoice.
- [ ] Same pass: a payment Razorpay has captured, while the browser never called verify and the webhook did not land, becomes `PAID`, provisions once, and invoices once. The fake provider cannot stage that capture from the UI; use Razorpay test mode for this row. If that setup is skipped, mark the row N/A with the reason and leave the Jest case as the record.
- [ ] The paid order from J1 stays `PAID` after another tick. Entitlement and invoice are not duplicated.

### J7 — Catalog and access regressions

- [ ] Archived product or unpublished offer cannot be bought. The plans sheet does not sell it.
- [ ] Student who already has access sees no lock and no “buy this exam” CTA on overview.
- [ ] Direct launch that the API rejects with entitlement-required shows a banner and View plans. It does not fail silently.
- [ ] Narrow mobile width: lock card, plans sheet, checkout form, and subscriptions remain usable.

### J8 — Go-live soak (only after J1–J7)

- [ ] `ACCESS_ENFORCEMENT_MODE=ENFORCED` locally. Repeat J1’s lock, purchase, and FREE-paper checks.
- [ ] Rollback drill: set the mode back to `LEGACY` and confirm the previously locked paper starts again. Document the switch in the session log, then decide whether production stays ENFORCED.
- [ ] Production seller/tax seed (`U-OPS-01`) and live Razorpay keys plus webhook (`U-OPS-02`) are either done or explicitly still open in [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md). This local pass does not by itself flip production.
- [ ] Client bundle does not contain the Razorpay key secret or webhook secret.
- [ ] “Free Early Access” (or equivalent) copy is updated for a selling app.
- [ ] No job or seed granted entitlements to every user.

---

## Negative tests and edge cases

### Access

- [ ] Logged-out student cannot start an ENTITLED paper and cannot call checkout.
- [ ] ENTITLED paper with no grant and no purchase: list/detail say not allowed; start is denied only when mode is `ENFORCED`. In `LEGACY`, start still works and the denial path is not what you are proving.
- [ ] Exam-wide entitlement unlocks papers in that exam. It does not unlock a different exam.
- [ ] Mock-test entitlement unlocks only that mock test.
- [ ] Expired entitlement (`validUntil` in the past) does not allow start under `ENFORCED`.
- [ ] Revoked entitlement does not allow start. A newer active grant still does.

### Catalog and money

- [ ] Offer price on the plans sheet and checkout equals the published offer, displayed in rupees, and the order stored is paise.
- [ ] Paused or archived offer is rejected at order create.
- [ ] Changing an offer after a paid order does not change that order’s `pricingSnapshot` or the invoice totals.
- [ ] Two rapid Pay clicks create one order for one idempotency key, or the second click is ignored. They do not double-charge or double-provision.

### Checkout and provider

- [ ] Missing billing name, state, line 1, city, or pincode is rejected before Razorpay opens.
- [ ] Unknown `stateCode` is rejected. The client does not ship its own GST state table.
- [ ] Network failure after the provider reports success shows a recoverable error. A retry of verify on the same captured payment does not create a second entitlement or a second invoice.
- [ ] Checkout verify on an order that is already paid does not depend on the client to finish provisioning. If the first paid signal provisioned and invoiced, the second call is a no-op. If you need to confirm the retry path, use the documented repair (paid signal while `provisionedAt` is still unset), not a second verify click.
- [ ] Webhook duplicate delivery does not double-provision or double-invoice.
- [ ] Webhook with a bad signature is rejected and does not change the order.
- [ ] `payment.failed` does not issue an invoice and does not grant access.

### Invoices (phase 10 — this is the deferred proof)

- [ ] `INVOICES_ENABLED` unset or not the string `true`: paid order still provisions access and **does not** create an invoice. Restore `true` afterwards.
- [ ] Failed, cancelled, expired, and unpaid orders have no invoice row and no PDF.
- [ ] Same-state buyer (`32`): CGST + SGST. Other state: IGST. Amounts match the order tax snapshot, not a fresh calculation from today’s config.
- [ ] Admin changes seller GSTIN (no checksum; a value such as `99NOTACHECKSUM` is accepted). A **new** invoice snapshots the new value. The earlier invoice still shows `32BIAPD6927L1ZC`. Restore GSTIN to `32BIAPD6927L1ZC` before ending the pass.
- [ ] Seller name, address, SAC, and series prefix on the PDF match instance config at issue time.
- [ ] Optional signatory name/designation print when set, and the computer-generated line is always present. IRN and a wet signature are not required (`U-GST-07`, `U-GST-08`).
- [ ] Invoice number is unique, FY-scoped, and zero-padded to at least 4 digits. A second paid order in the same FY increments by 1.
- [ ] Owner download returns `application/pdf`. Another user’s token gets 404. Admin download of the same id succeeds.
- [ ] PDF object key is `{userId}/{orderId}.pdf` in the invoices bucket. It is not under `invoices/` or `receipts/`, and it is not public.
- [ ] Re-opening the download does not create another S3 object or another invoice number.

### Refunds, recon, audit

- [ ] Partial refund is not offered.
- [ ] Refund of an unpaid or already refunded order is rejected.
- [ ] Student UI has no refund control.
- [ ] Reconciliation of a captured-but-still-pending Razorpay order marks it paid, provisions once, and invoices once. See the J6 capture row for how to produce that order.
- [ ] Reconciliation of an unpaid dismissed checkout expires it (`EXPIRED`, payment still `INITIATED`) and does not invoice.
- [ ] Reconciliation of a provider-failed order sets the order and payment to `FAILED` and does not invoice.
- [ ] Reconciliation does not modify an order that is already paid, and does not add a second entitlement or a second invoice.
- [ ] After the pass, `RECONCILIATION_ENABLED=false` and `RECONCILIATION_MIN_AGE_MINUTES=60` are restored and the API is restarted. Age `0` left on will expire checkouts that are still in progress.
- [ ] `GET /api/v1/admin/commerce-audit` with an admin JWT lists the grant, revoke, refund, publish or archive, offer change, `INVOICE_ISSUED`, and `ORDER_PROVISIONED` rows from this pass. Admin actions show that admin on `actorUserId`. `INVOICE_ISSUED` has no actor. `ORDER_PROVISIONED` stores the paying student. There is no admin page for this list. Filters: `action`, `resourceType`, `page`, `limit`.

### UI

- [ ] Empty subscriptions (new student): clear empty state, no broken invoice link.
- [ ] Checkout with the plans route missing `offerId`: visible error, no Razorpay modal.
- [ ] Loading and disabled states on Start, Buy, and Pay survive double clicks.
- [ ] Desktop and a narrow mobile width for lock, plans, checkout, and subscriptions.

---

## Per-phase notes

Use this section when a phase session adds detail. Do not delete the journeys above.

### Phases 00–09

Runtime proofs for these phases are already signed in [`STATUS.md`](STATUS.md). The user-visible repeats are J1, J4, and J7. No extra Postman pass.

### Phase 10 — GST invoices

Manual proof is J1’s PDF checks plus the invoice negative list. Postman was skipped on 2026-10-09 because the student session is OTP-based and the profile download UI does not exist yet.

Known gap to confirm in the PDF during this pass: the invoice cites the order number. It does not yet print the Razorpay payment id. Record whether that is acceptable at sign-off.

### Phase 11 — Admin refunds

Owner broad-tested the admin refund UI on 2026-10-09. That closed the phase. The extensive UI-integrated proof is still J5 in this file. Do not check those boxes until phase 16.

Admin route: `/admin/orders`, then an order at `/admin/orders/[id]`.

- Button label: **Refund** (shown only when the order status is Paid).
- Reason field is required. Confirm title: `Refund this order?`
- Confirm body: `This refunds the full amount and revokes access granted by this order. It does not change the tax invoice.`
- Success copy: `Order refunded`
- Provider still pending: `Refund is pending at the payment provider. Access was not revoked.`
- A second refund, or a refund of an unpaid order, shows the API error (already refunded / only paid orders).
- Invoice link label: `Download invoice`. The original invoice stays issued. There is no credit-note control.

Phase 16 runs J5 end to end with the paid order from J1: confirm modal, revoked payment entitlements, ENFORCED lock, unrelated grants still active, invoice still issued, no student refund control, second refund error.

### Phase 12 — Reconciliation and audit

Owner skipped Postman on 2026-10-10. Jest covers the status mapping. The UI-integrated proof is J6 plus the recon and audit rows in the negative list. Do not check those boxes until phase 16, after checkout exists.

Run this only during that pass. Checkout `expiresAt` is 30 minutes and is not this clock. The job does not use Redis. Any value other than the string `true` on `RECONCILIATION_ENABLED` leaves orders untouched.

1. Confirm the flag is not `true`. Dismiss a checkout. The order stays `PENDING_PAYMENT`. No entitlement. No invoice. Subscriptions does not show it as paid.
2. In API `.env`, set `RECONCILIATION_ENABLED=true`, `RECONCILIATION_MIN_AGE_MINUTES=0`, and `RECONCILIATION_INTERVAL_MS=10000`. Restart the API. Default age is 60 and default interval is 300000; those waits are too long for this pass.
3. On the next tick the dismissed unpaid order becomes `EXPIRED`. Payment stays `INITIATED`. Still no entitlement and no invoice.
4. A Razorpay test-mode failure becomes order `FAILED` and payment `FAILED` on a tick. No entitlement. No invoice. The failure webhook alone does not do this.
5. A Razorpay test-mode capture where verify never ran and the webhook did not land becomes `PAID` on a tick, provisions once, and invoices once. Fake checkout cannot stage “provider says captured.”
6. The paid order from J1 stays `PAID` after another tick. Access and the invoice are unchanged.
7. `GET /api/v1/admin/commerce-audit` (admin JWT, no admin screen) shows the actions from this pass. Use `action` and `resourceType` to narrow it. Admin clicks carry `actorUserId`. `INVOICE_ISSUED` does not. `ORDER_PROVISIONED` is the student who paid.
8. Set `RECONCILIATION_ENABLED=false`, set `RECONCILIATION_MIN_AGE_MINUTES=60`, and restart before leaving the pass.

### Phase 13 — User access UI

Planned proof is the lock, View plans, overview CTA, and launch-error bullets in J1, J4, and J7. When phase 13 finishes, add the component routes and any copy that phase 16 must match.

### Phase 14 — Checkout and subscriptions

Planned proof is J1–J3 and J6. When phase 14 finishes, add Razorpay test card/UPI steps, the checkout query (`offerId`), and the subscriptions download control.

### Phase 15 — Rollout hardening

Planned proof is J8. When phase 15 finishes, add the go-live runbook link and the production checklist. Do not mark the program live in `STATUS.md` until the close-out below is signed.

---

## Close-out (phase 16 only)

- [ ] J1–J8 executed on local app + admin, or a row marked N/A with a reason.
- [ ] Negative and edge list executed, or N/A with a reason.
- [ ] Failures found in this pass are fixed and the affected rows re-run.
- [ ] `ACCESS_ENFORCEMENT_MODE` left in the intended post-test value, recorded below.
- [ ] Local GSTIN restored to `32BIAPD6927L1ZC` if it was edited.
- [ ] Invoice rows in this file checked (phase 10 is already done; this is the UI proof).
- [ ] Program “Payments live” stays **No** until production ops in J8 are actually done.

**Developer confirmation:**

I, __________, confirm the boxes above were executed in the UI (or marked N/A with reason) and phase 16 may be marked done.

Date: __________

Enforcement mode left as: __________

Notes / waived rows:
