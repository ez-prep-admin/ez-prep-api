# Phase 10 — GST Invoices

## Objective

Issue B2C GST tax invoices after payment capture: use order tax snapshots from `TaxService`, CGST/SGST vs IGST already computed at order time, calendar numbering `EZPREP/YYYY/####`, PDF with required seller/SAC/customer fields from **instance config snapshots**, user and admin download APIs. Email/credit notes out of scope.

## Prerequisites

- Phase 09 done (order PAID stable).
- Phase 07 TaxService + order.tax snapshot in place.
- Instance `seller` + `taxConfig` schema fields exist (seed local test values; production seed is `U-OPS-01`).

## Source documents

`../gst-invoicing.md`, `../domain-model.md` §9 §11, `../api-contracts.md` §2 §9, `../decisions.md` D-10 D-11 D-17 D-19, `../unknowns.md` (U-GST resolved; U-OPS-01 for prod values).

## Code references (ez-prep-api)

- Existing `src/aws/` S3 upload patterns
- `src/instance-config/` singleton pattern — extend for seller/taxConfig
- Order billing + tax snapshots from phase 07
- `TaxService` from phase 07

## Target behavior

1. After PAID (+ provision), idempotent `issueTaxInvoice(orderId)` — **only** for CAPTURED/PAID; never for failed/abandoned/cancelled/expired.
2. Persist TaxInvoice copying order tax + snapshotting seller/SAC from instance config **at issue time**.
3. Generate PDF with all required fields from [`../gst-invoicing.md`](../gst-invoicing.md) (incl. place of supply, reverse charge `No`, SAC, seller address).
4. Invoice numbers use **Indian FY** series `EZPREP/YYYY-YY/####`.
5. `GET /meta/indian-states` if not already shipped (required before phase 14).
6. User + admin PDF download with authZ.
7. SAC/rate/seller identity read from DB config — no hardcoded `999293` / GSTIN in code paths.
8. Support optional billing address on invoice when present on order (`U-GST-06`).

## Files to create

```
src/invoices/
src/invoices/pdf/
src/meta/indian-states.*   (if not created earlier)
```

Extend instance-config schema/DTOs/admin update path for seller + taxConfig (admin-only).

## Files that may be modified

- Paid orchestration to call invoice issuer
- Instance-config module
- `.env.example` only for non-secret flags if any (seller data is DB, not env)

## Do-not-touch boundaries

- No email sender.
- No credit notes.
- No per-product SAC admin UI.
- Do not recalculate tax from live config when issuing — use order snapshot (refresh seller/SAC snapshot at issue is OK for identity fields present on invoice; amounts must match order.tax).

## Implementation tasks

1. Extend instance-config with seller + taxConfig. Allow `seller.gstin` to be replaced (entity change). Do not reject the update for checksum or state-prefix mismatch (D-17).
2. Invoice number allocator (IST year).
3. PDF template including SAC, address, state codes.
4. Idempotent issuer + download endpoints.
5. Indian states meta endpoint.
6. Jest: no invoice on FAILED order; idempotent issue; PDF field presence; authZ; config-driven SAC.

## Requirements

- One invoice per order.
- Historical invoices immutable w.r.t. later taxConfig edits.
- PDF not publicly guessable.

## Acceptance criteria

- Paid order → downloadable PDF with seller address, GSTIN, SAC, correct tax lines from order snapshot.
- Failed/cancelled/expired orders never get invoices.
- Re-issue does not allocate a new number.
- Suite green.

## Tests (Jest)

1. Issue only when order PAID / payment CAPTURED.
2. Reject issue for FAILED / CANCELLED / EXPIRED.
3. Idempotent issue (same invoiceNumber).
4. Invoice tax fields equal order.tax snapshot.
5. SAC/seller come from config snapshot, not string literals in service.
6. User cannot download another user’s PDF; admin can.
7. Updating `seller.gstin` succeeds; an already issued invoice still shows the previous GSTIN snapshot.
8. Indian states endpoint returns code+name (includes Kerala `32`, Karnataka `29`).

## Risks

R-05, R-12, R-17.

## Rollback / isolation

Feature flag `INVOICES_ENABLED`; paid path skips issue if disabled.

## Completion checklist

- [x] `STATUS.md` updated with ops + **developer confirmation** (PDF smoke deferred to phase 16)
- [x] Instance seller/taxConfig schema + local seed
- [x] Invoice + PDF + downloads
- [x] Meta indian-states
- [x] No hardcoded SAC in business logic
- [x] U-OPS-01 noted for production seed


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

v1 invoice pipeline ready for checkout UI links (phase 14) and admin views.
