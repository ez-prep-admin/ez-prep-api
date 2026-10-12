# Phase 14E — GST supply type, seller identity, and per-instance commerce config (ad-hoc)

Ad-hoc phase from [`../PRE_RELEASE_REVIEW.md`](../PRE_RELEASE_REVIEW.md). Runs after 14A and before 14B. It is small and independent of the payment-state work. It lands early because 14B–14D tests build on the order tax snapshot it extends.

## Objective

1. Make the intra-state split exactly equal: CGST 9% = SGST 9%, in paise.
2. Store the supply type and seller state on every new order, and drive the invoice from them.
3. Change the EZ Prep seller address to `Kerala`.
4. Show the buyer and the admin the GST breakdown.
5. Let each instance (EZ Prep, ExamFlex) carry its own seller identity, GSTIN, and invoice series without any chance of writing one instance's values into the other's database (D-29).
6. Show the instance's own name in the Razorpay modal.

Findings: PR-29, PR-30, PR-31, PR-32, PR-35, PR-36. Decisions: D-26, D-29.

## What is already correct (verified 2026-10-10, do not rework)

- Supply type is decided from `seller.stateCode` (instance config; `32` for EZ Prep) versus the buyer's billing `stateCode`. Same state → CGST + SGST; different → IGST (`calculate-inclusive-tax.ts` L47–50). This is per instance: if ExamFlex's GSTIN is registered in another state, its own state code drives its split with no code change.
- Invoice PDFs carry no brand strings. Seller, GSTIN, SAC, and series prefix all come from instance config.
- The PDF prints `CGST @ 9%` / `SGST @ 9%` or `IGST @ 18%`, the place of supply `{state} ({code})`, and reverse charge `No`.
- Order and invoice snapshot the tax; old documents are never recalculated.

## Prerequisites

- 14A done (harness).
- D-26 and D-29 in `../decisions.md`.
- The CA accepted the `Kerala` address, the equal-split rounding, and the date-vs-number order (`U-GST-11`, `U-GST-12`, `U-GST-13`; 2026-10-10).

## Source documents

`../gst-invoicing.md` §3–§6, `../decisions.md` D-10 D-17 D-26 D-29, `phase-07-orders-payments-port.md` (TaxService), `phase-10-gst-invoices.md`.

## Code references

**ez-prep-api**

- `src/common/commerce/calculate-inclusive-tax.ts` + `.spec.ts`
- `src/tax/tax.service.ts` + `.spec.ts`
- `src/orders/schemas/order.schema.ts` (`OrderTaxSnapshot`), `src/orders/dto/checkout-order-response.dto.ts`, admin order DTOs
- `src/invoices/invoice.service.ts` (issue: seller identity vs order snapshot), `src/invoices/schemas/*.ts`
- `src/invoices/pdf/render-tax-invoice-pdf.ts` (`taxRows`) + spec
- `scripts/seed-local-tax-config.ts`, `package.json` (script name)
- `src/orders/checkout.service.spec.ts` (fixtures that pin 7619/7620)
- `src/payments/infrastructure/razorpay/razorpay.gateway.ts` (create: `providerData`)

**ezprep-app:** `lib/api/checkout.ts` (`CheckoutOrder` type), `components/checkout/CheckoutClient.tsx`, `components/subscriptions/SubscriptionsClient.tsx`

**mock-app-admin:** `app/services/ezprep-api/orders.ts`, `app/admin/orders/[id]/page.tsx`

**ezprep-app (merchant name):** `lib/checkout/adapters/razorpay.ts` (L111)

## Target behavior

### 1. Equal split (PR-29, D-26)

All in integer paise, with round half up:

```text
intra-state:  half    = round_half_up(gross × rate / (2 × (100 + rate)))
              cgst    = sgst = half
              taxable = gross − 2 × half
              igst    = 0

inter-state:  taxable = round_half_up(gross × 100 / (100 + rate))   // unchanged
              igst    = gross − taxable
              cgst    = sgst = 0
```

| Gross | Supply | Taxable | CGST | SGST | IGST |
| --- | --- | --- | --- | --- | --- |
| ₹999.00 | intra | 846.62 | 76.19 | 76.19 | 0 |
| ₹999.00 | inter | 846.61 | 0 | 0 | 152.39 |
| ₹499.00 | intra | 422.88 | 38.06 | 38.06 | 0 |
| ₹1.00 | intra | 0.84 | 0.08 | 0.08 | 0 |
| ₹0.00 | either | 0 | 0 | 0 | 0 |

The implementation must assert the following and add a property test over gross 0…500000 paise at rates 0, 5, 12, 18, 28:

- `taxable + cgst + sgst + igst === gross`
- `cgst === sgst`
- every amount ≥ 0
- the result is within one paisa of the exact value

Odd rates (for example 5%) give a 2.5% half, and the formula handles them with no special case.

Use integer arithmetic for the division and the rounding (numerator and denominator as integers, as the current code does), never floating point.

### 2. Supply type snapshot (PR-30)

- `OrderTaxSnapshot` gains `supplyType: 'INTRA_STATE' | 'INTER_STATE'`, `sellerStateCode`, and `buyerStateCode`, set by `TaxService` at checkout. They are optional in the schema so that old orders stay valid.
- **Invoice issue:**
  - **Supply type.** Copy `supplyType` from the order. For an old order without one, derive it from the order's own split (`igst > 0` → inter, else intra) and never from live config.
  - **Seller state mismatch.** If the live `seller.stateCode` differs from `order.tax.sellerStateCode`, refuse to issue, log `INVOICE_SELLER_STATE_MISMATCH`, and list the order in health (14C). A GSTIN or state change mid-flight needs a person, not a silent mismatched invoice.
- **PDF.** `taxRows` branches on `supplyType` (falling back as above). It also prints `Supply type: Intra-state` or `Inter-state` next to the place of supply.
- **No recalculation.** Existing orders and invoices are never recalculated. The 7619/7620 local invoices stay as issued.

### 3. Seller address (PR-32)

- The EZ Prep seed file (§5) has `registeredAddress: 'Kerala'`. Re-run the seed locally; it updates the config row.
- Already-issued invoices keep their `Kochi, Kerala` snapshot. Invoices are legal documents and are not rewritten.
- The production seed at go-live (`U-OPS-01`) uses `Kerala`.

### 5. Per-instance tax seed (PR-36, D-29)

- **Seed files.** The hardcoded `TAX_CONFIG` and `SELLER` constants move to `scripts/commerce-seed/<instanceId>.json`, one per instance.
  - `ezprep.json` is committed with the CA-verified values: legal name, GSTIN `32BIAPD6927L1ZC`, address `Kerala`, state Kerala `32`, 18%, SAC `999293`, prefix `EZPREP`.
  - `examflex.example.json` is committed as a template. The real `examflex.json` is added when the owner supplies ExamFlex's values (`U-OPS-04`).
  - These values are printed on every invoice and are not secrets.
- **Command.** `npm run commerce:seed-tax-config` (the old `commerce:seed-local-tax-config` name stays as an alias).
  - **Instance guard.** Loads the file for `INSTANCE_ID` from env, and refuses if the file's `instanceId` field differs from it.
  - **Dry run by default.** Prints the target database name and a field-by-field diff of `seller` and `taxConfig`.
  - **`--apply` to write.** In production (`NODE_ENV=production`) it also requires `--confirm-db <database name>`, so running against the wrong `MONGODB_URI` is caught before any write.
- **Validation before writing:**
  - GSTIN is 15 characters.
  - `stateCode` is a known Indian state code (the existing D-19 list).
  - The rate is an integer 0–100.
  - The prefix is `[A-Z0-9]+`.
  - There is no GSTIN checksum or state-prefix check (D-17).
- **Config is read-only after go-live.** Changing a GSTIN or seller state on a live instance is a deliberate act. The 14E seller-state mismatch guard (§2) stops in-flight orders from being invoiced under the new state.

### 6. Merchant name from the instance (PR-35)

- The Razorpay create response's `providerData` gains `merchantName`, taken from the API's existing `INSTANCE_NAME` env (`EZ Prep` / `ExamFlex`).
- The app adapter uses it for Checkout.js `name`, falling back to `'EzPrep'`. No app env and no new endpoint are needed.

### 4. Show the breakdown (PR-31)

- **ezprep-app.**
  - Under the price on checkout: "Price includes GST". This is static, because the split depends on the billing state and is computed on the server.
  - On the success screen and on each Subscriptions order row: the gross, then "incl. CGST 9% ₹x + SGST 9% ₹y" or "incl. IGST 18% ₹z", from the order's `tax` field.
  - `tax` is already in the checkout order response (`checkout-order-response.dto.ts`). Add it as an optional field to the `me/orders` list and detail DTOs, and to the app's `CheckoutOrder` and `MyOrder` types.
  - No new endpoint.
- **mock-app-admin.** On order detail, a tax block shows taxable, CGST, SGST, IGST, rate, supply type, and buyer state. Add optional `tax` to the admin order detail DTO, which does not expose it today.

## Behavior changes (intentional)

| Before | After | Consumer impact |
| --- | --- | --- |
| ₹999 intra: taxable 84661, CGST 7619, SGST 7620 | taxable 84662, CGST 7619, SGST 7619 | New orders only. Spec fixtures change in the same commit: `calculate-inclusive-tax.spec.ts`, `tax.service.spec.ts`, `checkout.service.spec.ts`, invoice PDF spec |
| Inter-state | Unchanged | — |
| PDF picks the layout from `igst > 0` | From `supplyType`, with a fallback | Same output for every existing invoice |
| Address `Kochi, Kerala` | `Kerala` on new invoices | Existing invoices unchanged |
| Order DTOs | Checkout DTO gains optional `tax.supplyType`, `sellerStateCode`, `buyerStateCode`; `me/orders` and admin detail gain optional `tax` | Additive; the phase 14 clients ignore unknown fields |
| Seed script hardcodes EZ Prep | Per-instance file, dry run by default | Ops command changes (`U-OPS-01`, `U-OPS-04`). The old npm name still works |
| Razorpay modal shows "EzPrep" everywhere | Shows the instance name | EZ Prep shows "EZ Prep" (from `INSTANCE_NAME`) |

## Files to create

- `scripts/commerce-seed/ezprep.json`, `scripts/commerce-seed/examflex.example.json`
- `scripts/commerce-seed/seed-tax-config.ts` (replaces the body of the old script), plus a spec for its pure parts: file selection, validation, diff
- Optionally `src/common/commerce/calculate-inclusive-tax.property.spec.ts`

## Files that may be modified

Everything under Code references, `../gst-invoicing.md`, `../domain-model.md`.

## Do-not-touch boundaries

- Invoice numbering, FY logic, and S3 handling are unchanged (the invoice date rule is 14C).
- No credit notes.
- No change to which state counts as the seller's: that stays config.

## Implementation tasks

1. Equal-split formula + table and property specs; update the pinned fixtures in the same commit.
2. Snapshot fields in `TaxService` and the order schema; DTOs.
3. Invoice issue: copy the supply type, fall back, refuse on seller-state mismatch.
4. PDF `taxRows` by supply type + supply-type line; PDF spec for both layouts and the fallback.
5. Per-instance seed (files, guard, dry run, `--confirm-db`, validation); `Kerala` address; re-seed locally.
6. `merchantName` in `providerData`; adapter uses it.
7. App breakdown lines and types; admin tax block + Vitest.
8. Regression gate; record the fixture changes in the STATUS session log.

## Acceptance criteria

- A Kerala buyer (`32`) paying ₹999 gets an invoice with CGST @ 9% ₹76.19, SGST @ 9% ₹76.19, taxable ₹846.62, total ₹999.00, and supplier address `Kerala`.
- A Tamil Nadu buyer (`33`) paying ₹999 gets IGST @ 18% ₹152.39, taxable ₹846.61, total ₹999.00.
- An invoice issued before this phase still downloads byte-identical, because its stored PDF is served from S3.
- Changing the seller state code in local config between payment and issue blocks the issue and shows it in health.
- With `INSTANCE_ID=examflex`, the seed refuses `ezprep.json`; with no `examflex.json`, it fails with a clear message. A dry run changes nothing.
- A local API run with `INSTANCE_ID=examflex`, `INSTANCE_NAME=ExamFlex`, a separate database, and a test `examflex.json` issues an invoice with that seller, GSTIN, and prefix, and the Razorpay modal says "ExamFlex".

## Tests

1. Formula table + property test.
2. `TaxService` snapshot fields, intra and inter.
3. Invoice issue: supply type copied; old order fallback; mismatch refusal.
4. PDF rows for intra, inter, and fallback.
5. Seed: instance mismatch refused; validation table; diff output; production without `--confirm-db` refused.
6. Razorpay create includes `merchantName`.
7. Admin Vitest for the tax block. App: typecheck + lint.

**Manual (append to `../E2E_TEST_STATUS.md`, do not tick):** one intra-state (Kerala) and one inter-state purchase in test mode. Check both PDFs against the acceptance rows, and check the breakdown on the success screen, Subscriptions, and admin order detail.

## Risks

R-05 (GST incorrect on invoice), R-17 (seller/tax config), R-30 (wrong instance's seller identity).

## Rollback / isolation

Revert the phase. Orders created during it keep their equal split, which is valid. The fallback means the PDF code reads them either way.

## Completion checklist

- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] Local config re-seeded with `Kerala`
- [ ] `gst-invoicing.md` updated (split rule, fixture, address)
- [ ] Tests green; regression gate logged

## STATUS.md update (mandatory)

Same five steps as every phase. Developer ops:

- Run `npm run commerce:seed-tax-config` (dry run), check the diff, then run it with `--apply`.
- Make one intra-state and one inter-state purchase locally and open both PDFs.
- Run the second-instance smoke from the acceptance criteria.

## Definition of done

Every new invoice states the supply type it was priced with. An EZ Prep buyer in Kerala sees equal CGST and SGST at 9% each, and any other state sees IGST at 18%. The seller block says `Kerala`. Buyers and admins can see the breakdown. Each instance can only be seeded with its own seller identity, and the payment modal shows the instance's name.
