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
