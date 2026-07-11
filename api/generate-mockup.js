import { getProduct } from "../lib/products-catalog.js";
import {
  uploadImageToPrintify,
  getPlaceholderDimensions,
  buildWraparoundImage,
  buildFullBleedImage,
  resolveVariant,
  createPrintifyProduct
} from "./create-printify-order.js";

const SHOP_ID = "27439202";

// Deletes the temporary draft product. Fire-and-forget from the
// caller's point of view is tempting, but we await it so a failed
// delete shows up in logs instead of silently leaving drafts behind
// in the Printify dashboard.
async function deletePrintifyProduct(productId) {
  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.error(`Failed to delete temporary mockup product ${productId}:`, data);
  }
}

// Printify generates real product photos asynchronously after a
// product is created — they're not always ready instantly. Polls the
// product a few times, waiting for at least one non-empty mockup image.
async function waitForMockupImages(productId, attempts = 6, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`, {
      headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
    });
    const data = await response.json();
    if (response.ok && Array.isArray(data.images) && data.images.length > 0) {
      return data.images;
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return [];
}

// ===== MAIN ENTRY POINT =====
// Coffee mugs only for now (three-slot-wrap layout) — this is the
// product with the generic SVG illustration Alyx flagged as the
// priority to replace with a real photo. Other layout types can be
// added here the same way once this pattern is proven out.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let tempProductId = null;

  try {
    const { productKey, sizeLabel, colorName, placements, printMode = "standard" } = req.body;

    const product = getProduct(productKey);
    if (!product) throw new Error(`Unknown product: "${productKey}"`);
    if (product.layoutType !== "three-slot-wrap") {
      throw new Error("Real-photo mockups are only available for coffee mugs right now.");
    }
    if (!placements || !(placements.left || placements.front || placements.right)) {
      throw new Error("At least one design is required to generate a mockup.");
    }

    const { variantId } = resolveVariant(product, sizeLabel, colorName);

    const isFullBleed = printMode === "fullBleed" || printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      product.blueprintId, product.printProviderId, variantId
    );
    const buffer = isFullBleed
      ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
      : await buildWraparoundImage(placements, width, height);

    const imageId = await uploadImageToPrintify(buffer, `muggshotz-mockup-preview-${Date.now()}.png`);

    const { productId } = await createPrintifyProduct(
      { [position]: imageId },
      { blueprintId: product.blueprintId, printProviderId: product.printProviderId, displayName: product.displayName },
      variantId,
      `[PREVIEW - DELETE] Muggshotz ${product.displayName} mockup`
    );
    tempProductId = productId;

    const images = await waitForMockupImages(productId);
    const mockupUrl = images[0]?.src || null;

    if (!mockupUrl) {
      throw new Error("Printify didn't return a mockup photo in time — try again in a moment.");
    }

    return res.status(200).json({ mockupUrl });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    if (tempProductId) {
      await deletePrintifyProduct(tempProductId);
    }
  }
}
