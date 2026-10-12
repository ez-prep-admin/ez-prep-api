# Go-Live TODOs (must clear before production payments / GST invoices)

These items **do not block phased development**. Implement phases 01–14 with extension points and `TODO(golive): <id>` comments in code where a final CA/ops answer is still pending.

Before production goes live, every row below must be `done`, `accepted-with-CA-waiver`, or a step in [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md), and recorded in [`STATUS.md`](STATUS.md). The guide holds every production step; this board only logs compliance status.

**Policy:** Prefer additive, config-driven design. Do not hardcode unverified legal conclusions. Do not stop a phase because the CA has not replied — track it here instead.

Related: [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md) · [`unknowns.md`](unknowns.md) · [`gst-invoicing.md`](gst-invoicing.md) · [`STATUS.md`](STATUS.md)

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
| U-GST-11 | Supplier address `Kerala` alone | `registeredAddress` is `Kerala` (owner, 2026-10-10). It is config data; 14E updates the seed file | None | CA-verified 2026-10-10 |
| U-GST-12 | Equal CGST/SGST rounding | D-26: `cgst = sgst = round_half_up(gross × 9 / 118)`, taxable takes the remainder (₹999 → 846.62 + 76.19 + 76.19). Inter-state stays taxable 846.61 + IGST 152.39 | None | CA-verified 2026-10-10 |
| U-GST-13 | Invoice dated at payment, numbered at issue | D-25: `issuedAt = paidAt`; numbers are allocated when issued. A rare late repair gives an invoice a higher number than one dated after it, within the same FY series | None | CA-verified 2026-10-10 |
| U-OPS-01 | EZ Prep prod seller/tax seed | CA-verified values live in `scripts/commerce-seed/ezprep.json` (14E): legal name `EzPrep - Powered by Clustream`, GSTIN `32BIAPD6927L1ZC`, address `Kerala`, state Kerala `32`, 18%, SAC `999293`, prefix `EZPREP` | [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md) Step 15A | go-live step |
| U-OPS-02 | Prod Razorpay live | Live keys are ready. Local `.env` stays on test keys. Secrets are never committed. Capture automatic, late authorizations captured (owner, 2026-10-10; D-22). Razorpay disables a webhook after 24 hours of failed deliveries (verified) | `GO_LIVE_GUIDE.md` Steps 2A, 3, 7, 13A, 17A, 19A; Playbook P1 | go-live step |
| U-OPS-03 | nginx in front of the API | nginx is the only proxy, with no Cloudflare (owner, 2026-10-10). 14A reads `TRUST_PROXY_HOPS` (1 in production) | `GO_LIVE_GUIDE.md` Steps 12A/12B and 13 | go-live step |
| U-OPS-04 | ExamFlex selling | ExamFlex sells on the same code with its own seller identity and GSTIN (owner, 2026-10-10; D-29). No Redis is needed | `GO_LIVE_GUIDE.md` Step 0B, then every B step | go-live step (after EZ Prep) |
| U-OPS-05 | Website legal and contact details | Seven public per-deployment values (14D §10, `LEGAL_COPY.md`; PR-40). The website legal name must equal the invoice legal name | Owner supplies customer-care phone, grievance officer name, and (optionally) the full address: `GO_LIVE_GUIDE.md` Steps 1 and 4 | go-live input |

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
- 2026-10-10 (later): seller address changed to `Kerala` (U-OPS-01; CA check U-GST-11). Intra-state split confirmed as equal CGST 9% + SGST 9%, inter-state IGST 18% (D-26; rounding check U-GST-12). Invoice date = payment date (D-25; U-GST-13). Razorpay 24-hour webhook disable policy verified by the owner (U-OPS-02). nginx in front of `api.ezpre.in` confirmed (U-OPS-03).
- 2026-10-10 (final): U-GST-11, U-GST-12, U-GST-13 CA-verified. Capture settings set to automatic with late authorizations captured (U-OPS-02). nginx is the only proxy, so hop count 1 (U-OPS-03 becomes an execution step). ExamFlex will sell (U-OPS-04 added). Remaining before EZ Prep go-live are execution steps only (U-OPS-01, 02, 03), plus U-GST-10 confirmation; U-GST-07 applies only if turnover makes IRN mandatory, and U-GST-04 credit notes are handled in Zoho.
- 2026-10-10 (go-live guide): every production step moved into `GO_LIVE_GUIDE.md`; the U-OPS rows now point there. Legal and checkout wording locked in `LEGAL_COPY.md`. U-OPS-05 added: customer-care phone and grievance officer name are owner inputs before go-live (PR-40).
