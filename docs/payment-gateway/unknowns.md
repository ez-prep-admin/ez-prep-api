# Unknowns

Open questions that block design, compliance, or go-live. Resolved items stay at the bottom for traceability.

**Architecture unknowns (U-GST-01…03, U-RZ-*, U-BILL-01, U-MIG-01, U-LEG-01, U-GST-06 address): RESOLVED.**  
**Remaining CA/ops items are go-live TODOs** — they do **not** block phases 01–14. Track in [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md); clear before production live (phase 15).

This pack is an engineering plan, **not legal advice**. Confirm with a Chartered Accountant before production invoicing.

Canonical ops tracker: [`STATUS.md`](STATUS.md).

---

## Open — operations

### U-OPS-01 — Seed production seller/tax config values
- **Question:** Exact production strings for seller `legalName`, `registeredAddress`, `gstin`, and Kerala `state` / `stateCode` (`32`).
- **Why it matters:** Instance DB config; never hardcode in source.
- **Blocks:** Production invoice issuance.
- **Record in:** `STATUS.md` after seeding.

### U-OPS-02 — Production Razorpay live credentials
- **Question:** Live key id/secret/webhook secret + production webhook URL in Razorpay dashboard.
- **Blocks:** Production payments.
- **Record in:** `STATUS.md`.

---

## Open — GST / accounting compliance (CA required)

### U-GST-04 — Credit notes on refund (high priority for filing)
- **Question:** Until in-app credit notes exist, what is the mandatory Zoho Books / GST portal process when an admin refunds a paid order?
- **Why it matters:** Refunding money and revoking access **without** a credit note (CGST §34) can leave outward tax liability overstated. App v1 explicitly defers credit notes.
- **Interim rule (engineering):** On every admin refund, `STATUS.md` must record that a **credit note was issued in Zoho** (or CA workflow) for the same invoice/order. Do not treat app refund alone as GST-complete.
- **Options:** A) Manual Zoho credit note per refund (v1). B) Build in-app credit notes (later phase).
- **Blocks:** Clean GSTR adjustment after first production refund — not phase 01 coding.

### U-GST-05 — SAC and 18% confirmation for *your* registration
- **Question:** Does your GST registration / CA confirm SAC `999293` and 18% for EZ Prep’s actual online mock-test / coaching-style supplies (vs any exempt education entry)?
- **Why it matters:** Misclassification is an audit risk. Config defaults to 999293 / 18% per your stated intent; CA must sign off.
- **Blocks:** First live invoice confidence.

### U-GST-06 — Recipient address on tax invoice — RESOLVED (product)
- **Decision:** Always collect billing **address** (line1, optional line2, city, pincode) + name + state at checkout (D-10).
- Implement in order billing snapshot (phase 07) and checkout UI (phase 14); print on PDF (phase 10).
- Remaining: verify live PDF in go-live checklist (`GOLIVE_TODOS.md`).

### U-GST-07 — E-invoicing / IRN applicability
- **Question:** Is EZ Prep (by aggregate turnover) required to report B2B e-invoices or any B2C e-invoice scheme? v1 is B2C-only and does not integrate IRN/e-invoice portal.
- **Why it matters:** If turnover crosses notified thresholds, additional systems may be required.
- **Blocks:** Only if CA says you are in e-invoice mandate for these supplies.

### U-GST-08 — Signature / digital signature on PDF
- **Question:** Rule 46 includes signature or digital signature of supplier, with relaxation for documents issued in accordance with the IT Act, 2000.
- **Options:** A) CA accepts system-generated PDF without wet signature. B) Add digital signature. C) Add authorized signatory name/designation block as practice.
- **Blocks:** PDF template finalization (phase 10) — low code risk if CA accepts electronic invoice under IT Act.

### U-GST-09 — Invoice series: financial year vs calendar year
- **Question:** Owner earlier preferred `EZPREP/2026/0001` (calendar year). CGST Rule 46 / GST Council materials describe consecutive serial numbers **unique for a financial year**.
- **Engineering decision after compliance review:** Default series to **Indian financial year** `EZPREP/YYYY-YY/####` (e.g. `EZPREP/2025-26/0001`), reset sequence each FY (Asia/Kolkata). See `decisions.md` D-11 and `gst-invoicing.md`.
- **Still confirm with CA** that this format is acceptable for your books/Zoho import.
- **Blocks:** Phase 10 numbering implementation detail (FY is the planned default).

### U-GST-10 — Place of supply wording for online coaching / mock tests
- **Question:** For GSTR-1, place of supply for these services should be recipient’s state (based on state collected at checkout) for typical B2C online supplies — confirm with CA that treating buyer state as POS is correct for your SAC.
- **Blocks:** Correct GSTR-1; invoice must print Place of supply (especially interstate).

---

## Resolved

### U-GST-01 — GST rate and central tax config — RESOLVED
- GST-inclusive; central `taxConfig` at 18%; not per-offer; `TaxService` + snapshots. See `gst-invoicing.md`.

### U-GST-02 — Invoice fields, seller address, SAC — RESOLVED
- Seller legal name, registered address, GSTIN, SAC from instance config; PDF field list in `gst-invoicing.md`. Address/SAC first-class config.

### U-GST-03 — Seller state — RESOLVED
- Explicit `seller.state` / `stateCode` (Kerala / 32); GSTIN validated against stateCode; no GSTIN-only parsing at runtime.

### U-RZ-01 — Environments and webhooks — RESOLVED
- Local + production only; test mode + optional tunnel; signed fixtures; no staging prerequisite.

### U-RZ-02 — Razorpay env var names — RESOLVED
- `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET`; secrets never in browser.

### U-BILL-01 — Indian states API — RESOLVED
- `GET /api/v1/meta/indian-states` → `{ code, name }[]`.

### U-MIG-01 — Launch access model — RESOLVED
- Script marks **papers** FREE; no mass user entitlements; admins flip to ENTITLED later.

### U-LEG-01 — In-progress attempts — RESOLVED
- start requires access; IN_PROGRESS resume/submit do not re-check entitlement.

---

## Earlier planning resolutions (traceability)

| Topic | Resolution | Where |
| --- | --- | --- |
| Legacy papers | FREE via script | D-02, D-20 |
| Purchase / duration | One-time INR + presets | D-03 |
| Offers / sale | One ACTIVE per product+duration | D-04 |
| Stacking | Extend from expiresAt | D-09 |
| Billing (product) | Name + state; address pending U-GST-06 | D-10 |
| Invoice timing | Only after CAPTURED/PAID | D-11 |
| Refunds (app) | Admin full + revoke; credit note ops U-GST-04 | D-12 |
