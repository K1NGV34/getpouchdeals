/* ============================================================
   GetPouchDeals — app logic
   Depends on data.js (CONFIG, DEALS, BRANDS, STORES, POUCH_COUNT)
   ============================================================ */
"use strict";

/* ---------- affiliate-ready online retailers ----------
   Each program below was verified to exist and to accept affiliates.
   Swap `url` for your own tracked link once approved. Commission rates
   are what the programs currently advertise. */
const RETAILERS = [
  {name:"Northerner",  rate:"Deals hub",  note:"Long-running US pouch retailer with a dedicated clearance section.", url:"https://www.northerner.com/us/nicotine-pouches/deals"},
  {name:"Juice Head",  rate:"20% / sale", note:"Direct brand programme, one of the highest rates in the category.", url:"https://juicehead.com/pages/affiliate-program"},
  {name:"JOEY",        rate:"20% / sale", note:"Listed via FlexOffers. ~$1.04 EPC over 90 days.", url:"https://www.flexoffers.com/affiliate-programs/joey-affiliate-program/"},
  {name:"FRE",         rate:"10% / sale", note:"Runs through CJ with a 30-day cookie window.", url:"https://frepouch.com/pages/fre-affiliate-program"},
  {name:"ALP",         rate:"Programme",  note:"Newer brand running an active affiliate coalition.", url:"https://alppouch.com/pages/affiliate-program"},
  {name:"SnusDaddy",   rate:"Programme",  note:"Wide import range, good for flavours US stores don't carry.", url:"https://snusdaddy.com/"}
];

/* ---------- constants ---------- */
const LS_AGE = "gpd_age_ok";
const LS_VOTES = "gpd_my_votes";
const LS_SUBS = "gpd_my_submissions";

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const money = v => "$" + Number(v).toFixed(2);

function readLS(key, fallback){
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(_) { return fallback; }
}
function writeLS(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(_) {}
}

/* pouches per can for a brand, with a sane default */
function pouchesFor(brand){
  return POUCH_COUNT[brand] || 20;
}

/* ---------- derived values ---------- */
function perPouch(d){ return d.price / pouchesFor(d.brand); }
function perCan(d){ return d.price; }
function savingsPct(d){
  if (!CONFIG.typicalPerCan) return 0;
  return ((CONFIG.typicalPerCan - d.price) / CONFIG.typicalPerCan) * 100;
}
function agoLabel(h){
  if (h < 1) return "just now";
  if (h < 24) return Math.round(h) + "h ago";
  const d = Math.round(h / 24);
  return d === 1 ? "1 day ago" : d + " days ago";
}
function saveClass(p){
  if (p >= 25) return "save";
  if (p >= 10) return "mid";
  return "high";
}

/* ---------- working copy of the feed ---------- */
let deals = DEALS.map(d => ({...d}));
let myVotes = readLS(LS_VOTES, {});

function loadMySubmissions(){
  const subs = readLS(LS_SUBS, []);
  subs.forEach(s => {
    if (!deals.some(d => d.id === s.id)) deals.push({...s, mine:true});
  });
}

/* ============================================================
   AGE GATE
   ============================================================ */
function initGate(){
  const gate = $("ageGate");

  // Dismiss with an INLINE style, not just the hidden attribute. An older
  // cached stylesheet can still be forcing display:flex on this element, and
  // inline style outranks any stylesheet rule. This stays correct even if a
  // visitor is a version behind.
  const dismiss = () => { gate.hidden = true; gate.style.display = "none"; };

  if (readLS(LS_AGE, false)) { dismiss(); return; }

  gate.hidden = false;
  gate.style.display = "";   // let the stylesheet show it
  document.body.style.overflow = "hidden";

  $("ageYes").addEventListener("click", () => {
    writeLS(LS_AGE, true);
    dismiss();
    document.body.style.overflow = "";
  });

  $("ageNo").addEventListener("click", () => {
    // Send them somewhere genuinely useful rather than a dead end.
    window.location.href = "https://www.cdc.gov/tobacco/quit_smoking/index.html";
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function renderStats(){
  const n = deals.length;
  const stores = new Set(deals.map(d => d.store)).size;
  const best = Math.min(...deals.map(perPouch));
  const avg = deals.reduce((a,d) => a + perCan(d), 0) / n;
  const spread = Math.max(...deals.map(perCan)) - Math.min(...deals.map(perCan));

  $("stats").innerHTML = [
    [n + "", "prices reported"],
    [stores + "", "stores tracked"],
    [(best * 100).toFixed(1) + "\u00A2", "cheapest per pouch"],
    ["$" + spread.toFixed(2), "spread between stores"],
    ["$" + avg.toFixed(2), "average per can"]
  ].map(([big,label]) =>
    `<div class="stat"><b>${esc(big)}</b><span>${esc(label)}</span></div>`
  ).join("");
}

function fillSelects(){
  const sf = $("storeFilter"), bf = $("brandFilter");
  const storeList = [...new Set(deals.map(d => d.store))].sort();
  STORES.forEach(s => { if (!storeList.includes(s)) storeList.push(s); });
  storeList.sort();
  storeList.forEach(s => sf.insertAdjacentHTML("beforeend",
    `<option value="${esc(s)}">${esc(s)}</option>`));

  const brandList = [...new Set(deals.map(d => d.brand))].sort();
  BRANDS.forEach(b => { if (!brandList.includes(b)) brandList.push(b); });
  brandList.sort();
  brandList.forEach(b => bf.insertAdjacentHTML("beforeend",
    `<option value="${esc(b)}">${esc(b)}</option>`));

  $("fBrand").insertAdjacentHTML("beforeend",
    brandList.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join(""));
  $("storeList").innerHTML =
    storeList.map(s => `<option value="${esc(s)}"></option>`).join("");
}

function currentFilters(){
  return {
    q: $("q").value.trim().toLowerCase(),
    store: $("storeFilter").value,
    brand: $("brandFilter").value,
    sort: $("sortBy").value
  };
}

function applyFilters(list, f){
  return list.filter(d => {
    if (f.store && d.store !== f.store) return false;
    if (f.brand && d.brand !== f.brand) return false;
    if (f.q){
      const hay = [d.brand, d.product, d.city, d.state, d.store, d.note]
        .join(" ").toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}

function sortList(list, sort){
  const c = [...list];
  switch(sort){
    case "perCan":    return c.sort((a,b) => perCan(a) - perCan(b));
    case "savings":   return c.sort((a,b) => savingsPct(b) - savingsPct(a));
    case "recent":    return c.sort((a,b) => a.ago - b.ago);
    case "confirmed": return c.sort((a,b) => b.up - a.up);
    default:          return c.sort((a,b) => perPouch(a) - perPouch(b));
  }
}

function dealCard(d){
  const pp = perPouch(d), save = savingsPct(d), cls = saveClass(save);
  const voted = !!myVotes[d.id];

  return `
  <article class="deal">
    <div class="deal-top">
      <div>
        <div class="deal-brand">${esc(d.brand)}</div>
        <div class="deal-prod">${esc(d.product)}</div>
      </div>
      <div>
        <div class="deal-price ${cls}">${money(d.price)}</div>
        <div class="ppp">${(pp*100).toFixed(1)}¢/pouch</div>
      </div>
    </div>
    <div><span class="pill ${cls}">${save >= 0 ? "Save " + save.toFixed(0) + "%" : "Above typical"}</span></div>
    <div class="deal-meta">
      <span>🏪 ${esc(d.store)}</span>
      <span>📍 ${esc(d.city)}, ${esc(d.state)}</span>
      <span>🕒 ${esc(agoLabel(d.ago))}</span>
    </div>
    ${d.note ? `<div class="deal-note">${esc(d.note)}</div>` : ""}
    <div class="deal-foot">
      <button class="confirm-btn ${voted ? "done" : ""}" data-id="${esc(d.id)}" ${voted ? "disabled" : ""}>
        ${voted ? "✓ Confirmed" : "Still this price?"} · ${esc(d.up)}
      </button>
      ${d.aff ? `<a class="aff-link" href="#online">Buy online →</a>` : ""}
    </div>
  </article>`;
}

function render(){
  const f = currentFilters();
  const list = sortList(applyFilters(deals, f), f.sort);

  $("dealsGrid").innerHTML = list.map(dealCard).join("");
  $("emptyState").hidden = list.length > 0;
  $("dealCount").textContent = list.length
    ? list.length + (list.length === 1 ? " deal" : " deals")
    : "";

  const label = f.sort === "perPouch" ? "Cheapest per pouch"
    : f.sort === "perCan" ? "Cheapest per can"
    : f.sort === "savings" ? "Biggest savings"
    : f.sort === "recent" ? "Most recent reports"
    : "Most confirmed prices";
  $("feedTitle").textContent = label;

  document.querySelectorAll(".confirm-btn").forEach(b => {
    b.addEventListener("click", () => {
      const id = Number(b.dataset.id);
      const d = deals.find(x => x.id === id);
      if (!d || myVotes[id]) return;
      d.up += 1;
      myVotes[id] = true;
      writeLS(LS_VOTES, myVotes);
      render();
    });
  });
}

function renderRetailers(){
  $("retailers").innerHTML = RETAILERS.map(r => `
    <div class="retailer">
      <b>${esc(r.name)}</b>
      <span class="pill save">${esc(r.rate)}</span>
      <span class="rt">${esc(r.note)}</span>
      <a class="go" href="${esc(r.url)}" target="_blank" rel="noopener sponsored">Visit →</a>
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

    const fail = m => { msg.hidden = false; msg.className = "form-msg err"; msg.textContent = m; };
    if (!brand) return fail("Pick a brand.");
    if (!Number.isFinite(price) || price <= 0) return fail("Enter a valid price.");
    if (!store) return fail("Which store was it?");
    if (!cityRaw) return fail("Add a city and state so people nearby can use it.");

    const parts = cityRaw.split(",");
    const city = (parts[0] || "").trim();
    const state = (parts[1] || "").trim().toUpperCase().slice(0,2);

    const deal = {
      id: Date.now(), brand, product: brand + " " + (note ? "" : "report"),
      price, store, city, state, ago: 0, up: 1, note, aff: false, mine: true
    };

    // Optional backend. With none configured we keep it on-device so the
    // submit flow is genuinely testable before you wire up a server.
    if (CONFIG.submitEndpoint){
      try {
        await fetch(CONFIG.submitEndpoint, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify(deal)
        });
      } catch(_) { return fail("Couldn't reach the server — try again in a moment."); }
    }

    deals.unshift(deal);
    const subs = readLS(LS_SUBS, []);
    subs.unshift(deal);
    writeLS(LS_SUBS, subs);

    msg.hidden = false;
    msg.className = "form-msg ok";
    msg.textContent = CONFIG.submitEndpoint
      ? "Thanks — your price is live."
      : "Saved on this device and added to the feed above. Set submitEndpoint in data.js to collect reports from everyone.";

    e.target.reset();
    renderStats(); fillSelectsOnce(); render();
  });
}

/* ============================================================
   ADS — injected only when a publisher ID is configured.
   Formats are deliberately limited to inline units so nothing
   ever overlays or eats the viewport.
   ============================================================ */
function initAds(){
  if (!CONFIG.adsenseClient) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="
        + encodeURIComponent(CONFIG.adsenseClient);
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);

  document.querySelectorAll(".ad-body[data-ad]").forEach(el => {
    el.innerHTML = `
      <ins class="adsbygoogle" style="display:block"
           data-ad-client="${esc(CONFIG.adsenseClient)}"
           data-ad-slot="${esc(el.dataset.ad)}"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>`;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch(_) {}
  });
}

/* ============================================================
   BOOT
   ============================================================ */
let _selectsFilled = false;
function fillSelectsOnce(){
  if (_selectsFilled) return;
  fillSelects(); _selectsFilled = true;
}

function boot(){
  initGate();
  loadMySubmissions();
  fillSelectsOnce();
  renderStats();
  render();
  renderRetailers();
  initForm();
  initAds();

  if (CONFIG.demoMode) $("demoBanner").hidden = false;
  $("year").textContent = new Date().getFullYear();

  ["q","storeFilter","brandFilter","sortBy"].forEach(id => {
    $(id).addEventListener("input", render);
    $(id).addEventListener("change", render);
  });
}

document.addEventListener("DOMContentLoaded", boot);
