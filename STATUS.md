# GetPouchDeals — operational status

Last updated: 2026-09-11

## What is live

| Piece | Where |
|---|---|
| Site | https://getpouchdeals.com/ (HTTPS, http→https 301) |
| Origin | https://k1ngv34.github.io/getpouchdeals/ |
| Repo | https://github.com/K1NGV34/getpouchdeals |
| **API** | https://getpouchdeals-api.getpouchdeals.workers.dev |
| Cloudflare zone | `eb1fec5cdb5a96ee9c0aed2303111822` |

The site is static on GitHub Pages. The **API is a Cloudflare Worker** with a KV
namespace, so submissions and confirmations are shared state rather than
per-browser localStorage.

## The submission API

Worker script: `getpouchdeals-api` · KV namespace: `pouch-deals` (`f7a03ff546cb4f53a9d038c1a0c8b87c`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | liveness |
| `/deals` | GET | the feed; supports `?state=`, `?chain=`, `?brand=`, `?limit=` |
| `/report` | POST | submit a price report |
| `/vote` | POST | confirm a price is still current |

### Behaviour worth knowing

- **Reports merge instead of duplicating.** A report matching an existing
  `chain + brand + size` within 7 days bumps that deal's price and confirmation
  count rather than creating a second row.
- **Votes are deduped per IP per deal per day** using a hashed key. Cloudflare
  rejects client-supplied `CF-Connecting-IP`, so this can't be spoofed.
- **Feed shows 14 days**; older deals drop out.
- **Every submission is stored under its own key** (`deal:<id>`) so a write race
  can't lose it. The assembled `feed` key is a cache and is rebuildable.
- KV is **eventually consistent** — a read milliseconds after a write can see the
  old value. Fine for humans; the test suite allows for it.
- `*.workers.dev` returns **Cloudflare error 1010** to non-browser user agents.
  Any client (scripts, monitors) must send a normal browser `User-Agent`.

### Verified

39/39 end-to-end tests pass against the live deployment
(`python3 getpouchdeals/api/test_api.py`) — submission, merge, voting, dedupe,
validation, sanitisation, CORS, filters, 404s. A real browser submission on the
live domain was then read back from the API by a separate client, proving the
state is genuinely shared.

## Current data state

**The live feed is empty (0 deals).** All test rows were purged. The site renders
24 sample rows from `data.js` while `demoMode` is true, behind a disclosure
banner.

Nothing on the site is a real price yet. That is deliberate — seeding invented
prices on a community site would be dishonest.

## Where deal data can and cannot come from

**In-store chain promos are not obtainable. This is proved, not assumed.**

Scanned every Flipp flyer near zip 80202 (Flipp digitises circulars for 2,000+
retailers including Dollar General, Family Dollar, CVS, Walgreens, Walmart):

- 52 flyers
- 6,520 individual flyer items
- **0 nicotine pouch items, 0 pouch prices**
- 216 coupons + 148 loyalty coupons → **0 tobacco**
- The 14 loose keyword hits were false positives: Kodiak *waffles*, Nicorette
  (NRT, not pouches), dog chews, Hershey's

Individual chains behave the same way. Rocket Stores, 7-Eleven, Circle K,
QuikTrip and Kwik Trip all run pouch offers **inside their apps** (Rocket CREW,
7Rewards, QT app, Kwik Rewards) behind an account — nothing public, and
harvesting it would breach their terms.

The cause is structural: US tobacco advertising restrictions (Master Settlement
Agreement + state law) keep tobacco out of advertised circulars.

Confirmation that crowdsourcing is the only route: a competitor, **PouchHound**,
already does exactly this and is crowdsourced for the same reason.

### So: online prices (built, live)

Online retailers *do* publish prices, via public intended endpoints:

| Source | Method | Items |
|---|---|---|
| PouchSpot | Shopify `/products.json` (store's own public feed) | 249 |
| FRE | Shopify `/products.json` | 92 |
| Northerner | schema.org JSON-LD `ProductGroup.hasVariant[].offers` | 60 |

**401 real prices**, refreshed daily by cron `f9d1774db84a` (7am) →
`~/getpouchdeals/online-deals.json` → rendered in the "Cheapest online right
now" block in the `#online` section.

Nothing is invented. Every price comes from the retailer's catalogue at fetch
time. The block is labelled as retailer-published and visually distinct from the
community feed, because the topbar promises feed prices come from shoppers.

### Pouches per can

`cost per pouch` is the site's core comparison, so a wrong can-count silently
misranks everything. Counts in `sources/fetch_online_prices.py` are **sourced
and annotated** (ZYN 15 via us.zyn.com FAQ, CLEW 20, FRE 20, ZEO 25, etc.).
Items without a sourced count are flagged `pouchesVerified: false` and are
**excluded from the per-pouch ranking**. A wrong value (Juice Head 25) was found
and corrected to 20.

## Config switches (`data.js`)

| Key | Now | Meaning |
|---|---|---|
| `demoMode` | `true` | show sample rows alongside live ones |
| `apiBase` | worker URL | submission API |
| `adsenseClient` | `""` | no ads — needs your AdSense publisher ID |
| `submitEndpoint` | `""` | superseded by `apiBase` |

Affiliate links currently point at **program pages, not tracked links**, so they
earn nothing until you sign up and swap in the tracked URLs.

## Ops

- Watchdog: `~/.hermes/scripts/getpouchdeals_health.sh`, cron every 6h, silent
  when healthy. Checks apex, www, GitHub origin, assets, **and the API**.
- Deploy the API: `python3 ~/getpouchdeals/api/deploy.py`
- Redeploy the site: commit + push to `main` (Pages builds automatically)
- Bump `?v=` on `app.js`/`data.js`/`styles.css` in `index.html` whenever you
  change them — Pages caches for 10 minutes and that has bitten us repeatedly.

## What is still missing

1. **Real submissions.** The plumbing works; the feed is empty. Distribution is
   the limiter. Reddit is network-blocked from this box, so that runs through you.
2. **`Zone → Workers Routes → Edit`** on the Cloudflare token, to serve the API
   at `getpouchdeals.com/api/*` instead of the `workers.dev` URL. Cosmetic —
   same-origin and no CORS — not blocking.
3. **AdSense publisher ID** and **tracked affiliate links** — both need your
   accounts.
4. **State/store SEO pages** — one indexable page today; this is the organic
   search engine and the next build.
