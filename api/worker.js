/**
 * getpouchdeals submission API
 *
 * Community-reported nicotine pouch prices. Three jobs:
 *   GET  /deals   -> the feed everyone sees
 *   POST /report  -> accept a price report from a shopper
 *   POST /vote    -> confirm a price is still current
 *
 * Storage design: every submission is written to its own durable key
 * (`deal:<id>`) so a submission can never be lost to a write race. The
 * assembled feed lives in a single cached key (`feed`) that is rebuilt
 * from those records -- so if the cache is ever stale or clobbered, it is
 * rebuildable rather than lost.
 */

const FIELDS = ["brand", "chain", "size", "city", "state", "note"];
const MAX_LEN = { brand: 40, chain: 40, size: 24, city: 40, state: 2, note: 140 };
const ALLOWED_ORIGINS = [
  "https://getpouchdeals.com",
  "https://www.getpouchdeals.com",
  "https://k1ngv34.github.io",
];
const DAY = 86400;
const FEED_DAYS = 14;      // deals older than this drop out of the feed
const MERGE_WINDOW = 7;    // a matching report inside this window confirms, not duplicates

/* ---------------------------------------------------------------- utils */

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json;charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });

function cors(request) {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    Vary: "Origin",
  };
}

/** Strip anything that could be markup, collapse whitespace, cap length. */
function clean(value, field) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LEN[field] || 80);
}

const now = () => Math.floor(Date.now() / 1000);

/** Stable id for a deal so identical reports merge instead of piling up. */
async function dealId(body) {
  const basis = `${body.chain}|${body.brand}|${body.size}`.toLowerCase();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** One IP gets one vote per deal per day, so counts can't be trivially stuffed. */
async function voterKey(request, id) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const day = Math.floor(now() / DAY);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${id}|${day}`));
  return "vote:" + [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------------------------------------- feed */

async function listDeals(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.POUCH_DEALS.list({ prefix: "deal:", cursor, limit: 1000 });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const cutoff = now() - FEED_DAYS * DAY;
  const deals = (
    await Promise.all(keys.map((k) => env.POUCH_DEALS.get(k, "json")))
  ).filter((d) => d && d.updatedAt >= cutoff);

  deals.sort((a, b) => b.updatedAt - a.updatedAt);
  return deals;
}

/**
 * Rebuild the cached feed from the durable per-deal records.
 *
 * `override` is the record we just wrote. KV list/get are eventually
 * consistent, so a deal written milliseconds ago may not show up in the
 * listing yet -- without this the person who just submitted would watch
 * their own report fail to appear. We splice it in explicitly so a
 * submission is always immediately visible to the person who made it.
 */
async function rebuildFeed(env, override) {
  const deals = await listDeals(env);

  if (override) {
    const i = deals.findIndex((d) => d.id === override.id);
    if (i >= 0) deals[i] = override;
    else deals.unshift(override);
    deals.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  await env.POUCH_DEALS.put("feed", JSON.stringify({ generatedAt: now(), deals }));
  return deals;
}

/* ---------------------------------------------------------- validation */

function validate(b) {
  const errors = [];

  // Validate the RAW state before cleaning, otherwise "Colorado" gets truncated
  // to "Co" and silently passes the two-letter check.
  const rawState = String(b.state ?? "").trim();
  if (rawState && !/^[A-Za-z]{2}$/.test(rawState)) {
    errors.push("state must be a 2-letter code (e.g. CO)");
  }

  const out = {};
  for (const f of FIELDS) out[f] = clean(b[f], f);

  if (!out.brand) errors.push("brand is required");
  if (!out.chain) errors.push("chain is required");

  const price = Number(b.price);
  if (!Number.isFinite(price)) errors.push("price must be a number");
  else if (price <= 0 || price > 200) errors.push("price must be between $0.01 and $200");
  out.price = Number.isFinite(price) ? Math.round(price * 100) / 100 : 0;

  const qty = Number(b.qty);
  out.qty = Number.isFinite(qty) && qty > 0 && qty <= 100 ? Math.round(qty) : 1;

  out.state = out.state.toUpperCase();

  return { errors, deal: out };
}

/* ------------------------------------------------------------- routes */

async function handleReport(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }

  const { errors, deal } = validate(body || {});
  if (errors.length) return json({ ok: false, error: errors.join(", ") }, 422);

  const id = await dealId(deal);
  const existing = await env.POUCH_DEALS.get(`deal:${id}`, "json");

  const canMerge = existing && now() - existing.updatedAt < MERGE_WINDOW * DAY;

  const record = canMerge
    ? {
        ...existing,
        price: deal.price,
        qty: deal.qty,
        city: deal.city || existing.city,
        state: deal.state || existing.state,
        note: deal.note || existing.note,
        updatedAt: now(),
        confirmations: (existing.confirmations || 0) + 1,
        reports: (existing.reports || 1) + 1,
        history: [
          ...(existing.history || []).slice(-9),
          { at: now(), price: deal.price },
        ],
      }
    : {
        id,
        ...deal,
        reportedAt: now(),
        updatedAt: now(),
        confirmations: 0,
        reports: 1,
        history: [{ at: now(), price: deal.price }],
      };

  await env.POUCH_DEALS.put(`deal:${id}`, JSON.stringify(record));
  await rebuildFeed(env, record);

  return json({
    ok: true,
    action: canMerge ? "confirmed" : "added",
    id,
    confirmations: record.confirmations,
    message: canMerge
      ? `Confirmed — this price has now been reported ${record.reports} times.`
      : "Thanks — your report is live.",
  });
}

async function handleVote(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }

  const id = clean(body?.id, "size");
  if (!id) return json({ ok: false, error: "id is required" }, 400);

  const record = await env.POUCH_DEALS.get(`deal:${id}`, "json");
  if (!record) return json({ ok: false, error: "no such deal" }, 404);

  const vk = await voterKey(request, id);
  if (await env.POUCH_DEALS.get(vk)) {
    return json({
      ok: true,
      duplicate: true,
      confirmations: record.confirmations || 0,
      message: "You already confirmed this today.",
    });
  }

  await env.POUCH_DEALS.put(vk, "1", { expirationTtl: 2 * DAY });

  record.confirmations = (record.confirmations || 0) + 1;
  record.updatedAt = now();
  await env.POUCH_DEALS.put(`deal:${id}`, JSON.stringify(record));
  await rebuildFeed(env, record);

  return json({ ok: true, confirmations: record.confirmations });
}

async function handleDeals(url, env) {
  let payload = await env.POUCH_DEALS.get("feed", "json");
  if (!payload) payload = { generatedAt: now(), deals: await rebuildFeed(env) };

  let deals = payload.deals || [];
  const q = (k) => (url.searchParams.get(k) || "").toLowerCase();
  const [state, chain, brand] = [q("state"), q("chain"), q("brand")];

  if (state) deals = deals.filter((d) => (d.state || "").toLowerCase() === state);
  if (chain) deals = deals.filter((d) => (d.chain || "").toLowerCase().includes(chain));
  if (brand) deals = deals.filter((d) => (d.brand || "").toLowerCase().includes(brand));

  const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 1000);
  deals = deals.slice(0, limit);

  return json(
    { ok: true, count: deals.length, generatedAt: payload.generatedAt, deals },
    200,
    { "cache-control": "public, max-age=30" }
  );
}

/* -------------------------------------------------------------- entry */

export default {
  async fetch(request, env) {
    const corsHeaders = cors(request);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let res;
      if (path === "/deals" && request.method === "GET") res = await handleDeals(url, env);
      else if (path === "/report" && request.method === "POST") res = await handleReport(request, env);
      else if (path === "/vote" && request.method === "POST") res = await handleVote(request, env);
      else if (path === "/" || path === "/health") {
        res = json({ ok: true, service: "pouchdeals-api", time: now() });
      } else {
        res = json({ ok: false, error: "not found" }, 404);
      }

      const merged = new Response(res.body, res);
      for (const [k, v] of Object.entries(corsHeaders)) merged.headers.set(k, v);
      return merged;
    } catch (err) {
      return json({ ok: false, error: "internal error", detail: String(err).slice(0, 200) }, 500, corsHeaders);
    }
  },
};
