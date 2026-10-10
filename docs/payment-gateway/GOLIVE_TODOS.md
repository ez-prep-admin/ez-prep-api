# Go-Live TODOs (must clear before production payments / GST invoices)

These items **do not block phased development**. Implement phases 01–14 with extension points and `TODO(golive): <id>` comments in code where a final CA/ops answer is still pending.

Before phase 15 marks production live, every row below must be `done` or `accepted-with-CA-waiver` and recorded in [`STATUS.md`](STATUS.md).

**Policy:** Prefer additive, config-driven design. Do not hardcode unverified legal conclusions. Do not stop a phase because the CA has not replied — track it here instead.

Related: [`unknowns.md`](unknowns.md) · [`gst-invoicing.md`](gst-invoicing.md) · [`STATUS.md`](STATUS.md)

---

## How to use

1. During a phase, if you hit a compliance unknown: implement the **non-blocking** path (see table), leave `TODO(golive): U-xxx` in code, ensure a row exists here.
2. Do not invent tax law. Defaults in config are intentional placeholders until CA confirms.
3. Phase 15 completion requires this board clear (or explicit waiver logged in STATUS).

---

## Board

| ID | Item | Dev approach (non-blocking) | Before go-live | Status |
| --- | --- | --- | --- | --- |
| U-GST-04 | Credit notes on refund | App refund + entitlement revoke is accepted for now. No in-app credit note. `TODO(golive): U-GST-04` stays for a later CreditNote module | Handle credit notes in Zoho or a later phase. Not a phase 15 design question | deferred go-live step |
| U-GST-05 | SAC `999293` + 18% confirmation | Store in instance `taxConfig`; never hardcode in business logic | Owner reconfirmed 2026-10-10. Change later only by editing config and re-seeding | owner-confirmed |
| U-GST-06 | Buyer address | Always collected at checkout. CA verified the invoice that prints it. Values can still be edited in the database | Glance at the first production invoice after the prod seed | CA-verified locally |
| U-GST-07 | E-invoice / IRN | No IRN integration in v1. The CA verified the invoice that was issued without an IRN | Confirm only if turnover later makes e-invoicing mandatory | open |
| U-GST-08 | Signature / e-sign on PDF | Computer-generated invoice. CA verified the invoice. Seller values remain editable in the database | No template change required for go-live | CA-verified 2026-10-10 |
| U-GST-09 | FY invoice series | `EZPREP/YYYY-YY/####` is accepted as the standard series | No series change for go-live | accepted 2026-10-10 |
| U-GST-10 | Place of supply = buyer state | PDF already prints the buyer state collected at checkout | Owner will confirm this for the SAC before or during go-live. Not a code change unless the CA amends it | go-live confirmation |
| U-OPS-01 | Prod seller/tax seed | Values confirmed: legal name `EzPrep - Powered by Clustream`, GSTIN `32BIAPD6927L1ZC`, Kochi, Kerala `32`, 18%, SAC `999293`. Local DB is seeded | At go-live, run `npm run commerce:seed-local-tax-config` against production Mongo. Do not hardcode the values | go-live step |
| U-OPS-02 | Prod Razorpay live | Live keys are ready. Local `.env` stays on test keys. Secrets are never committed | At go-live, put the live key id, key secret, and webhook secret in the production API env. Register the webhook on `https://api.ezpre.in/api/v1/webhooks/payments/razorpay` (the API host, not `ezprep.in`). Events: `payment.captured`, `order.paid`, `refund.processed`, `refund.failed` | go-live step |

---

## What must NOT be deferred (bake into code now)

These are cheap to do correctly up front and painful to retrofit after live invoices exist:

| Concern | Why bake in now |
| --- | --- |
| Billing **name + state + address** on order/invoice snapshots | Schema + checkout + PDF; agreed always collect |
| Money in **paise**, tax-inclusive + `TaxService` snapshots | Historical invoices immutable |
| Invoice series **financial year** uniqueness | Changing series after go-live confuses GSTR/Zoho |
| Place of supply + reverse charge line on PDF template | Rule 46 fields |
| Seller/tax/SAC from **instance config** (not literals) | CA can change values without redeploy |
| Idempotent invoice per paid order only | Filing integrity |
| Provider port / entitlement model / accessMode | Core architecture |

---

## Feasibility note

Deferring CA answers as go-live TODOs is **feasible** and will not paint the codebase into a corner **if** the bake-in list above is followed. In-app credit notes and IRN are additive modules. Config values (SAC, rate, seller identity) are data. The only high-cost mistake would be shipping live with wrong series/snapshots/missing address on orders — those are not deferred.

---

## Clearance log

Record when each ID is closed (also copy a line into STATUS.md session log):

```markdown
- YYYY-MM-DD: U-GST-0X cleared — evidence: …
```

- 2026-10-09: U-GST-05 owner-confirmed — Sharun: GST 18% and SAC `999293`. Editable later via instance `taxConfig`, not a code change. Not a separate CA letter.
- 2026-10-10: U-GST-05 reconfirmed. U-GST-08 and the issued invoice CA-verified. U-GST-09 series accepted. U-GST-04 credit notes deferred. U-GST-10 place of supply stays a later confirmation. U-OPS-01 and U-OPS-02 are execution steps at go-live, not open design questions. Live webhook host is `api.ezpre.in`.
