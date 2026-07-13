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
// shippingCost (added July 2026): the REAL cost Printify charges us to
// ship this product, in dollars. Used by create-checkout-session.js's
// calculateShippingCharge() to charge the customer Printify's real cost
// (plus 10% markup once the item's base price hits $50+). EVERY value
// below is a PLACEHOLDER (0) — replace each with a real number pulled
// from Printify's dashboard (Products → pick blueprint/provider →
// shipping) or the Shipping Rates API before this goes live. Until
// real numbers are in, checkout is charging $0 shipping on every order.

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
    shippingCost: 0 // TODO: real Printify shipping cost — Classic White mug
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
    shippingCost: 0 // TODO: real Printify shipping cost — Color Pop mug
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
        // FIXED: this size was missing the "colors: [" opener entirely,
        // which broke the whole file's syntax. NOTE: it's also missing
        // a "Black" entry that the 11oz list has — Alyx should confirm
        // whether 15oz Trimmed is genuinely supposed to skip Black, or
        // whether that entry was lost along with the bracket.
        colors: [
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
    shippingSeparate: true,
    shippingCost: 0 // TODO: real Printify shipping cost — Trimmed mug
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
        // FIXED: same missing "colors: [" issue as Trimmed 15oz above —
        // also missing a "Black" entry, same flag applies.
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
          { name: "Light Blue", hex: "#5FA8DE", variantId: 148147 }
        ]
      },
      "15oz": {
        price: 19.95,
        // FIXED: same missing "colors: [" issue, same flag applies.
        colors: [
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
    shippingSeparate: true,
    shippingCost: 0 // TODO: real Printify shipping cost — Accented mug
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
    shippingCost: 0 // TODO: real Printify shipping cost — Tote Bag
  },

  "phone-case-tough": {
    displayName: "Tough Phone Case",
    generatorIcon: "phone case",
    layoutType: "single-image",
    blueprintId: 269,
    printProviderId: 1,
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
    colors: null,
    shippingSeparate: true,
    shippingCost: 0 // TODO: real Printify shipping cost — Phone Case
  },

  "photo-poster": {
    displayName: "Photo/Poster",
    generatorIcon: "photo poster",
    layoutType: "single-image",
    flowType: "choose-first",
    base: {
      blueprintId: 1079,
      printProviderId: null,
      finishes: ["Glossy", "Matte"],
      sizes: {
        "16x20": {
          orientations: ["Horizontal", "Vertical"],
          price: 12.95,
          aspectRatio: 1.25,
          variantIds: { horizontalGlossy: null, horizontalMatte: null, verticalGlossy: null, verticalMatte: null }
        },
        "20x24": {
          orientations: ["Horizontal", "Vertical"],
          price: 13.95,
          aspectRatio: 1.2,
          variantIds: { horizontalGlossy: null, horizontalMatte: null, verticalGlossy: null, verticalMatte: null }
        },
        "20x30": {
          orientations: ["Horizontal", "Vertical"],
          price: 15.95,
          aspectRatio: 1.5,
          variantIds: { horizontalGlossy: null, horizontalMatte: null, verticalGlossy: null, verticalMatte: null }
        }
      }
    },
    framedUpsell: {
      blueprintId: 492,
      printProviderId: 36,
      domesticFulfillment: false,
      frameColors: ["Black", "White"],
      sizes: {
        "8x11": {
          price: 35.95,
          aspectRatio: 1.375,
          colors: [
            { name: "Black", hex: "#1c1c1c", variantId: 66164 },
            { name: "White", hex: "#FFFFFF", variantId: 66165 }
          ]
        },
        "11x14": {
          price: 39.95,
          aspectRatio: 1.2727,
          colors: [
            { name: "Black", hex: "#1c1c1c", variantId: 65400 },
            { name: "White", hex: "#FFFFFF", variantId: 65401 }
          ]
        },
        "12x18": {
          price: 44.95,
          aspectRatio: 1.5,
          colors: [
            { name: "Black", hex: "#1c1c1c", variantId: 65402 },
            { name: "White", hex: "#FFFFFF", variantId: 65403 }
          ]
        },
        "16x20": {
          price: 53.95,
          aspectRatio: 1.25,
          colors: [
            { name: "Black", hex: "#1c1c1c", variantId: 66226 },
            { name: "White", hex: "#FFFFFF", variantId: 66228 }
          ]
        },
        "18x24": {
          price: 61.95,
          aspectRatio: 1.333,
          colors: [
            { name: "Black", hex: "#1c1c1c", variantId: 65406 },
            { name: "White", hex: "#FFFFFF", variantId: 65407 }
          ]
        },
        "20x30": {
          price: 73.95,
          aspectRatio: 1.5,
          colors: [
            { name: "Black", hex: "#1c1c1c", variantId: 66227 },
            { name: "White", hex: "#FFFFFF", variantId: 66229 }
          ]
        },
        "24x36": {
          price: 93.95,
          aspectRatio: 1.5,
          colors: [
            { name: "Black", hex: "#1c1c1c", variantId: 65410 },
            { name: "White", hex: "#FFFFFF", variantId: 65411 }
          ]
        }
      },
      upsellEligibleFrom: ["16x20", "20x30"]
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0 // TODO: real Printify shipping cost — Photo/Poster (base, unframed). NOTE: framedUpsell likely has a DIFFERENT real shipping cost since it's a different blueprint/provider — may need a second shippingCost field nested under framedUpsell once real numbers are gathered.
  },

  "photo-puzzle": {
    displayName: "Photo Puzzle",
    generatorIcon: "puzzle",
    layoutType: "single-image",
    blueprintId: 596,
    printProviderId: 80,
    sizes: {
      "96 pcs": { variantId: 80317, price: 40.95 },
      "252 pcs": { variantId: 80318, price: 38.95 },
      "500 pcs": { variantId: 74740, price: 43.95 },
      "1000 pcs": { variantId: 74741, price: 43.95 }
    },
    colors: null,
    shippingSeparate: true,
    shippingCost: 0 // TODO: real Printify shipping cost — Photo Puzzle
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
    shippingCost: 0 // TODO: real Printify shipping cost — Suitcase. HIGH PRIORITY: this is the most expensive/heaviest product in the catalog, most likely to actually lose money if left at $0.
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
    shippingCost: 0 // TODO: real Printify shipping cost — Insulated Travel Mug 40oz
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
    shippingCost: 0 // TODO: real Printify shipping cost — Travel Mug 20oz
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
    shippingCost: 0 // TODO: real Printify shipping cost — Travel Mug 14oz with Handle
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
