# Phase 14 — User Checkout + Subscriptions Ownership

## Objective

Implement provider-neutral checkout in ezprep-app (Razorpay adapter behind a checkout registry), billing name + state collection, order create/verify, success/failure/cancel handling, and replace Coming Soon `/dashboard/subscriptions` with active entitlements/orders/invoice downloads.

## Prerequisites

- Phases 08–10 APIs available.
- Phase 13 access UI + checkout route shell.
- Razorpay **test** key id for local client (`NEXT_PUBLIC_RAZORPAY_KEY_ID` only); secrets never in app (D-18).
- States from `GET /api/v1/meta/indian-states` only — no client-side GST table (D-19).

## Source documents

`../api-contracts.md` §2 §4, `../decisions.md` D-07 D-09 D-10 D-14, `../gst-invoicing.md`, `../PAYMENT_GATEWAY.md` §21–23.

## Code references (ezprep-app)

- `app/dashboard/checkout/page.tsx` (shell from 13)
- `app/dashboard/subscriptions/page.tsx`
- `lib/api/client.ts` patterns for new `lib/api/checkout.ts`, `entitlements.ts`, `invoices.ts`
- `components/auth/` forms patterns; shadcn Dialog/Button/Select
- Sidebar nav `lib/mockData.ts` — remove comingSoon on subscriptions

## Target behavior

1. Checkout page: load offer/product; show price (effective); billing **name + state + full address** (line1, optional line2, city, pincode) — all required except line2; states from meta API; prefill billing profile; Pay CTA.
2. `CheckoutService.startCheckout` → POST order → open provider adapter (Razorpay Checkout.js) with server-provided order data.
3. On success: verify endpoint → refresh entitlements → navigate to success state / subscriptions.
4. Handle failure, dismiss/cancel, duplicate clicks, expired order, network errors.
5. Subscriptions page: active entitlements list (product name, scope summary, dates); order history; invoice PDF download links.
6. No refund UI.

## Files to create

```
lib/checkout/CheckoutService.ts
lib/checkout/adapters/razorpay.ts
lib/checkout/adapters/types.ts
lib/api/checkout.ts
lib/api/entitlements.ts
lib/api/invoices.ts
lib/api/billing.ts
components/checkout/*
components/subscriptions/*
```

## Files that may be modified

- checkout + subscriptions pages
- nav flags
- `.env.example` public key id only

## Do-not-touch boundaries

- Do not trust client amount.
- Do not add test infra.
- Do not implement coupons.

## Implementation tasks

1. API clients.
2. CheckoutService + Razorpay adapter registry.
3. Billing form + validation.
4. Full checkout UX states.
5. Subscriptions ownership UI + invoice download.
6. typecheck/lint + manual checklist on **local** against API with Razorpay test mode (tunnel webhooks optional).

## Requirements

- Provider-neutral UI copy (“Pay securely”) not “Razorpay-only” in headings.
- IdempotencyKey per Pay click (uuid) stored for retries carefully (new key only for new intent).
- After success, locked cards unlock without full reload if possible (refetch lists).
- Billing state select options loaded from backend meta API only.

## Acceptance criteria

- Local (test mode): buy offer → Razorpay test pay → entitlement active → start ENTITLED paper → invoice downloadable.
- Cancel/fail paths do not grant access; no invoice for abandoned/failed checkout.
- Double-click Pay does not create chaos (idempotency / disabled button).

## Tests

**Automated:** none.

**Manual checklist:**

- [ ] Prefill billing profile
- [ ] State required
- [ ] Pay success path end-to-end
- [ ] Verify failure shows error; no access
- [ ] User closes modal → order pending; webhook/recon later noted
- [ ] Duplicate Pay click guarded
- [ ] Expired order message
- [ ] Subscriptions shows active entitlement
- [ ] Invoice PDF downloads
- [ ] No refund control visible
- [ ] Mobile layout
- [ ] Locked card → View plans → Buy → success unlocks

## Risks

R-06 (webhook must cover abandoned verify — already phase 08/12).

## Rollback / isolation

Feature flag checkout route; keep subscriptions Coming Soon revert if needed.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] Checkout verified locally (Razorpay test)
- [ ] Subscriptions ownership live
- [ ] Env example updated (public key id only)
- [ ] Manual results in STATUS.md


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Full user purchase loop works on web against backend authority.
