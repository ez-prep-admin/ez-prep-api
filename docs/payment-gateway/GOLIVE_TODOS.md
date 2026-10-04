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
| U-GST-04 | Credit notes on refund | App refund + entitlement revoke ships without in-app credit note; ops process via Zoho; `TODO(golive): U-GST-04` on refund service for future CreditNote module | CA/Zoho credit-note SOP proven; or ship in-app credit notes | open |
| U-GST-05 | SAC `999293` + 18% confirmation | Store in instance `taxConfig`; never hardcode in business logic | CA written confirmation; update config if different | open |
| U-GST-06 | Buyer address | **Resolved for product:** always collect billing address at checkout (see decisions D-10). Implement in phases 07/14 — not a deferral | Verify live invoices show address | product-resolved; verify at 14/15 |
| U-GST-07 | E-invoice / IRN | No IRN integration in v1; `TODO(golive): U-GST-07` if CA says mandated | CA: not applicable **or** plan IRN phase | open |
| U-GST-08 | Signature / e-sign on PDF | Ship “computer-generated invoice” + optional signatory fields from config; `TODO(golive): U-GST-08` | CA accepts template | open |
| U-GST-09 | FY invoice series Zoho mapping | Implement FY series `EZPREP/YYYY-YY/####` in phase 10 | CA/Zoho import OK | open |
| U-GST-10 | Place of supply = buyer state | Print POS from buyer state on PDF; `TODO(golive): U-GST-10` if CA amends | CA confirms for SAC | open |
| U-OPS-01 | Prod seller/tax seed | Local test seller config in phase 07/10 | Real legal name, address, GSTIN in prod DB | open |
| U-OPS-02 | Prod Razorpay live | Local test keys in phase 08/14 | Live keys + webhook URL | open |

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
