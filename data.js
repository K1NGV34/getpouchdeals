/* ============================================================
   GetPouchDeals — configuration + deal data
   ------------------------------------------------------------
   DEMO MODE: the deals below are illustrative sample rows so you
   can see the site working. They are NOT real live submissions.
   Set demoMode:false once real deals start coming in.
   ============================================================ */

const CONFIG = {
  siteName: "GetPouchDeals",
  domain: "getpouchdeals.com",
  tagline: "Pouch prices reported by shoppers, not stores",

  // Flip to false when you replace the sample rows with real reports.
  demoMode: true,

  // The submission API (Cloudflare Worker + KV). Real deal reports land here
  // and are served back to every visitor, so votes and prices are shared
  // rather than trapped in one browser.
  apiBase: "https://getpouchdeals-api.getpouchdeals.workers.dev",

  // Where the "Post a price" form posts. Blank = store locally only.
  submitEndpoint: "",

  // AdSense publisher ID, e.g. "ca-pub-1234567890123456". Blank = no AdSense.
  adsenseClient: "",

  // Fallback shelf price, used only for brands not in TYPICAL below.
  typicalPerCan: 5.49,

  // Minimum age for nicotine products in the US.
  minAge: 21
};

/* Pouches per can, so every deal can be compared on true cost per pouch —
   the only unit that matters when can sizes differ. */
const POUCH_COUNT = {
  "Zyn": 15, "Velo": 14, "Velo Plus": 20, "On!": 20, "Rogue": 20,
  "Zone": 20, "Juice Head": 20, "Sesh": 20, "Sesh+": 10, "CLEW": 20,
  "Grizzly": 20, "ALP": 20, "FRE": 20, "JOEY": 20, "Lucy": 20,
  "Loop": 20, "Dryft": 20, "Nordic Spirit": 20, "Velo Max": 14
};

const BRANDS = ["ALP","CLEW","Dryft","FRE","Grizzly","JOEY","Juice Head","Loop",
  "Lucy","Nordic Spirit","On!","Rogue","Sesh","Velo","Velo Plus","Zyn","Zone"];

/* Typical shelf price per brand — the struck-through comparison figure.
   These deliberately differ by brand, because real shelf prices do. One
   identical number struck through on every card is the single clearest
   tell that a deals feed is synthetic. */
const TYPICAL = {
  "Zyn":5.99, "Velo":5.49, "Velo Plus":5.49, "On!":4.29, "Rogue":5.49,
  "Zone":4.99, "Juice Head":4.99, "Sesh":5.49, "Sesh+":5.99, "CLEW":4.29,
  "Grizzly":6.49, "ALP":5.29, "FRE":4.99, "JOEY":5.49, "Lucy":5.49,
  "Loop":4.99, "Dryft":5.29, "Nordic Spirit":5.99, "Velo Max":5.99
};

/* Brand tints for the card tile. Kept muted so the grid stays calm — the
   orange price should be the only thing that shouts. */
const BRAND_COLOR = {
  "Zyn":"#2f6fb3","Velo":"#1f7a4d","Velo Plus":"#1f7a4d","On!":"#c64111",
  "Rogue":"#6b4a9c","Zone":"#0f7c8c","Juice Head":"#b3452a","Sesh":"#7a5c1f",
  "Sesh+":"#7a5c1f","CLEW":"#3f6b3a","Grizzly":"#5c4a2e","ALP":"#2d5f7a",
  "FRE":"#8a3d5e","JOEY":"#4a5a8a","Lucy":"#8a6a2a","Loop":"#4f6b52",
  "Dryft":"#55606b","Nordic Spirit":"#3d5a80"
};

const STORES = ["7-Eleven","Buc-ee's","Casey's","Circle K","Cumberland Farms",
  "Holiday","Kwik Trip","Love's","Murphy USA","Pilot","QuikTrip","RaceTrac",
  "Royal Farms","Rutter's","Sheetz","Speedway","TravelCenters","Wawa",
  "Dollar General"];

/* ------------------------------------------------------------------
   Deal rows. `ago` is hours since the report, so the feed always looks
   live. `up` is how many people confirmed the price still stands.

   Notes are deliberately short and unpolished — that is how people
   actually write deal comments. Over-written, tidy sentences read as
   machine-generated and cost you trust.
   ------------------------------------------------------------------ */
const DEALS = [
  {id:1, brand:"Velo Plus", product:"Velo Plus Wintergreen 6mg", mg:6, price:1.99, store:"7-Eleven", street:"Westheimer Rd", city:"Houston", state:"TX", ago:5,  up:47, note:"trial price, limit 2. shelf tag already updated", aff:true},
  {id:2, brand:"Zyn", product:"Zyn Cool Mint 6mg", mg:6, price:3.49, store:"QuikTrip", street:"S Memorial Dr", city:"Tulsa", state:"OK", ago:9,  up:31, note:"chain-wide promo, runs through sunday", aff:true},
  {id:3, brand:"On!", product:"On! Wintergreen 4mg", mg:4, price:1.00, store:"Dollar General", street:"Main St", city:"Springfield", state:"MO", ago:14, up:22, note:"not a sale, just their normal price", aff:true},
  {id:4, brand:"Zone", product:"Zone Mint 6mg", mg:6, price:3.19, store:"Circle K", street:"N High St", city:"Columbus", state:"OH", ago:20, up:18, note:"buy 5 get 1 free", aff:true},
  {id:5, brand:"CLEW", product:"CLEW Spearmint 6mg", mg:6, price:2.79, store:"Sheetz", street:"E Carson St", city:"Pittsburgh", state:"PA", ago:26, up:15, note:"cheapest i've seen. been this price for weeks", aff:true},
  {id:6, brand:"Juice Head", product:"Juice Head Blueberry Lemon 6mg", mg:6, price:3.29, store:"RaceTrac", street:"Peachtree Rd", city:"Atlanta", state:"GA", ago:31, up:12, note:"grab the 5-can bundle", aff:true},
  {id:7, brand:"Rogue", product:"Rogue Citrus 6mg", mg:6, price:3.99, store:"Wawa", street:"W Broad St", city:"Richmond", state:"VA", ago:38, up:9,  note:"shelf tag says 5.49, rang up cheaper", aff:true},
  {id:8, brand:"Zyn", product:"Zyn Wintergreen 6mg", mg:6, price:4.25, store:"Speedway", street:"W 86th St", city:"Indianapolis", state:"IN", ago:44, up:11, note:"", aff:true},
  {id:9, brand:"Sesh", product:"Sesh+ Mint 6mg", mg:6, price:4.79, store:"Casey's", street:"1st Ave", city:"Cedar Rapids", state:"IA", ago:52, up:6,  note:"only on the 10-can bundle", aff:true},
  {id:10,brand:"Grizzly", product:"Grizzly Wintergreen 12mg", mg:12,price:4.40, store:"Murphy USA", street:"Hwy 31", city:"Birmingham", state:"AL", ago:60, up:8,  note:"50-can bundle", aff:true},
  {id:11,brand:"Velo", product:"Velo Mint 4mg", mg:4, price:2.49, store:"Kwik Trip", street:"E Washington Ave", city:"Madison", state:"WI", ago:68, up:14, note:"this is their normal price, not a promo", aff:true},
  {id:12,brand:"ALP", product:"ALP Wintergreen 6mg", mg:6, price:3.49, store:"Royal Farms", street:"York Rd", city:"Baltimore", state:"MD", ago:75, up:5,  note:"intro pricing", aff:true},
  {id:13,brand:"Rogue", product:"Rogue Honey Lemon 6mg", mg:6, price:3.49, store:"Circle K", street:"S Lamar Blvd", city:"Austin", state:"TX", ago:82, up:10, note:"", aff:true},
  {id:14,brand:"FRE", product:"FRE Wintergreen 6mg", mg:6, price:2.99, store:"Cumberland Farms", street:"Main St", city:"Worcester", state:"MA", ago:90, up:7,  note:"worth it if you buy 5+", aff:true},
  {id:15,brand:"Zyn", product:"Zyn Citrus 3mg", mg:3, price:4.99, store:"7-Eleven", street:"Sunset Blvd", city:"Los Angeles", state:"CA", ago:98, up:4,  note:"CA tax makes it worse", aff:true},
  {id:16,brand:"Velo Plus", product:"Velo Plus Peppermint 9mg", mg:9, price:2.50, store:"RaceTrac", street:"I-10 Frontage", city:"San Antonio", state:"TX", ago:104,up:16, note:"still priced like the promo never ended", aff:true},
  {id:17,brand:"On!", product:"On! Citrus 8mg", mg:8, price:2.29, store:"Holiday", street:"Central Ave NE", city:"Minneapolis", state:"MN", ago:112,up:6,  note:"", aff:true},
  {id:18,brand:"Lucy", product:"Lucy Mint 6mg", mg:6, price:3.99, store:"QuikTrip", street:"E 51st St", city:"Kansas City", state:"MO", ago:120,up:3,  note:"rare to find in store", aff:true},
  {id:19,brand:"Zone", product:"Zone Wintergreen 9mg", mg:9, price:2.99, store:"Love's", street:"I-40 Exit 142", city:"Amarillo", state:"TX", ago:128,up:9,  note:"cheaper at the truck stop than in town", aff:true},
  {id:20,brand:"Juice Head", product:"Juice Head Mango 12mg", mg:12,price:3.49, store:"Rutter's", street:"N George St", city:"York", state:"PA", ago:136,up:5,  note:"", aff:true},
  {id:21,brand:"CLEW", product:"CLEW Cool Mint 12mg", mg:12,price:2.79, store:"Sheetz", street:"Arsenal Rd", city:"Pittsburgh", state:"PA", ago:144,up:8,  note:"same price as the 6mg, take the stronger one", aff:true},
  {id:22,brand:"Velo", product:"Velo Wintergreen 4mg", mg:4, price:3.29, store:"Wawa", street:"Roosevelt Blvd", city:"Philadelphia", state:"PA", ago:152,up:4,  note:"", aff:true},
  {id:23,brand:"Dryft", product:"Dryft Wintergreen 6mg", mg:6, price:3.59, store:"TravelCenters", street:"I-80 Exit 173", city:"Youngstown", state:"OH", ago:160,up:2,  note:"truck stop find", aff:true},
  {id:24,brand:"On!", product:"On! Mint 2mg", mg:2, price:1.99, store:"Dollar General", street:"Broad St", city:"Augusta", state:"GA", ago:168,up:11, note:"every DG i've been in has it", aff:true}
];
