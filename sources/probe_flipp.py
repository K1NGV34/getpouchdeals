#!/usr/bin/env python3
"""Probe Flipp for real pouch promo data.

Endpoints (no auth; sid is any 16 random digits):
  /api/flipp/data?locale=en&postal_code=ZIP&sid=SID
  /api/flipp/flyers/{flyer_id}/flyer_items?locale=en&sid=SID
"""
import json
import random
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
BASE = "https://flyers-ng.flippback.com/api/flipp"
ZIP = "80202"


def sid():
    return "".join(str(random.randint(0, 9)) for _ in range(16))


def get(url):
    r = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://flipp.com/"})
    with urllib.request.urlopen(r, timeout=40) as resp:
        return json.load(resp)


s = sid()
data = get(f"{BASE}/data?locale=en&postal_code={ZIP}&sid={s}")

# the /data payload nests flyers under a few possible keys
flyers = data if isinstance(data, list) else (
    data.get("flyers") or data.get("data") or []
)
print(f"flyers near {ZIP}: {len(flyers)}")
print("top-level keys:", list(data)[:12] if isinstance(data, dict) else "(list)")

# merchants that actually stock nicotine pouches
WANTED = {"Dollar General", "Family Dollar", "CVS Pharmacy", "Walgreens",
          "Walmart USA", "King Soopers", "Safeway", "Sam's Club", "Sprouts",
          "Circle K", "7-Eleven", "QuikTrip", "Kwik Trip"}

picked = []
for f in flyers:
    name = f.get("merchant") or f.get("merchant_name") or ""
    if name in WANTED:
        picked.append((name, f.get("id"), f.get("valid_to", "")[:10]))
print(f"relevant flyers: {len(picked)}")
for n, i, v in picked:
    print(f"   {n:16s} id={i} valid_to={v}")

# pull items from the first couple and look for pouch brands
BRANDS = ["zyn", "velo", "on!", "rogue", "juice head", "fre", "alp", "lucy", "pouch"]
for name, fid, _ in picked[:3]:
    try:
        items = get(f"{BASE}/flyers/{fid}/flyer_items?locale=en&sid={s}")
    except Exception as e:
        print(f"\n{name}: items fetch failed {str(e)[:70]}")
        continue
    rows = items if isinstance(items, list) else (items.get("items") or [])
    print(f"\n{name}: {len(rows)} items in flyer")
    hits = [it for it in rows
            if any(b in str(it.get("name", "")).lower() for b in BRANDS)]
    print(f"   pouch-brand matches: {len(hits)}")
    for it in hits[:8]:
        print(f"     - {str(it.get('name'))[:56]} | ${it.get('current_price')} "
              f"was ${it.get('original_price')} | {it.get('valid_to','')[:10]}")
    if not hits and rows:
        print("   sample item keys:", list(rows[0])[:14])
        print("   sample names:", [str(r.get('name'))[:30] for r in rows[:5]])
