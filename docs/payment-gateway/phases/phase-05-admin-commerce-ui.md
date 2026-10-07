# Phase 05 — Admin Commerce UI

## Objective

Add Ant Design admin pages for Products and Offers management (create, edit, publish, archive, duration offers, sale window, grants multi-select) following existing catalog CRUD patterns, with Vitest coverage.

## Prerequisites

- Phase 04 API contracts available on the API the admin app points to (local or production URL as appropriate).

## Source documents

`../api-contracts.md` §6 §7, `../decisions.md` D-04 D-15, `../current-architecture.md` §2.

## Code references (mock-app-admin)

- `app/admin/layout.tsx` (nav)
- `app/admin/categories/page.tsx`, `app/admin/exams/page.tsx`, `[id]/page.tsx` (CRUD templates)
- `app/services/ezprep-api/catalog.ts`, `envelope.ts`, `index.ts`
- `app/api/ezprep/[...path]/route.ts` (`ALLOWED_V1_ROOTS` — prefer paths under `admin`)
- `app/components/SearchableSelect.tsx`, `ConfirmModal.tsx`
- Existing `*.test.tsx` patterns e.g. categories/users

## Target behavior

1. Nav items: Products (and nested offers UX on product detail).
2. List/create products; edit grants via searchable selects for exam groups/exams/mock tests.
3. Publish/archive actions with confirm.
4. Manage offers per product: duration preset select, list/sale amounts, sale dates, active toggle; enforce one active per duration in UI (server still authoritative).
5. Errors via `formatEzPrepError`.

## Files to create

```
app/admin/products/page.tsx
app/admin/products/[id]/page.tsx
app/services/ezprep-api/products.ts
app/services/ezprep-api/offers.ts
colocated *.test.tsx / *.test.ts
```

## Files that may be modified

- `app/admin/layout.tsx`
- `app/services/ezprep-api/index.ts`
- Proxy allowlist only if new root required

## Do-not-touch boundaries

- No refunds/invoices UI yet.
- No ezprep-app.
- Do not introduce React Query/Redux.
- Prefer Ant Design over shadcn for these pages.

## Implementation tasks

1. API client wrappers matching phase 04.
2. List + detail pages.
3. Grant editors with SearchableSelect.
4. Offer editor section.
5. Vitest: list render, create validation, publish click, API error.

## Requirements

- `"use client"` pages.
- `omitEmpty` / `omitUndefined` on payloads.
- Amounts: match API unit (document conversion if API uses paise).

## Acceptance criteria

- Admin can configure SSC Pack + duration offers without calling API manually.
- Vitest green; typecheck/lint green.

## Tests (Vitest)

1. Products list renders rows from mocked API.
2. Create product requires name/code/grants.
3. Publish calls publish endpoint.
4. Offer create sends durationPreset + amounts.
5. API error surfaces message.
6. Proxy allowlist test update if roots changed.

## Risks

R-10.

## Rollback / isolation

Remove routes/nav; API remains.

## Completion checklist

- [x] `STATUS.md` updated with ops + **developer confirmation**
- [x] Nav + pages
- [x] Client modules exported
- [x] Tests added
- [x] Manual click-through noted in STATUS.md


## STATUS.md update (mandatory)

Before marking this phase **complete**:

1. Update [`../STATUS.md`](../STATUS.md): phase board, session log (template in STATUS.md), and every **developer ops / manual** step for this phase.
2. Ask the developer to perform those manual steps (scripts, `.env`, instance config, Razorpay dashboard, Zoho, checklists, etc.).
3. Record **Developer confirmation** in `STATUS.md` (checkbox + name/date). Without confirmation, leave status `in_progress` / `pending`.
4. Only then set the phase board row to `done`.
5. If a CA/compliance item is deferred: add/update [`../GOLIVE_TODOS.md`](../GOLIVE_TODOS.md) and leave `TODO(golive): <id>` in code — do **not** block this phase unless the item is on the “must NOT be deferred” bake-in list.

## Definition of done

Ops can manage catalog without developers.
