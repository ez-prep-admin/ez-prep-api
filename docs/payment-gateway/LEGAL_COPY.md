# Legal and checkout copy (locked)

**Status: locked 2026-10-10.** This is the final customer-facing wording for paid plans. Phase 14D §10 implements it word for word. Change it only by editing this file and recording the change in `STATUS.md`.

Related: [`phases/phase-14d-checkout-client-and-admin-ops.md`](phases/phase-14d-checkout-client-and-admin-ops.md) §10 · [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md) step 4 · [`PRE_RELEASE_REVIEW.md`](PRE_RELEASE_REVIEW.md) PR-39, PR-40

## What this copy is built to satisfy

| Requirement | Where it is met |
| --- | --- |
| Consumer Protection (E-Commerce) Rules, 2020, rule 4(2): legal name, principal geographic address, customer-care and grievance officer contact details | Terms § Contact and grievance redressal |
| Rule 4(4)–(5): grievance officer name and designation; acknowledge within 48 hours, resolve within one month | Same section |
| Rule 7 (inventory e-commerce entity): refund, cancellation, payment methods, total price including taxes shown before purchase | Plans and payments, Cancellation policy, Refund policy, checkout lines |
| Legal name on the website matches the seller on the GST invoice | `NEXT_PUBLIC_LEGAL_NAME` equals the seed file's `legalName` (PR-40) |
| Digital Personal Data Protection Act, 2023 and IT Act: purpose of billing data, processor disclosure, retention | Privacy Policy § Payments and billing |
| Razorpay website requirements: terms, privacy, refund and cancellation policy, contact details, prices | All of the above, reachable from the footer and checkout |

## Per-deployment values (public, not secrets)

All seven are read from one module, `ezprep-app/lib/brand.ts`, so the same code serves both Vercel projects. They are public strings. Never put a secret in a `NEXT_PUBLIC_*` variable.

| Variable | EZ Prep value | ExamFlex value | Rule |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_BRAND_NAME` | `EzPrep` | `ExamFlex` | Brand shown in the copy |
| `NEXT_PUBLIC_LEGAL_NAME` | `EzPrep - Powered by Clustream` | ExamFlex seed file `legalName` | Must equal the invoice seller legal name exactly |
| `NEXT_PUBLIC_LEGAL_ADDRESS` | `Kerala, India` | ExamFlex seller address | Principal place of business. The full postal address as on the GST registration is preferred; at minimum, the address printed on invoices |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@ezprep.in` | ExamFlex support mailbox | Monitored mailbox |
| `NEXT_PUBLIC_SUPPORT_PHONE` | owner input | owner input | Customer-care number. The line is hidden when empty, but the go-live guide requires it |
| `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` | owner input | owner input | Name of the person appointed. Required by rule 4(4) |
| `NEXT_PUBLIC_LEGAL_JURISDICTION` | `Kochi, Kerala` | city and state of ExamFlex's principal place | Courts named in Governing law |

Code defaults are the EZ Prep values, except the phone and grievance officer, which default to empty.

In the copy below, `{BRAND}`, `{LEGAL_NAME}`, `{LEGAL_ADDRESS}`, `{SUPPORT_EMAIL}`, `{SUPPORT_PHONE}`, `{GRIEVANCE_OFFICER}`, and `{JURISDICTION}` stand for those values.

## Scope of edits

- **Terms (`app/terms/page.tsx`).**
  - Replace the sections below.
  - Replace every other hard-coded `EzPrep` with `{BRAND}` and every `support@ezprep.in` with `{SUPPORT_EMAIL}`, including the page metadata.
  - Rename section id `subscriptions` to `plans` and update the nav list.
  - Set `updated` to the deploy date.
- **Privacy Policy and User Policy.** Same brand and email replacement. Add the Privacy paragraph below. Update their `updated` dates.
- **Checkout.** Add the two lines below.
- Nothing else in the legal pages changes.

---

## Terms: General (first paragraph, replaces the "EzPrep Technologies Pvt. Ltd." wording)

> The {BRAND} website, apps, and related services (together, the "Service") are operated by {LEGAL_NAME}, {LEGAL_ADDRESS} ("{BRAND}", "we", or "us"). Your access to and use of the Service is governed by these Terms of Service ("Terms"). By creating an account, signing in, or using any part of the Service, you confirm that you have read, understood, and agree to these Terms.

## Terms: Plans and payments (id `plans`, replaces "Subscriptions and payments")

> Some content on the Service is free. Other content is available only with a paid plan. Before you pay, each plan shows what it includes, how long access lasts (a fixed period or lifetime), and its price.
>
> - **Prices.** All prices are in Indian Rupees and include GST. The amount shown at checkout is the total you pay.
> - **One-time payment.** Plans do not renew automatically. We do not store your card or other payment details, and we never charge you again unless you choose to buy again. There are no free trials that turn into paid plans.
> - **Payment processing.** Payments are processed by Razorpay, a third-party payment gateway, using card, UPI, net banking, wallet, or other methods it offers. You enter your payment details on Razorpay's secure checkout; {BRAND} does not receive or store your full card or bank details. Razorpay's terms and privacy policy also apply to the payment.
> - **When access starts.** Access starts as soon as your payment is confirmed. If you buy a plan you already have active access to, the new period starts when your current access ends. A plan you already own for life cannot be bought again.
> - **Tax invoice.** A GST tax invoice is issued by {LEGAL_NAME} for every payment and is available under Subscriptions in your account. Please enter accurate billing details at checkout. The invoice uses the details you provide, and the state you choose determines the GST applied.
> - **Personal use.** A plan is for your own account. It may not be shared, transferred, or resold.
> - **Changes.** We may change prices or plans at any time. A change never affects a plan you have already paid for.

## Terms: Cancellation policy (id `cancellation`, replaces the current text)

> You can cancel a purchase at any time before completing payment by closing the payment window. Nothing is charged.
>
> Access is granted immediately once payment is confirmed, so a completed purchase cannot be cancelled. Plans do not renew, so there is nothing to cancel for future periods. If we suspend or end your access for a breach of these Terms, no refund is due except where the law requires one.

## Terms: Refund policy (id `refunds`, replaces the current text)

> Paid plans give immediate access to digital content. Once access has been granted, payments are non-refundable, except in the cases below.
>
> 1. **Duplicate payment.** If you are charged more than once for the same purchase, the extra payment is refunded automatically to the original payment method. You do not need to ask.
> 2. **Money debited but purchase not confirmed.** Please do not pay again. We keep checking with Razorpay for up to 72 hours. If the payment went through, your access is granted automatically. If it did not, any amount held is released by your bank, usually within 5–7 working days.
> 3. **Service failure.** If a technical problem on our side stops you from using content you paid for, and we cannot fix it within 7 days of your report, you may request a full refund.
> 4. **Where the law requires a refund.**
>
> Any other refund is at our discretion.
>
> **How to request a refund.** Email {SUPPORT_EMAIL} within 30 days of payment, from your registered email address or quoting your registered mobile number, with the invoice or order number and the reason. We acknowledge every request within 48 hours.
>
> **Processing.** Approved refunds are initiated within 5–7 working days to the original payment method. Your bank usually credits the amount within a further 5–7 working days. A refund ends the access that the refunded plan gave. If a later purchase of the same plan was waiting to start, it starts immediately instead. A credit note is issued for the refunded amount.

## Terms: Contact and grievance redressal (id `grievance`, replaces the current block)

> **Seller.** {LEGAL_NAME}, {LEGAL_ADDRESS}.
>
> **Customer support.** Email {SUPPORT_EMAIL}{, phone {SUPPORT_PHONE}}.
>
> **Grievance Officer.** In accordance with the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, and the Information Technology Act, 2000 and the rules under it, our Grievance Officer is:
>
> {GRIEVANCE_OFFICER}, Grievance Officer, {LEGAL_NAME}
> Email: {SUPPORT_EMAIL}{ · Phone: {SUPPORT_PHONE}}
>
> Please include your registered email address or mobile number, the order or invoice number if relevant, and a clear description of the issue. We acknowledge every complaint within 48 hours and resolve it within one month of receipt. You may also contact the National Consumer Helpline on 1915 or at consumerhelpline.gov.in.

The parts in `{, ...}` render only when the phone value is set.

## Terms: Governing law (id `law`, only the court name changes)

> These Terms are governed by the laws of India, without regard to conflict-of-law rules. Subject to applicable law, the courts in {JURISDICTION}, India have exclusive jurisdiction over disputes arising out of these Terms or the Service.

## Privacy Policy: Payments and billing (new paragraph at the end of "Information we collect"; add `payments` to the nav)

> **Payments and billing.** When you buy a plan, we collect the billing name, state, and address you enter at checkout. We use them to issue the GST tax invoice the law requires and to apply the correct tax. Payments are processed by Razorpay. You enter your card, UPI, or bank details on Razorpay's checkout, and we never receive or store them. Razorpay tells us whether a payment succeeded, the payment method type, and a payment reference. We share with Razorpay only what it needs to process the payment, such as the amount, an order reference, and an internal account identifier. Invoices and payment records are kept for as long as tax law requires, currently at least six years, even if you delete your account.

## Checkout lines (under the **Pay securely** button)

> One-time payment. Does not renew. Prices include GST.
>
> By paying, you agree to the [Terms](/terms#plans) and the [Refund policy](/terms#refunds).

## In-app payment messages (14D, listed here so all customer copy is in one place)

| Situation | Message |
| --- | --- |
| Still confirming after the polls | We are confirming your payment. Your access will appear in Subscriptions shortly. |
| Already lifetime | You already have lifetime access. (link: Subscriptions) |
| Extend | Starts after your current access ends on {date}. |
| Too many open orders | You have a payment in progress. Finish or wait a few minutes. |
| Order expired in the modal | This payment window has expired. (button: Try again) |
| Commerce off (`commerceEnabled: false`) | Purchases are not available yet. |
| Paid, invoice not yet issued | Invoice is being prepared |
| Future start | Starts {date} |
