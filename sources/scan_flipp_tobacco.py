#!/usr/bin/env python3
"""Scan every Flipp flyer for a zip code for tobacco / nicotine-pouch items.

Hypothesis to test: US retailers largely exclude tobacco from advertised
circulars, so Flipp may have no pouch prices at all. Better to know now.
"""
import json
import random
import re
import sys
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
BASE = "https://flyers-ng.flippback.com/api/flipp"
ZIP = sys.argv[1] if len(sys.argv) > 1 else "80202"
SID = "".join(str(random.randint(0, 9)) for _ in range(16))

TOBACCO = re.compile(
    r"\b(zyn|velo|on!|rogue|juice\s?head|nicotine|tobacco|cigarette|cigar|chew|"
    r"grizzly|copenhagen|marlboro|camel|pall\s?mall|vuse|juul|snus|snuff|"
    r"kodiak|skoal|timber\s?wolf|red\s?man|husky|stoker|seneca|american\s?spirit)\b",
    re.I)


def get(url):
    r = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://flipp.com/"})
    with urllib.request.urlopen(r, timeout=45) as resp:
        return json.load(resp)


data = get(f"{BASE}/data?locale=en&postal_code={ZIP}&sid={SID}")
flyers = data.get("flyers") or []
coupons = data.get("coupons") or []
loyalty = data.get("loyalty_program_coupons") or []
print(f"zip {ZIP}: {len(flyers)} flyers, {len(coupons)} coupons, {len(loyalty)} loyalty coupons\n")

# --- 1. coupons section (these DO carry values) ---
print("=== scanning coupon sections for tobacco ===")
for label, group in (("coupon", coupons), ("loyalty", loyalty)):
    hits = 0
    for c in group:
        blob = " ".join(str(c.get(k, "")) for k in
                        ("name", "description", "brand", "offer", "category", "merchant"))
        if TOBACCO.search(blob):
            hits += 1
            if hits <= 6:
                print(f"  [{label}] {str(c.get('name') or c.get('description'))[:64]}")
                print(f"           merchant={c.get('merchant')} value={c.get('value')} "
                      f"price={c.get('current_price')}")
    print(f"  {label}s matching tobacco: {hits}\n")

# --- 2. every flyer's items ---
print("=== scanning all flyer items for tobacco ===")
total_items = total_hits = priced = 0
flyer_hits = []
for f in flyers:
    name = f.get("merchant") or "?"
    fid = f.get("id")
    try:
        payload = get(f"{BASE}/flyers/{fid}/flyer_items?locale=en&sid={SID}")
    except Exception as e:
        print(f"  {name}: fetch failed {str(e)[:50]}")
        continue
    rows = payload if isinstance(payload, list) else (payload.get("items") or [])
    total_items += len(rows)
    got = []
    for it in rows:
        blob = f"{it.get('name','')} {it.get('brand','')}"
        if TOBACCO.search(blob):
            got.append(it)
            if it.get("current_price") is not None:
                priced += 1
    total_hits += len(got)
    if got:
        flyer_hits.append((name, len(got)))

print(f"\n  flyers scanned     : {len(flyers)}")
print(f"  total items seen   : {total_items}")
print(f"  tobacco matches    : {total_hits}")
print(f"  of those, priced   : {priced}")
if flyer_hits:
    print("  flyers containing tobacco:")
    for n, c in sorted(flyer_hits, key=lambda x: -x[1])[:20]:
        print(f"    {n:22s} {c}")
else:
    print("\n  => NO tobacco items advertised in any flyer for this zip.")
