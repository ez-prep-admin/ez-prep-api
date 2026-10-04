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

Update this file when a session discovers a new risk; link from `STATUS.md`.
