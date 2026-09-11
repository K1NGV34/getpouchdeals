# GetPouchDeals — launch guide

Your site is built and working. This is what's left, in order.

## What you have

```
getpouchdeals/
├── index.html    the page (SEO meta, 21+ gate, structured data)
├── styles.css    dark, mobile-first styling
├── data.js       CONFIG + the deal feed  ← everything you edit lives here
└── app.js        filtering, sorting, votes, report form, ad injection
```

No build step, no framework, no dependencies. It's static files — that means free
hosting, fast loads, and nothing to break at 2am.

---

## 1. Host it (10 minutes, free)

**Cloudflare Pages** — best option here. Free, fast, free SSL, and you can point
getpouchdeals.com at it directly.

1. Sign up at pages.cloudflare.com
2. "Create a project" → "Direct upload"
3. Drag the whole `getpouchdeals` folder in
4. Deploy. You get a `*.pages.dev` URL immediately.
5. Go to **Custom domains** → add `getpouchdeals.com` and `www.getpouchdeals.com`
6. Cloudflare shows you the DNS records to create. Add those at whoever you registered
   the domain with, and it goes live.

Alternatives: **Netlify** (same drag-and-drop flow), **GitHub Pages** (free, you already
have the account — push the repo, then Settings → Pages).

---

## 2. Turn off demo mode — do NOT skip this

Open `data.js` and change:

```js
demoMode: true,   →   demoMode: false,
```

Right now the site ships with **24 sample rows** so you can see it working. They are
illustrative, not real reports. If you launch with them on, you're publishing invented
prices to real people — which is both dishonest and the fastest way to lose the trust
the whole site depends on.

Either flip the flag and launch with an empty feed (honest, and fine — an empty deals
site says "no reports yet, add one"), or seed it with prices you've personally seen.

---

## 3. Collect reports from other people

Out of the box the report form saves to the visitor's own browser — the flow works, but
submissions don't reach you. To get them all in one place, set:

```js
submitEndpoint: "https://your-endpoint-here",
```

Easiest options, both free to start:

- **Formspree** — create a form, paste the endpoint URL, submissions hit your inbox.
- **Cloudflare Worker + Google Sheet** — slightly more work, but you own the data and
  it's free forever at this scale.

Once that's live, real reports accumulate and the feed becomes genuinely useful.

---

## 4. Money, in the order it actually pays

**Ads — AdSense.** Set `adsenseClient: "ca-pub-XXXXXXXXXXXXXXXX"` in `data.js` and the
script injects itself into both ad slots.

**Set your expectations correctly.** I verified Google's policy on this: tobacco is a
Publisher **Restriction**, not a Policy violation. Their own wording —

> *"Monetizing content that falls under the Google Publisher Restrictions is not a policy violation"*

So you won't get banned. But *"Google Ads ads will not serve on content labeled with
these restrictions"* — Google's own demand is excluded, leaving Authorized Buyers, DV360,
and others. Net effect: **fewer bidders, lower CPMs, and some page loads that fill
nothing.** Plan for maybe 20–40% of what a non-restricted site would earn. That's a
haircut, not a wall.

Fill the gaps with networks that actively handle restricted categories — **Adsterra,
MGID, PropellerAds**. Stick to their standard banner and native units and explicitly
decline popunder, push, and interstitial formats. That's what keeps ads from eating the
screen, which was your whole requirement.

**Affiliate — this will out-earn the ads.** The retailer list in `app.js` currently
points at the public programme pages. Apply, get approved, then swap each `url` for your
own tracked link. Verified programmes and rates:

- **Juice Head — 20% per sale**
- **JOEY — 20% per sale** (via FlexOffers, ~$1.04 EPC)
- **FRE — 10% per sale**, 30-day cookie (via CJ)
- **ALP, Snus Core, Kingston, Snusmania, Snuzone** — smaller programmes, all open

---

## 5. Compliance — non-negotiable, and it's already handled

- **21+ gate** ✅ built in, remembers the choice, no account, no tracking
- **Nicotine warning** ✅ in the footer — "This product contains nicotine. Nicotine is an addictive chemical."
- **Affiliate disclosure** ✅ under the retailer list (FTC)
- **No paid placement in the feed** ✅ the disclosure states stores can't pay to appear

Keep that last one. The moment stores can buy their way into the feed, the feed stops
being trustworthy and you have nothing.

---

## 6. The hard part, honestly

There is **no API and nothing scrapeable** for in-store pouch prices. I checked. Every
convenience chain prices locally and publishes none of it.

So this site is a **community**, not a scraper. The code is done. What determines whether
it works is whether people report prices.

Cold start is the whole game. The realistic play:

1. Seed it yourself — next time you're in a store, report the price. Ten rows beats zero.
2. Post the site where pouch users already gather: r/NicotinePouch, r/VeloNicotine.
   Frame it as "I built a price tracker, add yours" — not as promotion.
3. Post genuinely useful findings to those subs, with the site as the source. People are
   already sharing prices there manually; give them a better place to do it.

The Reddit posts are the distribution. There's no way around that part being manual.

---

## Local testing

```
cd getpouchdeals
python3 -m http.server 8000
```

Then open http://localhost:8000 — though it works fine by just double-clicking
`index.html`, since everything loads from relative paths with no fetch calls.
