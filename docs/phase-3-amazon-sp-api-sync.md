# Phase 3 — Automated Amazon Sync (SP-API + Vercel Cron)

> Goal: replace the manual CSV upload with **fully automatic** Amazon → Pramora
> sync. List or edit an item on Amazon, and it appears/updates on the site on its
> own — plus a one-click "Sync from Amazon" that hits Amazon live instead of a file.

This builds directly on Phase 1 + 2. **No rework** of the sync core: Phase 2's
`runSync(records, source)` already takes a source-agnostic `AmazonRecord[]`. Phase 3
only adds a new *producer* of that array (the SP-API client) and a *schedule*.

---

## What already exists (Phases 1 & 2)

- `src/lib/db/` — Neon Postgres schema (`products`, `sync_runs`), repo, client.
- `src/lib/amazon/types.ts` — `AmazonRecord` (the shared shape).
- `src/lib/amazon/csv.ts` — `parseAmazonCsv()` → `AmazonRecord[]`.
- `src/lib/amazon/sync.ts` — `runSync(records, source)` → diff, upsert (Amazon cols
  + storefront price), auto-create drafts, log to `sync_runs`, return report.
- `src/app/api/admin/sync/amazon/route.ts` — auth'd CSV upload endpoint.
- `/admin` — "Sync from Amazon" button + diff report UI.

Phase 3 reuses **all** of the above. The only new input is a function that returns
`AmazonRecord[]` from the live Amazon API.

---

## Prerequisites (one-time, on the Amazon side)

These are account/approval steps only you can do — they gate everything below:

1. **Professional Selling account** (Individual accounts can't use SP-API).
2. **Register as a developer** in Seller Central → *Apps & Services → Develop Apps*.
3. Create a **private (self-authorized) app** — for a single seller (you) this avoids
   the full public-app App Store review. Request the **Pricing**, **Listings**, and
   **FBA/Inventory** data roles. Some roles need extra justification.
4. Generate **LWA (Login with Amazon) credentials**: `client_id`, `client_secret`,
   and a **refresh token** (from self-authorization). Note your **SP-API endpoint**
   + **marketplace ID** (India = `A21TJRUUN4KGV`, endpoint `sellingpartnerapi-eu.amazon.com`).

> If approval stalls, the CSV path from Phase 2 keeps working as the fallback.

---

## New environment variables (Vercel + `.env.local`)

```
LWA_CLIENT_ID=
LWA_CLIENT_SECRET=
SPAPI_REFRESH_TOKEN=
SPAPI_ENDPOINT=https://sellingpartnerapi-eu.amazon.com
SPAPI_MARKETPLACE_ID=A21TJRUUN4KGV
CRON_SECRET=            # random string; protects the cron endpoint
```

Add via `vercel env add` (Production + Preview + Development). Remember Phase 1's
gotcha: re-pull with `vercel env pull .env.local` and re-check that `ADMIN_PASSWORD`
and Razorpay keys survived (see memory: env-gotchas).

> Note: SP-API no longer requires AWS IAM/SigV4 signing (deprecated). A plain LWA
> bearer token on each request is sufficient — no AWS SDK needed.

---

## New code to add

### 1. `src/lib/amazon/spapi.ts` — the live client (the only real new work)

Responsibilities:
- **Token exchange**: POST the refresh token to `https://api.amazon.com/auth/o2/token`
  to get a short-lived access token. Cache it in-memory until ~5 min before expiry.
- **Fetch listings**: pull the seller's listings/prices/inventory. Practical options:
  - **Reports API** (recommended for "all listings"): request report type
    `GET_MERCHANT_LISTINGS_ALL_DATA` (and/or a pricing report), poll until `DONE`,
    download the (TSV) document, decompress, and parse. This mirrors the CSV path —
    same columns — so it maps cleanly to `AmazonRecord`.
  - **Listings Items / Product Pricing APIs**: per-SKU calls; better for incremental
    updates but chattier and rate-limited.
- **Map → `AmazonRecord[]`**: reuse the same field mapping as `csv.ts`
  (sku, asin, title, status, currentPrice, buyBoxPrice, availableInventory,
  totalFees, lastChanged). Factor the row→record mapping out of `csv.ts` so both
  share it.
- **Rate limiting**: respect SP-API's token-bucket limits; add simple retry with
  backoff on 429/503.

Public surface:
```ts
export async function fetchAmazonListings(): Promise<AmazonRecord[]>
```
That's the entire contract the rest of the system needs.

### 2. `src/app/api/admin/sync/amazon/live/route.ts` — manual live sync

```ts
// POST, auth via x-admin-password (same as CSV route)
const records = await fetchAmazonListings()
const report = await runSync(records, 'sp-api')
// revalidate the same paths, return report
```
Wire the `/admin` "Sync from Amazon" button to call this instead of (or alongside)
the CSV upload — e.g. a split button: "Sync live" vs "Upload CSV".

### 3. `src/app/api/cron/amazon-sync/route.ts` — scheduled sync

```ts
// GET. Verify Authorization: Bearer ${CRON_SECRET} (Vercel sends it).
const records = await fetchAmazonListings()
const report = await runSync(records, 'sp-api')
// revalidate paths; return summary counts
```

### 4. `vercel.json` (or `vercel.ts`) — the schedule

```json
{ "crons": [{ "path": "/api/cron/amazon-sync", "schedule": "0 6 * * *" }] }
```
Daily at 06:00 UTC. Adjust cadence to taste (SP-API data isn't real-time anyway).
Set `export const maxDuration = 300` on the cron route — report polling can take a
while.

---

## Sync semantics (unchanged from Phase 2)

- Match by `amazonSku`, then `asin`.
- Overwrite **Amazon-owned** columns + **storefront price** (Amazon = price source
  of truth). Curated content (description, image, tags, title, compareAtPrice) is
  never touched.
- Unknown SKUs → created as **drafts** for admin enrichment.
- Every run logged to `sync_runs`; manual runs return the diff report to the UI.

---

## Optional niceties (later)

- **Sync history page** in `/admin` reading `sync_runs` (we already store full diffs).
- **Price lock** per product (a `priceLocked` boolean) so a curated price survives
  syncs — addresses the Phase 2 caveat that every sync overwrites storefront price.
- **Email/Slack alert** when a sync creates new drafts or changes status to inactive.
- **Write-back to Amazon** (true two-way): Listings Items `PATCH` to push a Pramora
  price/inventory change up to Amazon. Needs write scopes; out of scope unless wanted.
- **Webhook/near-real-time**: SP-API Notifications (e.g. `ANY_OFFER_CHANGED`,
  `LISTINGS_ITEM_MMFN_QUANTITY_CHANGE`) via SQS/EventBridge → a Vercel endpoint, to
  react in minutes instead of waiting for the daily cron.

---

## Build checklist

- [ ] Amazon: Professional account, developer registration, private app, data roles
- [ ] Generate LWA client id/secret + refresh token; note endpoint + marketplace id
- [ ] Add env vars (Vercel + local); re-verify ADMIN_PASSWORD/Razorpay after pull
- [ ] `src/lib/amazon/spapi.ts` — token cache, Reports API fetch, map → AmazonRecord
- [ ] Refactor shared row→record mapping out of `csv.ts`
- [ ] `/api/admin/sync/amazon/live` route + wire the admin button
- [ ] `/api/cron/amazon-sync` route with CRON_SECRET check
- [ ] `vercel.json` cron entry + `maxDuration`
- [ ] Test: live manual sync diff matches a CSV sync; cron fires; rate-limit retries
- [ ] (Optional) sync history page, price lock, alerts
```
