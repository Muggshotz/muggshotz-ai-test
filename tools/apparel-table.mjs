// Prints the studio's and the order page's APPAREL table from the catalog:
//   node tools/apparel-table.mjs
// Paste its output over `const APPAREL=` in needles-studio.html and order.html
// whenever a garment or a price changes; flow-tests/verify-apparel.js fails
// until the three agree.
import { PRODUCTS_CATALOG } from "../lib/products-catalog.js";
const PICS = { "unisex-tshirt": "tshirt" };
const BLURB = {
  "unisex-tshirt": "Classic heavy cotton tee.",
  "apparel-premium-tee": "Softer, lighter cotton tee.",
  "apparel-garment-dyed-tee": "Heavyweight, washed-in colour.",
  "apparel-womens-tee": "Slim fit.",
  "apparel-long-sleeve": "Heavy cotton, long sleeves.",
  "apparel-tank": "Heavy cotton tank.",
  "apparel-kids-tee": "Kids sizes XS–XL.",
  "apparel-crewneck": "Heavy blend fleece.",
  "apparel-hoodie": "Heavy blend pullover hoodie.",
  "apparel-youth-hoodie": "Youth sizes S–XL.",
  "apparel-zip-hoodie": "Full-zip hoodie."
};
const out = {};
for (const [key, p] of Object.entries(PRODUCTS_CATALOG)) {
  if (key !== "unisex-tshirt" && !key.startsWith("apparel-")) continue;
  const sizes = {}, colors = [], extra = {};
  for (const [s, e] of Object.entries(p.sizes)) {
    sizes[s] = e.price;
    for (const c of e.colors) {
      if (!colors.some((x) => x.name === c.name)) colors.push({ name: c.name, hex: c.hex });
      if (typeof c.price === "number") extra[s + "|" + c.name] = c.price;
    }
  }
  out[key] = { label: p.displayName, brand: p.apparelLabel, pic: "art/options/" + (PICS[key] || key) + ".jpg", blurb: BLURB[key] || "", sizes, colors, ...(Object.keys(extra).length ? { colorPrices: extra } : {}) };
}
console.log("const APPAREL=" + JSON.stringify(out) + ";");
