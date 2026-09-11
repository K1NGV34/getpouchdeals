#!/usr/bin/env python3
"""Deploy the submission API worker to Cloudflare and expose it on workers.dev."""
import json
import pathlib
import re
import urllib.error
import urllib.request
import uuid

home = pathlib.Path.home()
env = dict(re.findall(r'^([A-Z_]+)=(.+)$', (home / ".hermes/secrets/cloudflare.env").read_text(), re.M))
TOK = env["CLOUDFLARE_API_TOKEN"]
ACCT = env["CLOUDFLARE_ACCOUNT_ID"]
NS = (home / ".hermes/secrets/kv_ns.txt").read_text().strip()

SCRIPT = "getpouchdeals-api"
CODE = (home / "getpouchdeals/api/worker.js").read_text()


def call(url, method="GET", data=None, raw=None, ctype="application/json"):
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    r = urllib.request.Request(url, data=body, method=method,
                               headers={"Authorization": f"Bearer {TOK}", "Content-Type": ctype})
    try:
        return json.load(urllib.request.urlopen(r, timeout=60)), None
    except urllib.error.HTTPError as e:
        try:
            return json.load(e), f"HTTP {e.code}"
        except Exception:
            return None, f"HTTP {e.code}: {e.read()[:200]}"
    except Exception as e:
        return None, str(e)[:150]


# ---- multipart upload: metadata + module ----
metadata = {
    "main_module": "worker.js",
    "compatibility_date": "2026-09-01",
    "bindings": [
        {"type": "kv_namespace", "name": "POUCH_DEALS", "namespace_id": NS},
    ],
}

boundary = "----" + uuid.uuid4().hex
parts = []
parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\n"
             f"Content-Type: application/json\r\n\r\n{json.dumps(metadata)}\r\n".encode())
parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"worker.js\"; "
             f"filename=\"worker.js\"\r\nContent-Type: application/javascript+module\r\n\r\n".encode())
parts.append(CODE.encode())
parts.append(f"\r\n--{boundary}--\r\n".encode())
body = b"".join(parts)

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{SCRIPT}"
r, e = call(url, "PUT", raw=body, ctype=f"multipart/form-data; boundary={boundary}")
if (r or {}).get("success"):
    print(f"  deployed script '{SCRIPT}'")
    print(f"    modified: {r['result'].get('modified_on')}")
else:
    print("  DEPLOY FAILED:", (r or {}).get("errors") or e)
    raise SystemExit(1)

# ---- turn on workers.dev access ----
sub_url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{SCRIPT}/subdomain"
r2, e2 = call(sub_url, "POST", {"enabled": True, "previews_enabled": True})
if (r2 or {}).get("success"):
    print("  workers.dev access enabled")
else:
    print("  subdomain toggle:", (r2 or {}).get("errors") or e2)

# ---- resolve the public URL ----
sub, _ = call(f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/subdomain")
domain = (sub or {}).get("result", {}).get("subdomain")
if domain:
    public = f"https://{SCRIPT}.{domain}.workers.dev"
    print(f"\n  PUBLIC URL: {public}")
    (home / "getpouchdeals/api/endpoint.txt").write_text(public + "\n")
else:
    print("  could not resolve subdomain")
