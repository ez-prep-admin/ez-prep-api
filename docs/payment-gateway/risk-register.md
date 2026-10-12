# Risk Register

| ID | Risk | Severity | Likelihood | Mitigation | Phases |
| --- | --- | --- | --- | --- | --- |
| R-01 | Flip to ENFORCED locks all learners | High | Medium | FREE backfill on papers; LEGACY default until phase 15; no mass user entitlements (D-20) | 01, 03, 15 |
| R-02 | Duplicate webhook provisions twice | High | Medium | webhook_events unique; provisioningKey unique | 08, 09 |
| R-03 | Client forges amount/access | High | High | Server-side offer load; AccessControlService on start | 03, 07, 13 |
| R-04 | Exam.category drift breaks packs | High | Medium | Phase 01 invariant | 01 |
| R-05 | GST incorrect on invoice | High | Medium | TaxService + locked ₹999 fixtures; snapshot on order/invoice; instance taxConfig | 07, 10 |
| R-16 | No staging env | Medium | High | Local test mode + tunnel; signed webhook fixtures; prod live keys only (D-18) | 08, 14, 15 |
| R-17 | Seller/tax config empty in prod | High | Medium | Seed checklist U-OPS-01 before live invoices | 10, 15 |
| R-06 | Browser closes before verify | High | Medium | Webhook authoritative; reconciliation worker | 08, 12 |
| R-07 | Product edit mutates history | High | Low | Snapshots + versioning | 04, 09 |
| R-08 | Razorpay secret leak | High | Low | Env only; no logs; engineering-rules | 08 |
| R-09 | Mega-session incomplete feature | Medium | High | One phase/session; DoD gates | all |
| R-10 | Admin proxy 404 on new routes | Medium | Medium | Prefer `/admin/...`; allowlist tests | 05, 06 |
| R-11 | Stacking timezone/month edge | Medium | Medium | Document calendar rules; unit tests | 09 |
| R-12 | PDF generation flaky | Medium | Medium | Retry strategy; don't issue number without recovery plan | 10 |
| R-13 | User.subscription confusion | Medium | High | Stop using for auth; document deprecation | 02, 06 |
| R-14 | Sale window race at checkout | Low | Medium | Compute effective amount at order create time; snapshot | 07 |
| R-15 | Partial refund expectations | Low | Low | v1 full only; no UI partial | 11 |
| R-18 | Refund without credit note breaks GST books | High | High | U-GST-04 Zoho/CA credit note per refund; log in STATUS.md | 11, 15 |
| R-19 | Missing buyer address on invoices ≥ ₹50k | High | Medium | U-GST-06; collect address or CA waiver before live | 10, 14 |
| R-20 | Invoice series not FY-unique | Medium | Medium | Default FY series D-11; CA confirm U-GST-09 | 10 |
| R-21 | Production commerce misconfigured (fake provider, invoices or reconciliation off, ExamFlex receives commerce on a `main` deploy) | Critical | Medium | D-27: `COMMERCE_ENABLED` gate; boot fails closed; fake gateway absent in production | 14A, 15 |
| R-22 | Payment captured after the app expired the order | High | Medium | D-22: proof-based late edge; webhook first; bounded late watch; Checkout.js timeout | 14B, 14C, 14D |
| R-23 | Concurrent paid, expire, and refund signals corrupt state | High | Medium | Compare-and-set transitions; winner-only side effects; memory-Mongo concurrency tests | 14B |
| R-24 | Razorpay disables the webhook after 24 hours of failures (verified policy) | High | Low after 14C | 30-minute retry window; never 5xx on unresolvable events; health shows silent webhook and signature rejections; runbook re-enable steps | 14C, 15 |
| R-25 | Refunds made in the Razorpay Dashboard, or refunds with an unknown outcome | High | Low | Lookup through the payment; external refunds recorded and settled; unknown outcome resolved by listing | 14C |
| R-26 | Duplicate capture on one order | Medium | Low | D-28: `DUPLICATE` payment row + automatic refund | 14B, 14C |
| R-27 | Provisioning lock contention or a stale lock | Low | Low | Lock per user × product only; 10-second lease with takeover; the sweep repairs a failed provisioning | 14A, 14C |
| R-28 | `trust proxy` hop count wrong (IP spoofing of rate limits, or every user still shares nginx's IP) | Medium | Low | nginx is the only proxy, so hop count 1 (confirmed); nginx header lines (U-OPS-03); boot warning in production when 0 | 14A, 15 |
| R-29 | CA rejects the equal-split rounding or the `Kerala`-only address | Low | Closed | CA verified both 2026-10-10 (U-GST-11, U-GST-12) | 14E |
| R-30 | ExamFlex invoices issued under EZ Prep's seller identity, or the reverse | Critical | Medium before 14E | Per-instance seed file with instance guard, dry run, and `--confirm-db` (D-29, PR-36); second-instance smoke in phase 16 | 14E, 16 |
| R-31 | Charging under Terms that describe auto-renewal and trials the product does not have | High | High before 14D | Terms, Privacy, and checkout consent rewritten and owner-approved (PR-39) | 14D |
| R-32 | Cross-instance webhook events if both instances share a Razorpay account | Medium | Low | `notes.instanceId` + immediate ignore (PR-37) | 14B, 14C |

Update this file when a session discovers a new risk; link from `STATUS.md`.
