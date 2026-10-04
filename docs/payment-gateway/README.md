# EZ Prep — Commerce, Entitlements & Payments

This folder is the **execution specification** for building users, commerce, entitlements, payments (Razorpay), GST invoices, admin commerce UI, and user checkout/access UI across three repositories:

| Repo | Role |
| --- | --- |
| `ez-prep-api` | NestJS backend — source of truth for access, orders, payments, entitlements, invoices |
| `mock-app-admin` | Next.js admin — products, offers, grants, refunds, invoices, user entitlements |
| `ezprep-app` | Next.js user app — locked/free access UX, checkout, subscriptions ownership |

Nothing in this folder is application code. It is planning material for future implementation sessions.

The original design brief lives at [`../PAYMENT_GATEWAY.md`](../PAYMENT_GATEWAY.md). Where this pack and that brief disagree, **this pack wins** (see [`decisions.md`](decisions.md)).

Documentation style is modelled on [`ezprep-app/docs/mobile-migration/`](../../../ezprep-app/docs/mobile-migration/README.md), which proved effective for independently executable phases.

## How to use these documents

Every future implementation session follows the execution model in [`phases/README.md`](phases/README.md):

1. Read [`engineering-rules.md`](engineering-rules.md) (global project rules).
2. Read [`STATUS.md`](STATUS.md) (progress + developer ops checklists).
3. Read the phase file for the phase being implemented.
4. Read only the source files that the phase file lists.
5. Implement **only** that phase, validate (tests + checklists), update `STATUS.md` (code + scripts/config/ops).

Do not start Razorpay, checkout UI, or enforcement flips until their phase. Build access and commerce foundations first.

## Evidence labels

| Label | Meaning |
| --- | --- |
| **[Verified]** | Read directly in repository source, config, or git history. File paths given. |
| **[Inferred]** | Reasonable conclusion from verified facts, not directly stated in code. |
| **[Decision]** | Product/engineering decision locked in [`decisions.md`](decisions.md). |
| **[Unknown]** | Cannot be settled yet. Tracked in [`unknowns.md`](unknowns.md) (ops items like `U-OPS-01`). |

## Document map

### Orientation

| Document | Contents |
| --- | --- |
| [executive-summary.md](executive-summary.md) | One-page summary, sequence, top risks |
| [decisions.md](decisions.md) | Locked product and architecture decisions |
| [unknowns.md](unknowns.md) | Resolved architecture Qs + remaining ops seeds (U-OPS-*) |
| [engineering-rules.md](engineering-rules.md) | Rules every implementation session must follow |
| [STATUS.md](STATUS.md) | Live implementation + developer ops + phase confirmation gate |
| [GOLIVE_TODOS.md](GOLIVE_TODOS.md) | Must-clear-before-live items; non-blocking during phased coding |
| [PAYMENT_STATUS.md](PAYMENT_STATUS.md) | Alias → `STATUS.md` |

### Discovery (three repos)

| Document | Contents |
| --- | --- |
| [current-architecture.md](current-architecture.md) | How the three apps work today |
| [gap-analysis.md](gap-analysis.md) | What exists vs what commerce requires |

### Target design

| Document | Contents |
| --- | --- |
| [domain-model.md](domain-model.md) | Collections, fields, indexes, invariants |
| [api-contracts.md](api-contracts.md) | Admin and user API shapes |
| [state-machines.md](state-machines.md) | Order, payment, product, entitlement, refund states |
| [access-control.md](access-control.md) | Access resolver, FREE/ENTITLED, enforcement |
| [gst-invoicing.md](gst-invoicing.md) | B2C GST invoice rules for v1 |
| [testing-strategy.md](testing-strategy.md) | Jest / Vitest / manual checklists |
| [risk-register.md](risk-register.md) | Ranked risks and mitigations |

### Phases

| Document | Contents |
| --- | --- |
| [phases/README.md](phases/README.md) | Phase list, dependency graph, execution order |
| `phases/phase-NN-*.md` | One independently executable phase per file |

## Scope boundaries

- **v1 sells** one-time INR access with duration presets (not recurring Razorpay mandates).
- **Coupons, credit notes, email invoices, B2B GSTIN** are deferred; extension points must remain open.
- **ezprep-app has no test infrastructure** — validate with typecheck/lint + manual checklists only.
- **Backend + admin must ship automated tests** at every phase that changes them.
- UI bypass is irrelevant: the backend always authorizes.

## Recommended mental model

```text
Academic entities
      ↓
Commercial Product (+ Offers)
      ↓
Order
      ↓
Payment (via PaymentGateway port)
      ↓
Entitlement (idempotent provision / stack)
      ↓
AccessControlService
      ↓
User can start a mock test
```

Never: `Razorpay success → hardcode SSC access`.
