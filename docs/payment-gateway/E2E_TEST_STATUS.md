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

## Full pass — run this once, in order

This is the start-to-finish script for phase 16. Check the journey and edge boxes as you go. Do not check them before that session. Phase 14 checkout is in the build. Phase 15 still has to land before this session signs the close-out. Leave every box below unchecked until then.

Apps: API on port 3000, ezprep-app on 3001, mock-app-admin on its local port. One admin user. Two students: **Student A** (no grant) and **Student B** (used only for the other-user invoice 404).

### 1. Boot and baseline

1. API `.env`: `ACCESS_ENFORCEMENT_MODE=LEGACY`, `PAYMENT_PROVIDER=razorpay` with test keys, `INVOICES_ENABLED=true`, `RECONCILIATION_ENABLED` not the string `true`. Seller seed already applied (legal name, GSTIN `32BIAPD6927L1ZC`, Kerala `32`, SAC `999293`, 18%).
2. Restart the API. Log into admin and both students.
3. As Student A, open one exam and start a paper. Under `LEGACY` it starts even if you later mark it entitled. This only proves the flag is still legacy.

### 2. Pick the papers

Use one exam the student can already open.

- **Paper L** — the paper you will lock. Prefer an existing topic-wise paper.
- **Paper F** — a different paper on the same exam. It stays `FREE`.

Admin mock-test, full-mock, and sprint screens do not have an Access mode control. Do not save the topic-wise edit form to flip it: `PATCH /api/v1/mock-tests/:id` re-samples questions when the quota changes, and it is the wrong tool for a one-field change. Set `accessMode` to `ENTITLED` on Paper L’s mock-test document in local Mongo, and leave Paper F as `FREE`. Full-mock and sprint publish accept `accessMode` on `POST /api/v1/full-mock-tests/drafts/:id/publish` and `POST /api/v1/sprint-tests/drafts/:id/publish`. The admin publish forms do not send it, so those papers stay `FREE` unless the publish body includes `ENTITLED`. Phase 15 may add an admin control. Until then, use the Mongo field.

Record the exam id, Paper L id, and Paper F id in the close-out notes.

### 3. Admin — create the product and the offer

Admin → **Products** (`/admin/products`).

1. Create a product. Name it something you can see in the plans dialog, for example `E2E Exam Pack`. Add one grant: scope **EXAM**, target = the exam from step 2. Save. Status is **DRAFT**.
2. Set `ACCESS_ENFORCEMENT_MODE=ENFORCED` and restart the API. Leave it there until the restore step. As Student A, Paper L shows **Locked** and **View plans**. The unpublished draft is not listed. Empty copy: `No plans are available for this yet.` Paper F still starts.
3. On the product, **Publish**. Confirm `Publish this product?`. Status becomes **PUBLISHED**. Version is at least 1.
4. **Add Offer**. Duration `3 months` (`3M`). List amount `999` (the field is rupees; the API stores `99900`). Leave sale amount empty. Status **Active**. **Create Offer**. The table shows `ACTIVE`.
5. Add a second offer with the same duration `3M` and status **Active**. The duration option is marked `(ACTIVE exists)` and the save is rejected. One active offer per duration.
6. Optional second duration: add `12 months` at another rupee price, status **Active**. Both active rows may appear in View plans.

Student A, Paper L → **View plans**. The dialog title is `View plans`. The paper description is `Published plans that cover this test.` The pack name is listed. The 3 month row shows `3 months` and `₹999`. **Buy** opens `/dashboard/checkout?offerId=<that offer id>`.

Overview `/dashboard/exam/:id` shows heading `Some tests on this exam are locked` and **View plans**. That dialog uses the exam catalog (`EXAM` and `EXAM_GROUP` grants only) and the description `Published plans that cover this exam.` Paper F has no lock and **Start** still works. Topic-wise, full-mock, and sprint tabs all still open.

### 4. What each grant covers

Create these as separate published products, each with one active offer, then delete or archive them after the check so they do not clutter J1.

- **EXAM** grant: overview CTA and Paper L both list it. A paper on a different exam does not.
- **EXAM_GROUP** grant for that exam’s group: same, for every exam in the group. An exam outside the group does not list it.
- **MOCK_TEST** grant for Paper L only: Paper L **View plans** lists it. The overview dialog does not (exam catalog ignores mock-test grants). Paper F does not list it.

### 5. Invalidate the offer and the product

Do these on a copy, or restore an active offer before J1’s payment, so the ₹999 offer used for tax is active again at pay time.

1. **Inactive offer.** Edit the ₹999 offer. Set status to **Inactive**. **Update Offer**. Student A reopens **View plans**: that offer is gone. If it was the only offer, the dialog says `No plans are available for this yet.` Checkout create with that offer id is rejected (`Offer is not active`). Set it back to **Active** before paying.
2. **Sale window ended.** On an active offer set a sale amount below the list price and a sale window that has already ended. View plans shows the list price, not the sale price. A window that includes now shows the sale price. Clear the sale amount before the ₹999 tax check.
3. **Draft stays unsold.** Duplicate the published product. The copy is a new draft and does not appear in View plans until you publish it. Delete the draft when finished (**Delete**). Archiving a draft is rejected; delete it instead.
4. **Archive the product.** **Archive** on a published product. It disappears from View plans and from checkout (`Product is not published`). An entitlement already granted or purchased for that product stays active until it expires or is revoked. Archive does not refund and does not revoke. Un-archive is not a button; create or duplicate again if you still need a published pack. Do not archive the J1 pack until after refund testing, or J1 has nothing to buy.
5. **Price edit after payment.** After J1 is paid, change the offer’s list amount. The plans dialog shows the new rupee price. The paid order snapshot and the already issued PDF stay at ₹999.00.

### 6. Student — pay, stack, and a second state

Requires phase 14 checkout, not the phase 13 shell.

1. Student A, Paper L, **View plans**, **Buy** on the ₹999 / 3 month offer.
2. Checkout requires billing name, state, address line 1, city, and a 6-digit pincode. Address line 2 is optional. States come from `GET /api/v1/meta/indian-states`.
3. Choose Kerala (`32`). Pay with a Razorpay **test** success instrument.
4. Subscriptions shows the entitlement (product, scope, start, end) and one invoice download. The file is a GST invoice, not a second receipt. PDF checks are J1.
5. Paper L **Start** works. Paper F still starts. The overview CTA and the lock are gone.
6. Buy a second covering offer while the first entitlement is still active (J2). The new window starts at the current expiry. It does not restart from today. A second invoice uses the next FY sequence number.
7. New checkout as a different state, Karnataka `29` (J3). PDF is IGST only.

### 7. Grant and revoke without payment

Admin → **Users** → Student A → **Entitlements** → **Grant access**. Use Student A before the purchase, or use a third student who has not paid.

1. With no grant and `ENFORCED`, Paper L is locked.
2. Grant scope **EXAM** (or the paper) and a duration. No product id. The row is **ACTIVE**. The paper starts. No new order and no new invoice.
3. **Revoke**. Status **REVOKED**. Paper L is locked again and **View plans** is back.
4. A second, still-active grant continues to allow start after the first is revoked.

### 8. Refund, failure, and recon

Use the paid J1 order.

- Admin → **Orders** → the order. **Refund** only when status is Paid. Reason required. Confirm title `Refund this order?`. Success `Order refunded`. Payment entitlements from that order revoke. Grants from step 7 that were not from this order stay active. The invoice stays issued. Student UI has no refund button. A second refund errors.
- Dismiss Razorpay, fail a test payment, and run the recon tick only as written under Phase 12 below (J6). Restore `RECONCILIATION_ENABLED=false` and age `60` before you leave.

### 9. Restore

1. `ACCESS_ENFORCEMENT_MODE=LEGACY` unless this pass is the go-live soak (J8), then record the value you left.
2. `RECONCILIATION_ENABLED` is not `true`. `RECONCILIATION_MIN_AGE_MINUTES=60`.
3. Seller GSTIN is `32BIAPD6927L1ZC` if you edited it for the snapshot check.
4. Restart the API.

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
| 11 | Sharun 2026-10-09 | Broad admin refund smoke | **Re-check** J5 with the paid order |
| 12 | Sharun 2026-10-10 | Jest. Recon tick and audit list deferred here | **Re-check** J6 |
| 13 | Sharun 2026-10-10 | Broad lock, View plans, and checkout shell | **Re-check** the full pass script and J1, J4, J7 |

---

## Journeys (run these first)

Each journey is the happy path. Negative and edge cases are in the next section and call back to the same setup.

### J1 — Sell one pack and unlock a paper

- [ ] Admin: create or reuse an active product that covers one known ENTITLED paper (or one exam). Publish it.
- [ ] Admin: create an offer at a known paise price (use ₹999 / `99900` so the tax lines are comparable). Publish the offer.
- [ ] Admin: set that paper `accessMode` to `ENTITLED`. Leave a different paper on the same exam `FREE`.
- [x] App, student with no grant: FREE paper still starts. ENTITLED paper shows a lock and **View plans**, not Start. Owner 2026-10-10.
- [ ] View plans lists the covering product and the published offer. Price on screen matches the offer (rupees).
- [ ] Buy opens checkout. Billing name, state, address line 1, city, and pincode are required. Address line 2 is optional. State list comes from `GET /meta/indian-states`.
- [ ] Choose Kerala (`32`). Pay with a Razorpay **test** success instrument.
- [ ] Order becomes paid. Subscriptions shows the entitlement (product, scope, start, end). The ENTITLED paper starts. The FREE paper still starts.
- [x] Subscriptions offers one invoice download. The file is a GST tax invoice PDF, not a second receipt. Owner 2026-10-10 (`EZPREP/2026-27/0003`).
- [ ] PDF shows: Indian FY number `EZPREP/2026-27/####` (FY is 1 Apr–31 Mar, Asia/Kolkata), seller legal name, GSTIN `32BIAPD6927L1ZC`, SAC `999293`, full billing address, place of supply Kerala `32`, taxable ₹846.61, CGST and SGST (not IGST), total ₹999.00, “Computer-generated invoice”.
- [ ] S3 object is `{userId}/{orderId}.pdf` in `AWS_S3_INVOICES_BUCKET`, private. Downloading the API URL without the owner’s or an admin token does not return the file.
- [ ] Admin invoice list shows the same invoice. Admin can download it. A different student gets 404 on that invoice’s PDF route.

### J2 — Second purchase stacks

- [ ] Same student buys a second offer that covers the same paper (or the same offer again, if the catalog allows another order).
- [ ] A second entitlement exists. Access still works. The new window starts the day after the current `validUntil` (stack), it does not reset from today while the first grant is active.
- [ ] A second invoice is issued with the next sequence number. The first invoice number and PDF are unchanged.

### J3 — Interstate tax

- [x] New checkout with buyer state Karnataka (`29`) or any code other than `32`. Pay successfully. Owner 2026-10-10, Haryana `06`.
- [x] PDF place of supply is that state. Tax line is IGST only. CGST and SGST are absent. Totals still match the inclusive snapshot. Seller block is unchanged. Owner 2026-10-10, invoice `0003`, ₹129.

### J4 — Admin grant and revoke without payment

- [ ] Student with no purchase sees the ENTITLED paper locked.
- [x] Admin grants a covering entitlement. Student can start the paper without a new order and without a new invoice. Owner 2026-10-10.
- [x] Admin revokes that grant. Under `ENFORCED`, start is denied again and the card returns to the lock / View plans state. Owner 2026-10-10.

### J5 — Refund

- [x] Admin opens the paid order from J1 and refunds the full amount with a reason. Confirm modal. Success. Owner 2026-10-10. A `pending` Razorpay refund finished on the refund tick (`ORD-MV28B89M-P9LA`).
- [x] Order/payment show refunded. Entitlements that came from that order are revoked. Under `ENFORCED` the paper locks again. Owner 2026-10-10, refund completed. Paper lock after that revoke was not separately written down.
- [x] Grants that did not come from that order are still active. Owner 2026-10-10.
- [x] The original invoice stays issued. The app does not offer a credit note and does not show a refund button to the student. Owner 2026-10-10, no refund control on the student dashboard.
- [x] Second refund of the same order fails with a clear admin error. Owner 2026-10-10.
- [ ] Record the Zoho Books credit-note step for this refund (`U-GST-04`) in the phase 16 session log. The app does not generate that note.

### J6 — Failed, dismissed, and expired payment

Do this after checkout UI exists (phase 14). Reconciliation steps are spelled out under Phase 12 below. Do not check them early.

- [x] With `RECONCILIATION_ENABLED` not the string `true`, start checkout and dismiss the Razorpay modal. No entitlement. No invoice. Order stays `PENDING_PAYMENT` even after several minutes. Subscriptions does not show it as paid. Owner 2026-10-10. Payment row stayed in progress.
- [x] Start checkout and use a Razorpay test failure instrument. Error is visible. No entitlement. No invoice. The order stays pending until the reconciliation tick below; `payment.failed` webhooks do not move it by themselves. Owner 2026-10-10, UPI failure.
- [ ] Tampered or missing verify payload does not mark the order paid and does not unlock the paper.
- [x] Run the Phase 12 reconciliation pass (flag `true`, age `0`, interval `10000`, restart). The dismissed unpaid order becomes `EXPIRED`. Its payment stays `INITIATED`. Still no entitlement and no invoice. Subscriptions does not show it as paid. Owner 2026-10-10.
- [ ] Same pass: a Razorpay test failure that the provider reports as failed becomes order `FAILED` and payment `FAILED`. No entitlement. No invoice.
- [ ] Same pass: a payment Razorpay has captured, while the browser never called verify and the webhook did not land, becomes `PAID`, provisions once, and invoices once. The fake provider cannot stage that capture from the UI; use Razorpay test mode for this row. If that setup is skipped, mark the row N/A with the reason and leave the Jest case as the record.
- [ ] The paid order from J1 stays `PAID` after another tick. Entitlement and invoice are not duplicated.

### J7 — Catalog and access regressions

- [ ] Archived product or unpublished offer cannot be bought. The plans sheet does not sell it.
- [ ] Student who already has access sees no lock and no “buy this exam” CTA on overview.
- [ ] Direct launch that the API rejects with entitlement-required shows a banner and View plans. It does not fail silently.
- [x] Narrow mobile width: lock card, plans sheet, checkout form, and subscriptions remain usable. Owner 2026-10-10.

### J8 — Go-live soak (only after J1–J7)

- [x] `ACCESS_ENFORCEMENT_MODE=ENFORCED` locally. Repeat J1’s lock, purchase, and FREE-paper checks. Owner 2026-10-10: free papers start, entitled papers deny without payment, paid papers unlock.
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
- [ ] A **DRAFT** product does not appear in View plans. Publish it, then it does.
- [x] An offer set to **Inactive** disappears from View plans. Checkout create with that offer id is rejected (`Offer is not active`). Setting it back to **Active** lists it again. Owner 2026-10-10, inactive offers are hidden in the student UI.
- [ ] A second **Active** offer for the same duration on the same product is rejected. The duration option shows `(ACTIVE exists)`.
- [ ] A sale window that has ended shows the list price. A window that includes now shows the sale price.
- [ ] **Archive** removes the product from View plans and checkout. It does not revoke an entitlement already granted or purchased.
- [ ] A **MOCK_TEST** product is listed on that paper’s View plans and is not listed on the exam overview dialog. An **EXAM** or **EXAM_GROUP** product is listed on both when it covers that exam.
- [ ] Duplicate creates a draft that is not sold until published. Deleting a draft removes it. Archiving a draft is rejected.
- [ ] Changing an offer after a paid order does not change that order’s `pricingSnapshot` or the invoice totals. View plans shows the new price.
- [x] Two rapid Pay clicks create one order for one idempotency key, or the second click is ignored. They do not double-charge or double-provision. Owner 2026-10-10.

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
- [x] Student UI has no refund control. Owner 2026-10-10.
- [ ] Reconciliation of a captured-but-still-pending Razorpay order marks it paid, provisions once, and invoices once. See the J6 capture row for how to produce that order.
- [x] Reconciliation of an unpaid dismissed checkout expires it (`EXPIRED`, payment still `INITIATED`) and does not invoice. Owner 2026-10-10.
- [ ] Reconciliation of a provider-failed order sets the order and payment to `FAILED` and does not invoice.
- [ ] Reconciliation does not modify an order that is already paid, and does not add a second entitlement or a second invoice.
- [x] After the pass, `RECONCILIATION_ENABLED=false` and `RECONCILIATION_MIN_AGE_MINUTES=60` are restored and the API is restarted. Age `0` left on will expire checkouts that are still in progress. Owner 2026-10-10.
- [ ] `GET /api/v1/admin/commerce-audit` with an admin JWT lists the grant, revoke, refund, publish or archive, offer change, `INVOICE_ISSUED`, and `ORDER_PROVISIONED` rows from this pass. Admin actions show that admin on `actorUserId`. `INVOICE_ISSUED` has no actor. `ORDER_PROVISIONED` stores the paying student. There is no admin page for this list. Filters: `action`, `resourceType`, `page`, `limit`.

### UI

- [ ] Empty subscriptions (new student): clear empty state, no broken invoice link.
- [x] Checkout with no `offerId`: visible error, no Razorpay modal. Phase 13 shell copy, until phase 14 replaces it: `Choose a plan from View plans to continue.` Owner 2026-10-10.
- [ ] An in-progress paper still shows **Resume** when `access.allowed` is false. Start and Retake on that denied paper show **View plans**.
- [ ] A direct start the API rejects with `ENTITLEMENT_REQUIRED` shows the API message and **View plans**. Other start errors stay red text with no plans button.
- [ ] While one paper is starting, the other cards’ buttons are disabled. **View plans** does not enter that loading state.
- [ ] Loading and disabled states on Start, Buy, and Pay survive double clicks.
- [ ] Desktop and a narrow mobile width for lock, plans, checkout, and subscriptions.
- [ ] Exam tabs stay open for a student who is locked out of Paper L. Header copy `Free Early Access` stays until phase 15 changes it.

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

Owner broad-tested the lock, View plans, and checkout shell on 2026-10-10. That closed the phase. The detailed proof is the **Full pass** script (steps 2–5 and 7) plus J1, J4, and J7. Do not check those boxes until phase 16. Locks show only while `ACCESS_ENFORCEMENT_MODE=ENFORCED`. Restore `LEGACY` after the pass unless J8 says otherwise. Header copy `Free Early Access` is unchanged until phase 15. Phase 14 replaced the checkout shell and the Coming Soon subscriptions page. Use the Phase 14 copy below for those screens.

Routes and copy phase 16 must match:

- Overview `/dashboard/exam/:id`. CTA heading: `Some tests on this exam are locked`. Body: `You can still open every tab. Free tests start as usual. Locked tests show View plans.` Button: `View plans`. Hidden while the paper probe is loading, if the probe fails, or when every loaded paper has `access.allowed !== false`. The dialog calls `GET /api/v1/catalog/products/for-exam/:examId`.
- Topic-wise, full-mock, and sprint cards. When `access.allowed` is false and the action is not Resume: chip `Locked` and button `View plans` instead of Start or Retake. Resume stays when `userAttemptAction` is `RESUME` and `resumeAttemptId` is set. The dialog calls `GET /api/v1/catalog/products/for-mock-test/:mockTestId`.
- Dialog title: `View plans`. Exam description: `Published plans that cover this exam.` Paper description: `Published plans that cover this test.` Each offer shows `1 month`, `3 months`, `6 months`, `12 months`, or `Lifetime`, and rupees from `effectiveAmount` (else sale, else list). Button `Buy` opens `/dashboard/checkout?offerId=<offer id>`. A published product with no ACTIVE offer is omitted. Empty copy: `No plans are available for this yet.`
- Start error banner shows the API message. Button `View plans` appears only when `details.code` is `ENTITLEMENT_REQUIRED`.
- Checkout shell from this phase was replaced in phase 14. Do not expect `Checkout enabling soon`.

### Phase 14 — Checkout and subscriptions

Checked rows below are the owner pass on 2026-10-10. Phase 14 is closed. Unchecked rows elsewhere in this file stay open for phase 16. Razorpay Checkout.js is loaded from `https://checkout.razorpay.com/v1/checkout.js` only after **Pay securely**. The app sends no amount. `NEXT_PUBLIC_RAZORPAY_KEY_ID` is the Checkout.js `key`. The key secret stays on the API.

Local smoke before the pass: API `PAYMENT_PROVIDER=razorpay` with test key id and secret, `INVOICES_ENABLED=true`, and the invoice bucket set. App `.env` has `NEXT_PUBLIC_RAZORPAY_KEY_ID` (`rzp_test_...`) and not the secret. Restart both. A webhook tunnel for `payment.captured` and `order.paid` is optional. Verify still completes a payment if the tunnel is skipped.

Success instrument: card `4111 1111 1111 1111`, any future expiry, any CVV, or UPI `success@razorpay`. Failure instrument: UPI `failure@razorpay`.

- [x] `/dashboard/checkout` with no `offerId`. Heading `Checkout`. Body `Choose a plan from View plans to continue.` No Pay button. Owner 2026-10-10.
- [x] **Buy** opens `/dashboard/checkout?offerId=<offer id>`. The page shows the product name, duration (`3 months` and the other presets), and rupees from `effectiveAmount`. Owner 2026-10-10, purchases completed.
- [x] An unknown or inactive offer shows `This plan is not available.` Razorpay does not open. Owner 2026-10-10, inactive offers are not shown in the student UI.
- [x] Billing name is prefilled from `GET /me/billing-profile` when one is saved, otherwise from the account name. State, address line 1, city, and a 6-digit pincode are required. Address line 2 is optional. The state list is `GET /meta/indian-states`. Owner 2026-10-10.
- [x] **Pay securely** creates the order, then `PATCH /me/billing-profile`. A second visit prefills the saved address. Owner 2026-10-10.
- [x] Success card or UPI. Copy: heading `Payment received`, body `Payment received. Your access is active.` **View subscriptions** opens `/dashboard/subscriptions`. Returning to the exam shows the paper unlocked without a full browser reload. Owner 2026-10-10, test card payment and unlock. Exact success heading was not quoted.
- [x] A bad or tampered verify shows the API error and does not unlock the paper. Owner 2026-10-10: payment-stage errors did not unlock the paper.
- [x] Closing the Razorpay modal shows `Payment was not completed. You can try again.` No entitlement and no invoice. The order stays pending. Owner 2026-10-10.
- [x] UPI `failure@razorpay` shows an error. No entitlement and no invoice. Owner 2026-10-10.
- [x] A second click on **Pay securely** while the first request is in flight does not open a second modal. Owner 2026-10-10, after the 600ms lock.
- [x] An expired order shows `This checkout has expired. Start again.` Owner 2026-10-10.
- [x] With `PAYMENT_PROVIDER=fake`, Pay shows `This environment is not set up for card checkout.` and does not open Razorpay. Owner 2026-10-10. Production stays on Razorpay.
- [x] Subscriptions heading `My Subscriptions`. A new student sees `You do not have active access yet.` Paid access shows the product name, scope, start, and end (`Lifetime` when there is no end). Admin grants show the scope name and no product. Orders include pending rows labeled `Pending`, not `Paid`. Owner 2026-10-10: new student and pending orders verified.
- [x] **Download invoice** saves the GST PDF. There is no refund control. Owner 2026-10-10.
- [x] Narrow mobile width: checkout form and subscriptions remain usable. Owner 2026-10-10.

### Phase 15 — Rollout hardening

Planned proof is J8. When phase 15 finishes, add the go-live runbook link and the production checklist. Do not mark the program live in `STATUS.md` until the close-out below is signed.

---

## Local session log

These notes are from owner testing on 2026-10-10. They closed phase 14. They do not check the phase 16 boxes.

- A Razorpay test payment for `ORD-MV1I7RS7-RPHP` (₹129, Haryana, IGST) reached `PAID`. The payment is `CAPTURED`. The admin order shows the invoice. Student access was granted.
- Checkout create previously failed for two local setup issues, both fixed in code: Razorpay rejected the key id/secret (`401`), and a payments unique index treated every unpaid checkout as the same record (`409` on `providerPaymentId`). A later pay with the current test key opened Checkout.js and completed.
- Admin **Refund** on that paid order called Razorpay and Razorpay returned `400` `invalid request sent`. The order stayed `PAID`. The refund row is `FAILED`. Access was not revoked. The invoice stayed issued. A failed refund can be tried again from the same button.
- The captured payment is ₹129.00. The Razorpay test balance at the time was ₹126.42, which is short of a full refund because Razorpay has already taken its fee. Capture another test payment so the balance covers ₹129, then refund this order again.
- The admin error for that `400` was the generic `Payment provider request failed`. The API now returns the balance explanation when Razorpay's description is `invalid request sent` and the balance is below the refund.
- Admin **Refund** on `ORD-MV28B89M-P9LA` returned 200 with refund `INITIATED` (`rfnd_TmAYE2JW0SAI1e`). Razorpay later moved that refund to `processed`. With `RECONCILIATION_ENABLED=true`, the refund tick marked it completed. Owner confirmed 2026-10-10.
- Owner local pass the same day: payment, billing prefill, invoice download, mobile checkout and subscriptions, no student refund control, manual grant and revoke, free papers still start, entitled papers deny without payment. Webhook URL is registered through ngrok. Razorpay asks you to choose the webhook secret. Two `POST /api/v1/webhooks/payments/razorpay` calls returned 200. Phase 14 and phase 16 stay open.
- Invoice `EZPREP/2026-27/0003` showed a hand-drawn currency mark that did not read as ₹. New invoices use the Noto Sans Bold rupee outline. Owner confirmed a newly issued invoice on 2026-10-10. Already stored PDFs are not regenerated.
- Same pass: closed the Razorpay window (order stayed pending, payment not captured), UPI failure, expired checkout, checkout with no plan, a second refund error, an unrelated grant still active, and the reconciliation expire pass. A double click around the payment modal opened a second window. Pay now stays locked for 600ms after the modal closes. Owner retested that on 2026-10-10 and it held.
- Phase 14 closed the same day. Also verified: payment-stage errors do not unlock a paper, fake provider does not open Razorpay, inactive offers are hidden, a new student sees the empty subscriptions state, and a pending order stays pending. The student app env has `NEXT_PUBLIC_RAZORPAY_KEY_ID` only. Production will use Razorpay, not the fake provider. The remaining unchecked rows in this file are phase 16.

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

## Phase 14A manual checks

Confirmed by Sharun on 2026-10-10.

- [x] Boot the API with `NODE_ENV=production` and `COMMERCE_ENABLED=true` and a bad provider or test key. The process exits and the message names the bad key. Restore the local env afterward.
- [x] Edit a published product's grants in admin and do not republish. Catalog and a new checkout still use the previous grants.
- [x] Buy two stacked durations, then refund the earlier one. Subscriptions show the later window moved earlier.
- [x] Grant a lifetime entitlement, then try to buy the same scope again. Checkout is refused.

