export const config = {
  maxDuration: 30,
};

import { getProduct } from "../lib/products-catalog.js";
import {
  uploadImageToPrintify,
  getPlaceholderDimensions,
  buildWraparoundImage,
  buildFullBleedImage,
  buildFrontBackImages,
  buildSingleImage,
  resolveVariant,
  resolvePhotoPosterSelection,
  createPrintifyProduct
} from "./create-printify-order.js";

const SHOP_ID = "27439202";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let tempProductId = null;

  try {
    const {
      productKey, sizeLabel, colorName, placements,
      frontImage, backImage, image,
      printMode = "standard",
      posterFramed, posterOrientation, posterFinish
    } = req.body;

    const product = getProduct(productKey);
    if (!product) throw new Error(`Unknown product: "${productKey}"`);

    let variantId, effectiveBlueprintId, effectivePrintProviderId;

    if (productKey === "photo-poster") {
      const resolved = await resolvePhotoPosterSelection(product, {
        framed: !!posterFramed, sizeLabel, orientation: posterOrientation, finish: posterFinish, frameColor: colorName
      });
      variantId = resolved.variantId;
      effectiveBlueprintId = resolved.blueprintId;
      effectivePrintProviderId = resolved.printProviderId;
    } else {
      ({ variantId } = resolveVariant(product, sizeLabel, colorName));
      effectiveBlueprintId = product.blueprintId;
      effectivePrintProviderId = product.printProviderId;
    }

    let printifyImages = {};

    if (product.layoutType === "three-slot-wrap") {
      if (!placements || !(placements.left || placements.front || placements.right)) {
        throw new Error("At least one design is required to generate a mockup.");
      }
      const isFullBleed = printMode === "fullBleed" || printMode === "allCup";
      const { width, height, position } = await getPlaceholderDimensions(
        product.blueprintId, product.printProviderId, variantId
      );
      const buffer = isFullBleed
        ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
        : await buildWraparoundImage(placements, width, height);
      const imageId = await uploadImageToPrintify(buffer, `muggshotz-mockup-preview-${Date.now()}.png`);
      printifyImages[position] = imageId;

    } else if (product.layoutType === "front-back") {
      if (!frontImage && !backImage) throw new Error("At least a front or back image is required.");
      const frontDims = product.printDimensions?.front;
      const backDims = product.printDimensions?.back;
      const { frontBuf, backBuf } = await buildFrontBackImages(frontImage, backImage, frontDims, backDims);
      if (frontBuf) printifyImages["mug_front"] = await uploadImageToPrintify(frontBuf, `muggshotz-mockup-front-${Date.now()}.png`);
      if (backBuf) printifyImages["mug_back"] = await uploadImageToPrintify(backBuf, `muggshotz-mockup-back-${Date.now()}.png`);

    } else if (product.layoutType === "single-image") {
      if (!image) throw new Error("An image is required to generate a mockup.");
      const dims = product.printDimensions?.front;
      const { width, height, position } = dims
        ? { ...dims, position: "front" }
        : await getPlaceholderDimensions(effectiveBlueprintId, effectivePrintProviderId, variantId);
      const buffer = await buildSingleImage(image, width, height);
      printifyImages[position] = await uploadImageToPrintify(buffer, `muggshotz-mockup-preview-${Date.now()}.png`);

    } else {
      throw new Error("Real-photo mockups aren't available for this product type yet.");
    }

    const { productId } = await createPrintifyProduct(
      printifyImages,
      { blueprintId: effectiveBlueprintId, printProviderId: effectivePrintProviderId, displayName: product.displayName },
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
