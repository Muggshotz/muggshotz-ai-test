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
    shippingCost: 0, // TODO: real Printify shipping cost — Classic White mug
    // NEW (July 2026, Alyx's request): real profit per sale (retail
    // price minus what Printify actually charges to make this item),
    // NOT sale price and NOT a flat/percentage guess. This is what the
    // flyer/tier affiliate program's commission is calculated against
    // once that system goes live — a product with $0 here simply won't
    // generate commission yet, by design, until a real number is filled
    // in. Doesn't affect selling this product normally in the meantime.
    estimatedProfit: 0 // TODO: real estimated profit — Classic White mug
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
    shippingCost: 0, // TODO: real Printify shipping cost — Color Pop mug
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Color Pop mug. See Classic White's note above for what this field is for.
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
    shippingCost: 0, // TODO: real Printify shipping cost — Trimmed mug
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Trimmed mug
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
    shippingCost: 0, // TODO: real Printify shipping cost — Accented mug
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Accented mug
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
    shippingCost: 0, // TODO: real Printify shipping cost — Tote Bag
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Tote Bag
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
    shippingCost: 0, // TODO: real Printify shipping cost — Phone Case
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Phone Case
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
    shippingCost: 0, // TODO: real Printify shipping cost — Photo Puzzle
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Photo Puzzle
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
    shippingCost: 0, // TODO: real Printify shipping cost — Suitcase. HIGH PRIORITY: this is the most expensive/heaviest product in the catalog, most likely to actually lose money if left at $0.
    // HIGH PRIORITY (same reasoning as shippingCost above): this is
    // the highest-ticket item in the catalog, and Alyx has already
    // confirmed its markup is NOT proportional to its wholesale cost
    // the way smaller items are — a real number here matters a lot
    // before flyer commissions ever get calculated against it.
    estimatedProfit: 0 // TODO: real estimated profit — Suitcase
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
    shippingSeparate: true,
    shippingCost: 0, // TODO: real Printify shipping cost — Insulated Travel Mug 40oz
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Insulated Travel Mug 40oz
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
      "20oz": { price: 34.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // TODO: real Printify shipping cost — Travel Mug 20oz
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Travel Mug 20oz
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
    shippingSeparate: true,
    shippingCost: 0, // TODO: real Printify shipping cost — Travel Mug 14oz with Handle
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Travel Mug 14oz with Handle
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
      // TODO — price is a placeholder matching the other travel mugs'
      // pricing tier, not a real decision. Alyx should set the real
      // retail price before this goes live.
      "32oz": { price: 34.95 }
    },
    // CONFIRMED (Aug 2026, via multiple independent Printify seller
    // listings for this exact blueprint): single color only, no color
    // picker needed.
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // TODO: real Printify shipping cost — Gator Tumbler 32oz
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Gator Tumbler 32oz
  },

  "travel-mug-30oz-tundra": {
    displayName: "Tundra Tumbler, 30oz",
    generatorIcon: "bottle",
    layoutType: "single-image",
    blueprintId: 1662,
    // Provider is "Chill" — same company as the Gator Tumbler above, so
    // using that same confirmed ID (86). NOTE: this is a reasonable
    // inference (a print provider's ID is tied to the company, not the
    // blueprint, in Printify's system), not independently confirmed for
    // THIS specific blueprint the hard way. Worth a quick real check via
    // the same Portal-relay URL trick before this goes live, just to be
    // certain: /api/admin?action=printify-catalog&path=catalog/blueprints/1662/print_providers.json
    printProviderId: 86,
    // CONFIRMED (Aug 2026, direct from a real Printify listing for this
    // exact blueprint): print area is 3634 x 1039 px @ 300 DPI — one
    // single wide wraparound panel, same category as the 20oz/14oz.
    printDimensions: { front: { width: 3634, height: 1039 } },
    sizes: {
      // TODO — price is a placeholder, not a real pricing decision.
      "30oz": { price: 34.95 }
    },
    // White only, on purpose — the stainless-steel color options on this
    // blueprint are most likely laser-engraving-only (same category of
    // dead end as the 40oz BrüMate), while white is confirmed
    // sublimation-safe for full-color prints (multiple independent
    // listings for white 30oz sublimation tumblers, same shape/capacity).
    // Not offering colors here avoids exposing an option that might
    // silently fail or need a totally different (engraving) workflow.
    colors: null,
    shippingSeparate: true,
    shippingCost: 0, // TODO: real Printify shipping cost — Tundra Tumbler 30oz
    estimatedProfit: 0 // TODO: real estimated profit (retail minus Printify cost) — Tundra Tumbler 30oz
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
      "40oz": { price: 24.95 }
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
    // Probed 2026-08-27. shippingCost stays 0 because it is only a FALLBACK
    // — real shipping is looked up live per destination at checkout — but
    // the probed US number is recorded here because it is unusually high
    // and shapes the pricing above: $19.39 first item, $17.99 additional,
    // against $7.59/$2.99 for the insulated 40oz. On a $24.95 tumbler the
    // customer sees shipping at 78% of the product price. The all-in total
    // still beats our current 40oz by $8.20, but the optics are real.
    shippingCost: 0,
    estimatedProfit: 9.58
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
