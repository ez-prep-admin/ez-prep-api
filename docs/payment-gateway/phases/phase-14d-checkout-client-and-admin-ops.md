# Phase 14D — Checkout client resilience and admin ops (ad-hoc)

Ad-hoc phase from [`../PRE_RELEASE_REVIEW.md`](../PRE_RELEASE_REVIEW.md). Runs after 14C and before phase 15.

## Objective

1. Make the student checkout survive retries inside the Razorpay modal, lost verify calls, late captures, and plan switching, without hammering the API.
2. Show ownership and the lifetime block in "View plans".
3. Give admins the health view, a repair action, late-capture and duplicate markers, and a deliberate refund confirmation.

4. Make the Terms, Privacy Policy, and checkout wording match what is sold: one-time payments, no auto-renewal.

Findings: PR-08 (admin action), PR-11, PR-16 (UI), PR-17 (client), PR-19 (admin page), PR-24, PR-28, PR-39, PR-40.

## Prerequisites

The contracts from 14A–14C:

- Error codes: `ALREADY_COVERED`, `IDEMPOTENCY_KEY_REUSED`, `CHECKOUT_IN_PROGRESS`, `TOO_MANY_OPEN_ORDERS`, `COMMERCE_DISABLED`
- Verify field: `confirmation: 'PENDING_CAPTURE'`
- Catalog fields: `coveredForLife`, `ownedUntil`
- Order fields: `lateCaptureAt`, `redundantPurchase`
- Endpoints: `GET /admin/commerce/health`, `POST /admin/orders/:id/repair`, `GET /admin/orders?flag=`
- Duplicate payment rows
- The admin proxy already allows every `admin/*` path (`app/api/ezprep/[...path]/route.ts`), so the new endpoints need no proxy change. A proxy test for one new path is still added.

## Source documents

`../PRE_RELEASE_REVIEW.md` (late-payment design §7, compatibility contract), `../decisions.md` D-07 D-12 D-14 D-15 D-22 D-24, `phase-13-user-access-ui.md`, `phase-14-user-checkout-subscriptions.md`.

## Code references

**ezprep-app**

- `lib/checkout/adapters/razorpay.ts`, `lib/checkout/adapters/types.ts`, `lib/checkout/CheckoutService.ts`
- `components/checkout/CheckoutClient.tsx`, `components/checkout/billing-values.ts`
- `components/exam/access/ViewPlansDialog.tsx`, `components/subscriptions/SubscriptionsClient.tsx`, `lib/api/catalog.ts`, `lib/api/checkout.ts`
- `app/terms/page.tsx` (L52–58 General, L135–164, L242–263, L345–366 grievance, L392–398 law), `app/privacy-policy/page.tsx`, `app/user-policy/page.tsx`, `.env.example`
- New `lib/brand.ts`

**mock-app-admin**

- `app/admin/orders/[id]/page.tsx`, `app/admin/orders/page.tsx`, `app/services/ezprep-api/orders.ts`, `app/admin/layout.tsx` (nav)
- New page `app/admin/commerce-health/page.tsx`

## Target behavior

### ezprep-app

1. **Modal lifecycle (PR-11).**
   - `payment.failed` stores the last error and does **not** settle. Settle only from `handler` (success) or `modal.ondismiss`. A dismiss after a failure reports the stored error.
   - `checkoutOpen` stays true until settle, so only one modal can be open.
   - Pass Checkout.js `timeout` (seconds) = time remaining to `order.expiresAt` minus 60, with a floor of 120. This cuts down late captures (D-22). When the timeout closes the modal, show the expired copy and offer "Try again", which creates a new order.
2. **Confirm with bounded polling (D-22).**
   - **When.** After a success callback, if verify errors, times out, or returns `confirmation: 'PENDING_CAPTURE'`.
   - **How.** Poll `GET /checkout/orders/:id` at 2s, 4s, 8s, 16s, and 30s after the callback: 5 reads at most, about 60 seconds. Stop on `PAID` (success screen) or when the page is hidden (`visibilitychange`), and resume once on return.
   - **Still pending at the end.** Show "We are confirming your payment. Your access will appear in Subscriptions shortly." with a link to Subscriptions. Never "failed" after `handler` fired.
   - **Late capture.** A `PAID` order returned by verify for an order the page thought had expired shows the normal success screen.
3. **Idempotency key (PR-17).**
   - The fingerprint includes `offerId`, and `intentRef` resets when `offerId` changes.
   - `IDEMPOTENCY_KEY_REUSED` → new key and one retry.
   - `CHECKOUT_IN_PROGRESS` → wait 1s and replay once, then show the generic retry copy.
   - `TOO_MANY_OPEN_ORDERS` → "You have a payment in progress. Finish or wait a few minutes."
4. **Ownership and the lifetime block (PR-16, D-24).**
   - `ALREADY_COVERED`, or `coveredForLife` on a catalog product, shows "You already have lifetime access" with a link to Subscriptions. The Buy button is hidden for that product.
   - "View plans" shows "Active until {date}" from `ownedUntil`. The Buy button reads "Extend" when a finite stack exists, with copy "Starts after your current access ends on {date}".
5. **Billing profile (PR-24).** Save the profile in parallel with order creation without awaiting it, or after a successful payment. A failure shows a quiet notice and never blocks payment.
6. **Subscriptions.** A `PAID` order with no invoice row shows "Invoice is being prepared" instead of omitting it. A row with a future `startsAt` shows "Starts {date}".

### mock-app-admin

7. **Commerce health page (PR-19).**
   - Nav item "Commerce health" with a red dot when `status = degraded`.
   - One card per class from the health endpoint: count, oldest age, sample order numbers linking to the order, and a link to a filtered orders list.
   - The orders list gets a filter control for the `flag` values that 14C added to `GET /admin/orders` (`needsReview`, `unprovisioned`, `uninvoiced`, `lateCapture`, `redundantPurchase`, `duplicate`).
   - The webhook block shows the last processed time, rejections, and silent-while-paid, plus a short "how to re-enable in the Razorpay Dashboard" note (the steps from `GO_LIVE_GUIDE.md` § Playbook P1, as plain text).
   - Effective flags shown read-only.
8. **Order detail.**
   - **Repair (PR-08).** "Retry provisioning" on a `PAID` order without `provisionedAt` or without an invoice calls `POST /admin/orders/:id/repair` and refreshes.
   - **Markers.** Late capture (with `lateCaptureAt`), redundant purchase, external refund, and a "Duplicate payments" table with each duplicate's refund status.
   - **Tax.** The tax breakdown is 14E.
9. **Refund confirmation (PR-28).** The refund dialog requires typing the order number exactly, besides the reason. The button is disabled until it matches. The API still audits the actor; no API change.

### ezprep-app: legal and checkout wording (PR-39)

10. **Terms, Privacy, and checkout copy match the product (PR-39, PR-40).** The wording is **locked** in [`../LEGAL_COPY.md`](../LEGAL_COPY.md). Implement it word for word; do not rephrase.
    - **Per-deployment values.** Add `lib/brand.ts`, which reads the seven public values listed in `LEGAL_COPY.md` (`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_LEGAL_ADDRESS`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME`, `NEXT_PUBLIC_LEGAL_JURISDICTION`) with the EZ Prep defaults. Add them to the app `.env.example`. These are public values, not secrets.
    - **Legal pages.** Terms: replace General ¶1, Plans and payments (id `subscriptions` → `plans`), Cancellation, Refunds, Contact and grievance redressal, and Governing law as written. In Terms, Privacy, and User Policy, every hard-coded `EzPrep` becomes the brand value and every `support@ezprep.in` becomes the support email. This fixes PR-40: the Terms named "EzPrep Technologies Pvt. Ltd.", which does not match the invoice seller. Add the Privacy "Payments and billing" paragraph and update each page's `updated` date.
    - **Checkout.** Add the two lines under **Pay securely**.
    - **Commerce off.** When the catalog returns `commerceEnabled: false`, hide Buy and Extend and show "Purchases are not available yet." A direct visit to the checkout URL shows the same message instead of an error. This keeps the app correct on an instance whose API has not switched selling on yet.
    - Rebranding the header, logo, and non-legal pages is outside this phase (review § Go-live path).

## Behavior changes

| Before | After |
| --- | --- |
| First failed attempt ends the checkout | Modal stays open for retries; one outcome per modal |
| Verify error → "Payment could not be confirmed." | Up to 5 polls, then an honest "confirming" screen |
| Plan switch reuses the old order | New order for the new plan |
| Billing-profile save failure blocks payment | Never blocks |
| Refund: one click + reason | Also requires typing the order number |
| Terms describe auto-renewing subscriptions and trials | Terms describe one-time, non-renewing plans; checkout shows the consent line |

## Files to create

- `mock-app-admin/app/admin/commerce-health/page.tsx` + test
- `mock-app-admin/app/services/ezprep-api/commerce-health.ts` + test
- `ezprep-app/lib/checkout/poll-order-status.ts` (backoff schedule, visibility handling)

## Files that may be modified

Everything under Code references.

## Do-not-touch boundaries

- No API changes in this phase. A missing contract goes back to 14A–14C.
- No refund control in the student app (D-12).
- ezprep-app has no test runner (D-15): typecheck, ESLint on touched files, manual checklist.
- The GST display is 14E.

## Implementation tasks

1. Adapter lifecycle + timeout.
2. Polling confirmation and copy.
3. Idempotency fingerprint and error-code handling.
4. Ownership, `coveredForLife`, Extend copy.
5. Billing profile ordering; subscriptions lines.
6. Admin health page, filters, nav dot, Vitest.
7. Admin repair, markers, duplicates table, Vitest.
8. Refund typed confirmation, Vitest.
9. `lib/brand.ts`, legal pages, checkout lines, and the commerce-off state, exactly as in `LEGAL_COPY.md`.
10. Regression gate (admin Vitest + tsc, app typecheck + lint, manual smoke incl. non-commerce pages).

## Acceptance criteria

- In test mode, fail a card inside the modal, then pay with UPI in the same modal: verify runs, the success screen shows, and there is one paid order.
- Block the network after the success callback: at most 5 order reads, then the "confirming" screen. Access appears once the webhook settles it.
- Switch from plan A to plan B on the checkout URL: the order and the Razorpay amount are B's.
- A lifetime owner sees no Buy button, and a forced create shows the lifetime copy.
- The admin health page lists a deliberately unprovisioned order, and **Retry provisioning** clears it.
- A refund cannot be submitted without the exact order number.
- `/terms` contains no mention of renewal, trials, stored payment methods, app stores, or "Pvt. Ltd.". The rewritten sections match `LEGAL_COPY.md` word for word. Checkout shows the one-time and consent lines, and the links land on the right sections.
- With `NEXT_PUBLIC_BRAND_NAME=ExamFlex` and the other ExamFlex values set locally, `/terms`, `/privacy-policy`, and `/user-policy` show no "EzPrep" and no `ezprep.in` address.
- With the API at `COMMERCE_ENABLED=false`, no Buy button shows, and the checkout URL shows "Purchases are not available yet."

## Tests

**mock-app-admin Vitest:** health client and page (`ok` and `degraded`); filters; repair button visibility and call; markers; duplicates table; refund confirmation gating.

**ezprep-app:** `npm run typecheck`; ESLint on touched files. `poll-order-status.ts` is a pure function of time, so its schedule is checked by typecheck plus a manual run (no runner, D-15).

**Manual (append to `../E2E_TEST_STATUS.md`, do not tick):** the acceptance scenarios, plus the modal timeout near `expiresAt`, the "Starts {date}" line, and "Invoice is being prepared".

## Risks

R-06, R-22, new: the client misreports a successful payment.

## Rollback / isolation

Revert per repo. The API contracts from 14A–14C stay backward compatible with the phase 14 clients (see each phase's behavior-change table). The only purchase the old client could make that is now blocked is the D-24 repurchase.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] `E2E_TEST_STATUS.md` rows appended
- [ ] Admin Vitest green; app typecheck green; regression gate logged

## STATUS.md update (mandatory)

Same five steps as every phase. Developer ops:

- Run the acceptance scenarios in Razorpay test mode and record the outcomes in the session log.
- No wording approval is needed; it is locked in `LEGAL_COPY.md`.
- Production values for the seven brand and legal variables are set at go-live ([`../GO_LIVE_GUIDE.md`](../GO_LIVE_GUIDE.md) step 4), not in this phase.

## Definition of done

A customer who paid always ends on a paid screen or an honest "confirming" screen, never a false failure, and the client never polls more than five times. Admins can see and fix every stuck commerce state, and cannot refund by accident.
