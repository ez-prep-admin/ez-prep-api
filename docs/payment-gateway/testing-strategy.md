# Testing Strategy

## 1. Per-repo expectations

| Repo | Automated | Manual |
| --- | --- | --- |
| `ez-prep-api` | Jest unit (`*.spec.ts`) + e2e where phase requires | Optional smoke against staging |
| `mock-app-admin` | Vitest + Testing Library | Click-through checklist in phase |
| `ezprep-app` | **None** (no infra) | Phase manual checklist + typecheck/lint |

Every API/admin phase lists concrete test cases. Do not merge without them.

---

## 2. Backend testing patterns

Reuse existing Nest patterns:

- `@nestjs/testing` + mocked Mongoose models (`getModelToken`)
- Pure domain functions (price resolution, GST math, stacking, grant match) tested without Nest
- FakePaymentGateway for order/provision flows
- Webhook tests with fixture payloads + valid/invalid signatures (HMAC fixtures)
- Idempotency: call twice, assert single side effect

Coverage target: maintain project Jest threshold; new commerce modules should not be excluded casually.

### Mandatory scenario matrix (accumulate across phases)

| Area | Cases |
| --- | --- |
| Access | FREE allow; ENTITLED+grant allow; ENTITLED+none deny (ENFORCED); LEGACY allow; expired; revoked; wrong exam; EXAM_GROUP dynamic new exam; UI-bypass startAttempt |
| Offers | Effective sale price in/out window; unique ACTIVE conflict; inactive offer checkout reject |
| Orders | Idempotency key replay; amount from server; unpublished product reject |
| Payments | Verify success; bad signature; webhook duplicate; webhook after verify |
| Entitlements | Provision once; stack extend; lifetime; refund revoke |
| TaxService | ₹999 → 846.61 / 152.39; same-state CGST/SGST remainder; interstate IGST; snapshot immutability |
| Invoices | Only on PAID/CAPTURED; never on failed/cancelled/expired; unique number; one per order; SAC/seller from config |
| Refunds | Full only; revoke entitlements; reject double refund |
| Meta | indian-states returns code+name; clients must not hardcode |

---

## 3. Admin testing patterns

- Mock `ezPrepApiClient` / domain API modules
- List page renders table; create validation; edit save; error toast via `formatEzPrepError`
- Proxy allowlist tests if new roots added
- Grant/revoke and refund actions confirm modal + success/error

---

## 4. User app validation

Each app phase checklist must cover:

- Loading / empty / error
- Locked vs free vs owned
- Duplicate click on Pay
- Checkout cancel / failure / success refresh
- Mobile responsive widths
- DevTools bypass attempt → error banner with plans CTA

Run `npm run typecheck` / `lint` (or yarn equivalents per repo).

---

## 5. Definition of tested for a phase

A phase is not done if:

- New public API behavior lacks unit tests
- New admin page lacks at least one happy-path and one error-path test
- Manual checklist unchecked for app phases
- `STATUS.md` not updated
