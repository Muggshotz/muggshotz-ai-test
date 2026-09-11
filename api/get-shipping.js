// api/get-shipping.js
//
// Returns the REAL shipping charge for a product + destination country,
// using the exact same function create-checkout-session.js uses to bill
// it (calculateShippingCharge in lib/printify-shipping.js).
//
// This exists so order.html's Order Summary can stop guessing. It used a
// hardcoded $6.95 for every product while the server resolved the real
// Printify rate per product -- the mouse pad displayed $6.95 and charged
// $4.99. Display and charge now come from one function, so they cannot
// drift apart again.
//
// The PRINTIFY_API_TOKEN never leaves the server; the browser only ever
// sees a dollar amount.
//
// POST body:
//   { productKey: "mouse-pad", basePrice: 9.95, country: "US" }
//
// Response:
//   { shipping: 4.99, shippingSeparate: true, source: "live" }
//
// On any failure this returns HTTP 200 with source:"error" and
// shipping:null, so the caller can fall back to its own estimate
// rather than showing the customer a broken summary.

import { getProduct } from "../lib/products-catalog.js";
import { calculateShippingCharge } from "../lib/printify-shipping.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { productKey, basePrice, country } = req.body || {};

    if (!productKey) {
      return res.status(400).json({ error: "Missing productKey." });
    }

    const product = getProduct(productKey);
    if (!product) {
      return res.status(404).json({ error: `Unknown product: ${productKey}` });
    }

    // Products that don't ship separately have their shipping baked into
    // the retail price -- same rule the checkout session applies.
    if (!product.shippingSeparate) {
      return res.status(200).json({
        shipping: 0,
        shippingSeparate: false,
        source: "included"
      });
    }

    const price = typeof basePrice === "number" && basePrice > 0 ? basePrice : 0;
    const countryCode = (country || "US").trim().toUpperCase() || "US";

    const shipping = await calculateShippingCharge(product, price, countryCode);

    return res.status(200).json({
      shipping,
      shippingSeparate: true,
      source: "live"
    });
  } catch (err) {
    console.error("get-shipping failed:", err.message);
    // Deliberately a 200 with a null amount: the order page falls back to
    // its own estimate instead of rendering an error at the customer.
    return res.status(200).json({ shipping: null, source: "error" });
  }
}
