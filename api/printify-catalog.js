// Merged Printify catalog endpoint.
// Replaces check-existing-product.js and printify-variants.js.
//
// GET /api/printify-catalog?action=product  → returns a specific product's details
// GET /api/printify-catalog?action=variants&blueprintId=X&providerId=Y → returns variants
// GET /api/printify-catalog?action=search&keyword=tumbler → searches all blueprints by keyword
// GET /api/printify-catalog?action=providers&blueprintId=X → lists valid print providers for a blueprint
// GET /api/printify-catalog?action=shipping&productKey=mouse-pad&basePrice=9.95&country=US
//     → { shipping: 5.14, shippingSeparate: true, source: "live" }
//
// The shipping action lives HERE, not in its own api/get-shipping.js,
// because Vercel's Hobby plan caps a deployment at 12 serverless
// functions and this project already sits at exactly 12. A 13th file in
// api/ makes every build fail and Vercel silently keeps serving the last
// good deployment (that is what happened Sep 2026: the shipping fix was
// on main but the site kept showing $6.95). Do not add files to api/.
import { getProduct } from "../lib/products-catalog.js";
import { calculateShippingCharge } from "../lib/printify-shipping.js";

const SHOP_ID = "27439202";
const DEFAULT_PRODUCT_ID = "6a38968893a2ad63ed041050";
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { action, blueprintId, providerId } = req.query;
  try {
    if (action === "shipping") {
      // Real shipping charge for a product + destination, from the exact
      // same function create-checkout-session.js bills with
      // (calculateShippingCharge in lib/printify-shipping.js). order.html's
      // Order Summary calls this so display and charge cannot drift apart
      // again. PRINTIFY_API_TOKEN never leaves the server.
      //
      // On any failure this returns HTTP 200 with source:"error" and
      // shipping:null, so the page falls back to its own estimate rather
      // than showing the customer a broken summary.
      const productKey = (req.query.productKey || "").trim();
      if (!productKey) return res.status(400).json({ error: "productKey is required." });
      const product = getProduct(productKey);
      if (!product) return res.status(404).json({ error: `Unknown product: ${productKey}` });

      // Products that don't ship separately have shipping baked into the
      // retail price -- same rule the checkout session applies.
      if (!product.shippingSeparate) {
        return res.status(200).json({ shipping: 0, shippingSeparate: false, source: "included" });
      }

      const basePrice = Number(req.query.basePrice);
      const price = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 0;
      const countryCode = ((req.query.country || "US").trim().toUpperCase()) || "US";

      try {
        const shipping = await calculateShippingCharge(product, price, countryCode);
        return res.status(200).json({ shipping, shippingSeparate: true, source: "live" });
      } catch (err) {
        console.error("shipping quote failed:", err.message);
        return res.status(200).json({ shipping: null, source: "error" });
      }
    }
    if (action === "providers") {
      if (!blueprintId) return res.status(400).json({ error: "blueprintId is required." });
      const response = await fetch(
        `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers.json`,
        { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
      );
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }
    if (action === "search") {
      const keyword = (req.query.keyword || "").toLowerCase();
      if (!keyword) return res.status(400).json({ error: "keyword is required." });
      const response = await fetch("https://api.printify.com/v1/catalog/blueprints.json", {
        headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      const matches = data.filter(bp =>
        (bp.title || "").toLowerCase().includes(keyword) ||
        (bp.description || "").toLowerCase().includes(keyword)
      );
      return res.status(200).json({ total_matches: matches.length, blueprints: matches });
    }
    if (action === "variants") {
      if (!blueprintId || !providerId)
        return res.status(400).json({ error: "blueprintId and providerId are required." });
      const response = await fetch(
        `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`,
        { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
      );
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }
    // Default: return existing product details (action=product or no action)
    const productId = req.query.productId || DEFAULT_PRODUCT_ID;
    const response = await fetch(
      `https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`,
      { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
    );
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json({
      title: data.title,
      blueprint_id: data.blueprint_id,
      print_provider_id: data.print_provider_id,
      variants: data.variants,
      print_areas: data.print_areas
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
