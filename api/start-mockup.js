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

// Starts a real-photo mockup job on Printify and returns immediately
// with a productId — it does NOT wait for the photo to be ready.
// The frontend polls check-mockup.js afterward to find out when it's done.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    return res.status(200).json({ productId });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
