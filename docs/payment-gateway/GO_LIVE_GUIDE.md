# Go-live guide: EZ Prep and ExamFlex

**This is the single source of truth for taking payments live.** Every production step for both instances is here and nowhere else. Other documents link to it and do not repeat it. If a step changes, change it here.

Related: [`STATUS.md`](STATUS.md) (record progress) · [`LEGAL_COPY.md`](LEGAL_COPY.md) (customer-facing wording) · [`GOLIVE_TODOS.md`](GOLIVE_TODOS.md) (compliance log) · [`PRE_RELEASE_REVIEW.md`](PRE_RELEASE_REVIEW.md) (why each step exists)

---

## How to read this guide

- **A** = EZ Prep. **B** = ExamFlex. A step with no letter is identical for both instances: run it on the instance you are launching.
- Steps marked **(once)** are shared and run a single time. They affect both instances at the same moment.
- **Order:** Stage 0 → Stage 1 → Stage 2 (once) → Stages 3–6 for EZ Prep (all **A** steps). ExamFlex comes later: Stages 3–6 again with the **B** steps. Running ExamFlex after EZ Prep has been clean for 7 days is recommended, not required.
- **Each step has a Check.** If a check fails, stop. Do not continue to the next step. Use the [Playbooks](#playbooks) or [Rollback](#rollback).
- **Secrets** (Razorpay key secret, webhook secret, AWS keys) live only in your password manager and the droplet's API `.env`. Never put them in git, this file, chat, the admin app, or any `NEXT_PUBLIC_*` variable.
- Record each finished stage in the `STATUS.md` session log with the date.
- "Phase 14A" and the like refer to implementation phases. Steps in this guide are always written "Step N".

Stage overview:

| Stage | Steps | Who sees a change |
| --- | --- | --- |
| 0. Gates | 0, 0A, 0B | nobody |
| 1. Accounts and values | 1–7 | nobody |
| 2. Deploy code inert (once) | 8–11 | nobody (no Buy buttons yet) |
| 3. Configure the instance | 12–17 | nobody (selling still off) |
| 4. Switch on selling | 18–20 | only the owner (smoke purchase) |
| 5. Enforce paid access | 21–22 | students: chosen papers become paid |
| 6. Record and watch | 23 | nobody |

---

## Values sheet

Fill this in before Step 1. Values marked *fill* are yours to supply. Do not write secrets here.

| Item | A: EZ Prep | B: ExamFlex |
| --- | --- | --- |
| Student web app | `https://www.ezprep.in` | `https://examflex.in` |
| Admin app | `https://mock-app-admin.vercel.app` | `https://admin.examflex.in` |
| API host | `api.ezpre.in` | *fill* (the ExamFlex API host) |
| Webhook URL | `https://api.ezpre.in/api/v1/webhooks/payments/razorpay` | `https://<ExamFlex API host>/api/v1/webhooks/payments/razorpay` |
| Droplet and PM2 process | EZ Prep droplet, *fill* process name | ExamFlex droplet, *fill* process name |
| `INSTANCE_ID` / `INSTANCE_NAME` | `ezprep` / `EZ Prep` | `examflex` / `ExamFlex` |
| MongoDB database name | *fill* | *fill* |
| Seed file | `scripts/commerce-seed/ezprep.json` (exists after phase 14E) | `scripts/commerce-seed/examflex.json` (created in Step 15B) |
| Seller legal name | `EzPrep - Powered by Clustream` | *fill* |
| GSTIN | `32BIAPD6927L1ZC` | *fill* |
| Seller address / state / code | `Kerala` / Kerala / `32` | *fill* |
| GST rate / SAC | 18% / `999293` | 18% / `999293` (same service) |
| Invoice prefix | `EZPREP` | `EXAMFLEX` |
| Razorpay account | EZ Prep account (live keys ready) | decided in Step 2B |
| Invoice bucket | *fill*, e.g. `ezprep-invoices` | *fill*, e.g. `examflex-invoices` |
| Redis | in use; commerce does not use it | not needed |
| Support email | `support@ezprep.in` | *fill* |
| Customer-care phone | *fill* | *fill* |
| Grievance officer name | *fill* | *fill* |
| Website address line | `Kerala, India` (or the full GST-registered address) | *fill* |
| Courts (jurisdiction) | `Kochi, Kerala` | *fill* |

---

## Stage 0 — Gates

### Step 0 — Code is complete (once)

- [ ] Phases 14A, 14E, 14B, 14C, 14D, and 15 are `done` on the `STATUS.md` board, with developer confirmation.
- [ ] Phase 16 is signed in `STATUS.md`, including the second-instance smoke (`INSTANCE_ID=examflex` on a separate local database).
- [ ] On the `payment-gateway` branch of each repo: API `npx jest --config jest.config.js` green; admin `npm test` and `tsc` green; app `npm run typecheck` green.

**Check:** all three boxes ticked. Otherwise stop.

### Step 0A — EZ Prep compliance

- [ ] `GOLIVE_TODOS.md` has nothing open except U-GST-04 (credit notes in Zoho), U-GST-07 (only if turnover makes e-invoicing mandatory), and U-GST-10.
- [ ] U-GST-10: confirm with your CA that place of supply = the buyer's state for SAC `999293`. Log the answer in `GOLIVE_TODOS.md`.
- [ ] Values-sheet column A complete, including phone and grievance officer.

### Step 0B — ExamFlex prerequisites

- [ ] Step 0A's GST items also hold for ExamFlex's GSTIN (ask the CA once).
- [ ] ExamFlex's seller legal name, GSTIN, address, state and code are known (values-sheet column B complete).
- [ ] The ExamFlex web app shows ExamFlex branding in the header and logo. This is outside the payment program (review § Go-live path). The legal pages and payment modal are already per-instance from phase 14D.

**Check:** do not start any B step in Stages 3–6 until 0B is ticked.

---

## Stage 1 — Accounts and values (no customer impact)

### Step 1A / 1B — Fill the values sheet

Complete your column above. The legal name you enter must match the seed file exactly, because the website and the invoice must name the same seller.

### Step 2A — EZ Prep Razorpay account

1. In the Razorpay Dashboard, switch to **Live mode**.
2. Check that **Account & Settings → Website and app details** lists `ezprep.in`.
3. Open **Account & Settings → API Keys**. Use the live key id (`rzp_live_…`) and key secret you already have, or generate them. Store the secret in your password manager.

**Check:** you have the live key id and secret, and the account shows as activated.

### Step 2B — ExamFlex Razorpay account

The money must settle to the same legal person who issues the invoice. Compare ExamFlex's GSTIN with EZ Prep's. Characters 3–12 of a GSTIN are the PAN; EZ Prep's PAN is `BIAPD6927L`.

- **Same PAN** (the same legal person, even with a different GSTIN): share EZ Prep's account.
  1. Add `examflex.in` under **Account & Settings → Website and app details** and wait for Razorpay to approve it.
  2. Reuse the EZ Prep live key id and secret.
  3. Each instance ignores the other's webhook events by design (phase 14C).
- **Different PAN** (a separate legal entity): open a separate Razorpay account in that entity's name, with its own KYC and bank account. Complete activation, list `examflex.in`, and collect its live keys as in Step 2A.

**Check:** ExamFlex has live keys from the correct account, and `examflex.in` is approved on that account.

### Step 3 — Payment capture settings (once per Razorpay account)

In **Live mode**, open **Account & Settings → Payment capture** (the label may read "Capture settings"):

- Capture: **Automatic**.
- Late-authorized payments: **capture automatically**, not auto-refund.

If ExamFlex shares EZ Prep's account, this is already done. Then set the same in **Test mode** so local testing matches.

**Check:** both settings show as saved in live mode.

### Step 4A / 4B — Vercel env for the student web app

The same codebase runs as two Vercel projects. In each project, open **Settings → Environment Variables** and set these for **Production**. All are public values; never add a secret here.

| Variable | 4A: EZ Prep project | 4B: ExamFlex project |
| --- | --- | --- |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | EZ Prep live key id | ExamFlex live key id (Step 2B) |
| `NEXT_PUBLIC_BRAND_NAME` | `EzPrep` | `ExamFlex` |
| `NEXT_PUBLIC_LEGAL_NAME` | `EzPrep - Powered by Clustream` | ExamFlex seller legal name |
| `NEXT_PUBLIC_LEGAL_ADDRESS` | values sheet | values sheet |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@ezprep.in` | ExamFlex support email |
| `NEXT_PUBLIC_SUPPORT_PHONE` | values sheet | values sheet |
| `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` | values sheet | values sheet |
| `NEXT_PUBLIC_LEGAL_JURISDICTION` | `Kochi, Kerala` | values sheet |

Set both projects now, even if ExamFlex will sell later. The Step 11 merge redeploys both, and the ExamFlex legal pages should show ExamFlex's details from that moment. If ExamFlex's details are not final yet, set at least the brand name and support email, and finish the rest before Step 18B.

`NEXT_PUBLIC_*` values are baked in at build time. A change takes effect only after a redeploy.

**Check:** the variables are saved in each project.

### Step 5A / 5B — Invoice bucket

Use one bucket per instance, so each seller's invoices stay separate.

1. In AWS S3, in the same account and region as the API's `AWS_REGION`, create the bucket (5A: EZ Prep name; 5B: ExamFlex name).
2. **Block all public access:** on.
3. **Bucket versioning:** enabled.
4. **Lifecycle rules:** none. Invoices must never expire.
5. **Default encryption:** SSE-S3.
6. Let the API's AWS user use the bucket by adding this to its IAM policy:

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::<bucket-name>/*"
}
```

**Check:** the bucket exists, is private, and versioning shows "Enabled".

### Step 6 — Backups

Invoices, orders, payments, and refunds become legal and tax records.

- [ ] The production MongoDB backup for this instance runs at least daily and covers the whole database. The commerce collections live in the same database.
- [ ] Note the date of the last successful backup in the `STATUS.md` session log.

**Check:** a recent successful backup exists.

### Step 7 — Webhook secret

Generate one secret per instance, even when the Razorpay account is shared:

```bash
openssl rand -hex 32
```

Store it in your password manager as "Razorpay webhook secret, EZ Prep" (or ExamFlex). It goes in two places: the API env (Step 13) and the Razorpay webhook (Step 17).

---

## Stage 2 — Deploy the code inert (once, both instances)

A push to `main` of `ez-prep-api` deploys **both** droplets. With `COMMERCE_ENABLED` missing or not `true`, nothing can be bought. That is the safety this stage relies on. Always deploy the API first, then admin, then the app.

### Step 8 — Pre-merge env check (once)

On **each** droplet, confirm the API env does not contain `COMMERCE_ENABLED=true`:

```bash
grep -n COMMERCE_ENABLED /path/to/ez-prep-api/.env   # expect nothing, or COMMERCE_ENABLED=false
```

**Check:** neither droplet says `true`.

### Step 9 — Merge the API (once)

1. Merge `payment-gateway` into `main` in `ez-prep-api`.
2. Watch GitHub Actions. Both the EZ Prep job and `deploy-examflex` must succeed.
3. On each droplet, run `pm2 logs <process> --lines 100`.

**Check:**

- Each droplet logs the effective commerce config once, with `commerceEnabled=false` and no secrets printed. There is no crash loop.
- On both sites: sign in, open the paper list, and start and submit a free test.

If anything fails, see [Rollback](#rollback) R4.

### Step 10 — Merge the admin app (once)

Merge `payment-gateway` into `main` in `mock-app-admin`. Vercel redeploys the EZ Prep and ExamFlex admin projects.

**Check:** on both admin apps, sign in. The existing pages work. **Commerce health** loads and shows commerce disabled.

### Step 11 — Merge the student app (once)

Merge `payment-gateway` into `main` in `ezprep-app`. Vercel redeploys both web projects with the Step 4 values.

**Check:**

- Both sites load, and free papers work.
- No Buy button appears anywhere. Opening `/dashboard/checkout?offerId=x` shows "Purchases are not available yet."
- `/terms` on the EZ Prep site shows the legal name, address, phone, and grievance officer from Step 4A. The ExamFlex site shows its own details and no "EzPrep".

---

## Stage 3 — Configure the instance (selling still off)

Run Steps 12–17 for the instance you are launching: **A** steps for EZ Prep, **B** steps for ExamFlex.

### Step 12A / 12B — nginx headers

On the droplet (12A: `api.ezpre.in`; 12B: the ExamFlex API host), edit the nginx `server` block for the API host. Inside the existing `location` that proxies to the API, add these three lines and leave `proxy_pass` unchanged:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Check:** `nginx -t` reports "syntax is ok" and the site still works. The API reads these headers once Step 13 sets `TRUST_PROXY_HOPS=1`.

### Step 13A / 13B — API env on the droplet

Edit the API `.env` on the droplet. Add or update these keys. `COMMERCE_ENABLED` stays `false` in this step.

```bash
NODE_ENV=production
COMMERCE_ENABLED=false
INSTANCE_ID=ezprep                       # 13B: examflex
INSTANCE_NAME=EZ Prep                    # 13B: ExamFlex
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_live_...             # Step 2A / 2B
RAZORPAY_KEY_SECRET=<password manager>   # Step 2A / 2B
RAZORPAY_WEBHOOK_SECRET=<password manager>   # Step 7, this instance's secret
INVOICES_ENABLED=true
AWS_S3_INVOICES_BUCKET=<bucket>          # Step 5A / 5B
RECONCILIATION_ENABLED=true
RECONCILIATION_MIN_AGE_MINUTES=60
RECONCILIATION_INTERVAL_MS=300000
TRUST_PROXY_HOPS=1
MAX_OPEN_ORDERS_PER_USER=3
ACCESS_ENFORCEMENT_MODE=LEGACY
```

- Leave the phase 14C tuning keys unset so their defaults apply: `WEBHOOK_RETRY_WINDOW_MINUTES`, `LATE_CAPTURE_WATCH_HOURS`, `RECONCILIATION_BATCH`, `RECONCILIATION_MAX_ATTEMPTS`, `REFUND_UNKNOWN_WINDOW_MINUTES`.
- `CORS_ORIGINS` already lists this instance's web and admin domains; confirm it.
- 13A: the Redis keys stay as they are. 13B: no Redis keys are needed.

Restart:

```bash
pm2 restart <process> --update-env
pm2 logs <process> --lines 50
```

Keep PM2 in **fork** mode with a single process. Cluster mode would run the payment schedulers twice.

**Check:** the API boots with no error, the effective config line shows `provider=razorpay` and `commerceEnabled=false`, and the site works.

### Step 14 — Paper access backfill

Make sure every paper has an explicit access mode (`FREE` unless set otherwise). Run this on the droplet, in the API directory:

```bash
npm run commerce:backfill-access-mode-free
npm run commerce:report-exam-category-mismatches
```

**Check:**

- The backfill prints `matchedCount` and `modifiedCount`. A second run prints `modifiedCount: 0`.
- Read the mismatch report. Fix any listed paper in admin before you sell a product that covers its exam.

### Step 15A — EZ Prep seller and tax seed

On the EZ Prep droplet, in the API directory:

```bash
npm run commerce:seed-tax-config                                     # dry run, prints the diff
npm run commerce:seed-tax-config -- --apply --confirm-db <db name>   # writes
```

**Check:**

- The dry run shows `ezprep.json` values: legal name, GSTIN `32BIAPD6927L1ZC`, address `Kerala`, state `32`, 18%, SAC `999293`, prefix `EZPREP`.
- The apply step reports the update.
- If it says the instance config does not exist, stop. Create it first: it already exists on any instance whose admin app shows its branding.

### Step 15B — ExamFlex seller and tax seed

1. Create `scripts/commerce-seed/examflex.json` by copying `examflex.example.json`. Fill in the values-sheet column B, with prefix `EXAMFLEX`. A GSTIN is public information, not a secret.
2. Commit it through a normal PR to `main`. This redeploys both droplets, which is harmless.
3. On the **ExamFlex** droplet, run the same two commands as Step 15A with the ExamFlex database name.

**Check:** the dry run shows ExamFlex's values. The script refuses to run if `INSTANCE_ID` and the file do not match, which is the intended protection.

### Step 16 — Catalog

In this instance's production admin, create the products and offers you will sell. Prices are GST-inclusive. Publish them. Local data does not carry over.

- Note the **offer id** of the cheapest offer. You need it in Step 20.
- Do not change any paper to `ENTITLED` yet. That is Step 22.

**Check:** the products show as published, with active offers.

### Step 17A / 17B — Razorpay webhook

In the Razorpay Dashboard of this instance's account, in **Live mode**: **Account & Settings → Webhooks → Add new webhook**.

- **URL.** 17A: `https://api.ezpre.in/api/v1/webhooks/payments/razorpay`. 17B: `https://<ExamFlex API host>/api/v1/webhooks/payments/razorpay`. Use the API host, never the website domain.
- **Secret.** This instance's secret from Step 7, identical to `RAZORPAY_WEBHOOK_SECRET` in Step 13.
- **Alert email.** The support email.
- **Active events.** `payment.captured`, `order.paid`, `refund.processed`, `refund.failed`.

If ExamFlex shares EZ Prep's account, the account ends up with two webhooks, each with its own URL and secret.

**Check:** the webhook shows as active with exactly those four events.

---

## Stage 4 — Switch on selling

Do Steps 18–22 in one sitting, at a quiet hour. Until Step 22, no paper is paid, so no student is shown a reason to buy.

### Step 18 — Turn on commerce

In the API `.env`, set `COMMERCE_ENABLED=true`. Then:

```bash
pm2 restart <process> --update-env
pm2 logs <process> --lines 50
```

**Check:**

- No crash loop. The boot guard refuses to start if anything required is missing or wrong, and its message names the key (Playbook P4).
- Admin → **Commerce health** shows status `ok`, `commerceEnabled: true`, and provider `razorpay`.

### Step 19A / 19B — Webhook reachability probe

From your laptop (19A shown; use the ExamFlex API host for 19B):

```bash
curl -i -X POST https://api.ezpre.in/api/v1/webhooks/payments/razorpay \
  -H 'Content-Type: application/json' -d '{}'
```

**Check:**

- The response is **400**, because the request has no signature. Commerce health shows one signature rejection.
- **404** means commerce is not on, or nginx routes the path elsewhere. **502** means the API is down. Fix it before continuing.

### Step 20 — Production smoke purchase and refund

The owner makes one real purchase with their own student account and real money.

1. **Buy.** Open `https://<web app>/dashboard/checkout?offerId=<offer id from Step 16>` while signed in.
   - Checkout shows the price, the GST breakdown, and the one-time and consent lines.
   - The Razorpay modal shows "EZ Prep" (or "ExamFlex").
   - Pay with UPI or a card.
2. **Access.** The success screen appears. **Subscriptions** shows the plan as active.
3. **Invoice.** The invoice downloads from Subscriptions. On the PDF, check:
   - the seller legal name, GSTIN, and address from the seed
   - the number `EZPREP/YYYY-YY/0001` (or `EXAMFLEX/…`)
   - the place of supply equals your billing state
   - Kerala billing shows equal CGST 9% and SGST 9%; any other state shows IGST 18%
   - the totals equal the price paid
4. **Admin.**
   - The order is `PAID`, provisioned, and has an invoice.
   - Commerce health is `ok`, and its webhook block shows a processed event in the last few minutes.
5. **Razorpay Dashboard.** The payment is **captured**, and its notes include this instance's `instanceId` and the order number.
6. **Refund.**
   - In admin, open the order → **Refund**. Type the order number and a reason.
   - Within a few minutes the refund shows completed, after the `refund.processed` webhook.
   - Subscriptions no longer shows the access.
   - Commerce health is `ok`.
7. **Credit note.** Create the credit note for that invoice in Zoho (U-GST-04).

**Check:** every item above holds. If any item fails, set `COMMERCE_ENABLED=false`, restart, and investigate (R1 and the Playbooks) before any customer can buy.

---

## Stage 5 — Enforce paid access

### Step 21 — Enforce access

In the API `.env`, set `ACCESS_ENFORCEMENT_MODE=ENFORCED`, then run `pm2 restart <process> --update-env`.

Every paper is still `FREE` (Step 14), so students see no change yet.

**Check:**

- A non-buyer account can start a free paper.
- The API boot line shows `ENFORCED`, and Commerce health's effective flags show the same.

### Step 22 — Make the chosen papers paid

In admin, set the papers covered by your published products to `ENTITLED`. From this moment, students see **View plans** on those papers and can buy.

**Check:**

- With a non-buyer test account, an `ENTITLED` paper shows as locked, and **View plans** lists the offer.
- A raw API attempt to start it is refused.
- Grant that test account access in admin: the paper opens. Revoke it: the paper locks again.

---

## Stage 6 — Record and watch

### Step 23 — Record go-live and watch

1. In `STATUS.md`:
   - set "Payments live" to Yes for this instance, with the date
   - log Steps 0–22 as done in the session log
   - note any deviation
2. **First 48 hours.** Open admin → Commerce health a few times a day. Look at the red dot, `webhookSilentWhilePaid`, signature rejections, unprovisioned or uninvoiced orders, and refunds with an unknown outcome.
3. **After that.** Check Commerce health once a day and after every deploy.
4. **Every refund.** Create its credit note in Zoho.
5. **Monthly.** Give the CA the month's invoices and credit notes for the GST returns.

ExamFlex: when Step 0B is ready, return to Stage 3 and run the B steps.

---

## Playbooks

**P1. Webhook failing or disabled.** Commerce health shows `webhookSilentWhilePaid`, repeated signature rejections, or the red dot. Razorpay retries failed deliveries with backoff for 24 hours, then disables the webhook.

1. Find the cause:
   - Signature rejections: the secret in the API env differs from the one on the Razorpay webhook (Steps 7, 13, 17).
   - 404: commerce is off or nginx routes the path wrongly.
   - 502: the API is down.
2. Fix the cause. Then, if Razorpay disabled it, open Dashboard → **Account & Settings → Webhooks**, open the webhook, and enable it.
3. No data fix is needed. Reconciliation and the 72-hour late-capture watch settle the missed payments. Within an hour, health should return to `ok`.

**P2. "I paid but have no access."**

1. In admin, find the student's orders.
   - `PAID` but not provisioned or not invoiced: **Retry provisioning** on the order detail.
   - Still `PENDING_PAYMENT` or `EXPIRED`: the system keeps checking Razorpay for up to 72 hours and grants access automatically if the payment was captured. Tell the student that, using the refund policy wording.
2. Never grant access by hand for a payment you cannot see as captured. If Razorpay shows the payment captured but the order is still not `PAID` after an hour, use **Retry provisioning** (repair), then check P1.

**P3. Refund stuck or failed.**

- "Processing" resolves on its own within about an hour.
- `FAILED` shows the reason. Retry from admin once the cause is fixed. For example, Razorpay refuses refunds when the account balance is too low.

**P4. API will not start after an env change.** The boot guard message in `pm2 logs` names the missing or wrong key: test keys in production, an invoice or reconciliation flag off, a missing instance name, and so on. Fix it and restart. If you need the site back at once, set `COMMERCE_ENABLED=false` and restart. The site works without selling.

**P5. Seller details change (address, GSTIN, legal name).**

1. Update the instance's seed file through a PR and deploy.
2. Run Step 15 (dry run, then apply).
3. Update the matching `NEXT_PUBLIC_LEGAL_*` values (Step 4) and redeploy the web project.
4. Past invoices stay as issued; only new invoices use the new details.
5. Tell the CA.

**P6. Rotate Razorpay keys or the webhook secret.**

- **Keys.** Generate new keys in Dashboard → API Keys. Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the API env and `NEXT_PUBLIC_RAZORPAY_KEY_ID` in Vercel. Restart the API and redeploy the web project.
- **Webhook secret.** Change it on the Razorpay webhook and in the API env, back to back. Deliveries rejected in between are retried by Razorpay.

**P7. Duplicate payment** (the student paid twice for one order). It is refunded automatically. Commerce health lists it under duplicates with its refund status. Nothing to do unless that refund fails (P3).

---

## Rollback

Each switch is an env change plus `pm2 restart <process> --update-env`. It takes effect in under 2 minutes, and no data is lost.

| Goal | Action | Effect |
| --- | --- | --- |
| R1. Stop selling | `COMMERCE_ENABLED=false` | Checkout and webhook answer 404, and Buy buttons disappear. Buyers keep their access. Turn it back on within 24 hours, or Razorpay disables the webhook (then follow P1 when you turn it on). Payments captured while it was off are settled by the late-capture watch after it is back on |
| R2. Unlock all content | `ACCESS_ENFORCEMENT_MODE=LEGACY` | Every paper opens to everyone. Selling continues unless R1 is also applied |
| R3. Unlock one paper | In admin, set the paper to `FREE` | Only that paper opens to everyone |
| R4. Revert the code | Apply R1 first, then revert the merge on `main` (redeploys both droplets) | All schema changes are additive, so the previous code runs against the same data |

---

## Change log

- 2026-10-10: Created as the single go-live source. It replaces the runbook planned for phase 15, the go-live steps in `PRE_RELEASE_REVIEW.md`, and the step lists in `GOLIVE_TODOS.md` U-OPS-01 to U-OPS-04.
