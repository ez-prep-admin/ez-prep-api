# GST Invoicing (v1)

B2C tax invoices for India. Rates and classification live in **instance/business config** (DB), not hardcoded.

**Not legal advice.** Align with CGST Act/Rules and your CA before live use. Compliance review notes and open items: [`unknowns.md`](unknowns.md) U-GST-04…10. Ops checklist: [`STATUS.md`](STATUS.md).

Decisions: [`decisions.md`](decisions.md) D-11 / D-17.

---

## 1. Scope

| In v1 | Out of v1 |
| --- | --- |
| B2C tax invoice PDF after payment CAPTURED / order PAID | B2B buyer GSTIN |
| Download in user app + admin | Email delivery |
| One GST invoice PDF per paid order (also the post-payment download) | A separate payment-receipt PDF |
| CGST+SGST vs IGST from seller/buyer state codes | In-app credit notes (ops via Zoho — U-GST-04) |
| Financial-year invoice series | Calendar-year-only series |
| GST-inclusive offer amounts | Exclusive + add-at-checkout UX |
| Central tax config (18% coaching/training intent) | Per-offer / per-product SAC or rate |
| Place of supply + reverse-charge declaration on PDF | E-invoice IRN integration (U-GST-07) |

**Do not generate invoices for:** failed payments, abandoned checkout, cancelled orders, expired orders.

Invoice creation must be **idempotent** (one invoice per paid order).

---

## 2. Compliance checklist (Rule 46–oriented)

Engineering targets the following on every issued PDF. Items marked **CA** need sign-off.

| # | Particular | v1 plan |
| --- | --- | --- |
| 1 | Supplier name, address, GSTIN | From `seller` config snapshot |
| 2 | Consecutive serial number unique per **financial year** | `EZPREP/YYYY-YY/####` (IST FY) |
| 3 | Date of issue | IST date/time of issue (= after capture) |
| 4 | Recipient name | Checkout billing name |
| 5 | Recipient address | Always collected at checkout (D-10); print on PDF |
| 6 | Recipient state + code | Checkout `state` / `stateCode` (mandatory for online B2C POS) |
| 7 | SAC | From `taxConfig.sacCode` snapshot (intent `999293`) |
| 8 | Description of service | Product name + duration (+ SAC description) |
| 9 | Taxable value | From TaxService snapshot (exclusive of tax) |
| 10 | Rate of tax | Snapshot (e.g. 18%; show CGST 9% + SGST 9% or IGST 18%) |
| 11 | Tax amounts | CGST/SGST or IGST from snapshot |
| 12 | Total value | Inclusive gross |
| 13 | Place of supply | Buyer state name (+ code); required especially for interstate |
| 14 | Reverse charge | Print `No` (normal B2C forward charge) unless CA says otherwise |
| 15 | Signature / e-sign | **U-GST-08** — CA; system PDF under IT Act often accepted |

**Inclusive pricing is allowed** provided the invoice still shows taxable value and tax break-up (reverse-calculate via TaxService). Customers pay gross; books report taxable + tax.

---

## 3. Instance / business configuration (DB)

Extend instance-config (singleton) — **not hardcoded**:

### `taxConfig`

| Field | Example / rule |
| --- | --- |
| `taxEnabled` | `true` |
| `taxType` | `GST` |
| `taxRate` | `18` (percent). Not a per-offer admin field |
| `pricesAreTaxInclusive` | `true` |
| `currency` | `INR` |
| `sacCode` | `"999293"` from config only |
| `sacDescription` | `"Commercial training and coaching services"` |
| `invoiceSeriesPrefix` | `EZPREP` |

### `seller`

| Field | Notes |
| --- | --- |
| `legalName` | `EzPrep - Powered by Clustream` (owner, 2026-10-09) |
| `gstin` | `32BIAPD6927L1ZC` today. Replace this config value if the legal entity changes. Do not block the new GSTIN with a checksum or state-prefix check |
| `registeredAddress` | `Kerala` (owner, 2026-10-10; was `Kochi, Kerala`. Invoices issued before the change keep their snapshot. CA check `U-GST-11`) |
| `state` | `Kerala` |
| `stateCode` | `32` |

Local seed writes these values. Production Mongo still needs the same seed at phase 15 (`U-OPS-01`). SAC `999293` and 18% are owner-confirmed (`U-GST-05`) and stay in config so they can change without a code edit.

---

## 4. TaxService

```text
calculateInclusiveTax(input): TaxBreakdown
```

**Input:** `grossAmount` (paise), `taxRate`, `sellerStateCode`, `buyerStateCode`  
**Output:** `grossAmount`, `taxableAmount`, `taxAmount`, `cgst`, `sgst`, `igst`, `taxRate`  
(+ derive display rates: CGST/SGST each `taxRate/2`, IGST `taxRate`)

### Inclusive reverse calculation

The seller is registered in Kerala (`32`). The supply type comes from the buyer's billing `stateCode` (D-26).

For inclusive `P` in paise and an integer percent rate `R` (18), using integer arithmetic only:

Intra-state (`buyerStateCode === sellerStateCode`): CGST and SGST are each `R/2` (9%) and **equal in paise**.

```text
half          = round_half_up(P × R / (2 × (100 + R)))
cgst = sgst   = half
taxableAmount = P − 2 × half
taxAmount     = 2 × half
igst          = 0
```

Inter-state: a single IGST at `R` (18%).

```text
taxableAmount = round_half_up(P × 100 / (100 + R))
igst          = P − taxableAmount
cgst = sgst   = 0
```

Invariants: `taxable + cgst + sgst + igst = P`; `cgst = sgst`; each amount is within one paisa of the exact value. The one-paisa difference in taxable value between the two cases is inherent to rounding an inclusive price into paise (CA check `U-GST-12`).

### Canonical fixture (₹999 inclusive @ 18%), from phase 14E

```text
Same state (Kerala → Kerala):   taxable 846.62, CGST 9% 76.19, SGST 9% 76.19, IGST 0
Interstate (Kerala → any other): taxable 846.61, IGST 18% 152.39
```

Orders priced before 14E used `taxable = round_half_up(P × 100 / (100 + R))` for both cases, with the odd paisa going to SGST (₹999 → CGST 76.19, SGST 76.20). Those snapshots stay as issued.

**Snapshot** onto the Order at create, including `supplyType`, `sellerStateCode`, and `buyerStateCode` (14E), and onto the Invoice at issue. The invoice copies the supply type from the order. Never recalculate old documents from the live `taxConfig`. The invoice date is the order's `paidAt` (D-25).

---

## 5. Offers and money

- Store amounts in integer **paise** (₹999 → `99900`), tax-inclusive.
- Order create: resolve effective amount → `TaxService` → snapshot tax + billing (name, state, stateCode, **address if collected**).
- Invoice issue: copy the order tax, including the supply type; snapshot seller + SAC from config at issue time. Refuse to issue if the config seller state differs from `order.tax.sellerStateCode` (14E).

---

## 6. Numbering (financial year)

```text
EZPREP/{FY}/{seq}
```

Examples: `EZPREP/2025-26/0001`, `EZPREP/2026-27/0001`

- FY = Indian financial year of `issuedAt` in **Asia/Kolkata** (1 Apr–31 Mar). From 14C, `issuedAt = order.paidAt`, even when a repair issues the invoice later (D-25). A repaired invoice can therefore carry a later number than one dated after it (`U-GST-13`).
- Sequence resets each FY; zero-padded; unique index on `invoiceNumber`.
- One invoice per order (`orderId` unique).

(Updated from earlier calendar-year preference for Rule 46 “unique for a financial year” alignment — confirm with CA: `U-GST-09`.)

---

## 7. Lifecycle

```text
Payment CAPTURED / Order PAID
        ↓
Idempotent issueTaxInvoice(orderId)
        ↓
Persist TaxInvoice + PDF → storage
        ↓
User/Admin authenticated download
```

Never for FAILED / CANCELLED / EXPIRED / abandoned pending.

### Refunds (GST)

App refund (phase 11) revokes entitlements and calls provider refund.  
**GST books:** issue a **credit note** in Zoho/CA workflow for that invoice until in-app credit notes exist (`U-GST-04`). Record each time in `STATUS.md`.

---

## 8. PDF contents (required in template)

- Seller legal name, registered address, GSTIN  
- Invoice number (FY series), invoice date (IST)  
- Customer name; customer address (always on order); customer state + state code  
- Place of supply (state name ± code)  
- Reverse charge: `No`  
- Description of service; SAC code + description  
- Taxable value; GST rate(s); CGST/SGST or IGST; total invoice value  
- Payment/order reference (not card data)  
- Optional: “Computer-generated invoice” / signatory block per `U-GST-08`

---

## 9. GSTR / Zoho readiness

Invoice + order snapshots must be enough to file/report:

- Invoice number, date  
- Taxable value, tax break-up, rate  
- POS (buyer state)  
- SAC  

Export/API to Zoho is out of v1 scope; manual or CA import is OK if fields above are complete and stable.

---

## 10. Extension points (do not build now)

- `InvoiceNotifier` (email)  
- In-app CreditNote model linked to refund  
- B2B buyer GSTIN  
- Per-product SAC  
- IRN / e-invoice API  

---

## 11. Security

- PDF not world-guessable; auth stream or short-lived signed URL.  
- Only owning user or admin.  
- Seller GSTIN never required in client bundles.
