// lib/products-catalog.js
//
// THE SINGLE SOURCE OF TRUTH for every sellable product on MuggsHotz.
// Adding a new product (a new mug style, a new phone case, a suitcase,
// anything) means adding ONE entry here — nothing else in the codebase
// should need to change. create-printify-order.js and order.html both
// read from this file instead of having product details hardcoded.
//
// layoutType tells the system which image-building routine and which
// order-page UI pattern to use:
//   "three-slot-wrap" — Left/Center/Right sections on one wraparound
//                        image (existing coffee mugs). One print area.
//   "front-back"      — two separate images, front + back (Travel Mug
//                        20oz — blueprint 1513). Two print areas.
//   "single-image"    — one image, one print area, no slots (Travel
//                        Mug with Handle 14oz — blueprint 1160; also
//                        fits cards, post-its going forward).
//   "full-bleed"       — one image floods the entire print area edge to
//                        edge (Ewww Stew / Second Glance Funny line).
//
// flowType (optional, defaults to "generate-first" when absent): every
// product in the catalog lets the customer generate their art FIRST,
// then pick which product it lands on. photo-poster is the one
// deliberate exception — see its entry below for why.
//
// sizes: null if the product only comes in one size (no picker shown).
// colors: null if the product has no color choice (no picker shown).
//         Otherwise an array of { name, hex, variantId } — hex is just
//         for the on-screen swatch, variantId is what actually gets
//         sent to Printify.
//
// A color entry's variantId can be OMITTED (left out entirely, or set
// to null) once a color is confirmed to genuinely exist on Printify but
// its exact numeric variant ID hasn't been manually looked up yet.
// resolveVariant() in create-printify-order.js automatically falls back
// to resolving it live by matching size + color name against Printify's
// own variant titles for that blueprint/provider — the same mechanism
// already used for travel-mug-20oz's single variant. This lets a
// newly-confirmed color go live immediately; the real numeric ID can be
// filled in later purely as a speed optimization, never a requirement.
//
// shippingCost: a FALLBACK only, and 0 is the correct value for it.
//
// CORRECTED (2026-08-26). This comment used to say checkout reads this field
// and therefore charges $0 shipping on every order. That has not been true
// since lib/printify-shipping.js was added: calculateShippingCharge() calls
// getRealShippingCost() FIRST, which looks the rate up live from Printify's
// catalog shipping endpoint against the customer's own country, and only
// falls back to this static number if that lookup fails outright.
//
// Shipping cannot be baked in here anyway -- it depends entirely on where the
// customer lives. It is added post-sale as its own "Shipping & Handling" line
// at checkout, alongside Stripe's automatic_tax. The customer pays product +
// markup + shipping + sales tax, which is the intended model.
//
// The stale version of this note cost real time by sending a later session
// hunting a $0-shipping bug that does not exist. Leave these at 0.
//
// estimatedProfit (added July 2026): the REAL profit per sale — retail
// price minus what Printify actually charges to manufacture this item
// — NOT the sale price itself, and NOT a flat or percentage guess.
// This is what the flyer/tier affiliate program's commission gets
// calculated against once that system is activated. Every value below
// is a PLACEHOLDER (0), same pattern as shippingCost — a product with
// $0 here simply won't generate flyer commission yet, on purpose,
// until a real number is filled in. Doesn't block or affect selling
// the product normally in the meantime; only matters once the flyer
// system goes live.

// PROVIDER IDS: ALL 18 VERIFIED (2026-08-27), not spot-checked. Every
// blueprint below was read live from Printify's own catalog through the
// unauthenticated GET relay
// (/api/admin?action=printify-catalog&path=catalog/blueprints/<id>/print_providers.json)
// and every printProviderId in this file matched. Nothing needed correcting.
//
// The sweep did turn up two decoration methods that are not dye-sublimation,
// which the rest of the catalog quietly assumes:
//   * travel-mug-30oz-tundra (bp 1662, prov 86) -> "uv"
//   * travel-mug-40oz-insulated (bp 1498, prov 217) -> "dtf,engraving"
// Neither is sublimation, and neither has ever been run by us. See each
// entry for detail. Everything else in the catalog is dye-sublimation apart
// from photo-poster, which is digital-printing and always was.
//
// Cheap to redo: the relay needs no auth and no token, because catalog reads
// are public. It is worth re-running whenever a blueprint is added.

export const PRODUCTS_CATALOG = {

  "classic-white-mug": {
    displayName: "Classic White",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    blueprintId: 478,
    printProviderId: 99,
    sizes: {
      "11oz": { variantId: 65216, price: 14.95 },
      "15oz": { variantId: 104692, price: 16.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    // NEW (July 2026, Alyx's request): real profit per sale (retail
    // price minus what Printify actually charges to make this item),
    // NOT sale price and NOT a flat/percentage guess. This is what the
    // flyer/tier affiliate program's commission is calculated against
    // once that system goes live — a product with $0 here simply won't
    // generate commission yet, by design, until a real number is filled
    // in. Doesn't affect selling this product normally in the meantime.
    estimatedProfit: 10.37 // midpoint of $9.92 (11oz, $14.95-$5.03) and $10.82 (15oz, $16.95-$6.13). live probe, 2026-09-21
  },

  "color-pop-mug": {
    displayName: "Color Pop",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    blueprintId: 1151,
    printProviderId: 59,
    sizes: {
      "11oz": {
        price: 19.95,
        colors: [
          { name: "Black",         hex: "#1c1c1c", variantId: 96176 },
          { name: "Blue",          hex: "#2255A4", variantId: 96177 },
          { name: "Cambridge Blue",hex: "#A3C1AD", variantId: 96178 },
          { name: "Golden Yellow", hex: "#D4A017", variantId: 96179 },
          { name: "Green",         hex: "#1F7A45", variantId: 96180 },
          { name: "Light Blue",    hex: "#5FA8DE", variantId: 96181 },
          { name: "Light Green",   hex: "#5FBF5F", variantId: 96182 },
          { name: "Maroon",        hex: "#7A1F2B", variantId: 96183 },
          { name: "Orange",        hex: "#F0701A", variantId: 96184 },
          { name: "Pink",          hex: "#E0457B", variantId: 96185 },
          { name: "Red",           hex: "#D62828", variantId: 96186 },
          { name: "Yellow",        hex: "#F0D43A", variantId: 96187 }
        ]
      },
      "15oz": {
        price: 21.95,
        colors: [
          { name: "Black",         hex: "#1c1c1c", variantId: 114844 },
          { name: "Blue",          hex: "#2255A4", variantId: 114845 },
          { name: "Cambridge Blue",hex: "#A3C1AD", variantId: 114846 },
          { name: "Green",         hex: "#1F7A45", variantId: 114848 },
          { name: "Light Blue",    hex: "#5FA8DE", variantId: 114849 },
          { name: "Light Green",   hex: "#5FBF5F", variantId: 114850 },
          { name: "Maroon",        hex: "#7A1F2B", variantId: 114851 },
          { name: "Orange",        hex: "#F0701A", variantId: 114852 },
          { name: "Pink",          hex: "#E0457B", variantId: 114853 },
          { name: "Red",           hex: "#D62828", variantId: 114854 },
          { name: "Yellow",        hex: "#F0D43A", variantId: 114855 }
        ]
      }
    },
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 12.54 // midpoint of $12.08 (11oz, $19.95-$7.87) and $13.00 (15oz, $21.95-$8.95). live probe, 2026-09-21
  },

  "trimmed-mug": {
    displayName: "Trimmed",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    blueprintId: 2692,
    printProviderId: 59,
    sizes: {
      "11oz": {
        price: 17.95,
        colors: [
          { name: "Black", hex: "#1c1c1c", variantId: 148129 },
          { name: "Blue", hex: "#2255A4", variantId: 148130 },
          { name: "Maroon", hex: "#7A1F2B", variantId: 148131 },
          { name: "Green", hex: "#1F7A45", variantId: 148132 },
          { name: "Yellow", hex: "#F0D43A", variantId: 148133 },
          { name: "Red", hex: "#D62828", variantId: 148134 },
          { name: "Cambridge Blue", hex: "#A3C1AD", variantId: 148135 },
          { name: "Light Blue", hex: "#5FA8DE", variantId: 148136 },
          { name: "Orange", hex: "#F0701A", variantId: 148137 },
          { name: "Light Green", hex: "#5FBF5F", variantId: 148138 },
          { name: "Pink", hex: "#E0457B", variantId: 148139 }
        ]
      },
      "15oz": {
        price: 19.95,
        // CONFIRMED (July 2026, via Printify's own product page for this
        // exact blueprint/provider): Red, Orange, Light Blue, Light
        // Green, and Pink are genuinely 11oz-only for this provider —
        // NOT missing data. Black, however, IS available in 15oz and was
        // simply never added. Added below with no hardcoded variantId —
        // resolveVariant() in create-printify-order.js resolves it live
        // by name match the first time it's ordered (see the top-of-file
        // note on this pattern). Real numeric ID can be backfilled later
        // if ever wanted for lookup speed, but isn't required.
        colors: [
          { name: "Blue", hex: "#2255A4", variantId: 148124 },
          { name: "Maroon", hex: "#7A1F2B", variantId: 148125 },
          { name: "Green", hex: "#1F7A45", variantId: 148126 },
          { name: "Cambridge Blue", hex: "#A3C1AD", variantId: 148127 },
          { name: "Yellow", hex: "#F0D43A", variantId: 148128 },
          { name: "Black", hex: "#1c1c1c", variantId: null }
        ]
      }
    },
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 10.86 // midpoint of $10.40 (11oz, $17.95-$7.55) and $11.32 (15oz, $19.95-$8.63). live probe, 2026-09-21
  },

  "accented-mug": {
    displayName: "Accented",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    blueprintId: 2693,
    printProviderId: 59,
    sizes: {
      "11oz": {
        price: 17.95,
        // CONFIRMED (July 2026, via Printify's own product page for this
        // exact blueprint/provider): Cambridge Blue, Light Green, Orange,
        // and Red are genuinely 11oz-only for this provider — matches
        // Trimmed's same pattern. Black added below with no hardcoded
        // variantId, same live-resolution approach as Trimmed 15oz Black.
        colors: [
          { name: "Blue", hex: "#2255A4", variantId: 148149 },
          { name: "Maroon", hex: "#7A1F2B", variantId: 148150 },
          { name: "Green", hex: "#1F7A45", variantId: 148151 },
          { name: "Yellow", hex: "#F0D43A", variantId: 148152 },
          { name: "Pink", hex: "#E0457B", variantId: 148153 },
          { name: "Orange", hex: "#F0701A", variantId: 148154 },
          { name: "Cambridge Blue", hex: "#A3C1AD", variantId: 148155 },
          { name: "Light Green", hex: "#5FBF5F", variantId: 148156 },
          { name: "Red", hex: "#D62828", variantId: 148157 },
          { name: "Light Blue", hex: "#5FA8DE", variantId: 148147 },
          { name: "Black", hex: "#1c1c1c", variantId: null }
        ]
      },
      "15oz": {
        price: 19.95,
        // CONFIRMED (July 2026): same 11oz-only colors excluded here as
        // above. Black added with no hardcoded variantId — resolved live
        // by name match, same pattern as Trimmed 15oz Black.
        colors: [
          { name: "Blue", hex: "#2255A4", variantId: 148141 },
          { name: "Maroon", hex: "#7A1F2B", variantId: 148142 },
          { name: "Green", hex: "#1F7A45", variantId: 148143 },
          { name: "Yellow", hex: "#F0D43A", variantId: 148144 },
          { name: "Pink", hex: "#E0457B", variantId: 148145 },
          { name: "Light Blue", hex: "#5FA8DE", variantId: 148146 },
          { name: "Black", hex: "#1c1c1c", variantId: null }
        ]
      }
    },
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 10.86 // midpoint of $10.40 (11oz, $17.95-$7.55) and $11.32 (15oz, $19.95-$8.63). live probe, 2026-09-21
  },

  // COLOR BURST (Alyx, 22 Sep 2026: "People have asked me over and over
  // again don't we do colored mugs or just white? Now we do colored mugs as
  // well."). Printify's Traditional Ceramic Mug, blueprint 10725, provider
  // Taylor (228, USA, avg production 1.8 days). The whole body is the colour,
  // not just the rim and inside like Color Pop. ONE size, 11oz -- there is no
  // 15oz on this blueprint. Ships to the US and Canada only (live shipping
  // profile, 2026-09-22: US 7.29 first / 3.09 each extra, CA 16.49 / 10.99,
  // no REST_OF_THE_WORLD profile). Print area is ONE front placeholder,
  // 4725 x 1725 px, a 2.74:1 band -- wider than the 2.14 the other four mugs
  // share, so the studio keys the band ratio off this style.
  //
  // PRINT METHOD, still open: Printify labels it dye-sublimation, and its own
  // product photo shows white ink on a green body, which sublimation cannot
  // do. On a real mug, expect the body colour wherever the artwork is white.
  // Order one before this goes on a flyer.
  //
  // Colours: the fourteen swatches on Printify's product page, sampled
  // 2026-09-22. variantIds from catalog/blueprints/10725/print_providers/228/
  // variants.json the same day.
  "color-burst-mug": {
    displayName: "Color Burst",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    blueprintId: 10725,
    printProviderId: 228,
    printDimensions: { front: { width: 4725, height: 1725 } },
    sizes: {
      "11oz": {
        price: 21.95,
        colors: [
          { name: "Black",          hex: "#000000", variantId: 399488 },
          { name: "Red",            hex: "#cc141b", variantId: 399499 },
          { name: "Burgundy",       hex: "#67161b", variantId: 399492 },
          { name: "Almond",         hex: "#e3cfb4", variantId: 399487 },
          { name: "Orange",         hex: "#f97000", variantId: 399500 },
          { name: "Bright Yellow",  hex: "#d4b245", variantId: 399493 },
          { name: "Light Yellow",   hex: "#f9e38a", variantId: 399490 },
          { name: "Green",          hex: "#006400", variantId: 399495 },
          { name: "Forest Green",   hex: "#07463b", variantId: 399497 },
          { name: "Cobalt",         hex: "#313da6", variantId: 399496 },
          { name: "Ocean Blue",     hex: "#264f86", variantId: 399489 },
          { name: "Navy Blue",      hex: "#35405a", variantId: 399498 },
          { name: "Wedgewood Blue", hex: "#3a486a", variantId: 399491 },
          { name: "Purple",         hex: "#862470", variantId: 399494 }
        ]
      }
    },
    colors: null,
    colorsVaryBySize: true,
    shipsTo: ["US", "CA"],
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 13.48 // $21.95 - $8.47 wholesale (every colour the same). live probe, 2026-09-22
  },

  // THE ALL-NIGHTER (Alyx, 22 Sep 2026): Printify's Jumbo Mug, 20oz, ORCA
  // Coatings, blueprint 1126, provider Imagine Your Photos (59) -- the same
  // house as Trimmed, Accented and Color Pop. White only, one size, ships
  // worldwide (live profile 2026-09-22: US 9.69 first / 3.99 each extra).
  // Print area one front placeholder, 2700 x 1200, a 2.25:1 band. The
  // sixth mug style, and the first in a third size.
  "all-nighter-mug": {
    displayName: "All-Nighter",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    blueprintId: 1126,
    printProviderId: 59,
    printDimensions: { front: { width: 2700, height: 1200 } },
    sizes: {
      "20oz": { variantId: 84117, price: 24.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 11.44 // $24.95 - $13.51 wholesale. live probe, 2026-09-22
  },

  // IT'S A WRAP (Alyx, 22 Sep 2026): custom wrapping paper. Printify's Gift
  // Wrap Papers, blueprint 1100, provider Stickers & Posters (215). Chosen
  // on the live probe of all four wrapping-paper blueprints (see
  // NEW-PRODUCTS.md): cheapest entry sheet, and it ships US 8.49 first /
  // 1.39 each extra, CA 14.99 / 4.99, rest of world 16.29 / 6.59. Matte
  // only for now; satin exists on the same blueprint if ever wanted.
  //
  // tilePattern: the customer's picture is a repeating pattern, not a poster.
  // The server repeats it upright across the print (buildTiledPattern in
  // create-printify-order.js), about three repeats to the width.
  //
  // Wholesale, live probe 2026-09-22: 20" 5.50, 72" 11.90, 144" 19.05.
  // RETAIL (Alyx, 22 Sep 2026): about two, three and four dollars over
  // wholesale so the customer's all-in total stays near 19, 28 and 37 -- "our
  // greed ... nearly prices us out of the sale" -- then rounded up to .95
  // and bumped a dollar each. Postage (8.49 + 3%), the card fee and tax are
  // added at checkout as on every product.
  "wrapping-paper": {
    displayName: "It's a Wrap",
    generatorIcon: "wrapping paper",
    layoutType: "single-image",
    tilePattern: true,
    blueprintId: 1100,
    printProviderId: 215,
    sizes: {
      "Sheet 29\" x 20\"": { variantId: 147685, price: 8.95, printDimensions: { front: { width: 5874, height: 4205 } } },
      "Roll 29\" x 72\"":  { variantId: 147687, price: 15.95, printDimensions: { front: { width: 5874, height: 14614 } } },
      "Roll 29\" x 144\"": { variantId: 147686, price: 24.95, printDimensions: { front: { width: 5874, height: 28913 } } }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 4.47 // midpoint of $3.45 (sheet), $4.05 (72"), $5.90 (144") over the 2026-09-22 probe
  },

  // CERAMIC ORNAMENT (22 Sep 2026): Printify blueprint 531, Imagine Your
  // Photos (59), the house behind Color Pop. Sublimated ceramic, ONE ornament
  // per order line, four shapes. Wholesale 6.34 every shape; US postage 5.89
  // first, 0.69 each extra (live probe 2026-09-22). Blueprint 537 (Duplium,
  // two-sided) was ruled out on US postage, 17.09.
  // Retail 9.95, Alyx, 22 Sep 2026 (~3.61 over wholesale; about 18.60 all in
  // to a US door).
  "ceramic-ornament": {
    displayName: "Ceramic Ornament",
    generatorIcon: "ornament",
    layoutType: "single-image",
    blueprintId: 531,
    printProviderId: 59,
    sizes: {
      "Star": { variantId: 68983, price: 9.95, printDimensions: { front: { width: 1043, height: 996 } } },
      "Circle": { variantId: 69370, price: 9.95, printDimensions: { front: { width: 954, height: 954 } } },
      "Heart": { variantId: 74403, price: 9.95, printDimensions: { front: { width: 978, height: 972 } } },
      "Snowflake": { variantId: 74404, price: 9.95, printDimensions: { front: { width: 866, height: 960 } } }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 3.61 // $9.95 - $6.34, live probe 2026-09-22
  },

  // FROM WHERE I STAND (Alyx's name, 22 Sep 2026): Printify's Custom Cut
  // Standee, blueprint 2770, Chill (86), UV on cast acrylic, one size, with an
  // acrylic stand. Printify cuts along the artwork's OUTLINE, so the print
  // file is a transparent PNG of the figure alone (cutToShape). Wholesale
  // 12.66; US postage 5.89 first / 2.09 each extra (live probe 2026-09-22).
  // Retail 14.95, Alyx's price (24 Sep 2026).
  "custom-standee": {
    displayName: "From Where I Stand",
    generatorIcon: "standee",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 2770,
    printProviderId: 86,
    printDimensions: { front: { width: 1200, height: 1800 } },
    sizes: {
      "One size": { variantId: 149575, price: 14.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 2.29 // $14.95 - $12.66
  },

  // JUST PLAYIN' (Alyx's name, 22 Sep 2026): Printify Poker Playing Cards,
  // blueprint 675, Imagine Your Photos (59), 52 cards + 2 Jokers, 300gsm.
  // ONE design, printed on the back of every card; the faces are a standard
  // deck. Wholesale 13.96; US postage 7.09 / 2.99 each extra (probe
  // 2026-09-22). Retail 16.95, Alyx's price (24 Sep 2026).
  "playing-cards": {
    displayName: "Just Playin'",
    generatorIcon: "playing cards",
    layoutType: "single-image",
    blueprintId: 675,
    printProviderId: 59,
    printDimensions: { front: { width: 775, height: 1125 } },
    sizes: { "Standard Deck": { variantId: 72763, price: 16.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.99 // $16.95 - $13.96
  },

  // CAR AIR FRESHENER (22 Sep 2026): Printify blueprint 1482, M.i.A
  // Merchandise (80), 2.75 x 4 in rectangle, sublimated, four scents.
  // Wholesale 7.31 (Onyx Frost 6.57); US postage 7.19 / 0.99 each extra
  // (probe 2026-09-22). Retail 9.95, Alyx's price (24 Sep 2026).
  "car-air-freshener": {
    displayName: "Car Air Freshener",
    generatorIcon: "air freshener",
    layoutType: "single-image",
    blueprintId: 1482,
    printProviderId: 80,
    printDimensions: { front: { width: 898, height: 1252 } },
    sizes: {
      "New Car":    { variantId: 107443, price: 9.95 },
      "Pine":       { variantId: 107444, price: 9.95 },
      "Black Ice":  { variantId: 107442, price: 9.95 },
      "Onyx Frost": { variantId: 254005, price: 9.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.64
  },

  // DOORMAT (22 Sep 2026): Printify Polyester Doormat, blueprint 1601,
  // Colorway (48), 18 x 30 in, sublimated felt on rubber. Chosen over the coir
  // mat (1346: 28.74 + 21.39 US postage). Wholesale 13.04; US postage 13.69 /
  // 5.39 each extra (probe 2026-09-22). Retail 19.95, Alyx's price (24 Sep 2026).
  "doormat": {
    displayName: "Doormat",
    generatorIcon: "doormat",
    layoutType: "single-image",
    blueprintId: 1601,
    printProviderId: 48,
    printDimensions: { front: { width: 4650, height: 2850 } },
    sizes: { "18 x 30": { variantId: 112062, price: 19.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 6.91 // $19.95 - $13.04
  },

  // BEER STEIN (Claude's pick, 22 Sep 2026): Printify Beer Stein Mug,
  // blueprint 1088, Imagine Your Photos (59), 22oz white ceramic, gold trim,
  // not microwave safe. Print area a 2.52:1 band. Wholesale 20.80; US postage
  // 10.29 / 3.99 each extra (probe 2026-09-22). Retail 24.95, Alyx's price (24 Sep 2026).
  // Sold as a flat single image for now; no 3D body yet.
  "beer-stein": {
    displayName: "Beer Stein",
    generatorIcon: "beer stein",
    layoutType: "single-image",
    blueprintId: 1088,
    printProviderId: 59,
    printDimensions: { front: { width: 2175, height: 863 } },
    sizes: { "22oz": { variantId: 81535, price: 24.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 4.15
  },

  // NIGHT-BUDDY (Bud's pick, Alyx's name, 22 Sep 2026): Printify Custom
  // Shape Night Light (UV), blueprint 4742, Printdoors (332). A clear acrylic
  // panel cut to the artwork's outline in a lit wood base. Colorful 12.17,
  // Monochrome Warm 9.38. US postage is steep: 19.29 first / 15.99 each
  // extra (probe 2026-09-22). Both 14.95, Alyx's price (24 Sep 2026).
  // The base
  // plate carries its own print area (1772x354); left blank for now.
  "night-buddy": {
    displayName: "Night-Buddy",
    generatorIcon: "night light",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 4742,
    printProviderId: 332,
    printDimensions: { front: { width: 1772, height: 2362 } },
    sizes: {
      "Full Colour": { variantId: 247088, price: 14.95 },
      "Warm Glow":   { variantId: 247089, price: 14.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.78 // $14.95 - $12.17, Full Colour
  },

  // STICKER SHEET (22 Sep 2026): Printify Sticker Sheets, blueprint 661,
  // Printed Simply (73), UV on white vinyl, die-cut. Four sticker slots per
  // sheet (front_1..front_4); the same cutout goes into each. 6x4 6.24,
  // 11x8.5 10.02; US postage 5.29 / 0.40 each extra (probe 2026-09-22).
  // Retail 9.95 / 13.95, Alyx's prices (24 Sep 2026). White only for now.
  "sticker-sheet": {
    displayName: "Sticker Sheet",
    generatorIcon: "sticker sheet",
    layoutType: "single-image",
    cutToShape: true,
    repeatPositions: ["front_1", "front_2", "front_3", "front_4"],
    blueprintId: 661,
    printProviderId: 73,
    sizes: {
      "Small 6 x 4 in":    { variantId: 72840, price: 9.95,  printDimensions: { front: { width: 825, height: 525 } } },
      "Large 11 x 8.5 in": { variantId: 72841, price: 13.95, printDimensions: { front: { width: 1575, height: 1200 } } }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.82
  },

  // T-SHIRT (22 Sep 2026): Printify Unisex Heavy Cotton Tee (Gildan 5000),
  // blueprint 6, Printify Choice (99), DTG front print. Twelve classic colours
  // x S-5XL = 96 variants (Printify caps a product at 100). Wholesale S-XL
  // 4.28 (white 4.10), 2XL 6.32, 3XL 7.54, 4XL/5XL ~8.10; US standard postage
  // 3.99 / 2.09 each extra (probe 2026-09-22). Retail S-XL 8.95, 2XL 9.95,
  // 3XL-5XL 12.95, Alyx's prices (24 Sep 2026); repriced 26 Sep by the
  // apparel rule below: S-XL 6.95, 2XL 8.95, 3XL-5XL 10.95. cutToShape: the design is keyed to transparency so only the
  // figure prints, not a rectangle of background.
  "unisex-tshirt": {
    displayName: "T-Shirt",
    apparelLabel: "Gildan 5000",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 6,
    printProviderId: 99,
    printDimensions: { front: { width: 3951, height: 4919 } },
    sizes: {
      "S": { price: 6.95, colors: [{ name: "White", hex: "#ffffff", variantId: 12102 }, { name: "Black", hex: "#111111", variantId: 12126 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 12072 }, { name: "Navy", hex: "#1f2a44", variantId: 11988 }, { name: "Red", hex: "#c8102e", variantId: 12024 }, { name: "Royal", hex: "#1d4f91", variantId: 12030 }, { name: "Forest Green", hex: "#22452f", variantId: 12144 }, { name: "Maroon", hex: "#5c1f2b", variantId: 11976 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 11964 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 11958 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 11874 }, { name: "Sand", hex: "#d8c7a5", variantId: 12054 }] },
      "M": { price: 6.95, colors: [{ name: "White", hex: "#ffffff", variantId: 12101 }, { name: "Black", hex: "#111111", variantId: 12125 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 12071 }, { name: "Navy", hex: "#1f2a44", variantId: 11987 }, { name: "Red", hex: "#c8102e", variantId: 12023 }, { name: "Royal", hex: "#1d4f91", variantId: 12029 }, { name: "Forest Green", hex: "#22452f", variantId: 12143 }, { name: "Maroon", hex: "#5c1f2b", variantId: 11975 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 11963 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 11957 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 11873 }, { name: "Sand", hex: "#d8c7a5", variantId: 12053 }] },
      "L": { price: 6.95, colors: [{ name: "White", hex: "#ffffff", variantId: 12100 }, { name: "Black", hex: "#111111", variantId: 12124 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 12070 }, { name: "Navy", hex: "#1f2a44", variantId: 11986 }, { name: "Red", hex: "#c8102e", variantId: 12022 }, { name: "Royal", hex: "#1d4f91", variantId: 12028 }, { name: "Forest Green", hex: "#22452f", variantId: 12142 }, { name: "Maroon", hex: "#5c1f2b", variantId: 11974 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 11962 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 11956 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 11872 }, { name: "Sand", hex: "#d8c7a5", variantId: 12052 }] },
      "XL": { price: 6.95, colors: [{ name: "White", hex: "#ffffff", variantId: 12103 }, { name: "Black", hex: "#111111", variantId: 12127 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 12073 }, { name: "Navy", hex: "#1f2a44", variantId: 11989 }, { name: "Red", hex: "#c8102e", variantId: 12025 }, { name: "Royal", hex: "#1d4f91", variantId: 12031 }, { name: "Forest Green", hex: "#22452f", variantId: 12145 }, { name: "Maroon", hex: "#5c1f2b", variantId: 11977 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 11965 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 11959 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 11875 }, { name: "Sand", hex: "#d8c7a5", variantId: 12055 }] },
      "2XL": { price: 8.95, colors: [{ name: "White", hex: "#ffffff", variantId: 12104 }, { name: "Black", hex: "#111111", variantId: 12128 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 12074 }, { name: "Navy", hex: "#1f2a44", variantId: 11990 }, { name: "Red", hex: "#c8102e", variantId: 12026 }, { name: "Royal", hex: "#1d4f91", variantId: 12032 }, { name: "Forest Green", hex: "#22452f", variantId: 12146 }, { name: "Maroon", hex: "#5c1f2b", variantId: 11978 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 11966 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 11960 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 11876 }, { name: "Sand", hex: "#d8c7a5", variantId: 12056 }] },
      "3XL": { price: 10.95, colors: [{ name: "White", hex: "#ffffff", variantId: 12105 }, { name: "Black", hex: "#111111", variantId: 12129 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 12075 }, { name: "Navy", hex: "#1f2a44", variantId: 11991 }, { name: "Red", hex: "#c8102e", variantId: 12027 }, { name: "Royal", hex: "#1d4f91", variantId: 12033 }, { name: "Forest Green", hex: "#22452f", variantId: 12147 }, { name: "Maroon", hex: "#5c1f2b", variantId: 11979 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 11967 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 11961 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 11877 }, { name: "Sand", hex: "#d8c7a5", variantId: 12057 }] },
      "4XL": { price: 10.95, colors: [{ name: "White", hex: "#ffffff", variantId: 24031 }, { name: "Black", hex: "#111111", variantId: 24039 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 24021 }, { name: "Navy", hex: "#1f2a44", variantId: 23993 }, { name: "Red", hex: "#c8102e", variantId: 24005 }, { name: "Royal", hex: "#1d4f91", variantId: 24007 }, { name: "Forest Green", hex: "#22452f", variantId: 24045 }, { name: "Maroon", hex: "#5c1f2b", variantId: 23989 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 23985 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 23983 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 23955 }, { name: "Sand", hex: "#d8c7a5", variantId: 24015 }] },
      "5XL": { price: 10.95, colors: [{ name: "White", hex: "#ffffff", variantId: 24164 }, { name: "Black", hex: "#111111", variantId: 24171 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 24153 }, { name: "Navy", hex: "#1f2a44", variantId: 24126 }, { name: "Red", hex: "#c8102e", variantId: 24138 }, { name: "Royal", hex: "#1d4f91", variantId: 24140 }, { name: "Forest Green", hex: "#22452f", variantId: 24178 }, { name: "Maroon", hex: "#5c1f2b", variantId: 24122 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 24118 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 24116 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 24088 }, { name: "Sand", hex: "#d8c7a5", variantId: 24147 }] }
    },
    colors: null,
    colorsVaryBySize: false,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.67 // $6.95 - $4.28, S-XL
  },
  // APPAREL (Alyx, 26 Sep 2026: "RAID printifies catalog for anything that
  // would translate very well into our product"). One tile, Apparel, holds
  // the T-shirt above and these ten, all DTG front prints from a US printer,
  // cut to shape like the tee. THE PRICE RULE (Alyx, 26 Sep): wholesale plus
  // $3, rounded up or down to the nearest $0.95 -- per variant, from each
  // variant's own cost (cost probe 2026-09-26); a colour that costs more
  // carries its own price. The customer pays postage, card fees and tax.
  // Colours: up to the tee's twelve classics where a garment carries them,
  // within Printify's 100 variants a product. The studio (APPAREL) and the
  // order page keep copies; flow-tests/verify-apparel.js holds them together.
  "apparel-premium-tee": {
    displayName: "Premium Tee",
    apparelLabel: "Bella+Canvas 3001",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 12,
    printProviderId: 99,
    printDimensions: { front: { width: 2767, height: 3362 } },
    sizes: {
      "XS": { price: 8.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18075 }, { name: "Black", hex: "#111111", variantId: 18099 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18147 }, { name: "Forest", hex: "#24422f", variantId: 18179 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18355 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18371 }, { name: "Navy", hex: "#1f2a44", variantId: 18395 }, { name: "Pink", hex: "#f2b8c6", variantId: 18435 }, { name: "Red", hex: "#c8102e", variantId: 18443 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18515 }, { name: "White", hex: "#ffffff", variantId: 18539 }] },
      "S": { price: 8.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18076 }, { name: "Black", hex: "#111111", variantId: 18100 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18148 }, { name: "Forest", hex: "#24422f", variantId: 18180 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18356 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18372 }, { name: "Navy", hex: "#1f2a44", variantId: 18396 }, { name: "Pink", hex: "#f2b8c6", variantId: 18436 }, { name: "Red", hex: "#c8102e", variantId: 18444 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18516 }, { name: "White", hex: "#ffffff", variantId: 18540 }] },
      "M": { price: 8.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18077 }, { name: "Black", hex: "#111111", variantId: 18101 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18149 }, { name: "Forest", hex: "#24422f", variantId: 18181 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18357 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18373 }, { name: "Navy", hex: "#1f2a44", variantId: 18397 }, { name: "Pink", hex: "#f2b8c6", variantId: 18437 }, { name: "Red", hex: "#c8102e", variantId: 18445 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18517 }, { name: "White", hex: "#ffffff", variantId: 18541 }] },
      "L": { price: 8.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18078 }, { name: "Black", hex: "#111111", variantId: 18102 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18150 }, { name: "Forest", hex: "#24422f", variantId: 18182 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18358 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18374 }, { name: "Navy", hex: "#1f2a44", variantId: 18398 }, { name: "Pink", hex: "#f2b8c6", variantId: 18438 }, { name: "Red", hex: "#c8102e", variantId: 18446 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18518 }, { name: "White", hex: "#ffffff", variantId: 18542 }] },
      "XL": { price: 8.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18079 }, { name: "Black", hex: "#111111", variantId: 18103 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18151 }, { name: "Forest", hex: "#24422f", variantId: 18183 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18359 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18375 }, { name: "Navy", hex: "#1f2a44", variantId: 18399 }, { name: "Pink", hex: "#f2b8c6", variantId: 18439 }, { name: "Red", hex: "#c8102e", variantId: 18447 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18519 }, { name: "White", hex: "#ffffff", variantId: 18543 }] },
      "2XL": { price: 11.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18080 }, { name: "Black", hex: "#111111", variantId: 18104 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18152 }, { name: "Forest", hex: "#24422f", variantId: 18184 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18360 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18376 }, { name: "Navy", hex: "#1f2a44", variantId: 18400 }, { name: "Pink", hex: "#f2b8c6", variantId: 18440 }, { name: "Red", hex: "#c8102e", variantId: 18448 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18520 }, { name: "White", hex: "#ffffff", variantId: 18544 }] },
      "3XL": { price: 13.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18081 }, { name: "Black", hex: "#111111", variantId: 18105 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18153 }, { name: "Forest", hex: "#24422f", variantId: 18185 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18361 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18377 }, { name: "Navy", hex: "#1f2a44", variantId: 18401 }, { name: "Pink", hex: "#f2b8c6", variantId: 18441 }, { name: "Red", hex: "#c8102e", variantId: 18449 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18521 }, { name: "White", hex: "#ffffff", variantId: 18545 }] },
      "4XL": { price: 15.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 18082 }, { name: "Black", hex: "#111111", variantId: 18106 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 18154 }, { name: "Forest", hex: "#24422f", variantId: 18186 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 18362 }, { name: "Maroon", hex: "#5c1f2b", variantId: 18378 }, { name: "Navy", hex: "#1f2a44", variantId: 18402 }, { name: "Pink", hex: "#f2b8c6", variantId: 18442 }, { name: "Red", hex: "#c8102e", variantId: 18450 }, { name: "True Royal", hex: "#1f4ea3", variantId: 18522 }, { name: "White", hex: "#ffffff", variantId: 18546 }] },
      "5XL": { price: 17.95, colors: [{ name: "Black", hex: "#111111", variantId: 101666 }, { name: "Navy", hex: "#1f2a44", variantId: 101747 }, { name: "Red", hex: "#c8102e", variantId: 101756 }, { name: "True Royal", hex: "#1f4ea3", variantId: 101772 }, { name: "White", hex: "#ffffff", variantId: 101776 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.87 // $8.95 - $6.08, the smallest adult size
  },
  "apparel-garment-dyed-tee": {
    displayName: "Garment-Dyed Tee",
    apparelLabel: "Comfort Colors 1717",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 706,
    printProviderId: 99,
    printDimensions: { front: { width: 3703, height: 4200 } },
    sizes: {
      "S": { price: 15.95, colors: [{ name: "Black", hex: "#111111", variantId: 73196 }, { name: "Navy", hex: "#1f2a44", variantId: 73197 }, { name: "Red", hex: "#c8102e", variantId: 73198 }, { name: "White", hex: "#ffffff", variantId: 73199 }, { name: "Blossom", hex: "#f3c7cf", variantId: 78886 }, { name: "Blue Spruce", hex: "#3c5a55", variantId: 78896 }, { name: "Chambray", hex: "#a6bdd6", variantId: 78921 }, { name: "Grey", hex: "#8f9194", variantId: 78971 }, { name: "Ivory", hex: "#f1ead8", variantId: 78991 }, { name: "Pepper", hex: "#55524f", variantId: 79046 }, { name: "Royal Caribe", hex: "#2a5da8", variantId: 79056 }, { name: "Wine", hex: "#5e2331", variantId: 420478 }] },
      "M": { price: 15.95, colors: [{ name: "Black", hex: "#111111", variantId: 73200 }, { name: "Navy", hex: "#1f2a44", variantId: 73201 }, { name: "Red", hex: "#c8102e", variantId: 73202 }, { name: "White", hex: "#ffffff", variantId: 73203 }, { name: "Blossom", hex: "#f3c7cf", variantId: 78887 }, { name: "Blue Spruce", hex: "#3c5a55", variantId: 78897 }, { name: "Chambray", hex: "#a6bdd6", variantId: 78922 }, { name: "Grey", hex: "#8f9194", variantId: 78972 }, { name: "Ivory", hex: "#f1ead8", variantId: 78992 }, { name: "Pepper", hex: "#55524f", variantId: 79047 }, { name: "Royal Caribe", hex: "#2a5da8", variantId: 79057 }, { name: "Wine", hex: "#5e2331", variantId: 420474 }] },
      "L": { price: 15.95, colors: [{ name: "Black", hex: "#111111", variantId: 73204 }, { name: "Navy", hex: "#1f2a44", variantId: 73205 }, { name: "Red", hex: "#c8102e", variantId: 73206 }, { name: "White", hex: "#ffffff", variantId: 73207 }, { name: "Blossom", hex: "#f3c7cf", variantId: 78888 }, { name: "Blue Spruce", hex: "#3c5a55", variantId: 78898 }, { name: "Chambray", hex: "#a6bdd6", variantId: 78923 }, { name: "Grey", hex: "#8f9194", variantId: 78973 }, { name: "Ivory", hex: "#f1ead8", variantId: 78993 }, { name: "Pepper", hex: "#55524f", variantId: 79048 }, { name: "Royal Caribe", hex: "#2a5da8", variantId: 79058 }, { name: "Wine", hex: "#5e2331", variantId: 420472 }] },
      "XL": { price: 15.95, colors: [{ name: "Black", hex: "#111111", variantId: 73208 }, { name: "Navy", hex: "#1f2a44", variantId: 73209 }, { name: "Red", hex: "#c8102e", variantId: 73210 }, { name: "White", hex: "#ffffff", variantId: 73211 }, { name: "Blossom", hex: "#f3c7cf", variantId: 78889 }, { name: "Blue Spruce", hex: "#3c5a55", variantId: 78899 }, { name: "Chambray", hex: "#a6bdd6", variantId: 78924 }, { name: "Grey", hex: "#8f9194", variantId: 78974 }, { name: "Ivory", hex: "#f1ead8", variantId: 78994 }, { name: "Pepper", hex: "#55524f", variantId: 79049 }, { name: "Royal Caribe", hex: "#2a5da8", variantId: 79059 }, { name: "Wine", hex: "#5e2331", variantId: 420473 }] },
      "2XL": { price: 16.95, colors: [{ name: "Black", hex: "#111111", variantId: 73212 }, { name: "Navy", hex: "#1f2a44", variantId: 73213 }, { name: "Red", hex: "#c8102e", variantId: 73214 }, { name: "White", hex: "#ffffff", variantId: 73215 }, { name: "Blossom", hex: "#f3c7cf", variantId: 78890 }, { name: "Blue Spruce", hex: "#3c5a55", variantId: 78900 }, { name: "Chambray", hex: "#a6bdd6", variantId: 78925 }, { name: "Grey", hex: "#8f9194", variantId: 78975 }, { name: "Ivory", hex: "#f1ead8", variantId: 78995 }, { name: "Pepper", hex: "#55524f", variantId: 79050 }, { name: "Royal Caribe", hex: "#2a5da8", variantId: 79060 }, { name: "Wine", hex: "#5e2331", variantId: 420475 }] },
      "3XL": { price: 18.95, colors: [{ name: "Black", hex: "#111111", variantId: 79114 }, { name: "Blossom", hex: "#f3c7cf", variantId: 79115 }, { name: "Blue Spruce", hex: "#3c5a55", variantId: 79117 }, { name: "Chambray", hex: "#a6bdd6", variantId: 79124 }, { name: "Grey", hex: "#8f9194", variantId: 79137 }, { name: "Ivory", hex: "#f1ead8", variantId: 79142 }, { name: "Navy", hex: "#1f2a44", variantId: 79152 }, { name: "Pepper", hex: "#55524f", variantId: 79155 }, { name: "Red", hex: "#c8102e", variantId: 79157 }, { name: "Royal Caribe", hex: "#2a5da8", variantId: 79158 }, { name: "White", hex: "#ffffff", variantId: 79169 }, { name: "Wine", hex: "#5e2331", variantId: 420476 }] },
      "4XL": { price: 20.95, colors: [{ name: "Black", hex: "#111111", variantId: 101423 }, { name: "Blossom", hex: "#f3c7cf", variantId: 101424 }, { name: "Blue Spruce", hex: "#3c5a55", variantId: 101426 }, { name: "Chambray", hex: "#a6bdd6", variantId: 101433 }, { name: "Grey", hex: "#8f9194", variantId: 101445 }, { name: "Ivory", hex: "#f1ead8", variantId: 101450 }, { name: "Navy", hex: "#1f2a44", variantId: 101460 }, { name: "Pepper", hex: "#55524f", variantId: 101463 }, { name: "Red", hex: "#c8102e", variantId: 101465 }, { name: "Royal Caribe", hex: "#2a5da8", variantId: 101466 }, { name: "White", hex: "#ffffff", variantId: 101476 }, { name: "Wine", hex: "#5e2331", variantId: 420477 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.27 // $15.95 - $12.68, the smallest adult size
  },
  "apparel-womens-tee": {
    displayName: "Women's Tee",
    apparelLabel: "Bella+Canvas 6004",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 9,
    printProviderId: 99,
    printDimensions: { front: { width: 2452, height: 2789 } },
    sizes: {
      "S": { price: 14.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 17725 }, { name: "Baby Blue", hex: "#a7c7e7", variantId: 17731 }, { name: "Black", hex: "#111111", variantId: 17743 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 17773 }, { name: "Maroon", hex: "#5c1f2b", variantId: 17863 }, { name: "Navy", hex: "#1f2a44", variantId: 17869 }, { name: "Pink", hex: "#f2b8c6", variantId: 17899 }, { name: "Red", hex: "#c8102e", variantId: 17911 }, { name: "Soft Cream", hex: "#efe3c8", variantId: 17929 }, { name: "True Royal", hex: "#1f4ea3", variantId: 17965 }] },
      "M": { price: 14.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 17726 }, { name: "Baby Blue", hex: "#a7c7e7", variantId: 17732 }, { name: "Black", hex: "#111111", variantId: 17744 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 17774 }, { name: "Maroon", hex: "#5c1f2b", variantId: 17864 }, { name: "Navy", hex: "#1f2a44", variantId: 17870 }, { name: "Pink", hex: "#f2b8c6", variantId: 17900 }, { name: "Red", hex: "#c8102e", variantId: 17912 }, { name: "Soft Cream", hex: "#efe3c8", variantId: 17930 }, { name: "True Royal", hex: "#1f4ea3", variantId: 17966 }, { name: "White", hex: "#ffffff", variantId: 17978 }, { name: "Military Green", hex: "#5b5e3d", variantId: 64530 }] },
      "L": { price: 14.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 17727 }, { name: "Baby Blue", hex: "#a7c7e7", variantId: 17733 }, { name: "Black", hex: "#111111", variantId: 17745 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 17775 }, { name: "Maroon", hex: "#5c1f2b", variantId: 17865 }, { name: "Navy", hex: "#1f2a44", variantId: 17871 }, { name: "Pink", hex: "#f2b8c6", variantId: 17901 }, { name: "Red", hex: "#c8102e", variantId: 17913 }, { name: "Soft Cream", hex: "#efe3c8", variantId: 17931 }, { name: "True Royal", hex: "#1f4ea3", variantId: 17967 }, { name: "White", hex: "#ffffff", variantId: 17979 }, { name: "Military Green", hex: "#5b5e3d", variantId: 64531 }] },
      "XL": { price: 14.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 17728 }, { name: "Baby Blue", hex: "#a7c7e7", variantId: 17734 }, { name: "Black", hex: "#111111", variantId: 17746 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 17776 }, { name: "Maroon", hex: "#5c1f2b", variantId: 17866 }, { name: "Navy", hex: "#1f2a44", variantId: 17872 }, { name: "Pink", hex: "#f2b8c6", variantId: 17902 }, { name: "Red", hex: "#c8102e", variantId: 17914 }, { name: "Soft Cream", hex: "#efe3c8", variantId: 17932 }, { name: "True Royal", hex: "#1f4ea3", variantId: 17968 }, { name: "White", hex: "#ffffff", variantId: 17980 }, { name: "Military Green", hex: "#5b5e3d", variantId: 64532 }] },
      "2XL": { price: 16.95, colors: [{ name: "Athletic Heather", hex: "#a9adb0", variantId: 17729 }, { name: "Baby Blue", hex: "#a7c7e7", variantId: 17735 }, { name: "Black", hex: "#111111", variantId: 17747 }, { name: "Dark Grey Heather", hex: "#555659", variantId: 17777 }, { name: "Maroon", hex: "#5c1f2b", variantId: 17867 }, { name: "Navy", hex: "#1f2a44", variantId: 17873 }, { name: "Pink", hex: "#f2b8c6", variantId: 17903 }, { name: "Red", hex: "#c8102e", variantId: 17915 }, { name: "Soft Cream", hex: "#efe3c8", variantId: 17933 }, { name: "True Royal", hex: "#1f4ea3", variantId: 17969 }, { name: "White", hex: "#ffffff", variantId: 17981 }, { name: "Military Green", hex: "#5b5e3d", variantId: 64533 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.03 // $14.95 - $11.92, the smallest adult size
  },
  "apparel-long-sleeve": {
    displayName: "Long Sleeve Tee",
    apparelLabel: "Gildan 5400",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 1726,
    printProviderId: 29,
    printDimensions: { front: { width: 4500, height: 5100 } },
    sizes: {
      "S": { price: 16.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 118170 }, { name: "Irish Green", hex: "#2e8b57", variantId: 118171 }, { name: "Navy", hex: "#1f2a44", variantId: 118172 }, { name: "Purple", hex: "#4b2e83", variantId: 118173 }, { name: "Red", hex: "#c8102e", variantId: 118174 }, { name: "Royal", hex: "#1d4f91", variantId: 118175 }, { name: "White", hex: "#ffffff", variantId: 118176 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 118177 }, { name: "Black", hex: "#111111", variantId: 118178 }, { name: "Forest Green", hex: "#22452f", variantId: 118179 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 118180 }] },
      "M": { price: 16.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 118159 }, { name: "Irish Green", hex: "#2e8b57", variantId: 118160 }, { name: "Navy", hex: "#1f2a44", variantId: 118161 }, { name: "Purple", hex: "#4b2e83", variantId: 118162 }, { name: "Red", hex: "#c8102e", variantId: 118163 }, { name: "Royal", hex: "#1d4f91", variantId: 118164 }, { name: "White", hex: "#ffffff", variantId: 118165 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 118166 }, { name: "Black", hex: "#111111", variantId: 118167 }, { name: "Forest Green", hex: "#22452f", variantId: 118168 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 118169 }] },
      "L": { price: 16.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 118148 }, { name: "Irish Green", hex: "#2e8b57", variantId: 118149 }, { name: "Navy", hex: "#1f2a44", variantId: 118150 }, { name: "Purple", hex: "#4b2e83", variantId: 118151 }, { name: "Red", hex: "#c8102e", variantId: 118152 }, { name: "Royal", hex: "#1d4f91", variantId: 118153 }, { name: "White", hex: "#ffffff", variantId: 118154 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 118155 }, { name: "Black", hex: "#111111", variantId: 118156 }, { name: "Forest Green", hex: "#22452f", variantId: 118157 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 118158 }] },
      "XL": { price: 16.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 118181 }, { name: "Irish Green", hex: "#2e8b57", variantId: 118182 }, { name: "Navy", hex: "#1f2a44", variantId: 118183 }, { name: "Purple", hex: "#4b2e83", variantId: 118184 }, { name: "Red", hex: "#c8102e", variantId: 118185 }, { name: "Royal", hex: "#1d4f91", variantId: 118186 }, { name: "White", hex: "#ffffff", variantId: 118187 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 118188 }, { name: "Black", hex: "#111111", variantId: 118189 }, { name: "Forest Green", hex: "#22452f", variantId: 118190 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 118191 }] },
      "2XL": { price: 19.95, colors: [{ name: "White", hex: "#ffffff", variantId: 118126 }, { name: "Black", hex: "#111111", variantId: 118127 }, { name: "Navy", hex: "#1f2a44", variantId: 118128 }, { name: "Royal", hex: "#1d4f91", variantId: 118129 }, { name: "Red", hex: "#c8102e", variantId: 118130 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 118131 }, { name: "Purple", hex: "#4b2e83", variantId: 118132 }, { name: "Irish Green", hex: "#2e8b57", variantId: 118133 }, { name: "Carolina Blue", hex: "#7ba7d8", variantId: 118134 }, { name: "Forest Green", hex: "#22452f", variantId: 118135 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 118136 }] },
      "3XL": { price: 20.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 118137 }, { name: "Irish Green", hex: "#2e8b57", variantId: 118138 }, { name: "Navy", hex: "#1f2a44", variantId: 118139 }, { name: "Purple", hex: "#4b2e83", variantId: 118140 }, { name: "Red", hex: "#c8102e", variantId: 118141 }, { name: "Royal", hex: "#1d4f91", variantId: 118142 }, { name: "White", hex: "#ffffff", variantId: 118143 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 118144 }, { name: "Black", hex: "#111111", variantId: 118145 }, { name: "Forest Green", hex: "#22452f", variantId: 118146 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 118147 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.99 // $16.95 - $13.96, the smallest adult size
  },
  "apparel-tank": {
    displayName: "Tank Top",
    apparelLabel: "Gildan 5200",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 880,
    printProviderId: 99,
    printDimensions: { front: { width: 2681, height: 3051 } },
    sizes: {
      "S": { price: 15.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 76969 }, { name: "Red", hex: "#c8102e", variantId: 76970 }, { name: "Royal", hex: "#1d4f91", variantId: 76971 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 76972 }, { name: "White", hex: "#ffffff", variantId: 76973 }, { name: "Black", hex: "#111111", variantId: 76974 }, { name: "Maroon", hex: "#5c1f2b", variantId: 112099 }, { name: "Purple", hex: "#4b2e83", variantId: 112100 }, { name: "Safety Pink", hex: "#ff6fa8", variantId: 112101 }, { name: "Forest Green", hex: "#22452f", variantId: 112102 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 112103 }] },
      "M": { price: 15.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 76975 }, { name: "Red", hex: "#c8102e", variantId: 76976 }, { name: "Royal", hex: "#1d4f91", variantId: 76977 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 76978 }, { name: "White", hex: "#ffffff", variantId: 76979 }, { name: "Black", hex: "#111111", variantId: 76980 }, { name: "Maroon", hex: "#5c1f2b", variantId: 112104 }, { name: "Purple", hex: "#4b2e83", variantId: 112105 }, { name: "Safety Pink", hex: "#ff6fa8", variantId: 112106 }, { name: "Forest Green", hex: "#22452f", variantId: 112107 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 112108 }] },
      "L": { price: 15.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 76981 }, { name: "Red", hex: "#c8102e", variantId: 76982 }, { name: "Royal", hex: "#1d4f91", variantId: 76983 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 76984 }, { name: "White", hex: "#ffffff", variantId: 76985 }, { name: "Black", hex: "#111111", variantId: 76986 }, { name: "Purple", hex: "#4b2e83", variantId: 112110 }, { name: "Safety Pink", hex: "#ff6fa8", variantId: 112111 }, { name: "Forest Green", hex: "#22452f", variantId: 112112 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 112113 }] },
      "XL": { price: 15.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 76987 }, { name: "Red", hex: "#c8102e", variantId: 76988 }, { name: "Royal", hex: "#1d4f91", variantId: 76989 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 76990 }, { name: "White", hex: "#ffffff", variantId: 76991 }, { name: "Black", hex: "#111111", variantId: 76992 }, { name: "Maroon", hex: "#5c1f2b", variantId: 112114 }, { name: "Purple", hex: "#4b2e83", variantId: 112115 }, { name: "Safety Pink", hex: "#ff6fa8", variantId: 112116 }, { name: "Forest Green", hex: "#22452f", variantId: 112117 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 112118 }] },
      "2XL": { price: 18.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 76993 }, { name: "Red", hex: "#c8102e", variantId: 76994 }, { name: "Royal", hex: "#1d4f91", variantId: 76995 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 76996 }, { name: "White", hex: "#ffffff", variantId: 76997 }, { name: "Black", hex: "#111111", variantId: 76998 }, { name: "Maroon", hex: "#5c1f2b", variantId: 112119 }, { name: "Purple", hex: "#4b2e83", variantId: 112120 }, { name: "Safety Pink", hex: "#ff6fa8", variantId: 112121 }, { name: "Forest Green", hex: "#22452f", variantId: 112122 }, { name: "Graphite Heather", hex: "#6b6c70", variantId: 112123 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.78 // $15.95 - $13.17, the smallest adult size
  },
  "apparel-kids-tee": {
    displayName: "Kids Tee",
    apparelLabel: "Gildan 5000B",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 157,
    printProviderId: 99,
    printDimensions: { front: { width: 2244, height: 2564 } },
    sizes: {
      "XS": { price: 9.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 38495 }, { name: "Purple", hex: "#4b2e83", variantId: 38500 }, { name: "Red", hex: "#c8102e", variantId: 38505 }, { name: "Royal", hex: "#1d4f91", variantId: 38510 }, { name: "Black", hex: "#111111", variantId: 38525 }, { name: "Forest Green", hex: "#22452f", variantId: 38530 }, { name: "Maroon", hex: "#5c1f2b", variantId: 42501 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 42511 }, { name: "White", hex: "#ffffff", variantId: 42516 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42739 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42744 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 79366, price: 11.95 }] },
      "S": { price: 9.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 38496 }, { name: "Purple", hex: "#4b2e83", variantId: 38501 }, { name: "Red", hex: "#c8102e", variantId: 38506 }, { name: "Royal", hex: "#1d4f91", variantId: 38511 }, { name: "Black", hex: "#111111", variantId: 38526 }, { name: "Forest Green", hex: "#22452f", variantId: 38531 }, { name: "Maroon", hex: "#5c1f2b", variantId: 42502 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 42512 }, { name: "White", hex: "#ffffff", variantId: 42517 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42740 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42745 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 79367 }] },
      "M": { price: 9.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 38497 }, { name: "Purple", hex: "#4b2e83", variantId: 38502 }, { name: "Red", hex: "#c8102e", variantId: 38507 }, { name: "Royal", hex: "#1d4f91", variantId: 38512 }, { name: "Black", hex: "#111111", variantId: 38527 }, { name: "Forest Green", hex: "#22452f", variantId: 38532 }, { name: "Maroon", hex: "#5c1f2b", variantId: 42503 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 42513 }, { name: "White", hex: "#ffffff", variantId: 42518 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42741 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42746 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 79368 }] },
      "L": { price: 9.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 38498 }, { name: "Purple", hex: "#4b2e83", variantId: 38503 }, { name: "Red", hex: "#c8102e", variantId: 38508 }, { name: "Royal", hex: "#1d4f91", variantId: 38513 }, { name: "Black", hex: "#111111", variantId: 38528 }, { name: "Forest Green", hex: "#22452f", variantId: 38533 }, { name: "Maroon", hex: "#5c1f2b", variantId: 42504 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 42514 }, { name: "White", hex: "#ffffff", variantId: 42519 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42742 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42747 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 79369 }] },
      "XL": { price: 9.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 38499 }, { name: "Purple", hex: "#4b2e83", variantId: 38504 }, { name: "Red", hex: "#c8102e", variantId: 38509 }, { name: "Royal", hex: "#1d4f91", variantId: 38514 }, { name: "Black", hex: "#111111", variantId: 38529 }, { name: "Forest Green", hex: "#22452f", variantId: 38534 }, { name: "Maroon", hex: "#5c1f2b", variantId: 42505 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 42515 }, { name: "White", hex: "#ffffff", variantId: 42520 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42743 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42748 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.84 // $9.95 - $7.11, the smallest adult size
  },
  "apparel-crewneck": {
    displayName: "Crewneck Sweatshirt",
    apparelLabel: "Gildan 18000",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 49,
    printProviderId: 99,
    printDimensions: { front: { width: 3185, height: 3636 } },
    sizes: {
      "S": { price: 20.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25379 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 25385 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 25386 }, { name: "Maroon", hex: "#5c1f2b", variantId: 25387 }, { name: "Navy", hex: "#1f2a44", variantId: 25388 }, { name: "Red", hex: "#c8102e", variantId: 25391 }, { name: "Sand", hex: "#d8c7a5", variantId: 25394 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25395 }, { name: "White", hex: "#ffffff", variantId: 25396 }, { name: "Black", hex: "#111111", variantId: 25397 }, { name: "Forest Green", hex: "#22452f", variantId: 25400 }, { name: "Royal", hex: "#1d4f91", variantId: 25625 }] },
      "M": { price: 20.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25410 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 25416 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 25417 }, { name: "Maroon", hex: "#5c1f2b", variantId: 25418 }, { name: "Navy", hex: "#1f2a44", variantId: 25419 }, { name: "Red", hex: "#c8102e", variantId: 25422 }, { name: "Sand", hex: "#d8c7a5", variantId: 25425 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25426 }, { name: "White", hex: "#ffffff", variantId: 25427 }, { name: "Black", hex: "#111111", variantId: 25428 }, { name: "Forest Green", hex: "#22452f", variantId: 25431 }, { name: "Royal", hex: "#1d4f91", variantId: 25624 }] },
      "L": { price: 20.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25441 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 25447 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 25448 }, { name: "Maroon", hex: "#5c1f2b", variantId: 25449 }, { name: "Navy", hex: "#1f2a44", variantId: 25450 }, { name: "Red", hex: "#c8102e", variantId: 25453 }, { name: "Sand", hex: "#d8c7a5", variantId: 25456 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25457 }, { name: "White", hex: "#ffffff", variantId: 25458 }, { name: "Black", hex: "#111111", variantId: 25459 }, { name: "Forest Green", hex: "#22452f", variantId: 25462 }, { name: "Royal", hex: "#1d4f91", variantId: 25623 }] },
      "XL": { price: 20.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25472 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 25478 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 25479 }, { name: "Maroon", hex: "#5c1f2b", variantId: 25480 }, { name: "Navy", hex: "#1f2a44", variantId: 25481 }, { name: "Red", hex: "#c8102e", variantId: 25484 }, { name: "Sand", hex: "#d8c7a5", variantId: 25487 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25488 }, { name: "White", hex: "#ffffff", variantId: 25489 }, { name: "Black", hex: "#111111", variantId: 25490 }, { name: "Forest Green", hex: "#22452f", variantId: 25493 }, { name: "Royal", hex: "#1d4f91", variantId: 25626 }] },
      "2XL": { price: 22.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25503 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 25509 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 25510 }, { name: "Maroon", hex: "#5c1f2b", variantId: 25511 }, { name: "Navy", hex: "#1f2a44", variantId: 25512 }, { name: "Red", hex: "#c8102e", variantId: 25515 }, { name: "Sand", hex: "#d8c7a5", variantId: 25518 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25519 }, { name: "White", hex: "#ffffff", variantId: 25520 }, { name: "Black", hex: "#111111", variantId: 25521 }, { name: "Forest Green", hex: "#22452f", variantId: 25524 }, { name: "Royal", hex: "#1d4f91", variantId: 25627 }] },
      "3XL": { price: 24.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25534 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 25540 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 25541 }, { name: "Maroon", hex: "#5c1f2b", variantId: 25542 }, { name: "Navy", hex: "#1f2a44", variantId: 25543 }, { name: "Red", hex: "#c8102e", variantId: 25546 }, { name: "Sand", hex: "#d8c7a5", variantId: 25549 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25550 }, { name: "White", hex: "#ffffff", variantId: 25551 }, { name: "Black", hex: "#111111", variantId: 25552 }, { name: "Forest Green", hex: "#22452f", variantId: 25555 }, { name: "Royal", hex: "#1d4f91", variantId: 25628 }] },
      "4XL": { price: 27.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25565 }, { name: "Navy", hex: "#1f2a44", variantId: 25574 }, { name: "Red", hex: "#c8102e", variantId: 25577 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25581 }, { name: "White", hex: "#ffffff", variantId: 25582 }, { name: "Black", hex: "#111111", variantId: 25583 }, { name: "Forest Green", hex: "#22452f", variantId: 25586 }, { name: "Royal", hex: "#1d4f91", variantId: 25629 }] },
      "5XL": { price: 27.95, colors: [{ name: "Charcoal", hex: "#4a4b4f", variantId: 25596 }, { name: "Navy", hex: "#1f2a44", variantId: 25605 }, { name: "Red", hex: "#c8102e", variantId: 25608 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 25612 }, { name: "White", hex: "#ffffff", variantId: 25613 }, { name: "Black", hex: "#111111", variantId: 25614 }, { name: "Forest Green", hex: "#22452f", variantId: 25617 }, { name: "Royal", hex: "#1d4f91", variantId: 25630 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.29 // $20.95 - $17.66, the smallest adult size
  },
  "apparel-hoodie": {
    displayName: "Hoodie",
    apparelLabel: "Gildan 18500",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 77,
    printProviderId: 99,
    printDimensions: { front: { width: 2919, height: 1944 } },
    sizes: {
      "S": { price: 23.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32886 }, { name: "Navy", hex: "#1f2a44", variantId: 32894 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32902 }, { name: "White", hex: "#ffffff", variantId: 32910 }, { name: "Black", hex: "#111111", variantId: 32918 }, { name: "Red", hex: "#c8102e", variantId: 33385 }, { name: "Royal", hex: "#1d4f91", variantId: 33393 }, { name: "Forest Green", hex: "#22452f", variantId: 33417 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42148 }, { name: "Sand", hex: "#d8c7a5", variantId: 42164 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42211 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42235 }] },
      "M": { price: 23.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32887 }, { name: "Navy", hex: "#1f2a44", variantId: 32895 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32903 }, { name: "White", hex: "#ffffff", variantId: 32911 }, { name: "Black", hex: "#111111", variantId: 32919 }, { name: "Red", hex: "#c8102e", variantId: 33386 }, { name: "Royal", hex: "#1d4f91", variantId: 33394 }, { name: "Forest Green", hex: "#22452f", variantId: 33418 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42149 }, { name: "Sand", hex: "#d8c7a5", variantId: 42165 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42212 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42236 }] },
      "L": { price: 23.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32888 }, { name: "Navy", hex: "#1f2a44", variantId: 32896 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32904 }, { name: "White", hex: "#ffffff", variantId: 32912 }, { name: "Black", hex: "#111111", variantId: 32920 }, { name: "Red", hex: "#c8102e", variantId: 33387 }, { name: "Royal", hex: "#1d4f91", variantId: 33395 }, { name: "Forest Green", hex: "#22452f", variantId: 33419 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42150 }, { name: "Sand", hex: "#d8c7a5", variantId: 42166 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42213 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42237 }] },
      "XL": { price: 23.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32889 }, { name: "Navy", hex: "#1f2a44", variantId: 32897 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32905 }, { name: "White", hex: "#ffffff", variantId: 32913 }, { name: "Black", hex: "#111111", variantId: 32921 }, { name: "Red", hex: "#c8102e", variantId: 33388 }, { name: "Royal", hex: "#1d4f91", variantId: 33396 }, { name: "Forest Green", hex: "#22452f", variantId: 33420 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42151 }, { name: "Sand", hex: "#d8c7a5", variantId: 42167 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42214 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42238 }] },
      "2XL": { price: 26.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32890 }, { name: "Navy", hex: "#1f2a44", variantId: 32898 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32906 }, { name: "White", hex: "#ffffff", variantId: 32914 }, { name: "Black", hex: "#111111", variantId: 32922 }, { name: "Red", hex: "#c8102e", variantId: 33389 }, { name: "Royal", hex: "#1d4f91", variantId: 33397 }, { name: "Forest Green", hex: "#22452f", variantId: 33421 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42152 }, { name: "Sand", hex: "#d8c7a5", variantId: 42168 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42215 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42239 }] },
      "3XL": { price: 27.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32891 }, { name: "Navy", hex: "#1f2a44", variantId: 32899 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32907 }, { name: "White", hex: "#ffffff", variantId: 32915 }, { name: "Black", hex: "#111111", variantId: 32923 }, { name: "Red", hex: "#c8102e", variantId: 33390 }, { name: "Royal", hex: "#1d4f91", variantId: 33398 }, { name: "Forest Green", hex: "#22452f", variantId: 33422 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42153 }, { name: "Sand", hex: "#d8c7a5", variantId: 42169 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42216 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42240 }] },
      "4XL": { price: 27.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32892 }, { name: "Navy", hex: "#1f2a44", variantId: 32900 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32908 }, { name: "White", hex: "#ffffff", variantId: 32916 }, { name: "Black", hex: "#111111", variantId: 32924 }, { name: "Red", hex: "#c8102e", variantId: 33391 }, { name: "Royal", hex: "#1d4f91", variantId: 33399 }, { name: "Forest Green", hex: "#22452f", variantId: 33423 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42154 }, { name: "Sand", hex: "#d8c7a5", variantId: 42170 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42217 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42241 }] },
      "5XL": { price: 27.95, colors: [{ name: "Maroon", hex: "#5c1f2b", variantId: 32893 }, { name: "Navy", hex: "#1f2a44", variantId: 32901 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32909 }, { name: "White", hex: "#ffffff", variantId: 32917 }, { name: "Black", hex: "#111111", variantId: 32925 }, { name: "Red", hex: "#c8102e", variantId: 33392 }, { name: "Royal", hex: "#1d4f91", variantId: 33400 }, { name: "Forest Green", hex: "#22452f", variantId: 33424 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 42155 }, { name: "Sand", hex: "#d8c7a5", variantId: 42171 }, { name: "Charcoal", hex: "#4a4b4f", variantId: 42218 }, { name: "Light Blue", hex: "#a9c8e8", variantId: 42242 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.57 // $23.95 - $21.38, the smallest adult size
  },
  "apparel-youth-hoodie": {
    displayName: "Youth Hoodie",
    apparelLabel: "Gildan 18500B",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 314,
    printProviderId: 99,
    printDimensions: { front: { width: 2480, height: 1984 } },
    sizes: {
      "S": { price: 26.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 43865 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 43868 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 43871 }, { name: "Maroon", hex: "#5c1f2b", variantId: 43872 }, { name: "Navy", hex: "#1f2a44", variantId: 43873 }, { name: "Purple", hex: "#4b2e83", variantId: 43875 }, { name: "Red", hex: "#c8102e", variantId: 43876 }, { name: "Royal", hex: "#1d4f91", variantId: 43877 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 43878 }, { name: "White", hex: "#ffffff", variantId: 43879 }, { name: "Black", hex: "#111111", variantId: 43880 }, { name: "Forest Green", hex: "#22452f", variantId: 43881 }] },
      "M": { price: 26.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 43884 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 43887 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 43890 }, { name: "Maroon", hex: "#5c1f2b", variantId: 43891 }, { name: "Navy", hex: "#1f2a44", variantId: 43892 }, { name: "Purple", hex: "#4b2e83", variantId: 43894 }, { name: "Red", hex: "#c8102e", variantId: 43895 }, { name: "Royal", hex: "#1d4f91", variantId: 43896 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 43897 }, { name: "White", hex: "#ffffff", variantId: 43898 }, { name: "Black", hex: "#111111", variantId: 43899 }, { name: "Forest Green", hex: "#22452f", variantId: 43900 }] },
      "L": { price: 26.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 43903 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 43906 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 43909 }, { name: "Maroon", hex: "#5c1f2b", variantId: 43910 }, { name: "Navy", hex: "#1f2a44", variantId: 43911 }, { name: "Purple", hex: "#4b2e83", variantId: 43913 }, { name: "Red", hex: "#c8102e", variantId: 43914 }, { name: "Royal", hex: "#1d4f91", variantId: 43915 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 43916 }, { name: "White", hex: "#ffffff", variantId: 43917 }, { name: "Black", hex: "#111111", variantId: 43918 }, { name: "Forest Green", hex: "#22452f", variantId: 43919 }] },
      "XL": { price: 26.95, colors: [{ name: "Carolina Blue", hex: "#7ba7d8", variantId: 43922 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 43925 }, { name: "Light Pink", hex: "#f4c6d2", variantId: 43928 }, { name: "Maroon", hex: "#5c1f2b", variantId: 43929 }, { name: "Navy", hex: "#1f2a44", variantId: 43930 }, { name: "Purple", hex: "#4b2e83", variantId: 43932 }, { name: "Red", hex: "#c8102e", variantId: 43933 }, { name: "Royal", hex: "#1d4f91", variantId: 43934 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 43935 }, { name: "White", hex: "#ffffff", variantId: 43936 }, { name: "Black", hex: "#111111", variantId: 43937 }, { name: "Forest Green", hex: "#22452f", variantId: 43938 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.76 // $26.95 - $24.19, the smallest adult size
  },
  "apparel-zip-hoodie": {
    displayName: "Zip Hoodie",
    apparelLabel: "Gildan 18600",
    generatorIcon: "tshirt",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 66,
    printProviderId: 99,
    printDimensions: { front: { width: 3709, height: 2472 } },
    sizes: {
      "S": { price: 31.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 31925 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 31928 }, { name: "Black", hex: "#111111", variantId: 31930 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 66100 }] },
      "M": { price: 31.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 31935 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 31938 }, { name: "Black", hex: "#111111", variantId: 31940 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 66101 }] },
      "L": { price: 31.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 31945 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 31948 }, { name: "Black", hex: "#111111", variantId: 31950 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 66102 }] },
      "XL": { price: 31.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 31955 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 31958 }, { name: "Black", hex: "#111111", variantId: 31960 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 66103 }] },
      "2XL": { price: 33.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 31965 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 31968 }, { name: "Black", hex: "#111111", variantId: 31970 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 66104 }] },
      "3XL": { price: 35.95, colors: [{ name: "Navy", hex: "#1f2a44", variantId: 32786 }, { name: "Sport Grey", hex: "#9ea3a8", variantId: 32789 }, { name: "Black", hex: "#111111", variantId: 32791 }, { name: "Dark Heather", hex: "#4b4d52", variantId: 66105 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.32 // $31.95 - $28.63, the smallest adult size
  },

  // DESK CALENDAR (22 Sep 2026): Printify Desktop Calendar (Blank),
  // blueprint 1170, District Photo (28), 10 x 5 in, spiral bound, 13 pages
  // (front_cover + january..december) with NO date grids. calendarPages: the
  // server draws them (lib/calendar-pages.js) -- the picture square beside
  // each month, the year across the cover; next year from September on.
  // Wholesale 6.88; US postage 6.79 / 1.59 each extra (probe 2026-09-22).
  // Retail 9.95, Alyx's price (24 Sep 2026). One picture on every page for now.
  "desk-calendar": {
    displayName: "Desk Calendar",
    generatorIcon: "calendar",
    layoutType: "single-image",
    calendarPages: true,
    blueprintId: 1170,
    printProviderId: 28,
    printDimensions: { front: { width: 3075, height: 1575 } },
    sizes: { "10 x 5": { variantId: 91088, price: 9.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.07 // $9.95 - $6.88
  },

  // CAR MAGNET (Alyx, 22 Sep 2026): Printify Car Magnets, blueprint 1464,
  // District Photo (28), white vinyl on a magnetic back, weatherproof, made in
  // the USA. Three rectangles, each its own print area. Wholesale 3.20 / 3.12
  // / 4.11; US postage 4.79 / 0.49 each extra (probe 2026-09-22). Retail
  // 5.95 / 6.95 / 8.95, Alyx's prices: the store should feel fair to browse.
  // Printify's caution: the white base can show through dark designs.
  // SURPRISE!!! -- THE SMART MUG (Alyx, 23 Sep 2026). Printify's Color
  // Morphing Mug, 11oz, black until hot coffee goes in: blueprint 1156,
  // District Photo (provider 28), one variant. Wholesale 9.06; US shipping
  // 6.69 first / 2.99 each more (Printify also lists a 7.29 / 3.09 US
  // profile for the same variant). The templates are finished prints at the
  // exact print area, 2475 x 1155.
  "smart-mug": {
    displayName: "SURPRISE!!! Smart Mug",
    generatorIcon: "smart mug",
    layoutType: "single-image",
    blueprintId: 1156,
    printProviderId: 28,
    printDimensions: { front: { width: 2475, height: 1155 } },
    // Alyx's price: wholesale plus a $10 markup ("People will pay more for
    // that"), with the customer's total, shipping and fees in, under $30.
    sizes: { "11oz": { variantId: 88141, price: 19.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 10.89
  },
  // THE SURPRISE!!! HOLIDAY SET (Alyx, 26 Sep 2026): four different smart-mug
  // designs of one holiday, sold together at $59.95, Alyx's price. The same
  // mug as above (bp 1156, District Photo, variant 88141), four of them in one
  // Printify order; which four is lib/surprise-sets.js, never the page.
  // setOf tells basket shipping it is four mugs in the parcel. Profit is the
  // set less four wholesale mugs: 59.95 - 4 x 9.06.
  "smart-mug-set": {
    displayName: "SURPRISE!!! Holiday Set",
    generatorIcon: "smart mug",
    layoutType: "surprise-set",
    setOf: 4,
    blueprintId: 1156,
    printProviderId: 28,
    printDimensions: { front: { width: 2475, height: 1155 } },
    sizes: { "Set of 4": { variantId: 88141, price: 59.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 23.71
  },

  "car-magnet": {
    displayName: "Car Magnet",
    generatorIcon: "car magnet",
    layoutType: "single-image",
    blueprintId: 1464,
    printProviderId: 28,
    sizes: {
      "5 x 5 in":     { variantId: 105489, price: 5.95, printDimensions: { front: { width: 1650, height: 1650 } } },
      "7.5 x 4.5 in": { variantId: 105505, price: 6.95, printDimensions: { front: { width: 2475, height: 1575 } } },
      "10 x 3 in":    { variantId: 105497, price: 8.95, printDimensions: { front: { width: 3150, height: 1050 } } }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.75
  },

  // LUGGAGE TAG (Alyx, 23 Sep 2026): Printify Luggage Tag, blueprint 1308,
  // Acrylic Idea Factory (104), acrylic, 2.4 x 4 in, printed one side, leather
  // strap, a business-card slot behind. Wholesale 13.46; US postage 6.19 /
  // 0.99 each extra (probe 2026-09-22). Retail 16.95, Alyx's price.
  "luggage-tag": {
    displayName: "Luggage Tag",
    generatorIcon: "luggage tag",
    layoutType: "single-image",
    blueprintId: 1308,
    printProviderId: 104,
    printDimensions: { front: { width: 750, height: 1237 } },
    sizes: { "2.4 x 4 in": { variantId: 99003, price: 16.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.49
  },

  // BUSINESS CARDS (Alyx, 23 Sep 2026): one tile, three products. Taylor's
  // cards, blueprint 1053, provider 228: 3.5 x 2 in horizontal, printed one
  // side, four papers at one price; shipping differs by quantity (6.19 for
  // 10 up to 13.19 for 100 and 200), so shippingByVariant. Wholesale 32.33
  // (100) / 58.14 (200) / 21.00 (50). Alyx offers 50, 100 and 200, at
  // 24.95 / 34.95 / 61.95; 10 and 30 are left out on purpose.
  "business-cards": {
    displayName: "Business Cards",
    generatorIcon: "business cards",
    layoutType: "single-image",
    blueprintId: 1053,
    printProviderId: 228,
    shippingByVariant: true,
    printDimensions: { front: { width: 1125, height: 675 } },
    sizes: {
      "50 cards": { price: 24.95, colors: [{ name: "Coated (both sides)", variantId: 80434 }, { name: "Coated (one side)", variantId: 80439 }, { name: "White Matte", variantId: 80444 }, { name: "Uncoated", variantId: 80449 }] },
      "100 cards": { price: 34.95, colors: [{ name: "Coated (both sides)", variantId: 80435 }, { name: "Coated (one side)", variantId: 80440 }, { name: "White Matte", variantId: 80445 }, { name: "Uncoated", variantId: 80450 }] },
      "200 cards": { price: 61.95, colors: [{ name: "Coated (both sides)", variantId: 80436 }, { name: "Coated (one side)", variantId: 80441 }, { name: "White Matte", variantId: 80446 }, { name: "Uncoated", variantId: 80451 }] }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.62
  },

  // BOXED BUSINESS CARDS (23 Sep 2026): Print Pigeons, blueprint 812, provider
  // 36, 100 cards 3.5 x 2.3 in in a storage box, 350gsm. Two-sided, but a
  // design here is one picture, so the front is printed and the back left
  // blank. Wholesale 21.95 / 31.18 laminated; US postage 21.79 / 2.49.
  // Retail 24.95 / 33.95, Alyx's prices.
  "business-cards-boxed": {
    displayName: "Boxed Business Cards",
    generatorIcon: "business cards",
    layoutType: "single-image",
    blueprintId: 812,
    printProviderId: 36,
    printDimensions: { front: { width: 1075, height: 720 } },
    sizes: {
      "100 cards": { variantId: 76855, price: 24.95 },
      "100 cards, laminated": { variantId: 76854, price: 33.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 2.77
  },

  // BUSINESS CARD HOLDER (23 Sep 2026): Imagine Your Photos, blueprint 719,
  // provider 59, polished metal, the picture on the lid, holds 20 cards.
  // Wholesale 13.07; US postage 12.39 / 1.99. Retail 16.95, Alyx's price.
  "business-card-holder": {
    displayName: "Business Card Holder",
    generatorIcon: "business cards",
    layoutType: "single-image",
    blueprintId: 719,
    printProviderId: 59,
    printDimensions: { front: { width: 1022, height: 566 } },
    sizes: { "One size": { variantId: 73415, price: 16.95 } },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0,
    estimatedProfit: 3.88
  },

  "tote-bag": {
    displayName: "Tote Bag",
    generatorIcon: "tote bag",
    layoutType: "single-image",
    blueprintId: 507,
    printProviderId: 48,
    sizes: {
      "13\" x 13\"": {
        price: 23.95,
        colors: [
          { name: "Beige",      hex: "#E8DCC8", variantId: 80814 },
          { name: "Black",      hex: "#1c1c1c", variantId: 80815 },
          { name: "Light Blue", hex: "#A8D4E8", variantId: 80816 },
          { name: "Light Pink", hex: "#F4C2D7", variantId: 80817 },
          { name: "White",      hex: "#FFFFFF", variantId: 80818 }
        ]
      },
      "16\" x 16\"": {
        price: 24.95,
        colors: [
          { name: "Beige",      hex: "#E8DCC8", variantId: 80819 },
          { name: "Black",      hex: "#1c1c1c", variantId: 80820 },
          { name: "Light Blue", hex: "#A8D4E8", variantId: 80821 },
          { name: "Light Pink", hex: "#F4C2D7", variantId: 80822 },
          { name: "White",      hex: "#FFFFFF", variantId: 80823 }
        ]
      },
      // $25.95 IS DELIBERATE — do not "fix" it to $24.95 (2026-08-27, Alyx).
      // The threshold rule flags this as one rung over the $25 line, and
      // dropping it looks like an easy win. It is not: 16" x 16" is already
      // $24.95, so the drop ties the two sizes and gives the larger bag away.
      // Alyx, asked directly: "I don't think the 18 by 18 should be the same
      // price as the 16 by 16 so make it higher. That $25 cap is not a hard
      // and fast rule, it's more of a target to aim at."
      // Ladder integrity outranks the threshold. Leave it.
      "18\" x 18\"": {
        price: 25.95,
        colors: [
          { name: "Beige",      hex: "#E8DCC8", variantId: 80824 },
          { name: "Black",      hex: "#1c1c1c", variantId: 80825 },
          { name: "Light Blue", hex: "#A8D4E8", variantId: 80826 },
          { name: "Light Pink", hex: "#F4C2D7", variantId: 80827 },
          { name: "White",      hex: "#FFFFFF", variantId: 80828 }
        ]
      }
    },
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 4.91 // midpoint of the ladder $4.64-$5.18 (13" $23.95-$18.77, 16" $24.95-$20.08, 18" $25.95-$21.31). live probe, 2026-09-21
  },

  "phone-case-tough": {
    displayName: "Tough Phone Case",
    generatorIcon: "phone case",
    layoutType: "single-image",
    blueprintId: 269,
    printProviderId: 1,
    sizes: {
      "iPhone 11": { variantId: 62582, price: 19.95 },
      "iPhone 11 Pro": { variantId: 62583, price: 19.95 },
      "iPhone 11 Pro Max": { variantId: 62584, price: 19.95 },
      "iPhone 12": { variantId: 70871, price: 19.95 },
      "iPhone 12 Mini": { variantId: 70872, price: 19.95 },
      "iPhone 12 Pro": { variantId: 70873, price: 19.95 },
      "iPhone 12 Pro Max": { variantId: 70874, price: 19.95 },
      "iPhone 13": { variantId: 76611, price: 19.95 },
      "iPhone 13 Mini": { variantId: 76612, price: 19.95 },
      "iPhone 13 Pro": { variantId: 76613, price: 19.95 },
      "iPhone 13 Pro Max": { variantId: 76614, price: 19.95 },
      "iPhone 14": { variantId: 93905, price: 19.95 },
      "iPhone 14 Pro": { variantId: 93906, price: 19.95 },
      "iPhone 14 Pro Max": { variantId: 93907, price: 19.95 },
      "iPhone 14 Plus": { variantId: 93908, price: 19.95 },
      "iPhone 15": { variantId: 103561, price: 19.95 },
      "iPhone 15 Pro": { variantId: 103562, price: 19.95 },
      "iPhone 15 Plus": { variantId: 103563, price: 19.95 },
      "iPhone 15 Pro Max": { variantId: 103564, price: 19.95 },
      "Samsung Galaxy S24": { variantId: 105527, price: 19.95 },
      "Samsung Galaxy S23": { variantId: 105528, price: 19.95 },
      "Samsung Galaxy S22": { variantId: 105529, price: 19.95 },
      "Samsung Galaxy S21": { variantId: 105530, price: 19.95 },
      "iPhone 16 Pro": { variantId: 112812, price: 19.95 },
      "iPhone 16 Pro Max": { variantId: 112813, price: 19.95 },
      "iPhone 16": { variantId: 112814, price: 19.95 },
      "iPhone 16 Plus": { variantId: 112815, price: 19.95 },
      "Samsung Galaxy S25": { variantId: 125531, price: 19.95 },
      "iPhone 17": { variantId: 130115, price: 19.95 },
      "iPhone 17 Pro": { variantId: 130116, price: 19.95 },
      "iPhone 17 Pro Max": { variantId: 130117, price: 19.95 },
      "iPhone 17 Air": { variantId: 130118, price: 19.95 },
      "Samsung Galaxy S26": { variantId: 254190, price: 19.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    // NOT A MIDPOINT, and this is the one entry in the file where that would
    // lie. Every case is priced at a flat $19.95 but wholesale runs $11.25 to
    // $18.22, so the margins run $8.70 down to $1.73 -- and the spread is not
    // evenly populated: 34 of the 45 variants cost $11.25, 7 cost $12.86, and
    // only 4 are dearer than that. A midpoint of the RANGE ($5.22) would
    // describe four phones nobody has and misstate the other forty-one.
    // This is the average across all 45 variants weighted by how many sit at
    // each cost, which is what a case sold at random actually earns.
    estimatedProfit: 7.93 // weighted mean of 45 variants; range $1.73 (iPhone 5) to $8.70 (iPhone 11 and most current models). live probe, 2026-09-21
  },

  // PHONE CASE WITH CARD HOLDER (Alyx, 24 Sep 2026: "incorporate that phone
  // case into our repertoire"). WOYC, dye-sublimation, a credit-card slot in
  // the back. The phone MODEL is the size key, as on the Tough case; the
  // finish (Glossy/Matte) and the gift box are the "colours", because each
  // combination is its own Printify variant. Every model costs the same:
  // $13.14 plain, $15.60 gift boxed (live cost probe, 24 Sep 2026).
  // Alyx's prices: $21.95 plain ("these phones also have a credit card
  // holder"), the gift box a round $3 on top -- $24.95. A colour that carries
  // its own price overrides the size price (create-checkout-session's
  // resolvePrice reads it), which is how the gift box is billed.
  // Shipping (Printify, live 24 Sep 2026): US $4.39 first item, $0.99 each
  // extra; the second US profile Printify lists ($5.69/$1.49) is not the one
  // getShippingRates picks. Production time is listed as 10 days.
  "phone-case-card-holder": {
    displayName: "Phone Case With Card Holder",
    generatorIcon: "phone case",
    layoutType: "single-image",
    blueprintId: 1022,
    printProviderId: 23,
    sizes: {
      "iPhone 13": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79738 },
        { name: "Matte", variantId: 79739 },
        { name: "Glossy, gift boxed", variantId: 79758, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79759, price: 24.95 }
      ] },
      "iPhone 13 Mini": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79740 },
        { name: "Matte", variantId: 79741 },
        { name: "Glossy, gift boxed", variantId: 79760, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79761, price: 24.95 }
      ] },
      "iPhone 13 Pro": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79742 },
        { name: "Matte", variantId: 79743 },
        { name: "Glossy, gift boxed", variantId: 79762, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79763, price: 24.95 }
      ] },
      "iPhone 13 Pro Max": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79744 },
        { name: "Matte", variantId: 79745 },
        { name: "Glossy, gift boxed", variantId: 79764, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79765, price: 24.95 }
      ] },
      "iPhone 14": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149101 },
        { name: "Matte", variantId: 149093 },
        { name: "Glossy, gift boxed", variantId: 149105, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149097, price: 24.95 }
      ] },
      "iPhone 14 Plus": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149103 },
        { name: "Matte", variantId: 149095 },
        { name: "Glossy, gift boxed", variantId: 149107, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149099, price: 24.95 }
      ] },
      "iPhone 14 Pro": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149102 },
        { name: "Matte", variantId: 149094 },
        { name: "Glossy, gift boxed", variantId: 149106, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149098, price: 24.95 }
      ] },
      "iPhone 14 Pro Max": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149104 },
        { name: "Matte", variantId: 149096 },
        { name: "Glossy, gift boxed", variantId: 149108, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149100, price: 24.95 }
      ] },
      "iPhone 15": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149109 },
        { name: "Matte", variantId: 149110 },
        { name: "Glossy, gift boxed", variantId: 149117, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149118, price: 24.95 }
      ] },
      "iPhone 15 Plus": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149113 },
        { name: "Matte", variantId: 149114 },
        { name: "Glossy, gift boxed", variantId: 149121, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149122, price: 24.95 }
      ] },
      "iPhone 15 Pro": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149111 },
        { name: "Matte", variantId: 149112 },
        { name: "Glossy, gift boxed", variantId: 149119, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149120, price: 24.95 }
      ] },
      "iPhone 15 Pro Max": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149115 },
        { name: "Matte", variantId: 149116 },
        { name: "Glossy, gift boxed", variantId: 149123, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149124, price: 24.95 }
      ] },
      "iPhone 16": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149125 },
        { name: "Matte", variantId: 149126 },
        { name: "Glossy, gift boxed", variantId: 149133, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149134, price: 24.95 }
      ] },
      "iPhone 16 Plus": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149129 },
        { name: "Matte", variantId: 149130 },
        { name: "Glossy, gift boxed", variantId: 149137, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149138, price: 24.95 }
      ] },
      "iPhone 16 Pro": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149127 },
        { name: "Matte", variantId: 149128 },
        { name: "Glossy, gift boxed", variantId: 149135, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149136, price: 24.95 }
      ] },
      "iPhone 16 Pro Max": { price: 21.95, colors: [
        { name: "Glossy", variantId: 149131 },
        { name: "Matte", variantId: 149132 },
        { name: "Glossy, gift boxed", variantId: 149139, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 149140, price: 24.95 }
      ] },
      "iPhone 17": { price: 21.95, colors: [
        { name: "Glossy", variantId: 148553 },
        { name: "Matte", variantId: 148545 },
        { name: "Glossy, gift boxed", variantId: 148557, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 148549, price: 24.95 }
      ] },
      "iPhone 17 Air": { price: 21.95, colors: [
        { name: "Glossy", variantId: 148554 },
        { name: "Matte", variantId: 148546 },
        { name: "Glossy, gift boxed", variantId: 148558, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 148550, price: 24.95 }
      ] },
      "iPhone 17 Pro": { price: 21.95, colors: [
        { name: "Glossy", variantId: 148555 },
        { name: "Matte", variantId: 148547 },
        { name: "Glossy, gift boxed", variantId: 148559, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 148551, price: 24.95 }
      ] },
      "iPhone 17 Pro Max": { price: 21.95, colors: [
        { name: "Glossy", variantId: 148556 },
        { name: "Matte", variantId: 148548 },
        { name: "Glossy, gift boxed", variantId: 148560, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 148552, price: 24.95 }
      ] },
      "iPhone 18 Pro": { price: 21.95, colors: [
        { name: "Glossy", variantId: 462506 },
        { name: "Matte", variantId: 462507 }
      ] },
      "iPhone 18 Pro Max": { price: 21.95, colors: [
        { name: "Glossy", variantId: 462508 },
        { name: "Matte", variantId: 462509 }
      ] },
      "Samsung Galaxy S21": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79746 },
        { name: "Matte", variantId: 79747 },
        { name: "Glossy, gift boxed", variantId: 79766, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79767, price: 24.95 }
      ] },
      "Samsung Galaxy S21 Plus": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79748 },
        { name: "Matte", variantId: 79749 },
        { name: "Glossy, gift boxed", variantId: 79768, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79769, price: 24.95 }
      ] },
      "Samsung Galaxy S21 Ultra": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79750 },
        { name: "Matte", variantId: 79751 },
        { name: "Glossy, gift boxed", variantId: 79770, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79771, price: 24.95 }
      ] },
      "Samsung Galaxy S22": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79732 },
        { name: "Matte", variantId: 79733 },
        { name: "Glossy, gift boxed", variantId: 79752, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79753, price: 24.95 }
      ] },
      "Samsung Galaxy S22 Plus": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79734 },
        { name: "Matte", variantId: 79735 },
        { name: "Glossy, gift boxed", variantId: 79754, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79755, price: 24.95 }
      ] },
      "Samsung Galaxy S22 Ultra": { price: 21.95, colors: [
        { name: "Glossy", variantId: 79736 },
        { name: "Matte", variantId: 79737 },
        { name: "Glossy, gift boxed", variantId: 79756, price: 24.95 },
        { name: "Matte, gift boxed", variantId: 79757, price: 24.95 }
      ] }
    },
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 8.81 // $21.95 - $13.14 plain; the gift box is the same $8.81 ($24.95 - $15.60). live probe, 2026-09-24
  },

  "photo-poster": {
    displayName: "Photo/Poster",
    generatorIcon: "photo poster",
    layoutType: "single-image",

    // MOVED PROVIDERS (2026-08-26). Posters used to run on blueprint 1079 /
    // Prima Printing. A live shipping probe showed Prima has NO US profile at
    // all: US orders fell to REST_OF_THE_WORLD at $31.79 a poster, against
    // $6.99 for a mug. A $12.95 poster would have cost $44.74 delivered, so
    // posters were effectively unsellable domestically.
    //
    // Printed Simply (852/73) ships US for $6.79 and is Matte-only, which is
    // why the finish choice is gone. Costs and IDs from a live probe.
    //
    // Seven sizes. The first four are the affordable line, all under $15. The
    // last three are large formats Alyx chose to offer anyway at $19.95,
    // $24.95 and $34.95 -- they cost $16.18, $20.18 and $32.21 wholesale, so
    // the margins are thinner by design rather than by oversight.
    base: {
      blueprintId: 852,
      printProviderId: 73,
      finishes: ["Matte"],
      sizes: {
        // price ladder tracks WHOLESALE, which is why 11x17 sits below 11x14:
        // it genuinely costs less to make ($7.97 vs $9.98). Same lesson the
        // puzzle taught -- do not "correct" this to a rising ladder.
        "9x11": {
          orientations: ["Horizontal", "Vertical"],
          price: 11.95, aspectRatio: 1.222,   // cost $5.64 -> $6.31 profit
          variantIds: { verticalMatte: 76789, horizontalMatte: 76790 }
        },
        "11x17": {
          orientations: ["Horizontal", "Vertical"],
          price: 13.95, aspectRatio: 1.545,   // cost $7.97 -> $5.98 profit
          variantIds: { verticalMatte: 76779, horizontalMatte: 76782 }
        },
        "12x18": {
          orientations: ["Horizontal", "Vertical"],
          price: 14.95, aspectRatio: 1.5,     // cost $8.99 -> $5.96 profit
          variantIds: { verticalMatte: 76780, horizontalMatte: 76783 }
        },
        "11x14": {
          orientations: ["Horizontal", "Vertical"],
          price: 14.95, aspectRatio: 1.273,   // cost $9.98 -> $4.97 profit
          variantIds: { verticalMatte: 100778, horizontalMatte: 100777 }
        },

        // LARGE SIZES (Alyx, 2026-08-26): "it hurts nothing to offer them.
        // They cannot buy them if they don't want them." Thinner margins are
        // accepted deliberately -- Printify guarantees the goods, so a damaged
        // print is replaced at their cost, not ours.
        "16x20": {
          orientations: ["Horizontal", "Vertical"],
          price: 19.95, aspectRatio: 1.25,    // cost $16.18 -> $3.77 profit
          variantIds: { verticalMatte: 76781, horizontalMatte: 76785 }
        },
        "18x24": {
          orientations: ["Horizontal", "Vertical"],
          price: 24.95, aspectRatio: 1.333,   // cost $20.18 -> $4.77 profit
          variantIds: { verticalMatte: 76784, horizontalMatte: 76786 }
        },
        // THINNEST in the catalog: $2.74 gross, and Stripe's ~2.9% + 30c takes
        // $1.31 of it, leaving roughly $1.43. Flagged to Alyx and kept on
        // their call. If this ever needs rescuing, $39.95 would clear $7.74.
        "24x36": {
          orientations: ["Horizontal", "Vertical"],
          price: 34.95, aspectRatio: 1.5,     // cost $32.21 -> $2.74 profit
          variantIds: { verticalMatte: 76787, horizontalMatte: 76788 }
        }
      }
    },

    // FRAMES REMOVED (2026-08-26, Alyx). Print Pigeons charged $57.87 to frame
    // an 18x24 whose print costs a dollar -- the frame alone was $56.82, more
    // than fifty times the poster inside it. Retail $61.95 cleared $4.08, or
    // roughly $2 after Stripe. Alyx: "for $61 they'll probably make their own
    // frame." resolvePhotoPosterSelection() still has a framed branch; it is
    // simply unreachable now, since nothing sends framed:true.
    framedUpsell: null,

    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout
    estimatedProfit: 5.96 // midpoint of the ladder ($4.97-$6.31, live probe 2026-08-26)
  },

  // ROUND COASTERS (2026-08-27, Alyx: "I'm kinda partial to those round
  // coasters, they look so good. My sister loved them... take only a
  // marginal profit to keep them as low as we can get away with").
  //
  // A different blueprint from the square set, because shape is baked into
  // the blueprint here, not a variant of ours. Probed live:
  //   Round 4-pack  $20.72   (variant 79363)
  //   Square 4-pack $13.46   on this same blueprint, for reference
  //   US shipping   $7.39 first / $7.39 additional
  //
  // The "round costs more" assumption is true of SINGLES and barely true of
  // sets: against our existing square set's $19.79 this is $0.93 dearer.
  // So it is presented at $29.95, the SAME as the square set, and we absorb
  // the 93c rather than marking the nicer shape up. That is the marginal
  // profit Alyx asked for -- ~$7.77 net against the square set's ~$8.70 --
  // and it avoids pricing round BELOW square while it costs more to make,
  // which is what $24.95 would have done.
  //
  // NOTE for later: this blueprint's SQUARE 4-pack is $13.46, $6.33 cheaper
  // than our current square set, but smaller (3.7" vs 4") and corkwood
  // rather than hardboard. A consolidation worth pricing out, not a
  // like-for-like swap.
  //
  // Print area is 1193x1193 (square canvas, cropped to a disc by the
  // product), which is why needles-studio.html marks this 'circle' in
  // PRODUCT_FADE_SHAPE -- an edge fade here must run from the rim inward.
  "coaster-set-round": {
    displayName: "Round Coasters, Set of 4",
    generatorIcon: "coaster",
    layoutType: "single-image",
    blueprintId: 994,
    printProviderId: 66,
    printDimensions: { front: { width: 1193, height: 1193 } },
    sizes: {
      "Round 3.7\"": { variantId: 79363, price: 29.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout
    estimatedProfit: 7.77
  },

  "coaster-set": {
    displayName: "Coasters, Set of 4",
    generatorIcon: "coaster",
    layoutType: "single-image",
    blueprintId: 2764,
    printProviderId: 59,
    sizes: {
      "4\" x 4\"": { variantId: 149519, price: 29.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 10.16 // $29.95 retail minus $19.79 wholesale (live probe, 2026-08-26)
    // SEASONAL NOTE (Alyx): drop this to ~$24.95 around Christmas to land it
    // under $25 as a Secret Santa buy. That is still $5.16 clear per set.
  },

  // Blueprint 608 / provider 28 (District Photo). Wholesale $4.88, confirmed by
  // live cost probe 2026-08-26. Chosen over the round Mouse Pad (#582) which
  // costs $12.37 -- two and a half times as much for the same category of
  // product. $11.95 retail is a $7.07 profit at 59%.
  "mouse-pad": {
    displayName: "Mouse Pad",
    generatorIcon: "mouse pad",
    layoutType: "single-image",
    blueprintId: 608,
    printProviderId: 28,
    sizes: {
      "9\" x 8\"": { variantId: 71923, price: 9.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 5.07 // $9.95 retail minus $4.88 wholesale (live probe, 2026-08-26)
  },

  // PLUGGED IN (2026-08-28, Alyx: "There's no sense in having [them] hang out
  // unintegrated"). Both sat on the studio picker as "Art only" leftovers
  // from the legacy generator; both turned out to have real Printify
  // blueprints. Printer choice was decided by SHIPPING, not cost -- the
  // probes told the real story:
  //   * Duplium (bp 785): $2.97/card but ships US at $16.79 (Canadian).
  //   * Prima (bp 962): $1.00/card and NO US shipping profile at all --
  //     rest-of-world $16.69. (Prima's COASTER blueprint does have a US
  //     profile at $7.69; the gap is per-blueprint, checked 2026-08-28.)
  //   * CatPrint (bp 819): US printer, sane rates. Chosen.
  // REPRICED (2026-08-28, Alyx): "This was always supposed to be a reflex
  // buy item, and not a profit generator." Cards and post-its are priced
  // at roughly $2 over wholesale, deliberately -- do not "fix" these
  // margins upward. The plan is to replace reflex-buy items with
  // profitable products over time, not to squeeze these. Ladder TODO:
  // 16 pcs ($27.91 cost, v77839) and 24 pcs ($37.77, v77840) are real
  // variants on this same blueprint whenever a ladder is wanted.
  "greeting-card": {
    displayName: "Greeting Cards, 8-Pack",
    generatorIcon: "greeting card",
    layoutType: "single-image",
    blueprintId: 819,
    printProviderId: 84,
    // CONFIRMED (live catalog read, 2026-08-28): front 2625x1725 @300dpi.
    // The blueprint also carries an "inside" placeholder. Until Sep 2026 we
    // printed the front only and the inside shipped blank. It is now
    // optional: supportsInsidePrint tells placeProductOrder that an
    // insideImage is legal here, and the inside's own dimensions are read
    // LIVE from the blueprint rather than pinned, because unlike the front
    // they have never been confirmed against the real catalog and a guessed
    // print area is a mis-printed card, not a mis-sized preview.
    printDimensions: { front: { width: 2625, height: 1725 } },
    supportsInsidePrint: true,
    sizes: {
      "8-Pack": { variantId: 76175, price: 15.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 1.99 // $15.95 retail minus $13.96 wholesale (live probe, 2026-08-28); reflex-buy margin per Alyx
  },

  // Taylor is a US printer (US ship $5.59 first item, live probe
  // 2026-08-28). Reflex-buy margin, same as the greeting card above --
  // $7.95 is the .95 step BELOW wholesale+$2 ($8.22) because buyability
  // beats the extra 27 cents; do not round it up. Ladder TODO: 4"x6" pad
  // is $7.01 (v96734) and five other sizes exist on this blueprint
  // whenever more rungs are wanted.
  "post-it-notes": {
    displayName: "Post-it® Note Pad, 3\" x 3\"",
    generatorIcon: "post-it note",
    layoutType: "single-image",
    blueprintId: 1294,
    printProviderId: 228,
    printDimensions: { front: { width: 976, height: 957 } },
    sizes: {
      "3\" x 3\"": { variantId: 96731, price: 7.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 1.73 // $7.95 retail minus $6.22 wholesale (live probe, 2026-08-28); reflex-buy margin per Alyx
  },

  "photo-puzzle": {
    displayName: "Photo Puzzle",
    generatorIcon: "puzzle",
    layoutType: "single-image",
    blueprintId: 596,
    printProviderId: 80,
    sizes: {
      // REVERTED (2026-08-26, Alyx). These were briefly flipped to 38.95/40.95
      // on the assumption that the larger puzzle costing less was an error. A
      // live cost probe proved the opposite: 96 pcs genuinely costs MORE to
      // make than 252 pcs ($35.07 vs $33.62), because short runs are dearer.
      // The original ladder was tracking wholesale cost at a steady ~14%
      // margin on both tiers; the flip cut 96 pcs to 10% ($3.88 profit) and
      // inflated 252 pcs to 18%. Do not "fix" this again without re-probing.
      // 39.95, not 40.95 (2026-08-27, Alyx's threshold rule): a presented
      // price must land JUST UNDER the round number the buyer measures
      // against, never a dollar past it. $40.95 cleared nothing and read as
      // "over forty" — doubly odd next to the LARGER 252-piece at $38.95.
      // The inversion below is still intact (39.95 > 38.95) and still real:
      // 96 pcs genuinely costs more to make. Costs $1.00 of margin, leaving
      // $4.88 over the $35.07 wholesale.
      "96 pcs": { variantId: 80317, price: 39.95 },
      "252 pcs": { variantId: 80318, price: 38.95 },
      "500 pcs": { variantId: 74740, price: 43.95 },
      "1000 pcs": { variantId: 74741, price: 43.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 4.54 // midpoint of the ladder $4.19-$4.90 (96pc $39.95-$35.76, 252pc $38.95-$34.29, 500/1000pc $43.95-$39.05). live probe, 2026-09-21
  },

  "suitcase": {
    displayName: "Suitcase",
    generatorIcon: "suitcase",
    layoutType: "single-image",
    blueprintId: 624,
    printProviderId: 81,
    sizes: {
      "Small": { variantId: 72133, price: 169.95 },
      "Medium": { variantId: 79350, price: 194.95 },
      "Large": { variantId: 79351, price: 214.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    // He was right that the markup here is NOT proportional to the smaller
    // items, and the probe puts a figure on it: a Small costs $147.78 against
    // $169.95 retail. That is $22.17 -- a bigger DOLLAR margin than anything
    // else sold here, and 13%, against 66% on a Classic White mug. So a
    // suitcase is worth two mugs in the till and a sixth of one in headroom;
    // there is very little room to discount it, and a refunded one costs what
    // twenty mugs earn.
    estimatedProfit: 26.61 // midpoint of $22.17 (Small, $169.95-$147.78), $29.10 (Medium, $194.95-$165.85) and $31.04 (Large, $214.95-$183.91). live probe, 2026-09-21
  },

  "travel-mug-40oz-insulated": {
    displayName: "Insulated Travel Mug, 40oz",
    generatorIcon: "bottle",
    layoutType: "front-back",
    blueprintId: 1498,
    // CONFIRMED (2026-08-27, live relay read): provider 217 is correct.
    // The same call reports decoration_methods ["dtf","engraving"] -- DTF
    // (direct-to-film transfer) and laser engraving. NOT dye-sublimation,
    // which every other cup here uses and which the art pipeline is built
    // around. DTF puts down a physical transfer film with its own opaque
    // white underbase, so it behaves differently from sublimation on exactly
    // the things we tune for: edge fade to the product colour assumes the
    // substrate shows through, and it does not here. This product is on the
    // grid at $44.95 and has never been physically run. Flagged, not
    // changed.
    printProviderId: 217,
    sizes: {
      "40oz": { price: 44.95 }
    },
    colors: [
      { name: "White",       hex: "#FFFFFF", variantId: 107788 },
      { name: "Black",       hex: "#1c1c1c", variantId: 107784 },
      { name: "Navy Blue",   hex: "#1B3D7A", variantId: 107782 },
      { name: "Royal Blue",  hex: "#2255A4", variantId: 107786 },
      { name: "Teal",        hex: "#1F9E8E", variantId: 107787 },
      { name: "Olive Green", hex: "#6B8E23", variantId: 107783 },
      { name: "Dark Gray",   hex: "#4a4a4a", variantId: 107781 },
      { name: "Red",         hex: "#D62828", variantId: 107785 }
    ],
    printDimensions: { front: { width: 900, height: 1200 }, back: { width: 900, height: 1200 } },
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js (probe 2026-09-20: $7.89 first / $2.99 additional US)
    estimatedProfit: 4.88 // $44.95 retail minus $40.07 wholesale (live probe, 2026-09-20)
  },

  "travel-mug-20oz": {
    displayName: "Travel Mug, 20oz",
    generatorIcon: "bottle",
    layoutType: "single-image",
    // UPDATED (July 2026): swapped from Polar Camel (blueprint 1513) to
    // SPOKE Custom Products (blueprint 353) — CONFIRMED via real Printify
    // product page that blueprint 1513 is listed as "Early Access,"
    // meaning it has NO real photographed mockups available at all, only
    // a flat print-file preview. That was the root cause of travel mug
    // real-photo previews showing raw flat artwork instead of an actual
    // mockup photo. This replacement blueprint has real lifestyle
    // mockups, comes in white only (no color picker), and prints as one
    // continuous full-wrap image rather than separate front/back panels.
    blueprintId: 353,
    printProviderId: 1,
    // No hardcoded variantId — CONFIRMED this blueprint has exactly one
    // orderable variant (20oz, white). It's resolved live by name match
    // via resolveVariantIdByTitleMatch() in create-printify-order.js,
    // the same approach already used for photo-poster's not-yet-looked-up
    // variant IDs, instead of a hardcoded number.
    sizes: {
      "20oz": { price: 29.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js (probe 2026-09-20: $6.19 first / $2.99 additional US)
    estimatedProfit: 4.98 // $29.95 retail minus $24.97 wholesale (live probe, 2026-09-20)
  },

  "travel-mug-14oz-handle": {
    displayName: "Travel Mug with Handle, 14oz",
    generatorIcon: "bottle",
    layoutType: "single-image",
    blueprintId: 1160,
    printProviderId: 28,
    sizes: {
      "14oz": { variantId: 88210, price: 24.95 }
    },
    colors: null,
    printDimensions: { front: { width: 1995, height: 930 } },
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js (probe 2026-09-20: $5.89 first / $2.99 additional US)
    estimatedProfit: 6.07 // $24.95 retail minus $18.88 wholesale (live probe, 2026-09-20)
  },

  "travel-mug-32oz-gator": {
    displayName: "Gator Tumbler, 32oz",
    generatorIcon: "bottle",
    layoutType: "single-image",
    blueprintId: 1235,
    // CONFIRMED (Aug 2026, via a direct Printify API call through The
    // Portal's relay): print provider "Chill" is provider ID 86.
    printProviderId: 86,
    sizes: {
      // PRICED (2026-09-20, Alyx), replacing the $34.95 placeholder. Live
      // cost probe the same day: wholesale $22.50, US shipping $7.89 first
      // item -- shipping is billed to the customer at checkout, not here.
      "32oz": { price: 26.95 }
    },
    // CONFIRMED (Aug 2026, via multiple independent Printify seller
    // listings for this exact blueprint): single color only, no color
    // picker needed.
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js (probe 2026-09-20: $7.89 first / $2.99 additional US)
    estimatedProfit: 4.45 // $26.95 retail minus $22.50 wholesale (live probe, 2026-09-20)
  },

  "travel-mug-30oz-tundra": {
    displayName: "Tundra Tumbler, 30oz",
    generatorIcon: "bottle",
    layoutType: "single-image",
    blueprintId: 1662,
    // CONFIRMED (2026-08-27) — no longer an inference. The relay call the
    // old note here recommended was finally made:
    //   /api/admin?action=printify-catalog&path=catalog/blueprints/1662/print_providers.json
    //   -> [{"id":86,"title":"Chill","decoration_methods":["uv"]}]
    // Provider 86 is right.
    //
    // But the same call contradicts the colour note below. This blueprint is
    // decorated by UV, NOT dye-sublimation -- the Gator, from the same
    // company on the same provider ID, is dye-sublimation. So the reasoning
    // under `colors` ("white is confirmed sublimation-safe") rests on a
    // premise that does not hold for this cup. The white-only decision may
    // still be correct, but it is no longer supported by the argument given
    // for it, and UV is a process we have never actually run. Left as-is and
    // flagged rather than quietly rewritten: it needs a real sample, not a
    // better-sounding comment.
    printProviderId: 86,
    // CONFIRMED (Aug 2026, direct from a real Printify listing for this
    // exact blueprint): print area is 3634 x 1039 px @ 300 DPI — one
    // single wide wraparound panel, same category as the 20oz/14oz.
    printDimensions: { front: { width: 3634, height: 1039 } },
    sizes: {
      // PRICED (2026-09-20, Alyx), replacing the $34.95 placeholder. Live
      // cost probe the same day: wholesale $25.21 in all three colours, US
      // shipping $7.89 first item, billed to the customer at checkout.
      "30oz": { price: 30.95 }
    },
    // White only, on purpose — the stainless-steel color options on this
    // blueprint are most likely laser-engraving-only (same category of
    // dead end as the 40oz BrüMate), while white is confirmed
    // sublimation-safe for full-color prints (multiple independent
    // listings for white 30oz sublimation tumblers, same shape/capacity).
    // Not offering colors here avoids exposing an option that might
    // silently fail or need a totally different (engraving) workflow.
    // THREE COLOURS, CONFIRMED (Sep 2026, pulled live through the catalogue
    // relay): blueprint 1662 / provider 86 lists exactly these variants, all
    // UV, all the same 3634 x 1039 band. White first: it is the default when
    // no colour has been chosen.
    colors: [
      { name: "White", hex: "#FFFFFF", variantId: 114840 },
      { name: "Black", hex: "#111214", variantId: 114839 },
      { name: "Steel", hex: "#B8BCC2", variantId: 114841 }
    ],
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js (probe 2026-09-20: $7.89 first / $2.99 additional US)
    estimatedProfit: 5.74 // $30.95 retail minus $25.21 wholesale (live probe, 2026-09-20)
  },

  "travel-mug-40oz-vacuum": {
    displayName: "Vacuum Thermal Tumbler, 40oz",
    generatorIcon: "bottle",
    layoutType: "single-image",
    blueprintId: 1715,
    // CONFIRMED (Aug 2026, via a direct Printify API call through The
    // Portal's relay): print provider "Smart Printee" is provider ID 90.
    printProviderId: 90,
    // CONFIRMED (Aug 2026, same relay call, print_providers/90/variants.json):
    // single "front" placeholder at 3710 x 2817 px — much taller than the
    // Tundra/Gator wrap bands (which only cover a narrow mid-body strip),
    // so this design prints nearly the full height of the tumbler, not
    // just a band. Decoration method is "uv", not sublimation like the
    // other tumblers here — UV DTF tumbler wraps are a known real process,
    // but worth a real product test print before this goes live since it's
    // a different printer/ink system than the rest of the catalog.
    printDimensions: { front: { width: 3710, height: 2817 } },
    sizes: {
      // THE PRICING RULE, whole (2026-08-27, Alyx, after three wrong passes):
      //
      //   1. It governs the PRESENTED price — the number on the tile that the
      //      customer reads and compares. "The final penny count occurs after
      //      the sale is made." Shipping and tax land wherever they land and
      //      must never be reverse-engineered into this figure.
      //   2. The .95 exists to sit JUST UNDER A THRESHOLD. It is not "round to
      //      the nearest .95" and it is emphatically not "round UP" — the
      //      whole point is to come in below a round number the customer is
      //      measuring against. $24.95 clears a $25 gift limit. $25.95 does
      //      not, and a $25.95 price is therefore strictly worse than $24.95
      //      despite being the higher number: it costs the sale.
      //
      // So: find the round number the buyer is likely measuring against, and
      // price at the .95 BELOW it. Never above it.
      //
      // The three wrong passes, so nobody repeats them: $25.56 (derived
      // backwards from a $44.95 all-in total, which is not a presented price
      // and is US-pre-tax-only anyway); $25.95 twice (once reasoning from the
      // .95 ending alone, once from net margin) — both broke the $25 ceiling.
      //
      // Probed live, not estimated:
      //   wholesale        $13.69 flat across all 12 colours
      //   US shipping      $19.39 first item / $17.99 additional (post-sale)
      //   net after Stripe $9.58
      // Which is exactly Alyx's "$9 profit is enough for one item", and the
      // extra dollar was never worth the $25 barrier.
      //
      // For contrast, travel-mug-40oz-insulated is presented at $44.95
      // against a $39.29 wholesale and nets $3.84 — this tumbler is presented
      // at nearly half that while being worth two and a half times as much.
      // REPRICED (2026-09-20, Alyx): $24.95 -> $21.95 -> $26.95 the same
      // day, on seeing it beside the rest: "that is probably the most
      // valuable mug and it's one of the cheapest, and that makes no sense
      // ... it is still way underpriced, even though it is the best item."
      // The reasoning above is kept as the history it is; the number it
      // argues for is no longer the number. Live probe the same day:
      // wholesale $13.96 (was recorded as $13.69), US shipping $20.19 first
      // item, billed at checkout.
      "40oz": { price: 26.95 }
    },
    // CONFIRMED variant IDs (Aug 2026, same relay call). Hex values below
    // are only a best-guess match to each color name, NOT pulled from a
    // real Printify swatch — swap these for the real swatch hexes before
    // this goes live if exact on-screen color matching matters.
    colors: [
      { name: "White",        hex: "#FFFFFF", variantId: 117425 },
      { name: "Navy Blue",    hex: "#1B3D7A", variantId: 117426 },
      { name: "Pink",         hex: "#F4A6C1", variantId: 117427 },
      { name: "Rose Red",     hex: "#B7434F", variantId: 117428 },
      { name: "Grey Green",   hex: "#7A8B7F", variantId: 117429 },
      { name: "Cyan",         hex: "#00BCD4", variantId: 117430 },
      { name: "Light Green",  hex: "#90C695", variantId: 117431 },
      { name: "Black",        hex: "#1c1c1c", variantId: 117432 },
      { name: "Light Purple", hex: "#C9A8E0", variantId: 117433 },
      { name: "Red",          hex: "#D62828", variantId: 117434 },
      { name: "Creamy White", hex: "#F5F0E1", variantId: 117435 },
      { name: "Light Blue",   hex: "#A8D0E6", variantId: 117436 }
    ],
    shippingSeparate: true,
    // Probed 2026-08-27, re-probed 2026-09-20. shippingCost stays 0 because
    // it is only a FALLBACK — real shipping is looked up live per destination
    // at checkout — but the probed US number is recorded here because it is
    // unusually high: $20.19 first item, $17.99 additional (was $19.39),
    // against $7.89/$2.99 for the insulated 40oz. On a $26.95 tumbler the
    // customer sees shipping at 75% of the product price. The optics are real.
    shippingCost: 0,
    // Was 9.58, an after-Stripe figure at the old $24.95. Now the same
    // convention as every other entry: retail minus wholesale.
    estimatedProfit: 12.99 // $26.95 retail minus $13.96 wholesale (live probe, 2026-09-20)
  }

};

export function getProduct(productKey) {
  return PRODUCTS_CATALOG[productKey];
}

export function getProductsByIcon(iconName) {
  return Object.entries(PRODUCTS_CATALOG)
    .filter(([key, product]) => product.generatorIcon === iconName)
    .map(([key, product]) => ({ key, ...product }));
}
