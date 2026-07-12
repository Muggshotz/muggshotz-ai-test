export const config = {
  maxDuration: 60,
};

import { getProduct } from "../lib/products-catalog.js";
import {
  uploadImageToPrintify,
  getPlaceholderDimensions,
  buildWraparoundImage,
  buildFullBleedImage,
  buildSeamlessWrapImage,
  buildFrontBackImages,
  buildSingleImage,
  resolveVariant,
  resolvePhotoPosterSelection,
  resolveVariantIdByTitleMatch,
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

async function handleStart(req, res) {
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
  } else if (productKey === "travel-mug-20oz") {
    // UPDATED (July 2026): matches the same special-case in
    // create-printify-order.js — this blueprint has one orderable
    // variant with no hardcoded ID in the catalog, resolved live by name.
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
    variantId = await resolveVariantIdByTitleMatch(effectiveBlueprintId, effectivePrintProviderId, [sizeLabel]);
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
    // Matches create-printify-order.js's split — "fullBleed" (Wraparound
    // scene-continuation, no cropping) vs "allCup" (reserved for the
    // future Ewww Stew overflow line). See buildSeamlessWrapImage's
    // comment there for why these must stay separate.
    const isSeamlessWrap = printMode === "fullBleed";
    const isFullBleed = printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      product.blueprintId, product.printProviderId, variantId
    );
    const buffer = isFullBleed
      ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
      : isSeamlessWrap
      ? await buildSeamlessWrapImage(placements.front || placements.left || placements.right, width, height)
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

  // RESOLVED — matches placeProductOrder's logic in
  // create-printify-order.js, so the preview accurately reflects what a
  // real order would actually look like.
  const isCoffeeMug = product.layoutType === "three-slot-wrap";
  const imageScale = isCoffeeMug ? 1 : 1;
  const imageY = isCoffeeMug ? 0.58 : 0.5;

  const { productId } = await createPrintifyProduct(
    printifyImages,
    { blueprintId: effectiveBlueprintId, printProviderId: effectivePrintProviderId, displayName: product.displayName },
    variantId,
    `[PREVIEW - DELETE] Muggshotz ${product.displayName} mockup`,
    imageScale,
    imageY
  );

  return res.status(200).json({ productId });
}

async function handleCheck(req, res) {
  const { productId } = req.body;
  if (!productId) throw new Error("productId is required.");

  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`, {
    headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
  });
  const data = await response.json();

  const hasImages = response.ok && Array.isArray(data.images) && data.images.length > 0;
  // Printify often photographs a single wraparound print from several
  // camera angles (front, and a couple of side/turned views) — return
  // all of them so a multi-angle product (coffee mugs) can show more
  // than just the first shot instead of throwing the rest away.
  const mockupUrls = hasImages ? data.images.map(img => img.src) : [];
  const mockupUrl = mockupUrls[0] || null;

  if (mockupUrl) {
    deletePrintifyProduct(productId).catch(() => {});
    return res.status(200).json({ ready: true, mockupUrl, mockupUrls });
  }

  return res.status(200).json({ ready: false });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (req.body.action === "check") {
      return await handleCheck(req, res);
    }
    return await handleStart(req, res);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
