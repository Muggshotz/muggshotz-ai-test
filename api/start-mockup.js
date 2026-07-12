export const config = {
  maxDuration: 60,
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

  } else if (product.layoutType
