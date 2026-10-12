# Users / Commerce Gap Analysis

Maps current state → target state. Gaps drive the phase sequence.

---

## 1. Access control

| Capability | Today | Target | Gap |
| --- | --- | --- | --- |
| Gate start attempt | Auth + `isActive` only | FREE or active entitlement via AccessControlService | Large — new service + wire into attempts |
| Gate resume | Ownership of attempt | Ownership + policy for lapsed entitlement (allow in-progress) | Medium — explicit rules |
| List lock state | None | Backend `access` DTO on papers | Medium |
| Free papers | Implicit all free | Explicit `accessMode: FREE \| ENTITLED` | Medium — field + script |
| Exam-group packs | N/A | Dynamic hierarchy resolve | Large |
| UI bypass safety | N/A (everything open) | Backend 403/entitlement error | Required with gates |
| Feature flag | N/A | LEGACY / ENFORCED | Small |

---

## 2. Catalog / products

| Capability | Today | Target | Gap |
| --- | --- | --- | --- |
| Sellable products | None | Product + grants + versioning | Large |
| Pricing / duration | None | Offer with presets + sale window | Large |
| Admin CRUD | None | Ant Design modules | Large |
| View plans for exam/mock | None | Query covering PUBLISHED products | Medium |
| Coupons | None | Deferred | Extension point only |

---

## 3. Orders / payments

| Capability | Today | Target | Gap |
| --- | --- | --- | --- |
| Orders | None | State machine + idempotency | Large |
| Payments | None | Attempts collection + normalized status | Large |
| Provider port | None | PaymentGateway + registry + FakeGateway | Large |
| Razorpay | None | Isolated adapter | Large |
| Webhooks | None | webhook_events + verify + idempotent process | Large |
| Reconciliation | None | Worker for stuck PENDING | Medium |
| User verify callback | None | Signature verify; webhook authoritative backup | Medium |

---

## 4. Entitlements

| Capability | Today | Target | Gap |
| --- | --- | --- | --- |
| Entitlement store | `User.subscription` placeholder | Entitlement collection + sources | Large |
| Provision from payment | None | Idempotent from paid order snapshots | Large |
| Stacking | None | Extend expiresAt | Medium |
| Admin grant/revoke | Subscription patch only | Dedicated grant APIs + audit | Large |
| Refund revoke | None | On admin full refund | Medium |

---

## 5. Invoicing

| Capability | Today | Target | Gap |
| --- | --- | --- | --- |
| Tax invoice | None | B2C PDF after capture | Large |
| Billing identity | Profile name/email only | Name + state at checkout; saved profile | Medium |
| Numbering | None | `EZPREP/YYYY/####` | Medium |
| Admin/user download | None | Authenticated download endpoints | Medium |
| Email / credit notes | None | Deferred | — |

---

## 6. Admin app

| Capability | Today | Target | Gap |
| --- | --- | --- | --- |
| Products/Offers UI | None | Full CRUD + publish/archive | Large — feasible on existing patterns |
| User entitlements view | Subscription read-only | List entitlements + grant/revoke | Medium |
| Refunds | None | Full refund action | Medium |
| Invoices | None | View/download | Medium |
| Proxy allowlist | No commerce roots | Prefer `/v1/admin/...` (already allowed) | Small |
| Tests | Vitest present | Cover new pages/APIs | Required each phase |

---

## 7. User app

| Capability | Today | Target | Gap |
| --- | --- | --- | --- |
| Locked cards | None | Lock + View plans | Medium |
| Overview CTA | Free Early Access messaging | Clean buy/owned state | Medium |
| Checkout | None | Provider-neutral + Razorpay adapter | Large |
| Subscriptions page | Coming Soon | Active entitlements + invoice links | Medium |
| Error mapping | Generic API message | Entitlement-required → plans CTA | Small |
| Automated tests | None | Manual checklists only | Process gap |

---

## 8. Data integrity

| Issue | Today | Target | Phase |
| --- | --- | --- | --- |
| `Exam.category` vs `ExamGroup.category` | Not validated on create/update | Enforce equality | 01 |
| Historical price/grants | N/A | Snapshots on order/entitlement | 04 / 07 / 09 |
| Unique active offer | N/A | Index `(productId, durationPreset)` partial unique for ACTIVE | 04 |

---

## 9. What not to build in early phases

- Razorpay before AccessControlService and Product/Offer exist
- User checkout before access DTOs and order APIs
- ENFORCED mode before FREE backfill + admin tooling + smoke of grant path
- Coupons, credit notes, email, second PSP, native mobile checkout

---

## 10. Feasibility summary

| Repo | Feasibility | Notes |
| --- | --- | --- |
| ez-prep-api | High | Clean Nest module slots; clear enforcement seam at `startAttempt` |
| mock-app-admin | High | Copy categories/exams CRUD; Vitest ready; `/v1/admin` proxied |
| ezprep-app | High for UI | Greenfield commerce UX on existing shell; manual QA only |
