#!/usr/bin/env python3
"""Check which online pouch retailers expose real, current prices to a plain fetch.

In-store chain promo data turned out not to exist publicly (retailers don't
advertise tobacco prices). Online retailers do publish theirs, so that is the
source that can fill the site until the community contributes.
"""
import json
import re
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

SITES = [
    ("Northerner",   "https://www.northerner.com/us/nicotine-pouches/deals"),
    ("SnusDaddy",    "https://snusdaddy.com/collections/nicotine-pouches"),
    ("SnusDirect",   "https://snusdirect.com/collections/nicotine-pouches"),
    ("PouchSpot",    "https://pouchspot.com/collections/all"),
    ("FRE",          "https://frepouch.com/collections/all"),
    ("Prilla",       "https://www.prilla.com/collections/nicotine-pouches"),
]


def fetch(url):
    r = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en"})
    with urllib.request.urlopen(r, timeout=45) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


for name, url in SITES:
    print(f"=== {name} ===")
    try:
        status, html = fetch(url)
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} — blocked or missing")
        print()
        continue
    except Exception as e:
        print(f"  fetch failed: {str(e)[:70]}")
        print()
        continue

    size = len(html)
    # Shopify exposes a machine-readable product feed at /products.json
    jsonld = re.findall(r'application/ld\+json[^>]*>(.*?)</script>', html, re.S)
    prices = re.findall(r'"price"\s*:\s*"?(\d+\.\d{2})"?', html)
    dollars = re.findall(r'\$\d+\.\d{2}', html)

    # Shopify detection -> we can use the clean products.json endpoint instead
    shopify = "cdn.shopify.com" in html or "/products.json" in html

    print(f"  http={status}  bytes={size:,}")
    print(f"  jsonld blocks={len(jsonld)}  price fields={len(prices)}  $ occurrences={len(dollars)}")
    if prices:
        uniq = sorted({float(p) for p in prices})
        print(f"  price range: ${uniq[0]:.2f} - ${uniq[-1]:.2f}  ({len(uniq)} distinct)")
    if shopify:
        try:
            s2, feed = fetch(url.split("/collections")[0].split("/us/")[0].rstrip("/") + "/products.json?limit=250")
            data = json.loads(feed)
            prods = data.get("products", [])
            print(f"  SHOPIFY products.json -> {len(prods)} products")
            for p in prods[:3]:
                v = (p.get("variants") or [{}])[0]
                print(f"     - {p.get('title','')[:50]} | ${v.get('price')}")
        except Exception as e:
            print(f"  products.json failed: {str(e)[:60]}")
    print()
