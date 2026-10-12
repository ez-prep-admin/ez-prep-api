# Phase 14A — Fail-closed config, catalog and entitlement integrity (ad-hoc)

Ad-hoc phase from [`../PRE_RELEASE_REVIEW.md`](../PRE_RELEASE_REVIEW.md). Runs first after phase 14, then 14E.

## Objective

1. Build the commerce regression harness that every later ad-hoc phase runs.
2. Make every commerce misconfiguration fail closed in production.
3. Sell only the frozen published product version.
4. Make entitlement windows mean what their dates say, including re-anchoring (D-23) and blocking worthless repurchases (D-24).

Findings: PR-01, PR-07, PR-08 (boot), PR-12, PR-14 (boot), PR-15, PR-16, PR-18, PR-20, PR-23, PR-25, PR-26, PR-27 (hard delete).

## Prerequisites

- Phase 14 done.
- D-23, D-24, D-27, D-29 recorded in `../decisions.md` (done 2026-10-10).
- Owner answers (final): nginx is the only proxy, so `TRUST_PROXY_HOPS=1` in production. ExamFlex sells, so both instances will run `COMMERCE_ENABLED=true` once configured. Production has no commerce data.

## Source documents

`../PRE_RELEASE_REVIEW.md` (including the compatibility contract), `../decisions.md` D-04 D-09 D-14 D-16 D-18 D-23 D-24 D-27, `../state-machines.md` §4, `../engineering-rules.md`.

## Code references (ez-prep-api)

- `src/payments/domain/payment-gateway.registry.ts`, `src/payments/payments.module.ts`, `src/payments/infrastructure/razorpay/razorpay-provider.config.ts`
- `src/orders/dto/verify-checkout-payment.dto.ts`, `src/orders/checkout.service.ts` (`priceOffer`)
- `src/access/access-control.service.ts` (`getEnforcementMode`, ENTITLED-without-exam branch)
- `src/common/commerce/is-entitlement-active.ts`, `src/common/commerce/stack-entitlement-window.ts`
- `src/entitlements/entitlements.service.ts` (`findActiveForUser`, `revokePaymentEntitlementsForOrder`, admin revoke)
- `src/entitlements/entitlement-provisioning.service.ts`, `src/entitlements/schemas/entitlement.schema.ts`
- `src/products/products.service.ts` (`update`, `findPublishedByGrantMatchers`), `src/products/schemas/product-version.schema.ts`
- `src/catalog/catalog.service.ts`, `src/catalog/dto/catalog-product-response.dto.ts`
- `src/offers/offers.service.ts`, `src/main.ts`, `src/app.module.ts`, `src/users/users.service.ts` (hard delete)
- `.env.example`, `package.json`, `jest.config.js`, `test/jest-e2e.json`

## Target behavior

### 0. Commerce regression harness (lands first, on unchanged code)

`test/commerce/` boots the real `AppModule` over `mongodb-memory-server`, driven with `supertest`.

- **Gateways.** The fake gateway is used for the happy path. The Razorpay gateway runs over a stubbed `RazorpaySdkClient`, and a helper signs webhook bodies with a test secret.
- **What it pins.** The flows listed in the review's compatibility contract §1.
- **Runtime.** One shared in-memory server per file, with collections dropped between tests. Target: under 60 seconds.
- **Rule.** It must pass on the current code before any other task here starts.

### 1. Typed commerce config + production boot guard (D-27)

`CommerceConfig` is one parsed object that the registry, access, schedulers, and controllers read. Nothing else reads `process.env` for these keys.

| Key | Parse | Production rule when `COMMERCE_ENABLED=true` |
| --- | --- | --- |
| `COMMERCE_ENABLED` | `true` only when exactly `true` (trimmed). New; default `false` | — |
| `PAYMENT_PROVIDER` | trimmed, lowercase | must be `razorpay` |
| `INSTANCE_ID` / `INSTANCE_NAME` | existing keys; same `INSTANCE_ID` pattern as `redis.settings.ts` | both present. Today `INSTANCE_ID` is only required when Redis is set. Commerce needs it for Razorpay `notes.instanceId` (14B) and the per-instance seed (14E), and `INSTANCE_NAME` for the payment modal (14E) |
| `RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` | trimmed, non-empty | all present; key id starts with `rzp_live_`. There is no override: test keys in production would issue real GST invoice numbers for test payments (D-18, no staging) |
| `INVOICES_ENABLED` | boolean | must be `true` |
| `RECONCILIATION_ENABLED` | boolean | must be `true` |
| `ACCESS_ENFORCEMENT_MODE` | trim + uppercase; must be `LEGACY` or `ENFORCED` | unknown is a boot error (PR-12). Outside production: `LEGACY` plus a warning |

**When `COMMERCE_ENABLED` is not `true`:**

- Checkout, verify, me/orders, me/invoices, the webhook controller, and both reconciliation schedulers answer 404 `COMMERCE_DISABLED` or do not start.
- Catalog still answers but returns `commerceEnabled: false`.
- Access keeps its configured mode.
- Admin product, offer, and tax config CRUD stays available, so the catalog can be prepared before switching on.

This makes a `main` deploy to an instance without commerce env inert (PR-20). At boot, log the effective values once: names and booleans only, never a secret.

Guard placement: a provider in `CommerceModule` that throws in `onModuleInit`, so PM2 shows a crash loop with the message instead of a running API that sells nothing correctly.

**Two different switches.** `COMMERCE_ENABLED` and `ACCESS_ENFORCEMENT_MODE` are independent, and `.env.example` must say so in its comments:

| Key | Answers | Off / LEGACY means |
| --- | --- | --- |
| `COMMERCE_ENABLED` (new, this phase) | Can this instance **sell**? (checkout, verify, webhook, reconciliation, my orders, my invoices) | Nothing can be bought. Content access is unchanged |
| `ACCESS_ENFORCEMENT_MODE` (exists since phase 02) | Do `ENTITLED` papers **require** an entitlement? | `LEGACY` lets everyone in. `FREE` papers are always open in both modes |

Go-live order: `COMMERCE_ENABLED=true` first (people can buy), then `ACCESS_ENFORCEMENT_MODE=ENFORCED` (paid papers become locked to buyers).

**`.env.example` additions in this phase** (names, defaults, comments; never values of secrets):

```text
COMMERCE_ENABLED=false          # true on any instance that sells (local dev, EZ Prep, ExamFlex)
TRUST_PROXY_HOPS=0              # 1 in production (nginx only, no CDN in front)
MAX_OPEN_ORDERS_PER_USER=3
```

The webhook comment lists all four events: `payment.captured`, `order.paid`, `refund.processed`, `refund.failed`. 14C adds its own keys in the same block.

### 2. Fake gateway unreachable in production (PR-01)

- The registry registers `fake` only when `NODE_ENV !== 'production'`.
- An unknown provider name throws everywhere; nothing falls back to `fake`.
- The verify DTO's `provider` enum is built from the registered providers, so `provider: 'fake'` is a 400 in production.

### 3. Checkout sells the frozen version (PR-07)

- `priceOffer` loads `product_versions` for `(productId, product.version)` and snapshots `code`, `name`, and `grants` from that row.
- A missing row or zero grants returns 400 `PRODUCT_NOT_PURCHASABLE`.
- Publish copies grants to `product.publishedGrants` (plus an idempotent boot backfill from `product_versions`). Catalog matching (`findPublishedByGrantMatchers`) uses `publishedGrants`, so draft edits never change what the catalog advertises.
- Admin `update` on a `PUBLISHED` product keeps editing draft fields only; the copy change is in 14D.

### 4. Entitlement windows (PR-15, D-23)

- **Active means started.** `isEntitlementCurrentlyActive` requires `startsAt <= now`. `findActiveForUser` filters `startsAt <= now` and `expiresAt null or > now` in Mongo. Compound index `{ userId, status, expiresAt }` (additive). The access batch path keeps its single query per request.
- **Store the preset.** `durationPreset` is stored on `PAYMENT` entitlements at provisioning, so a window can be recomputed. Boot backfill from the order item for existing local rows, idempotent.
- **Re-anchor (D-23).** Runs after any revoke of `PAYMENT` rows (refund settle, admin revoke). It operates on one `(userId, productId)` under the lock from §6.
  - Load the still-ACTIVE `PAYMENT` rows for that user and product and group them by `orderId`. Every row in a group shares one window.
  - Sort the groups by `startsAt` and set `cursor = now`.
  - A group already started (`startsAt <= now`) is left alone and moves the cursor to `max(cursor, expiresAt)`.
  - A future group gets `startsAt = cursor` and `expiresAt = expiresAtFromDurationPreset(preset, cursor)`, then moves the cursor to that `expiresAt`. A lifetime group gets `startsAt = cursor`, `expiresAt = null`, and the walk stops.
  - Writes are conditional on the old `startsAt` (compare-and-set), so a concurrent pass makes no change. Each moved group writes one `ENTITLEMENT_REANCHORED` audit row with old and new windows.
  - **Invariant:** a group's start only moves earlier. Removing coverage never delays anyone.
- **Admin grants.** `ADMIN_GRANT` rows are never moved. They count as coverage only for D-24.

### 5. Block worthless repurchases (PR-16, D-24)

- Checkout create returns 409 `{ details.code: 'ALREADY_COVERED' }` when **every** grant of the frozen version is covered for life by an active entitlement of the user, from any source, scope-matched the way access matches (exam scope covers that exam's papers; a paper scope covers only that paper). If a new version adds a scope the user lacks, purchase is allowed.
- Catalog product DTOs gain:
  - `coveredForLife: boolean`
  - `ownedUntil: string | null | undefined` (undefined = no active `PAYMENT` row for this product, null = lifetime, ISO date = last expiry of the stack)

  Both are computed in the same batch query as today; there is no per-product query.
- If the user became covered between create and payment, provisioning still runs (the money is real). The order gets `redundantPurchase: true` and an audit row, and 14C health lists it so an admin can refund.

### 6. Provisioning serialization (PR-16)

- New collection `entitlement_locks`: `_id = "${userId}:${productId}"`, `holder`, `lockedUntil`, plus a TTL index on `lockedUntil` for cleanup.
- **Acquire:** `insertOne`; on a duplicate key, take over with `findOneAndUpdate({ _id, lockedUntil: { $lt: now } })`.
- **Retry:** 50 ms, 100 ms, 200 ms, 400 ms, 800 ms with jitter. Then throw a retryable error (the paid signal retries; the 14C sweep repairs).
- **Lease:** 10 seconds.
- **Scope:** stacking read + insert in provisioning, and the re-anchor pass. Contention is per user and product, so the lock never serializes different customers.

### 7. Proxy and throttling (PR-18)

- `app.set('trust proxy', TRUST_PROXY_HOPS)`. The env is new, default `0`; production sets `1`, because nginx is the only proxy (confirmed). Boot logs a warning if production runs with `0`.
- Express then takes the client IP from the right-most `X-Forwarded-For` entry, which is the one nginx appends. A client-supplied header cannot spoof it. nginx must send the header (`U-OPS-03`).
- Checkout create and verify throttles are keyed by user id, falling back to IP.
- **Open-order cap:** a user may hold at most `MAX_OPEN_ORDERS_PER_USER` (default 3) orders in `CREATED` or `PENDING_PAYMENT` that are newer than the app window.
  - A create for an offer that already has an open order and the same idempotency key replays as today.
  - A create beyond the cap returns 429 `TOO_MANY_OPEN_ORDERS`.
  - Index `{ userId, status, createdAt }`.

### 8. Small fixes

- Offers: `saleAmount < listAmount` and `saleValidFrom < saleValidUntil` (PR-23).
- A `MOCK_TEST` grant matches before exam metadata is required (PR-25).
- Admin hard delete is refused (409) for users with `PAID` or `REFUNDED` orders or issued invoices. Soft delete still works (PR-27).
- `.env.example` lists all four webhook events and every new key.
- One Jest config: remove the `jest` key from `package.json` (PR-26).
- The phase 10 file says FY numbering.

## Behavior changes (the harness expectations that change, all intentional)

| Before | After | Consumer impact |
| --- | --- | --- |
| Blank provider → fake | Boot error (production) / error (any env, unknown name) | Local `.env` must set `PAYMENT_PROVIDER=fake` explicitly; `.env.example` already does |
| Commerce routes always on | 404 unless `COMMERCE_ENABLED=true` | Local `.env` and the EZ Prep production env must add it. App shows the "not available" state it already has for 404 |
| Future `startsAt` grants access | Denied until start | Only `ENTITLED` papers; `FREE` unaffected. Subscriptions page already shows the window |
| Repeat lifetime purchase charged | 409 `ALREADY_COVERED` | App maps it in 14D. Until then, the generic error toast shows |
| Throttle per nginx IP (shared by all users) | Per client IP; checkout per user | Every route, including OTP: limits become per person, which is the intended behavior. Users behind one carrier NAT share a bucket, the same as on any IP-keyed limit |
| Draft grant edit changes catalog and sale | Only republish does | Admin copy updated in 14D |

## Files to create

- `test/commerce/` harness, plus helpers `test/commerce/support/{app,razorpay-stub,sign-webhook}.ts`
- `src/commerce/commerce-config.ts`, `src/commerce/commerce-config.guard.ts`, specs
- `src/entitlements/entitlement-lock.service.ts`, schema, spec
- `src/entitlements/domain/reanchor-entitlement-groups.ts` (pure function) + spec
- `src/entitlements/domain/covered-for-life.ts` (pure function) + spec

## Files that may be modified

Everything under Code references. `../decisions.md` (only if a rule changes during implementation), `.env.example`.

## Do-not-touch boundaries

- No order, payment, or refund state machine changes (14B).
- No webhook retry policy changes (14C).
- No frontend changes (14D).
- Tax calculation untouched (14E).
- Local development must still boot with `PAYMENT_PROVIDER=fake` when `NODE_ENV` is not `production`.

## Implementation tasks

0. Harness on unchanged code; green.
1. `CommerceConfig` + guard + `COMMERCE_ENABLED` gating.
2. Registry/DTO production lock for `fake`.
3. Frozen-version checkout, `publishedGrants`, backfill.
4. `startsAt` enforcement, index, `durationPreset` on rows + backfill.
5. Lock service; wire into provisioning.
6. Re-anchor pass on every `PAYMENT` revoke path.
7. `ALREADY_COVERED`, `coveredForLife`, `ownedUntil`, `redundantPurchase`.
8. Trust proxy, user-keyed throttles, open-order cap.
9. Small fixes and drift.
10. Regression gate (review §Compatibility); update harness rows per the table above.

## Acceptance criteria

- `NODE_ENV=production`, `COMMERCE_ENABLED=true`, and a provider that is unset, `fake`, or `Razorpay ` fails to boot with a message naming the key. With `COMMERCE_ENABLED` unset, checkout and webhook return 404 and the rest of the API (auth, tests, admin) works.
- Editing grants on a published product without republishing changes neither the catalog nor a new order.
- A stacked purchase does not grant access before its `startsAt`. Refunding the anchor moves it to start now with its full duration, and a third stacked purchase follows directly after it.
- A user covered for life gets 409 on repurchase; a version that adds an uncovered scope is purchasable.
- Two orders of the same 3-month product provisioned concurrently end up back to back (no overlap, no lost period).

## Tests

1. Harness (§0) green before and after, with only the listed rows changed.
2. Config guard matrix: production × each key × `COMMERCE_ENABLED`.
3. Registry rejects `fake` in production; unknown provider errors.
4. Enforcement parse: `' ENFORCED '`, `enforced`, `ENFORCE`, unset.
5. Snapshot from `product_versions`; draft edit ignored; zero grants → 400.
6. `reanchorEntitlementGroups` table tests:
   - anchor refunded with one or two future groups
   - middle group refunded
   - a lifetime group in the chain
   - a group already started
   - month-end dates (R-11)
   - concurrent compare-and-set loses cleanly
7. `coveredForLife`: exam scope covers paper grants; paper scope does not cover exam; an admin lifetime grant counts.
8. **Concurrency (memory Mongo):** two provisionings of the same product in parallel → back to back; lock takeover after lease expiry.
9. Open-order cap; offer validation; MOCK_TEST match without exam; hard-delete refusal.

**Manual (append to `../E2E_TEST_STATUS.md`, do not tick):** bad production env shows the guard message; published grant edit without republish has no effect; refunding the anchor moves the stacked purchase in subscriptions; a lifetime owner sees the purchase blocked.

## Risks

R-01, R-07, R-11, R-21 (production misconfiguration), R-27 (lock contention), R-28 (proxy hop count).

## Rollback / isolation

`COMMERCE_ENABLED=false` removes the commerce surface. The guard, the lock, and the re-anchor pass are independent commits. All schema changes are additive, and the backfills only fill missing fields.

## Completion checklist

- [ ] Harness merged first, green on unchanged code
- [ ] `STATUS.md` updated with ops + **developer confirmation**
- [ ] `GO_LIVE_GUIDE.md` Step 13 env block matches the implemented key names
- [ ] Tests green; regression gate run and logged

## STATUS.md update (mandatory)

Follow the five steps in [`phase-15-rollout-hardening.md`](phase-15-rollout-hardening.md) § STATUS.md update.

Developer ops for this phase:

- Add `COMMERCE_ENABLED=true` and `TRUST_PROXY_HOPS=0` to local `.env`. Without the first, local checkout returns 404 after this phase.
- Check that `GO_LIVE_GUIDE.md` Step 13 lists the implemented key names (`COMMERCE_ENABLED=false` at merge, then `true` in Step 18; `TRUST_PROXY_HOPS=1`).
- Boot locally with `NODE_ENV=production` and a deliberately bad env, confirm it fails as expected, then restore.

## Definition of done

No production misconfiguration can sell access without a real capture. Checkout sells only what was published. Entitlement windows, stacking, and refunds behave as D-09 / D-23 / D-24 say, under concurrency. The harness protects every later phase.
