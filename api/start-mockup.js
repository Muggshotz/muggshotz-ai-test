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

  let variantId, hex, effectiveBlueprintId, effectivePrintProviderId;

  if (productKey === "photo-poster") {
    const resolved = await resolvePhotoPosterSelection(product, {
      framed: !!posterFramed, sizeLabel, orientation: posterOrientation, finish: posterFinish, frameColor: colorName
    });
    variantId = resolved.variantId;
    effectiveBlueprintId = resolved.blueprintId;
    effectivePrintProviderId = resolved.printProviderId;
  } else if (productKey === "travel-mug-20oz") {
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
    variantId = await resolveVariantIdByTitleMatch(effectiveBlueprintId, effectivePrintProviderId, [sizeLabel]);
  } else {
    ({ variantId, hex } = await resolveVariant(product, sizeLabel, colorName));
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
  }

  let printifyImages = {};

  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right)) {
      throw new Error("At least one design is required to generate a mockup.");
    }
    const isSeamlessWrap = printMode === "fullBleed";
    const isFullBleed = printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      product.blueprintId, product.printProviderId, variantId
    );
    const buffer = isFullBleed
      ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
      : isSeamlessWrap
      ? await buildSeamlessWrapImage(placements, width, height)
      : await buildWraparoundImage(placements, width, height, hex || null);
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

  const isCoffeeMug = product.layoutType === "three-slot-wrap";
  const isTravelMug20oz = productKey === "travel-mug-20oz";
  // UPDATED (Aug 2026, Alyx's request): pushed from 1 (100%) to 1.05
  // (105%) for coffee mugs specifically -- Printify's placement API
  // genuinely supports scale >1, which zooms the design in relative to
  // the print area (anything past the boundary gets cropped, rest
  // renders larger, same mechanism as manually zooming in Printify's
  // own placement editor). Reversible if this doesn't hold up -- see
  // the July 2026 comment on createPrintifyProduct in
  // create-printify-order.js for the earlier over-tight-cropping
  // history this is deliberately pushing back against.
  // REVERTED (Aug 2026): see the matching comment in
  // create-printify-order.js -- zoom now lives per-panel inside
  // buildWraparoundImage(), not as a uniform whole-canvas scale here.
  const imageScale = 1;
  const imageY = isCoffeeMug ? 0.5 : 0.5;

  const { productId } = await createPrintifyProduct(
    printifyImages,
    { blueprintId: effectiveBlueprintId, printProviderId: effectivePrintProviderId, displayName: product.displayName },
    variantId,
    `[PREVIEW - DELETE] Muggshotz ${product.displayName} mockup`,
    imageScale,
    imageY
  );

  return res.status(200).json({ productId, variantId });
}

async function handleCheck(req, res) {
  const { productId, variantId } = req.body;
  if (!productId) throw new Error("productId is required.");

  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`, {
    headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
  });
  const data = await response.json();

  const hasImages = response.ok && Array.isArray(data.images) && data.images.length > 0;
  const allImages = hasImages ? data.images : [];
  // FIXED (Aug 2026): previously took allImages[0] unconditionally, with
  // no check that the returned image was actually generated for the
  // variant (color) the customer picked. Printify's images array isn't
  // guaranteed to put the requested variant's mockup first, so this
  // could silently hand back a mismatched-color photo (found via a real
  // Cambridge Blue order showing a solid-blue physical mug). Now: if we
  // know which variantId we asked for, only accept an image that lists
  // it in that image's own variant_ids. Falls back to the old
  // take-the-first behavior only if we have no variantId to check
  // against, or nothing matches (better to show something than nothing).
  const matchedImages = variantId
    ? allImages.filter(img => Array.isArray(img.variant_ids) && img.variant_ids.includes(variantId))
    : [];
  const relevantImages = matchedImages.length ? matchedImages : allImages;
  const mockupUrls = relevantImages.map(img => img.src);
  const mockupUrl = mockupUrls[0] || null;

  // TEMPORARY DEBUG (Aug 2026): for diagnosing the Cambridge Blue
  // mismatch -- shows exactly what variant_ids Printify actually tagged
  // each returned image with, next to the variantId we requested, so we
  // can tell whether Printify never sends a real Cambridge Blue photo at
  // all vs. sends one mislabeled. Remove once that's confirmed.
  const debugImages = allImages.map(img => ({
    src: img.src,
    variant_ids: Array.isArray(img.variant_ids) ? img.variant_ids : []
  }));

  if (mockupUrl) {
    deletePrintifyProduct(productId).catch(() => {});
    return res.status(200).json({ ready: true, mockupUrl, mockupUrls, requestedVariantId: variantId || null, debugImages });
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
