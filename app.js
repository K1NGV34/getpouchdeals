/* ============================================================
   GetPouchDeals — app logic
   Depends on data.js (CONFIG, DEALS, BRANDS, STORES, POUCH_COUNT)
   ============================================================ */
"use strict";

/* Online retailers. Each programme verified to exist and accept affiliates.
   Swap `url` for your tracked link once approved. */
const RETAILERS = [
  {name:"Northerner",  rate:"Deals hub",  note:"US pouch retailer with a dedicated clearance section.", url:"https://www.northerner.com/us/nicotine-pouches/deals"},
  {name:"Juice Head",  rate:"20% / sale", note:"Direct brand programme — one of the highest rates in the category.", url:"https://juicehead.com/pages/affiliate-program"},
  {name:"JOEY",        rate:"20% / sale", note:"Listed via FlexOffers. ~$1.04 EPC over 90 days.", url:"https://www.flexoffers.com/affiliate-programs/joey-affiliate-program/"},
  {name:"FRE",         rate:"10% / sale", note:"Runs through CJ with a 30-day cookie window.", url:"https://frepouch.com/pages/affiliate-program"},
  {name:"ALP",         rate:"Programme",  note:"Newer brand running an active affiliate coalition.", url:"https://alppouch.com/pages/affiliate-program"},
  {name:"SnusDaddy",   rate:"Programme",  note:"Wide import range, good for flavours US stores don't carry.", url:"https://snusdaddy.com/"}
];

const LS_AGE = "gpd_age_ok", LS_VOTES = "gpd_my_votes",
      LS_SUBS = "gpd_my_submissions", LS_THEME = "gpd_theme";

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const money = v => "$" + Number(v).toFixed(2);
const cents = v => (Number(v) * 100).toFixed(1) + "\u00A2";

function readLS(k, fb){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(_) { return fb; } }
function writeLS(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) {} }

const pouchesFor = b => POUCH_COUNT[b] || 20;
const perPouch   = d => d.price / pouchesFor(d.brand);
/* Per-brand shelf price. A single global figure struck through on every card
   is the clearest sign a deals feed is synthetic — real shelf prices vary. */
const typicalFor = d => (typeof TYPICAL !== "undefined" && TYPICAL[d.brand]) || CONFIG.typicalPerCan;
const brandColor = b => (typeof BRAND_COLOR !== "undefined" && BRAND_COLOR[b]) || "#55606b";
const savePct    = d => { const t = typicalFor(d); return t ? ((t - d.price) / t) * 100 : 0; };

function agoLabel(h){
  if (h < 1) return "just now";
  if (h < 24) return Math.round(h) + "h ago";
  const d = Math.round(h / 24);
  return d === 1 ? "1 day ago" : d + " days ago";
}

/* inline icons, no emoji */
const ICO = {
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22V11l5-9 1.2.6a2 2 0 011 2.3L13 9h5.2a2 2 0 012 2.4l-1.4 7A2 2 0 0116.8 20H7z"/><path d="M7 11H4v11h3"/></svg>',
  down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2v11l-5 9-1.2-.6a2 2 0 01-1-2.3L11 15H5.8a2 2 0 01-2-2.4l1.4-7A2 2 0 017.2 4H17z"/><path d="M17 13h3V2h-3"/></svg>'
};

let deals = DEALS.map(d => ({...d}));
let myVotes = readLS(LS_VOTES, {});

/* ============================================================
   LIVE DATA — real submissions from the API.
   The API speaks its own vocabulary (chain/confirmations/updatedAt)
   and uses hex ids, so map it into the shape the UI already renders.
   ============================================================ */
function fromApi(d){
  return {
    id:      String(d.id),
    brand:   d.brand,
    mg:      d.mg || "",
    product: d.brand + (d.size ? " " + d.size : ""),
    price:   Number(d.price),
    store:   d.chain,
    city:    d.city,
    state:   d.state,
    note:    d.note,
    up:      Number(d.confirmations) || 0,
    reports: Number(d.reports) || 1,
    ago:     Math.max(0, (Date.now() / 1000 - Number(d.updatedAt)) / 3600),
    aff:     false,
    live:    true
  };
}

async function loadLive(){
  if (!CONFIG.apiBase) return 0;
  try {
    const r = await fetch(CONFIG.apiBase + "/deals", {cache: "no-store"});
    if (!r.ok) return 0;
    const j = await r.json();
    if (!j || !j.ok) return 0;

    const live = (j.deals || []).map(fromApi);
    // While demoMode is on, keep the sample rows so the feed isn't bare.
    // Once real reports exist and demoMode is off, only live data shows.
    deals = live.concat(CONFIG.demoMode ? DEALS.map(d => ({...d})) : []);
    return live.length;
  } catch(_) {
    return 0;
  }
}

function loadMySubmissions(){
  readLS(LS_SUBS, []).forEach(s => {
    if (!deals.some(d => d.id === s.id)) deals.push({...s, mine:true});
  });
}

/* ============================================================
   THEME
   ============================================================ */
function initTheme(){
  $("themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(LS_THEME, next); } catch(_) {}
  });
}

/* ============================================================
   AGE GATE
   ============================================================ */
function initGate(){
  const gate = $("ageGate");
  /* Dismiss with an INLINE style — an older cached stylesheet may still be
     forcing display:flex, and inline style outranks any stylesheet rule. */
  const dismiss = () => { gate.hidden = true; gate.style.display = "none"; };

  if (readLS(LS_AGE, false)) { dismiss(); return; }

  gate.hidden = false;
  gate.style.display = "";
  document.body.style.overflow = "hidden";

  $("ageYes").addEventListener("click", () => {
    writeLS(LS_AGE, true); dismiss(); document.body.style.overflow = "";
  });
  $("ageNo").addEventListener("click", () => {
    window.location.href = "https://www.cdc.gov/tobacco/quit_smoking/index.html";
  });
}

/* ============================================================
   RENDERING
   ============================================================ */
function fillSelects(){
  const sf = $("storeFilter"), bf = $("brandFilter"), stf = $("stateFilter");

  const stores = [...new Set(deals.map(d => d.store))].sort();
  STORES.forEach(s => { if (!stores.includes(s)) stores.push(s); });
  stores.sort().forEach(s => sf.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(s)}</option>`));

  const brands = [...new Set(deals.map(d => d.brand))].sort();
  BRANDS.forEach(b => { if (!brands.includes(b)) brands.push(b); });
  brands.sort().forEach(b => {
    bf.insertAdjacentHTML("beforeend", `<option value="${esc(b)}">${esc(b)}</option>`);
    $("fBrand").insertAdjacentHTML("beforeend", `<option value="${esc(b)}">${esc(b)}</option>`);
  });

  [...new Set(deals.map(d => d.state))].filter(Boolean).sort()
    .forEach(s => stf.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(s)}</option>`));

  $("storeList").innerHTML = stores.map(s => `<option value="${esc(s)}"></option>`).join("");

  /* category bar — real taxonomy, like a deals site has */
  const topStores = Object.entries(
    deals.reduce((a,d) => (a[d.store] = (a[d.store]||0)+1, a), {})
  ).sort((a,b) => b[1]-a[1]).slice(0,7);
  $("catBar").innerHTML =
    `<a href="#deals" class="on" data-cat="">Trending</a>` +
    topStores.map(([s]) => `<a href="#deals" data-cat="${esc(s)}">${esc(s)} Deals</a>`).join("") +
    `<a href="#online">Online Only</a>`;
  $("catBar").addEventListener("click", e => {
    const a = e.target.closest("a[data-cat]"); if (!a) return;
    e.preventDefault();
    document.querySelectorAll("#catBar a").forEach(x => x.classList.remove("on"));
    a.classList.add("on");
    $("storeFilter").value = a.dataset.cat || "";
    render();
  });
}

function filters(){
  return {
    q: $("q").value.trim().toLowerCase(),
    store: $("storeFilter").value,
    brand: $("brandFilter").value,
    state: $("stateFilter").value,
    sort: $("sortBy").value
  };
}

function apply(list, f){
  return list.filter(d => {
    if (f.store && d.store !== f.store) return false;
    if (f.brand && d.brand !== f.brand) return false;
    if (f.state && d.state !== f.state) return false;
    if (f.q){
      const hay = [d.brand, d.product, d.city, d.state, d.store, d.note].join(" ").toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}

function sortList(list, sort){
  const c = [...list];
  switch(sort){
    case "perCan":    return c.sort((a,b) => a.price - b.price);
    case "savings":   return c.sort((a,b) => savePct(b) - savePct(a));
    case "recent":    return c.sort((a,b) => a.ago - b.ago);
    case "confirmed": return c.sort((a,b) => b.up - a.up);
    default:          return c.sort((a,b) => perPouch(a) - perPouch(b));
  }
}

/* the card — mirrors Slickdeals' DealCardGridV2 anatomy */
function card(d){
  const pp = perPouch(d), saved = savePct(d), voted = !!myVotes[d.id];
  const col = brandColor(d.brand);
  const isNew = d.ago <= 24;

  return `
  <article class="card">
    ${isNew ? `<span class="badge">${d.mine ? "Yours" : "New"}</span>` : ""}
    <div class="card-body">
      <div class="thumb" style="--brand:${esc(col)}">
        <svg class="can" viewBox="0 0 56 74" aria-hidden="true">
          <ellipse cx="28" cy="8" rx="23" ry="5" fill="rgba(0,0,0,.30)"/>
          <rect x="5" y="8" width="46" height="58" rx="8" fill="var(--brand)"/>
          <rect x="5" y="8" width="46" height="16" rx="8" fill="rgba(255,255,255,.18)"/>
          <rect x="5" y="50" width="46" height="16" rx="8" fill="rgba(0,0,0,.15)"/>
          <text x="28" y="44" text-anchor="middle" font-size="13" font-weight="700"
                fill="rgba(255,255,255,.95)" font-family="Outfit,Inter,sans-serif">${d.mg ? esc(d.mg) + "mg" : esc(d.brand.slice(0, 3))}</text>
        </svg>
        <div class="tilemeta">
          <span class="tilebrand">${esc(d.brand)}</span>
          <span class="tilespec">${pouchesFor(d.brand)} pouches</span>
        </div>
      </div>
      <h3 class="card-title">${esc(d.product)}</h3>
      <div class="pricerow">
        <span class="final">${money(d.price)}</span>
        <span class="list">${money(typicalFor(d))}</span>
        <span class="perpouch">${cents(pp)}/pouch</span>
      </div>
      <div class="store">${esc(d.store)} · ${esc(d.city)}, ${esc(d.state)}</div>
      <div class="meta">${esc(agoLabel(d.ago))} · save ${saved.toFixed(0)}%</div>
      ${d.note ? `<div class="card-note">${esc(d.note)}</div>` : ""}
    </div>
    <div class="actions">
      <div class="votes">
        <button class="votebtn ${voted ? "on" : ""}" data-id="${esc(d.id)}" ${voted ? "disabled" : ""}
                title="${voted ? "You confirmed this" : "Still this price?"}">
          ${ICO.up}<span>${esc(d.up)}</span>
        </button>
        <button class="votebtn down" data-down="${esc(d.id)}" title="Report this price as gone">${ICO.down}</button>
      </div>
      <a class="cta" href="#online">Buy online →</a>
    </div>
  </article>`;
}

function render(){
  const f = filters();
  const list = sortList(apply(deals, f), f.sort);

  $("dealsGrid").innerHTML = list.map(card).join("");
  $("emptyState").hidden = list.length > 0;
  $("dealCount").textContent = list.length
    ? list.length + (list.length === 1 ? " deal" : " deals")
    : "";

  const titles = {perPouch:"Lowest cost per pouch", perCan:"Lowest price per can",
    savings:"Biggest savings", recent:"Newest reports", confirmed:"Most confirmed prices"};
  $("feedTitle").textContent = titles[f.sort] || "Top pouch deals";

  document.querySelectorAll(".votebtn[data-id]").forEach(b => {
    b.addEventListener("click", async () => {
      const id = String(b.dataset.id);
      const d = deals.find(x => String(x.id) === id);
      if (!d || myVotes[id]) return;

      // optimistically mark as yours so the button can't be double-fired
      myVotes[id] = true;
      writeLS(LS_VOTES, myVotes);

      if (d.live && CONFIG.apiBase){
        b.disabled = true;
        try {
          const r = await fetch(CONFIG.apiBase + "/vote", {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id})
          });
          const j = await r.json();
          if (j && j.ok){
            d.up = j.confirmations;          // the real shared count
          } else {
            delete myVotes[id]; writeLS(LS_VOTES, myVotes);   // let them retry
          }
        } catch(_) {
          delete myVotes[id]; writeLS(LS_VOTES, myVotes);
        }
      } else {
        d.up += 1;
      }
      render();
    });
  });
  /* "price is gone" marks locally without pretending to be a global downvote */
  document.querySelectorAll(".votebtn[data-down]").forEach(b => {
    b.addEventListener("click", () => {
      const id = String(b.dataset.down);
      const d = deals.find(x => String(x.id) === id);
      if (!d) return;
      d.gone = true;
      writeLS("gpd_gone", [...new Set([...readLS("gpd_gone", []), id])]);
      render();
    });
  });
}

function renderRetailers(){
  $("retailers").innerHTML = RETAILERS.map(r => `
    <div class="retailer">
      <b>${esc(r.name)}</b>
      <span class="rate">${esc(r.rate)}</span>
      <div class="note">${esc(r.note)}</div>
      <a href="${esc(r.url)}" target="_blank" rel="noopener sponsored">Visit store →</a>
    </div>`).join("");
}

/* ============================================================
   REPORT FORM
   ============================================================ */
function initForm(){
  $("reportForm").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("formMsg");
    const brand = $("fBrand").value;
    const price = parseFloat($("fPrice").value);
    const store = $("fStore").value.trim();
    const cityRaw = $("fCity").value.trim();
    const note = $("fNote").value.trim();

    const fail = m => { msg.hidden = false; msg.className = "formmsg err"; msg.textContent = m; };
    if (!brand) return fail("Pick a brand.");
    if (!Number.isFinite(price) || price <= 0) return fail("Enter a valid price.");
    if (!store) return fail("Which store was it?");
    if (!cityRaw) return fail("Add a city and state so people nearby can use it.");

    const parts = cityRaw.split(",");
    const city = (parts[0] || "").trim();
    const state = (parts[1] || "").trim().toUpperCase().slice(0,2);

    /* --- real submission path --- */
    if (CONFIG.apiBase){
      let j;
      try {
        const r = await fetch(CONFIG.apiBase + "/report", {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({brand, chain: store, price, city, state, note, qty: 1})
        });
        j = await r.json();
        if (!r.ok || !j || !j.ok){
          return fail((j && j.error) || "That didn't go through — try again in a moment.");
        }
      } catch(_) {
        return fail("Couldn't reach the server — try again in a moment.");
      }

      // Re-read from the server so the new deal shows with its real id and
      // shared confirmation count rather than a local guess.
      await loadLive();
      deals.unshift({
        id: String(j.id), brand, mg: "", product: brand, price,
        store, city, state, note, up: j.confirmations || 0, reports: 1,
        ago: 0, aff: false, live: true, mine: true
      });
      deals = deals.filter((d, i, a) => a.findIndex(x => String(x.id) === String(d.id)) === i);

      msg.hidden = false;
      msg.className = "formmsg ok";
      msg.textContent = j.message || "Thanks — your price is live.";
      e.target.reset();
      reflectGone();
      render();
      return;
    }

    /* --- offline fallback: keep it on this device only --- */
    const deal = {id: Date.now(), brand, product: brand + " " + (note || "report"),
      price, store, city, state, ago: 0, up: 0, note, aff: false, mine: true};

    deals.unshift(deal);
    const subs = readLS(LS_SUBS, []); subs.unshift(deal); writeLS(LS_SUBS, subs);

    msg.hidden = false;
    msg.className = "formmsg ok";
    msg.textContent = "Saved on this device only — the report server is unreachable.";

    e.target.reset();
    reflectGone();
    render();
  });
}

/* ============================================================
   ADS — only when a publisher ID is set. Inline units only, so
   nothing ever overlays or eats the viewport.
   ============================================================ */
function initAds(){
  if (!CONFIG.adsenseClient) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="
        + encodeURIComponent(CONFIG.adsenseClient);
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);

  document.querySelectorAll(".adslot .body[data-ad]").forEach(el => {
    el.innerHTML = `<ins class="adsbygoogle" style="display:block"
      data-ad-client="${esc(CONFIG.adsenseClient)}" data-ad-slot="${esc(el.dataset.ad)}"
      data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch(_) {}
  });
}

/* prices the user marked as gone stay marked */
function reflectGone(){
  const gone = readLS("gpd_gone", []);
  deals.forEach(d => { if (gone.includes(d.id)) d.gone = true; });
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot(){
  // Pull real submissions before anything renders, so filters and the
  // category bar are built from the live feed.
  const liveCount = await loadLive();

  reflectGone();
  initTheme();
  initGate();
  // Locally-remembered reports would duplicate what the server already has.
  if (!CONFIG.apiBase) loadMySubmissions();
  fillSelects();
  render();
  renderRetailers();
  initForm();
  initAds();

  if (CONFIG.demoMode) $("demoBanner").hidden = false;
  if (liveCount) console.log(`getpouchdeals: ${liveCount} live report(s) loaded`);
  $("year").textContent = new Date().getFullYear();

  ["q","storeFilter","brandFilter","stateFilter","sortBy"].forEach(id => {
    $(id).addEventListener("input", render);
    $(id).addEventListener("change", render);
  });
}
document.addEventListener("DOMContentLoaded", boot);
