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

  "accented-mug": {
    displayName: "Accented",
    generatorIcon: "mug",
    layoutType: "three-slot-wrap",
    // CONFIRMED via real Printify product page (screenshot) + live variant
    // lookup — "Accent Rim & Handle Mug." Trimmed is still unconfirmed;
    // do not assume it shares this blueprint until verified the same way.
    blueprintId: 2692,
    printProviderId: 59,
    sizes: {
      "11oz": {
        price: 24.95, // placeholder — confirm real pricing before going live
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
