# Unknowns

Open questions that block design, compliance, or go-live. Resolved items stay at the bottom for traceability.

**Architecture unknowns (U-GST-01…03, U-GST-05, U-GST-06, U-GST-08, U-GST-09, U-RZ-*, U-BILL-01, U-MIG-01, U-LEG-01, U-OPS-01, U-OPS-02): RESOLVED as decisions.**  
**What remains are go-live execution steps** in [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md), not open design questions. Phase 14 is closed. Production is not live.

This pack is an engineering plan, **not legal advice**. Confirm with a Chartered Accountant before production invoicing.

Canonical ops tracker: [`STATUS.md`](STATUS.md).

---

## Still to confirm at go-live

These are checklist steps. The code already behaves as described. Details are in [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md).

### U-GST-07 — E-invoicing / IRN
- v1 does not integrate IRN. The CA verified the invoice that was issued without one.
- Revisit only if turnover later makes e-invoicing mandatory.

### U-GST-10 — Place of supply
- The PDF prints the buyer state collected at checkout.
- Owner will confirm that this is correct for SAC `999293`. No code change unless that confirmation amends it.

### U-GST-04 — Credit notes
- Refunds revoke access and leave the invoice issued. Credit notes are deferred to Zoho or a later phase.

### U-OPS-01 — Production seller and tax seed
- Values are confirmed. Run the existing seed against production Mongo when going live.

### U-OPS-02 — Production Razorpay
- Live keys are ready. When going live, put them in the production API env and register `https://api.ezpre.in/api/v1/webhooks/payments/razorpay`. Do not register that URL on `ezprep.in`.

---

## Resolved

### U-GST-08 — Invoice template — RESOLVED (CA, 2026-10-10)
- The CA verified the invoice that was issued. Seller and tax values can still be changed in the database. The computer-generated line stays.

### U-GST-09 — Invoice series — RESOLVED (owner, 2026-10-10)
- `EZPREP/YYYY-YY/####` is the series. It is not changing for go-live.

### U-OPS-01 and U-OPS-02 — RESOLVED as decisions (2026-10-10)
- Seller, tax, live keys, and the webhook host are known. Putting them into production is a go-live step, not an open question.

### U-GST-05 — SAC and 18% — RESOLVED (owner, 2026-10-09; reconfirmed 2026-10-10)
- Sharun confirmed GST **18%** and SAC **`999293`**. Stored in instance `taxConfig` via the seed script. Change later by editing that config and re-seeding, not by hardcoding. No separate CA letter is on file.

### U-GST-01 — GST rate and central tax config — RESOLVED
- GST-inclusive; central `taxConfig` at 18%; not per-offer; `TaxService` + snapshots. See `gst-invoicing.md`.

### U-GST-02 — Invoice fields, seller address, SAC — RESOLVED
- Seller legal name, registered address, GSTIN, SAC from instance config; PDF field list in `gst-invoicing.md`. Address/SAC first-class config.

### U-GST-03 — Seller state — RESOLVED
- Explicit `seller.state` / `stateCode` (Kerala / 32). Do not derive seller state from the GSTIN at runtime.
- Owner 2026-10-09: `seller.gstin` may change if the entity changes. No checksum gate that rejects the new value. Issued invoices keep the GSTIN snapshot from issue time.

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
| Billing (product) | Name + state + address always collected | D-10 |
| Invoice timing | Only after CAPTURED/PAID | D-11 |
| Refunds (app) | Admin full + revoke; credit note ops U-GST-04 | D-12 |
