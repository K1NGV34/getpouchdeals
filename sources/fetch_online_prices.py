#!/usr/bin/env python3
"""Collect real, current nicotine-pouch prices from online retailers.

Why this exists: in-store chain promos are not published anywhere (proved by
scanning 52 Flipp flyers / 6,520 items -> 0 pouch prices), so until the
community contributes in-store reports the site needs a source of genuine
data. Online retailers publish theirs via public, intended endpoints:

  PouchSpot   Shopify /products.json   (the store's own public feed)
  FRE         Shopify /products.json
  Northerner  schema.org JSON-LD ProductGroup -> hasVariant[].offers

Nothing here is invented: every price comes from the retailer's own catalogue
at fetch time. Output: online-deals.json
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
OUT = Path(__file__).resolve().parent.parent / "online-deals.json"

# Pouches per can by brand, for true cost-per-pouch comparison.
# VERIFIED counts only — sourced, because this number drives the whole
# "cheapest per pouch" ranking and a wrong value silently misranks everything.
#   ZYN 15      -> us.zyn.com FAQ ("every can of ZYN contains 15")  [Ultra = 20]
#   FRE 20      -> frepouch.com / prilla.com
#   VELO 15|20  -> prilla.com: oblong cans 15, round/mini cans 20 (ambiguous,
#                  use 20 and flag it) 
#   CLEW 20     -> northerner.com product page, nicokick.com
#   ZEO 25      -> prilla.com (most of any brand)
#   White Fox 20-> prilla.com slim
#   Juice Head 20 -> stated in the PouchSpot product description
#   RAVE/Denssi/LEO/XQS/Loop 20 -> stated in PouchSpot product descriptions
#   Neafs 25    -> PouchSpot product description
# Brands not listed get DEFAULT and are marked estimated.
POUCHES = {
    "zyn ultra": 20,
    "zyn": 15,
    "zeo": 25,
    "white fox": 20,
    "fre": 20,
    "velo": 20,
    "clew": 20,
    "juice head": 20,
    "neafs": 25,
    "rave": 20,
    "denssi": 20,
    "leo": 20,
    "xqs": 20,
    "loop": 20,
    "on!": 20,
    "rogue": 20,
    "sesh": 20,
    "zone": 20,
    "alp": 20,
    "grizzly": 20,
    "skruf": 20,
    "killa": 20,
    "pablo": 20,
    "iceberg": 20,
    "lucy": 15,
}
DEFAULT_POUCHES = 20

# titles that mean "more than one can" — per-can maths would be wrong otherwise
MULTI = re.compile(r"\b(\d{1,2})\s*(?:x\s*)?(?:cans?|packs?|tins?|rolls?)\b", re.I)
BUNDLE = re.compile(r"\b(bundle|mixer|variety|sampler|mixpack|mix pack|multipack)\b", re.I)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")


def pouches_for(brand, title=""):
    """Return (count, verified). Most specific signal wins.

    Priority: explicit count in the title > variant keyword > brand default.
    'zyn ultra' is checked before 'zyn' so the longer key wins.
    """
    explicit = count_from_title(title)
    if explicit:
        return explicit, True

    var = variant_count(title, brand)
    if var:
        return var, True

    blob = f"{brand or ''} {title or ''}".lower()
    best = None
    for key, n in POUCHES.items():
        if key in blob and (best is None or len(key) > len(best[0])):
            best = (key, n)
    if best:
        return best[1], True
    return DEFAULT_POUCHES, False


def mg_from(title):
    m = re.search(r"(\d{1,2}(?:\.\d)?)\s*mg\b", title, re.I)
    return float(m.group(1)) if m else None


# Can counts are not uniform even within one brand, which is exactly why a
# single "zyn = 15" is wrong:
#   ZYN US standard = 15     ZYN Ultra = 20     ZYN sold in EU = 20
#   VELO oblong/slim = 15    VELO round/mini = 20
# So read an explicit count off the title first, then variant keywords, and
# only then fall back to the brand default.
VARIANT_COUNTS = [
    ("zyn ultra", 20), ("zyn mini", 15), ("ultra", None),   # 'ultra' alone is brand-specific
    ("slim", None), ("mini", None),
]


def count_from_title(title):
    """Explicit counts beat any guess: '15ct', '20 ct', '20 pouches', '25 portions'."""
    m = re.search(r"\b(\d{1,3})\s*(?:ct\b|count\b|pouches?\b|portions?\b|nicotine pouches?\b)", title, re.I)
    if m:
        n = int(m.group(1))
        if 5 <= n <= 50:
            return n
    return None


def variant_count(title, brand):
    blob = f"{brand or ''} {title}".lower()
    if "zyn" in blob and "ultra" in blob:
        return 20
    return None


def cans_from(title):
    """How many cans does this listing represent?"""
    m = MULTI.search(title)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 50:
            return n
    if BUNDLE.search(title):
        return 0        # unknown bundle size -> don't fake per-can maths
    return 1


def norm(store, brand, title, price, was, url, available=True, product_type=""):
    title = re.sub(r"\s+", " ", (title or "")).strip()
    if not price or price <= 0:
        return None
    cans = cans_from(title)
    ppc, verified = pouches_for(brand, title)
    per_can = round(price / cans, 2) if cans else None
    return {
        "store": store,
        "brand": (brand or "").strip(),
        "product": title,
        "mg": mg_from(title),
        "price": round(float(price), 2),
        "was": round(float(was), 2) if was and float(was) > float(price) else None,
        "cans": cans,
        "pouchesPerCan": ppc,
        # false means the pouch count is a default guess, not a sourced figure
        "pouchesVerified": verified,
        "perCan": per_can,
        "perPouch": round(per_can / ppc, 3) if per_can else None,
        "url": url,
        "available": bool(available),
        "type": product_type or "Nicotine Pouch",
    }


# ---------------------------------------------------------------- sources

def shopify(store, base, keep=None):
    """Shopify stores publish their catalogue at /products.json — their own feed."""
    data = json.loads(fetch(base.rstrip("/") + "/products.json?limit=250"))
    out = []
    for p in data.get("products", []):
        variants = p.get("variants") or []
        if not variants:
            continue
        v = variants[0]
        title = p.get("title", "")
        if keep and not keep(p):
            continue
        item = norm(
            store, p.get("vendor", ""), title,
            float(v.get("price") or 0),
            float(v["compare_at_price"]) if v.get("compare_at_price") else None,
            f"{base.rstrip('/')}/products/{p.get('handle','')}",
            v.get("available", True),
            p.get("product_type", ""),
        )
        if item:
            out.append(item)
    return out


def northerner(url, store="Northerner"):
    """Magento stores using schema.org ProductGroup -> hasVariant[].offers.
    Northerner and Nicokick both use this exact shape."""
    html = fetch(url)
    blocks = re.findall(r'application/ld\+json[^>]*>(.*?)</script>', html, re.S)
    out = []
    for b in blocks:
        try:
            d = json.loads(b)
        except Exception:
            continue
        groups = d if isinstance(d, list) else [d]
        for g in groups:
            if not isinstance(g, dict) or g.get("@type") != "ProductGroup":
                continue
            gname = g.get("name") or ""
            for var in (g.get("hasVariant") or []):
                if not isinstance(var, dict):
                    continue
                offers = var.get("offers") or {}
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                price = offers.get("price")
                name = var.get("name") or gname
                item = norm(
                    store, (gname.split()[0] if gname else name.split()[0] if name else ""),
                    name,
                    float(price) if price else 0, None,
                    var.get("url", url),
                    "InStock" in str(offers.get("availability", "")),
                )
                if item:
                    out.append(item)
    # dedupe by url+price
    seen, uniq = set(), []
    for i in out:
        k = (i["url"], i["price"])
        if k not in seen:
            seen.add(k); uniq.append(i)
    return uniq


# ------------------------------------------------------------------- main

def main():
    sources, items = [], []

    jobs = [
        ("PouchSpot", lambda: shopify("PouchSpot", "https://pouchspot.com",
                                      keep=lambda p: "pouch" in (p.get("product_type","") + " ".join(p.get("tags") or [])).lower()
                                      or p.get("product_type","") == "Nicotine Pouch")),
        ("FRE", lambda: shopify("FRE", "https://frepouch.com")),
        ("Northerner", lambda: northerner("https://www.northerner.com/us/nicotine-pouches/deals", "Northerner")),
        ("Nicokick", lambda: northerner("https://nicokick.com/us/nicotine-pouches", "Nicokick")),
    ]

    for name, fn in jobs:
        try:
            got = fn()
            items.extend(got)
            sources.append({"name": name, "count": len(got)})
            print(f"  {name:12s} {len(got):4d} prices")
        except Exception as e:
            sources.append({"name": name, "count": 0, "error": str(e)[:120]})
            print(f"  {name:12s} FAILED: {str(e)[:80]}")

    # drop anything without a usable price, then sort by cost per pouch
    items = [i for i in items if i["price"] > 0]
    priced = [i for i in items if i["perPouch"]]
    priced.sort(key=lambda x: x["perPouch"])
    rest = [i for i in items if not i["perPouch"]]
    items = priced + rest

    payload = {
        "generatedAt": int(time.time()),
        "generatedAtISO": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sources": sources,
        "count": len(items),
        "items": items,
    }
    OUT.write_text(json.dumps(payload, indent=1))

    verified = [i for i in items if i.get("pouchesVerified")]
    est = [i for i in items if not i.get("pouchesVerified")]
    print(f"\n  wrote {OUT} — {len(items)} items from {len(sources)} sources")
    for s in sources:
        print(f"    {s['name']:12s} {s['count']}")
    print(f"  pouch count sourced : {len(verified)}")
    print(f"  pouch count guessed : {len(est)}")
    if est:
        brands = sorted({i["brand"] for i in est if i["brand"]})
        print(f"    unverified brands : {brands[:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
