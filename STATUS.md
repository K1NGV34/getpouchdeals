# GetPouchDeals — operational status

Last updated: 2026-09-11

## LIVE

| | |
|---|---|
| **Custom domain** | https://getpouchdeals.com/ — **LIVE**, HTTPS, cert approved |
| **www** | pending certificate (apex cert covers only the bare domain) |
| **Origin** | https://k1ngv34.github.io/getpouchdeals/ |
| **Repo** | https://github.com/K1NGV34/getpouchdeals |
| **Hosting** | GitHub Pages, branch `main`, free |
| **Watchdog** | cron `5df4be568ad6`, every 6h, silent unless something breaks |

Verified in a real browser on the live domain: secure context, stylesheet applied,
21+ gate fires, 24 deals render, stats compute, per-pouch sorting correct, all
three assets return 200. `http://` 301-redirects to `https://`.

## DNS (Cloudflare)

Zone `getpouchdeals.com` — was empty, now:

```
A      getpouchdeals.com      185.199.108.153   (DNS-only)
A      getpouchdeals.com      185.199.109.153
A      getpouchdeals.com      185.199.110.153
A      getpouchdeals.com      185.199.111.153
CNAME  www.getpouchdeals.com  k1ngv34.github.io (DNS-only)
```

Records are **DNS-only (grey cloud), not proxied** — deliberate. The token has
`DNS:Edit` but not `Zone Settings:Edit`, so it cannot change SSL/TLS mode. Proxying
without setting SSL to Full causes redirect loops on GitHub Pages. Grey-cloud avoids
that failure mode entirely; GitHub issues its own certificate.

## Cloudflare account

Four zones visible to the token:

- `getpouchdeals.com` — active (live)
- `vasquezfam.us` — active
- `vfdlabs.com` — active
- `kingsbiz.work` — status **`moved`** ⚠️ not active. Worth investigating: `moved`
  usually means the zone was transferred to a different Cloudflare account or is
  stuck mid-migration. Its DNS is NOT being served.

## Credentials

`~/.hermes/secrets/cloudflare.env` (mode 600) — account token `cfat_…`, scope
DNS:Edit + Zone:Read across all zones. Helper: `~/.hermes/scripts/cf.sh`
(`verify` / `zones` / `records <zone>` / `point <zone>`).

**⚠️ ROTATE THIS TOKEN.** It was pasted into the Telegram chat, so it is in the
session log. It grants DNS rewrite on all four domains, which is the standard
domain-hijack vector. Manage Account → Account API Tokens → Revoke "Hermes domains",
create a fresh one, drop it into the env file (mode 600), and nothing else needs
to change.

## Still needs you

1. **Rotate the Cloudflare token** (above).
2. **Affiliate signups** — Juice Head 20%, JOEY 20%, FRE 10%. Identity verification
   required. Send me the tracked links and I swap them into `app.js`.
3. **AdSense** — send the `ca-pub-` ID and I wire both ad slots.
4. **Submission backend** — tell me where reports should land (your inbox via
   Formspree, or a Google Sheet) and I'll build it.

## `demoMode` — still ON, deliberately

The 24 rows are sample data and the page says so in a visible banner. The site is
now **publicly live on the real domain**. I have not flipped it to `false` because
that is a launch decision, not a maintenance one — flipping it empties the feed.
Either:
- seed real prices you have personally seen, or
- flip the flag and launch honest-but-empty ("no reports yet, add one")

I will not publish invented prices as though they were real reports.

## The constraint

No API, no scrapeable source for in-store pouch prices — every chain prices locally.
The feed becomes real only when people submit. And Reddit is network-blocked from
this machine, so launch distribution is yours. I can draft the posts.

## Possible next work (no input needed)

- Per-state landing pages (`/deals/texas`) — those are what rank in search
- The submission backend
- Seed the feed from public sources, clearly labelled as sourced not user-submitted
- Investigate `kingsbiz.work`'s `moved` status
