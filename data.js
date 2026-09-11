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
  tagline: "Real pouch prices, reported by people who actually bought them",

  // Flip to false when you replace the sample rows with real reports.
  demoMode: true,

  // Where the "Report a deal" form posts. Leave blank to store locally only.
  // Once you have a backend (Formspree, Cloudflare Worker, etc.) put the URL here.
  submitEndpoint: "",

  // AdSense publisher ID, e.g. "ca-pub-1234567890123456". Blank = no AdSense script.
  adsenseClient: "",

  // Typical shelf price used to compute "you save X%". Update as the market moves.
  typicalPerCan: 5.99,

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

const STORES = ["7-Eleven","Buc-ee's","Casey's","Circle K","Cumberland Farms",
  "Holiday","Kwik Trip","Love's","Murphy USA","Pilot","QuikTrip","RaceTrac",
  "Royal Farms","Rutter's","Sheetz","Speedway","TravelCenters","Wawa"];

/* ------------------------------------------------------------------
   Deal rows. `ago` is hours since the report, so the feed always looks
   live. `up` is community confirmations ("still this price" votes).
   ------------------------------------------------------------------ */
const DEALS = [
  {id:1, brand:"Velo Plus", product:"Velo Plus Wintergreen 6mg", mg:6, price:1.99, store:"7-Eleven", street:"Westheimer Rd", city:"Houston", state:"TX", ago:5,  up:47, note:"Trial price, limit 2 per customer. Shelf tag was updated.", aff:true},
  {id:2, brand:"Zyn", product:"Zyn Cool Mint 6mg", mg:6, price:3.49, store:"QuikTrip", street:"S Memorial Dr", city:"Tulsa", state:"OK", ago:9,  up:31, note:"Chain-wide promo running this week.", aff:false},
  {id:3, brand:"On!", product:"On! Wintergreen 4mg", mg:4, price:1.00, store:"Dollar General", street:"Main St", city:"Springfield", state:"MO", ago:14, up:22, note:"Dollar store pricing, not a sale. Very consistent.", aff:false},
  {id:4, brand:"Zone", product:"Zone Mint 6mg", mg:6, price:3.19, store:"Circle K", street:"N High St", city:"Columbus", state:"OH", ago:20, up:18, note:"Buy 5 get 1 free brought it down to this.", aff:true},
  {id:5, brand:"CLEW", product:"CLEW Spearmint 6mg", mg:6, price:2.79, store:"Sheetz", street:"E Carson St", city:"Pittsburgh", state:"PA", ago:26, up:15, note:"Cheapest can I've found anywhere, consistent in PA.", aff:true},
  {id:6, brand:"Juice Head", product:"Juice Head Blueberry Lemon 6mg", mg:6, price:3.29, store:"RaceTrac", street:"Peachtree Rd", city:"Atlanta", state:"GA", ago:31, up:12, note:"Frequently this price, watch for the 5-can bundle.", aff:true},
  {id:7, brand:"Rogue", product:"Rogue Citrus 6mg", mg:6, price:3.99, store:"Wawa", street:"W Broad St", city:"Richmond", state:"VA", ago:38, up:9,  note:"Down from $5.49 on the shelf.", aff:false},
  {id:8, brand:"Zyn", product:"Zyn Wintergreen 6mg", mg:6, price:4.25, store:"Speedway", street:"W 86th St", city:"Indianapolis", state:"IN", ago:44, up:11, note:"", aff:false},
  {id:9, brand:"Sesh", product:"Sesh+ Mint 6mg", mg:6, price:4.79, store:"Casey's", street:"1st Ave", city:"Cedar Rapids", state:"IA", ago:52, up:6,  note:"Only on the 10-can bundle.", aff:true},
  {id:10,brand:"Grizzly", product:"Grizzly Wintergreen 12mg", mg:12,price:4.40, store:"Murphy USA", street:"Hwy 31", city:"Birmingham", state:"AL", ago:60, up:8,  note:"50-can bundle pricing.", aff:true},
  {id:11,brand:"Velo", product:"Velo Mint 4mg", mg:4, price:2.49, store:"Kwik Trip", street:"E Washington Ave", city:"Madison", state:"WI", ago:68, up:14, note:"Kwik Trip runs this often.", aff:false},
  {id:12,brand:"ALP", product:"ALP Wintergreen 6mg", mg:6, price:3.49, store:"Royal Farms", street:"York Rd", city:"Baltimore", state:"MD", ago:75, up:5,  note:"Newer brand, intro pricing.", aff:true},
  {id:13,brand:"Rogue", product:"Rogue Honey Lemon 6mg", mg:6, price:3.49, store:"Circle K", street:"S Lamar Blvd", city:"Austin", state:"TX", ago:82, up:10, note:"", aff:false},
  {id:14,brand:"FRE", product:"FRE Wintergreen 6mg", mg:6, price:2.99, store:"Cumberland Farms", street:"Main St", city:"Worcester", state:"MA", ago:90, up:7,  note:"Good if you buy 5+.", aff:true},
  {id:15,brand:"Zyn", product:"Zyn Citrus 3mg", mg:3, price:4.99, store:"7-Eleven", street:"Sunset Blvd", city:"Los Angeles", state:"CA", ago:98, up:4,  note:"CA prices run higher than most states.", aff:false},
  {id:16,brand:"Velo Plus", product:"Velo Plus Peppermint 9mg", mg:9, price:2.50, store:"RaceTrac", street:"I-10 Frontage", city:"San Antonio", state:"TX", ago:104,up:16, note:"Priced near the trial rate even after promo.", aff:false},
  {id:17,brand:"On!", product:"On! Citrus 8mg", mg:8, price:2.29, store:"Holiday", street:"Central Ave NE", city:"Minneapolis", state:"MN", ago:112,up:6,  note:"", aff:false},
  {id:18,brand:"Lucy", product:"Lucy Mint 6mg", mg:6, price:3.99, store:"QuikTrip", street:"E 51st St", city:"Kansas City", state:"MO", ago:120,up:3,  note:"Hard to find in stores here.", aff:true},
  {id:19,brand:"Zone", product:"Zone Wintergreen 9mg", mg:9, price:2.99, store:"Love's", street:"I-40 Exit 142", city:"Amarillo", state:"TX", ago:128,up:9,  note:"Truck stop pricing beat the city by a dollar.", aff:true},
  {id:20,brand:"Juice Head", product:"Juice Head Mango 12mg", mg:12,price:3.49, store:"Rutter's", street:"N George St", city:"York", state:"PA", ago:136,up:5,  note:"", aff:false},
  {id:21,brand:"CLEW", product:"CLEW Cool Mint 12mg", mg:12,price:2.79, store:"Sheetz", street:"Arsenal Rd", city:"Pittsburgh", state:"PA", ago:144,up:8,  note:"Same price as the 6mg, best value on the shelf.", aff:true},
  {id:22,brand:"Velo", product:"Velo Wintergreen 4mg", mg:4, price:3.29, store:"Wawa", street:"Roosevelt Blvd", city:"Philadelphia", state:"PA", ago:152,up:4,  note:"", aff:false},
  {id:23,brand:"Dryft", product:"Dryft Wintergreen 6mg", mg:6, price:3.59, store:"TravelCenters", street:"I-80 Exit 173", city:"Youngstown", state:"OH", ago:160,up:2,  note:"Truck stop find.", aff:true},
  {id:24,brand:"On!", product:"On! Mint 2mg", mg:2, price:1.99, store:"Dollar General", street:"Broad St", city:"Augusta", state:"GA", ago:168,up:11, note:"Dollar General near-universally has this.", aff:false}
];
