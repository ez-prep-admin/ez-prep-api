# Phase 04 — Products + Offers API

## Objective

Ship Product and Offer modules with versioning, grant validation, effective sale pricing, catalog query APIs (including View plans), and admin commerce APIs. No Razorpay/orders yet.

## Prerequisites

- Phase 03 done (access gates exist; not strictly required for compile, but program order).

## Source documents

`../domain-model.md` §2 §3 §12, `../api-contracts.md` §3 §6 §7, `../state-machines.md` §1 §2, `../decisions.md` D-04.

## Code references (ez-prep-api)

- Existing Nest CRUD modules e.g. `src/categories/`, `src/exams/` for patterns
- `src/common/dto/`, validators
- ExamGroup/Exam/MockTest models for grant validation

## Target behavior

1. Admin CRUD products (draft/publish/archive/duplicate) with grants.
2. Publish validates grants exist; bumps version when grants change on published product per domain-model policy.
3. Offers with duration presets; unique ACTIVE per product+duration; sale window effective price helper.
4. User catalog endpoints for product detail + covering products for exam/mock.
5. Money unit: integer paise stored; document in OpenAPI/README snippet in STATUS.md.

## Files to create

```
src/products/
src/offers/
src/catalog/   (or user controllers under products)
```

Pure `resolveEffectiveAmount(offer, now)` with tests.

## Files that may be modified

- `app.module.ts`
- `.env.example` if needed (none expected)

## Do-not-touch boundaries

- No order/payment/Razorpay.
- No admin React UI (phase 05).
- No coupons.
- **Zero regressions:** new modules only (`products` / `offers` / `catalog`). Do not modify existing module tests except structural DI wiring if unavoidable. Follow [`../engineering-rules.md`](../engineering-rules.md) §6a. Allowed existing-file edits: `app.module.ts` registration; grant validation may **read** ExamGroup/Exam/MockTest models without changing their behavior.

## Implementation tasks

1. Schemas + indexes (partial unique ACTIVE offer).
2. ProductsService + OffersService with state transitions.
3. Grant validation service.
4. Catalog covering-query (aggregation or filter).
5. Swagger DTOs.
6. Jest for pricing, uniqueness, publish, covering query.

## Requirements

- Historical meaning: publishing grant changes must not rewrite past orders (orders don’t exist yet — ensure ProductVersion snapshot strategy is implemented or version field + immutable grant snapshot helper ready for phase 07).
- Soft delete consistency.

## Acceptance criteria

- Admin can create SSC-like product with EXAM_GROUP grant and multiple duration offers.
- Second ACTIVE offer same duration fails.
- Sale price used only inside window.
- for-exam returns group pack + exam product.
- Tests green.

## Tests (Jest)

1. Create/publish product happy path.
2. Publish with invalid scopeId fails.
3. Version increments on grant change publish.
4. Offer unique ACTIVE conflict.
5. Effective amount: before/during/after sale.
6. Catalog for-exam includes EXAM_GROUP pack.
7. Catalog for-mock includes MOCK_TEST product.
8. Archive hides from user catalog.
9. Inactive offer not returned as purchasable.

## Risks

R-07, R-14.

## Rollback / isolation

New modules only; revert PR.

## Completion checklist

- [x] `STATUS.md` updated with ops + **developer confirmation**
- [x] Admin product/offer APIs live
- [x] User catalog APIs live
- [x] Money unit recorded in STATUS.md
- [x] Indexes verified in schema
- [x] Existing suites green without rewriting prior test cases (§6a)


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Commerce catalog is API-complete for admin UI and later checkout.
