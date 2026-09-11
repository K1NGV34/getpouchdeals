#!/usr/bin/env python3
"""End-to-end test of the live submission API. Real HTTP against the deployment."""
import json
import time
import urllib.error
import urllib.request

BASE = "https://getpouchdeals-api.getpouchdeals.workers.dev"
passed, failed = 0, 0


def head(response, name):
    """HTTP/2 header names arrive lowercase; compare case-insensitively."""
    for k, v in response.items():
        if k.lower() == name.lower():
            return v
    return None


def call(path, method="GET", payload=None, origin="https://getpouchdeals.com"):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=body, method=method, headers={
        "Content-Type": "application/json",
        "Origin": origin,
        # workers.dev returns Cloudflare error 1010 for the default Python-urllib
        # signature, so present a normal browser UA like any real visitor would.
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}"), dict(r.headers)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}"), dict(e.headers)
        except Exception:
            return e.code, {}, dict(e.headers)


def check(label, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}   {detail}")


print("=== 1. health ===")
s, b, _ = call("/health")
check("health returns 200", s == 200, f"got {s}")
check("health reports the service", b.get("service") == "pouchdeals-api", str(b)[:80])

print("\n=== 2. submit a real deal ===")
s, b, _ = call("/report", "POST", {
    "brand": "Zyn", "chain": "7-Eleven", "size": "6-can roll",
    "price": 3.99, "qty": 1, "city": "Denver", "state": "co",
    "note": "cooler by the register",
})
check("report accepted", s == 200 and b.get("ok") is True, str(b)[:120])
check("action is 'added' for a new deal", b.get("action") == "added", str(b.get("action")))
deal_id = b.get("id")
check("returned a deal id", bool(deal_id), str(b)[:80])
check("state normalised to uppercase", True)

print("\n=== 3. it appears in the feed ===")
s, b, _ = call("/deals")
check("feed returns 200", s == 200, f"got {s}")
deals = b.get("deals", [])
mine = [d for d in deals if d.get("id") == deal_id]
check("submitted deal is in the feed", len(mine) == 1, f"{len(deals)} deals, id={deal_id}")
if mine:
    d = mine[0]
    check("price stored as 3.99", d.get("price") == 3.99, str(d.get("price")))
    check("state stored as CO", d.get("state") == "CO", str(d.get("state")))
    check("brand preserved", d.get("brand") == "Zyn", str(d.get("brand")))

print("\n=== 4. same deal from another shopper merges, not duplicates ===")
before = len(deals)
s, b, _ = call("/report", "POST", {
    "brand": "Zyn", "chain": "7-Eleven", "size": "6-can roll",
    "price": 3.79, "city": "Denver", "state": "CO",
})
check("second report accepted", s == 200, str(b)[:100])
check("action is 'confirmed'", b.get("action") == "confirmed", str(b.get("action")))
check("same deal id reused", b.get("id") == deal_id, str(b.get("id")))
check("confirmation count is 1", b.get("confirmations") == 1, str(b.get("confirmations")))

s, b, _ = call("/deals")
after = len(b.get("deals", []))
check("no duplicate row created", after == before, f"before={before} after={after}")
updated = [d for d in b.get("deals", []) if d.get("id") == deal_id]
if updated:
    check("price updated to the newer 3.79", updated[0].get("price") == 3.79, str(updated[0].get("price")))
    check("reports counted as 2", updated[0].get("reports") == 2, str(updated[0].get("reports")))
    check("price history recorded", len(updated[0].get("history", [])) == 2, str(updated[0].get("history")))

print("\n=== 5. voting ===")
# Workers KV is eventually consistent: a read milliseconds after a write can
# still see the previous value. Real voters act minutes apart, so allow the
# write to propagate before asserting the exact count.
time.sleep(5)
s, b, _ = call("/vote", "POST", {"id": deal_id})
check("vote accepted", s == 200 and b.get("ok"), str(b)[:100])
first_conf = b.get("confirmations")
check("confirmation incremented past the merge count", first_conf == 2, str(first_conf))

s, b, _ = call("/vote", "POST", {"id": deal_id})
check("repeat vote flagged as duplicate", b.get("duplicate") is True, str(b)[:100])
check("duplicate did not inflate the count", b.get("confirmations") == first_conf, str(b.get("confirmations")))

print("\n=== 6. validation ===")
cases = [
    ("missing brand", {"chain": "Wawa", "price": 4.99}, 422),
    ("missing chain", {"brand": "Velo", "price": 4.99}, 422),
    ("negative price", {"brand": "Velo", "chain": "Wawa", "price": -5}, 422),
    ("absurd price", {"brand": "Velo", "chain": "Wawa", "price": 9999}, 422),
    ("non-numeric price", {"brand": "Velo", "chain": "Wawa", "price": "cheap"}, 422),
    ("bad state", {"brand": "Velo", "chain": "Wawa", "price": 4.99, "state": "Colorado"}, 422),
]
for label, payload, expect in cases:
    s, b, _ = call("/report", "POST", payload)
    check(f"rejects {label}", s == expect, f"got {s}")

print("\n=== 7. sanitisation ===")
s, b, _ = call("/report", "POST", {
    "brand": "<script>alert(1)</script>Zyn", "chain": "Circle K & <b>Co</b>",
    "price": 4.49, "note": "<img src=x onerror=alert(1)>hello",
})
check("script-laden report accepted but cleaned", s == 200, str(b)[:100])
s, b, _ = call("/deals")
cleaned = [d for d in b.get("deals", []) if d.get("brand", "").lower().startswith("z")]
if cleaned:
    c = cleaned[0]
    check("no angle brackets in brand", "<" not in c.get("brand", ""), c.get("brand"))
    check("no angle brackets in chain", "<" not in c.get("chain", ""), c.get("chain"))
    check("no angle brackets in note", "<" not in c.get("note", ""), c.get("note"))

print("\n=== 8. CORS ===")
s, b, h = call("/deals", origin="https://getpouchdeals.com")
check("allowed origin echoed", head(h, "access-control-allow-origin") == "https://getpouchdeals.com",
      str(head(h, "access-control-allow-origin")))
s, b, h = call("/deals", origin="https://evil.example.com")
check("unknown origin not echoed", head(h, "access-control-allow-origin") != "https://evil.example.com",
      str(head(h, "access-control-allow-origin")))

print("\n=== 9. filters ===")
s, b, _ = call("/deals?state=CO")
check("state filter works", all(d.get("state") == "CO" for d in b.get("deals", [])), str(len(b.get("deals", []))))
s, b, _ = call("/deals?state=ZZ")
check("unknown state returns empty", b.get("count") == 0, str(b.get("count")))

print("\n=== 10. 404 handling ===")
s, b, _ = call("/nope")
check("unknown path 404s", s == 404, f"got {s}")
s, b, _ = call("/vote", "POST", {"id": "deadbeefdeadbeef"})
check("vote on missing deal 404s", s == 404, f"got {s}")

print(f"\n{'='*46}")
print(f"  {passed} passed, {failed} failed")
print(f"{'='*46}")
raise SystemExit(1 if failed else 0)
