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
// sizes: null if the product only comes in one size (no picker shown).
// colors: null if the product has no color choice (no picker shown).
//         Otherwise an array of { name, hex, variantId } — hex is just
//         for the on-screen swatch, variantId is what actually gets
//         sent to Printify.

export const PRODUCTS_CATALOG = {

  "classic-white-mug": {
    displayName: "Classic White",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    blueprintId: 478,
    printProviderId: 99,
    sizes: {
      "11oz": { variantId: 65216, price: 14.95 },
      "15oz": { variantId: 104692, price: 19.95 }
    },
    colors: null,
    // UPDATED (July 2026 universal pricing overhaul): shipping is now
    // charged separately on every product, including this one — dropped
    // $5 off the old all-inclusive sticker price to compensate.
    shippingSeparate: true
  },

  "color-pop-mug": {
    displayName: "Color Pop",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    // CONFIRMED (not assumed) via live Printify product lookup: Color Pop
    // is a completely separate blueprint from Classic White, not just a
    // different color option on the same one.
    blueprintId: 1151,
    printProviderId: 59,
    // Color options DIFFER by size on this product — 11oz has 12 colors
    // (including Golden Yellow), 15oz has only 11 (no Golden Yellow).
    // So colors are nested under size here, not a flat top-level list.
    sizes: {
      "11oz": {
        price: 29.95,
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
        price: 34.95,
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
    // colors: null at top level intentionally — see nested per-size
    // colors above instead. Flagged so a generic order-page builder
    // doesn't mistake this product for having no color choice.
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true
  },

  "trimmed-mug": {
    displayName: "Trimmed",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    // CONFIRMED via real Printify product page — "Accent Rim & Handle Mug"
    // on Printify's own site. Printify's naming doesn't match Alyx's —
    // this is colored RIM + HANDLE, which is Alyx's definition of
    // "Trimmed," not "Accented" (inside-only color, still unconfirmed).
    blueprintId: 2692,
    printProviderId: 59,
    sizes: {
      "11oz": {
        price: 24.95, // placeholder — real base cost confirmed from USD 7.40
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
        price: 29.95, // placeholder — confirm real pricing before going live
        colors: [
          { name: "Black", hex: "#1c1c1c", variantId: 148123 },
          { name: "Blue", hex: "#2255A4", variantId: 148124 },
          { name: "Maroon", hex: "#7A1F2B", variantId: 148125 },
          { name: "Green", hex: "#1F7A45", variantId: 148126 },
          { name: "Cambridge Blue", hex: "#A3C1AD", variantId: 148127 },
          { name: "Yellow", hex: "#F0D43A", variantId: 148128 }
        ]
      }
    },
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true
  },

  "accented-mug": {
    displayName: "Accented",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    // CONFIRMED via real Printify product page + photo verification —
    // "Two-Tone Accent Mug." Colored INTERIOR ONLY (white handle, white
    // rim) — this is Alyx's real definition of "Accented," distinct from
    // Trimmed (blueprint 2692, rim+handle) and Color Pop (blueprint
    // 1151, interior+handle).
    blueprintId: 2693,
    printProviderId: 59,
    sizes: {
      "11oz": {
        price: 24.95, // placeholder — confirm real pricing before going live
        colors: [
          { name: "Black", hex: "#1c1c1c", variantId: 148148 },
          { name: "Blue", hex: "#2255A4", variantId: 148149 },
          { name: "Maroon", hex: "#7A1F2B", variantId: 148150 },
          { name: "Green", hex: "#1F7A45", variantId: 148151 },
          { name: "Yellow", hex: "#F0D43A", variantId: 148152 },
          { name: "Pink", hex: "#E0457B", variantId: 148153 },
          { name: "Orange", hex: "#F0701A", variantId: 148154 },
          { name: "Cambridge Blue", hex: "#A3C1AD", variantId: 148155 },
          { name: "Light Green", hex: "#5FBF5F", variantId: 148156 },
          { name: "Red", hex: "#D62828", variantId: 148157 },
          { name: "Light Blue", hex: "#5FA8DE", variantId: 148147 }
        ]
      },
      "15oz": {
        price: 29.95, // placeholder — confirm real pricing before going live
        colors: [
          { name: "Black", hex: "#1c1c1c", variantId: 148140 },
          { name: "Blue", hex: "#2255A4", variantId: 148141 },
          { name: "Maroon", hex: "#7A1F2B", variantId: 148142 },
          { name: "Green", hex: "#1F7A45", variantId: 148143 },
          { name: "Yellow", hex: "#F0D43A", variantId: 148144 },
          { name: "Pink", hex: "#E0457B", variantId: 148145 },
          { name: "Light Blue", hex: "#5FA8DE", variantId: 148146 }
        ]
      }
    },
    colors: null,
    colorsVaryBySize: true,
    shippingSeparate: true
  },

  "tote-bag": {
    displayName: "Tote Bag",
    generatorIcon: "tote bag",
    layoutType: "single-image",
    // CONFIRMED via real Printify product page — "Canvas Tote Bag,
    // 5-Color Straps." Print area is noticeably taller than wide
    // (~2100x4050px at smallest size) — a tall/narrow tote shape, not
    // square, despite the "13x13 / 16x16 / 18x18" size labels.
    blueprintId: 507,
    printProviderId: 48,
    // Pricing rule (Alyx, July 2026): flat +$5 profit added to EVERY
    // size (not tiered like suitcases) — Alyx's reasoning: tote size is
    // chosen for style/use-case fit, not "bigger is better," and the
    // base costs are already close together, so a flat bump makes more
    // sense here than scaling profit with size. Rounded up to .95.
    sizes: {
      "13\" x 13\"": {
        price: 23.95, // base cost $18.41 + $5, rounded to .95
        colors: [
          { name: "Beige",      hex: "#E8DCC8", variantId: 80814 },
          { name: "Black",      hex: "#1c1c1c", variantId: 80815 },
          { name: "Light Blue", hex: "#A8D4E8", variantId: 80816 },
          { name: "Light Pink", hex: "#F4C2D7", variantId: 80817 },
          { name: "White",      hex: "#FFFFFF", variantId: 80818 }
        ]
      },
      "16\" x 16\"": {
        price: 24.95, // base cost $19.69 + $5, rounded to .95
        colors: [
          { name: "Beige",      hex: "#E8DCC8", variantId: 80819 },
          { name: "Black",      hex: "#1c1c1c", variantId: 80820 },
          { name: "Light Blue", hex: "#A8D4E8", variantId: 80821 },
          { name: "Light Pink", hex: "#F4C2D7", variantId: 80822 },
          { name: "White",      hex: "#FFFFFF", variantId: 80823 }
        ]
      },
      "18\" x 18\"": {
        price: 25.95, // base cost $20.90 + $5, rounded to .95
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
    colorsVaryBySize: true, // colors are the same 5 across all sizes here, but variantId still depends on size+color together, so this uses the same nested structure as Color Pop/Trimmed/Accented
    shippingSeparate: true
  },

  "phone-case-tough": {
    displayName: "Tough Phone Case",
    generatorIcon: "phone case",
    layoutType: "single-image",
    // CONFIRMED via real Printify catalog lookup — "Tough Phone Cases,"
    // provider "SPOKE Custom Products." Base cost from $11.04 across all
    // models. Flat retail pricing (Alyx, July 2026): $24.95 + shipping,
    // same as every model, regardless of individual base cost — matches
    // the travel mug line's flat-price approach, not a per-model markup.
    blueprintId: 269,
    printProviderId: 1,
    // Each supported phone model is its own "size" entry — same pattern
    // used for suitcase sizes. sizeLabel at checkout = the exact model
    // name string below, matched against what the phone-compatibility
    // search tool returns, so the order-page picker can reuse that same
    // search UX instead of a giant dropdown of 32 options.
    sizes: {
      "iPhone 11": { variantId: 62582, price: 24.95 },
      "iPhone 11 Pro": { variantId: 62583, price: 24.95 },
      "iPhone 11 Pro Max": { variantId: 62584, price: 24.95 },
      "iPhone 12": { variantId: 70871, price: 24.95 },
      "iPhone 12 Mini": { variantId: 70872, price: 24.95 },
      "iPhone 12 Pro": { variantId: 70873, price: 24.95 },
      "iPhone 12 Pro Max": { variantId: 70874, price: 24.95 },
      "iPhone 13": { variantId: 76611, price: 24.95 },
      "iPhone 13 Mini": { variantId: 76612, price: 24.95 },
      "iPhone 13 Pro": { variantId: 76613, price: 24.95 },
      "iPhone 13 Pro Max": { variantId: 76614, price: 24.95 },
      "iPhone 14": { variantId: 93905, price: 24.95 },
      "iPhone 14 Pro": { variantId: 93906, price: 24.95 },
      "iPhone 14 Pro Max": { variantId: 93907, price: 24.95 },
      "iPhone 14 Plus": { variantId: 93908, price: 24.95 },
      "iPhone 15": { variantId: 103561, price: 24.95 },
      "iPhone 15 Pro": { variantId: 103562, price: 24.95 },
      "iPhone 15 Plus": { variantId: 103563, price: 24.95 },
      "iPhone 15 Pro Max": { variantId: 103564, price: 24.95 },
      "Samsung Galaxy S24": { variantId: 105527, price: 24.95 },
      "Samsung Galaxy S23": { variantId: 105528, price: 24.95 },
      "Samsung Galaxy S22": { variantId: 105529, price: 24.95 },
      "Samsung Galaxy S21": { variantId: 105530, price: 24.95 },
      "iPhone 16 Pro": { variantId: 112812, price: 24.95 },
      "iPhone 16 Pro Max": { variantId: 112813, price: 24.95 },
      "iPhone 16": { variantId: 112814, price: 24.95 },
      "iPhone 16 Plus": { variantId: 112815, price: 24.95 },
      "Samsung Galaxy S25": { variantId: 125531, price: 24.95 },
      "iPhone 17": { variantId: 130115, price: 24.95 },
      "iPhone 17 Pro": { variantId: 130116, price: 24.95 },
      "iPhone 17 Pro Max": { variantId: 130117, price: 24.95 },
      "iPhone 17 Air": { variantId: 130118, price: 24.95 },
      "Samsung Galaxy S26": { variantId: 254190, price: 24.95 }
    },
    // Only one visual finish per model (glossy) — no separate color
    // picker. Model selection itself is effectively the "variant" choice.
    colors: null,
    // NOTE: no printDimensions listed on purpose, same reasoning as
    // suitcase — print size differs by model, and create-printify-order.js's
    // single-image handler already fetches the correct dimensions live
    // from Printify using whichever model's variantId gets resolved.
    shippingSeparate: true
  },

  "suitcase": {
    displayName: "Suitcase",
    generatorIcon: "suitcase", // NOTE: no generator icon exists for this yet — needs a new Product card button on index.html before this is orderable end-to-end.
    layoutType: "single-image",
    // CONFIRMED via real Printify product page — "Suitcase," hard-shell,
    // canvas print encapsulated under polycarbonate front.
    blueprintId: 624,
    printProviderId: 81,
    // Pricing rule (Alyx + Bud, July 2026): profit is TIERED by size, not
    // a percentage — Small +$25, Medium +$30, Large +$35 — then rounded
    // UP to the nearest .95. No inventory risk + Printify Merchant
    // Protection covers full value on damage/loss (confirmed via
    // Printify support directly), so this is treated as low-risk margin.
    sizes: {
      "Small": {
        variantId: 72133,
        price: 169.95 // CONFIRMED: base cost $144.93 + $25 profit, rounded to .95
      },
      "Medium": {
        variantId: 79350,
        price: 194.95 // base cost $162.64; Alyx set final price
      },
      "Large": {
        variantId: 79351,
        price: 214.95 // base cost $180.35; Alyx set final price
      }
    },
    // Only one color exists for this blueprint (Black) — no color picker needed.
    colors: null,
    // NOTE: no printDimensions listed here on purpose. Unlike other
    // products, this one's print size genuinely differs by chosen size
    // (Small/Medium/Large), and create-printify-order.js's single-image
    // handler already falls back to fetching the real dimensions live
    // from Printify (using whichever variant the size selection resolves
    // to) whenever printDimensions.front isn't present. That live lookup
    // is correct here — don't add a flat printDimensions.front value,
    // it would silently apply the wrong size's dimensions.
    shippingSeparate: true
  },

  "travel-mug-40oz-insulated": {
    displayName: "Insulated Travel Mug, 40oz",
    generatorIcon: "bottle",
    layoutType: "front-back",
    blueprintId: 1498,
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
    shippingSeparate: true
  },

  "travel-mug-20oz": {
    displayName: "Travel Mug, 20oz",
    generatorIcon: "bottle",
    layoutType: "front-back",
    blueprintId: 1513,
    printProviderId: 217,
    sizes: {
      "20oz": { price: 34.95 } // variant chosen via color below, not a separate size picker
    },
    colors: [
      { name: "White",        hex: "#FFFFFF", variantId: 109113 },
      { name: "Black",        hex: "#1c1c1c", variantId: 109101 },
      { name: "Navy",         hex: "#1B3D7A", variantId: 109107 },
      { name: "Royal",        hex: "#2255A4", variantId: 109111 },
      { name: "Light Blue",   hex: "#5FA8DE", variantId: 109104 },
      { name: "Teal",         hex: "#1F9E8E", variantId: 109112 },
      { name: "Green",        hex: "#1F7A45", variantId: 109103 },
      { name: "Olive Green",  hex: "#6B8E23", variantId: 109100 },
      { name: "Dark Gray",    hex: "#4a4a4a", variantId: 109098 },
      { name: "Maroon",       hex: "#7A1F2B", variantId: 109106 },
      { name: "Red",          hex: "#D62828", variantId: 109110 },
      { name: "Coral",        hex: "#F08070", variantId: 109102 },
      { name: "Orange",       hex: "#F0701A", variantId: 109108 },
      { name: "Pink",         hex: "#E0457B", variantId: 109109 },
      { name: "Dark Purple",  hex: "#4B2E5A", variantId: 109099 },
      { name: "Light Purple", hex: "#8E3FC9", variantId: 109105 },
      { name: "Yellow",       hex: "#F0D43A", variantId: 109114 }
    ],
    printDimensions: { front: { width: 900, height: 1050 }, back: { width: 900, height: 1050 } },
    shippingSeparate: true
  },

  "travel-mug-14oz-handle": {
    displayName: "Travel Mug with Handle, 14oz",
    generatorIcon: "bottle",
    layoutType: "single-image",
    blueprintId: 1160,
    printProviderId: 28,
    sizes: {
      "14oz": { variantId: 88210, price: 34.95 }
    },
    colors: null,
    printDimensions: { front: { width: 1995, height: 930 } },
    shippingSeparate: true
  }

};

// Small helper: look up a product's full config by its key. Returns
// undefined if the key doesn't exist — callers should handle that.
export function getProduct(productKey) {
  return PRODUCTS_CATALOG[productKey];
}

// Small helper: list every product tied to a given generator icon
// (e.g. "bottle" currently maps to two different travel mug products).
// Useful for building the style-picker UI on a generic order page.
export function getProductsByIcon(iconName) {
  return Object.entries(PRODUCTS_CATALOG)
    .filter(([key, product]) => product.generatorIcon === iconName)
    .map(([key, product]) => ({ key, ...product }));
}
