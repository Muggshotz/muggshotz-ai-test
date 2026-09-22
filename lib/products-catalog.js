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
  // Retail 16.95 provisional (~4.29 over wholesale); Alyx to confirm.
  "custom-standee": {
    displayName: "From Where I Stand",
    generatorIcon: "standee",
    layoutType: "single-image",
    cutToShape: true,
    blueprintId: 2770,
    printProviderId: 86,
    printDimensions: { front: { width: 1200, height: 1800 } },
    sizes: {
      "One size": { variantId: 149575, price: 16.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // resolved live per destination at checkout — see lib/printify-shipping.js
    estimatedProfit: 4.29 // $16.95 - $12.66, live probe 2026-09-22
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
