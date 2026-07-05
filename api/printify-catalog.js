// Merged Printify catalog endpoint.
// Replaces check-existing-product.js and printify-variants.js.
//
// GET /api/printify-catalog?action=product  → returns a specific product's details
// GET /api/printify-catalog?action=variants&blueprintId=X&providerId=Y → returns variants

const SHOP_ID = "27439202";
const DEFAULT_PRODUCT_ID = "6a38968893a2ad63ed041050";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { action, blueprintId, providerId } = req.query;

  try {
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
