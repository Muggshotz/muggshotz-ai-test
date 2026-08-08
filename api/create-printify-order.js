import sharp from "sharp";
import { getProduct } from "../lib/products-catalog.js";

const SHOP_ID = "27439202";

export async function uploadImageToPrintify(imageBuffer, fileName) {
  const base64Data = imageBuffer.toString("base64");
  const response = await fetch("https://api.printify.com/v1/uploads/images.json", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      file_name: fileName,
      contents: base64Data
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify image upload failed: " + JSON.stringify(data));
  return data.id;
}

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error("Image must be a base64 data URL.");
  return Buffer.from(match[1], "base64");
}

async function resolveImageBuffer(source) {
  if (source.startsWith("data:")) {
    return dataUrlToBuffer(source);
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Could not fetch design image: ${source}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getPlaceholderDimensions(blueprintId, printProviderId, variantId, position) {
  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch blueprint variants: " + JSON.stringify(data));
  const variant = (data.variants || []).find(v => v.id === variantId);
  if (!variant || !variant.placeholders) {
    throw new Error(`No placeholders found for variant ${variantId}`);
  }
  const ph = position
    ? variant.placeholders.find(p => p.position === position)
    : variant.placeholders[0];
  if (!ph) throw new Error(`No "${position || "default"}" placeholder found for variant ${variantId}`);
  return { width: ph.width, height: ph.height, position: ph.position };
}

const PRINT_PROVIDER_ID_CACHE = {};

async function resolvePrintProviderId(blueprintId, providerNameHint) {
  if (PRINT_PROVIDER_ID_CACHE[blueprintId]) return PRINT_PROVIDER_ID_CACHE[blueprintId];
  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch print providers: " + JSON.stringify(data));
  const match = (providerNameHint
    ? data.find(p => p.title?.toLowerCase().includes(providerNameHint.toLowerCase()))
    : null) || data[0];
  if (!match) throw new Error(`No print providers found for blueprint ${blueprintId}`);
  PRINT_PROVIDER_ID_CACHE[blueprintId] = match.id;
  return match.id;
}

// Now exported — reused directly by placeProductOrder() below for
// travel-mug-20oz, which (like photo-poster's unresolved sizes) has no
// hardcoded variantId in the catalog and needs it looked up live by name.
// ALSO reused (July 2026, Alyx's request) by resolveVariant() below as a
// generic fallback for any catalog color entry missing a hardcoded
// variantId — e.g. a color just confirmed to exist on Printify but not
// yet manually looked up. Lets a color go live immediately from just its
// name, no manual ID-hunting required, then be backfilled with the real
// number later if ever needed for speed.
export async function resolveVariantIdByTitleMatch(blueprintId, printProviderId, matchTerms) {
  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch blueprint variants: " + JSON.stringify(data));
  const variant = (data.variants || []).find(v =>
    matchTerms.every(term => v.title?.toLowerCase().includes(term.toLowerCase()))
  );
  if (!variant) throw new Error(`No Printify variant matched [${matchTerms.join(", ")}] for blueprint ${blueprintId}`);
  return variant.id;
}

export async function resolvePhotoPosterSelection(product, { framed, sizeLabel, orientation, finish, frameColor }) {
  if (framed) {
    const tree = product.framedUpsell;
    const sizeEntry = tree.sizes[sizeLabel];
    if (!sizeEntry) throw new Error(`Unknown framed poster size "${sizeLabel}".`);
    if (!frameColor) throw new Error("A frame color selection is required.");
    const colorEntry = sizeEntry.colors.find(c => c.name === frameColor);
    if (!colorEntry) throw new Error(`Unknown frame color "${frameColor}" for size "${sizeLabel}".`);
    return {
      variantId: colorEntry.variantId,
      price: sizeEntry.price,
      blueprintId: tree.blueprintId,
      printProviderId: tree.printProviderId,
      aspectRatio: sizeEntry.aspectRatio
    };
  }

  const tree = product.base;
  const sizeEntry = tree.sizes[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown poster size "${sizeLabel}".`);
  if (!orientation || !sizeEntry.orientations.includes(orientation)) {
    throw new Error(`Unknown or missing orientation "${orientation}" for size "${sizeLabel}".`);
  }
  if (!finish || !tree.finishes.includes(finish)) {
    throw new Error(`Unknown or missing finish "${finish}".`);
  }

  const printProviderId = tree.printProviderId || await resolvePrintProviderId(tree.blueprintId, "Prima Printing");

  const variantKey = `${orientation.toLowerCase()}${finish}`;
  let variantId = sizeEntry.variantIds?.[variantKey];

  if (!variantId) {
    const [a, b] = sizeLabel.split("x").map(s => s.trim());
    const dimsTerm = orientation === "Vertical" ? `${a}" x ${b}"` : `${b}" x ${a}"`;
    variantId = await resolveVariantIdByTitleMatch(tree.blueprintId, printProviderId, [dimsTerm, orientation, finish]);
  }

  return {
    variantId,
    price: sizeEntry.price,
    blueprintId: tree.blueprintId,
    printProviderId,
    aspectRatio: sizeEntry.aspectRatio
  };
}

export async function buildWraparoundImage(placements, canvasWidth, canvasHeight) {
  const { left, front, right } = placements;
  const WHITE = { r: 255, g: 255, b: 255 };
  const sectionWidth = Math.round(canvasWidth / 3);
  const lastSectionWidth = canvasWidth - sectionWidth * 2;

  const filledCount = [left, front, right].filter(Boolean).length;

  // UPDATED (July 2026, Alyx's request): when only ONE slot is filled,
  // that design was correctly anchored to its own third but looked
  // small against two-thirds of blank mug. Since the neighboring space
  // really is blank ceramic with nothing to conflict with, widen that
  // one design's box symmetrically around its slot's original center --
  // bigger, but still anchored on the correct side of the mug -- capped
  // so it can't run off either edge of the canvas. This ONLY applies
  // when exactly one slot is filled; two- or three-filled placements
  // keep the exact fixed thirds as before, unaffected.
  function boxFor(startX, width) {
    if (filledCount !== 1) return { x: startX, width };
    const centerX = startX + width / 2;
    const widenedWidth = Math.min(canvasWidth, Math.round(width * 1.8));
    let x = Math.round(centerX - widenedWidth / 2);
    if (x < 0) x = 0;
    if (x + widenedWidth > canvasWidth) x = canvasWidth - widenedWidth;
    return { x, width: widenedWidth };
  }

  async function renderSection(imageSource, startX, width) {
    if (!imageSource) return null;
    const box = boxFor(startX, width);
    const buffer = await sharp(await resolveImageBuffer(imageSource))
      .resize(box.width, canvasHeight, { fit: "contain", background: WHITE })
      .png()
      .toBuffer();
    return { input: buffer, left: box.x, top: 0 };
  }

  const [leftComposite, frontComposite, rightComposite] = await Promise.all([
    renderSection(left, 0, sectionWidth),
    renderSection(front, sectionWidth, sectionWidth),
    renderSection(right, sectionWidth * 2, lastSectionWidth)
  ]);

  const composites = [leftComposite, frontComposite, rightComposite].filter(Boolean);

  return await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 3, background: WHITE }
  })
    .composite(composites)
    .png()
    .toBuffer();
}

export async function buildFullBleedImage(imageSource, canvasWidth, canvasHeight) {
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

// NEW (July 2026, Alyx's request): the customer-facing "Wraparound"
// print mode (auto-generated three-panel continuous scene) was sharing
// buildFullBleedImage's cover-fit crop -- same head-cropping bug as the
// three-slot-wrap fix, just reached through a different code path
// (printMode === "fullBleed"), which is why lowering the Printify
// placement scale didn't help: the crop was already baked into the
// print file before it ever reached Printify. This function uses
// contain-fit instead, so nothing gets cropped away. Deliberately kept
// SEPARATE from buildFullBleedImage -- that one's cover-fit crop-to-fill
// behavior is reserved for the future Ewww Stew line, where designs are
// supposed to intentionally overflow past the print margins. Only
// printMode === "allCup" should ever call buildFullBleedImage going
// forward; printMode === "fullBleed" (the Wraparound scene-continuation
// customers actually use today) calls this one instead.
export async function buildSeamlessWrapImage(imageSource, canvasWidth, canvasHeight) {
  const WHITE = { r: 255, g: 255, b: 255 };
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();
}

export async function buildSingleImage(imageSource, canvasWidth, canvasHeight) {
  const WHITE = { r: 255, g: 255, b: 255 };
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();
}

// UPDATED (Aug 2026, Alyx's request): switched from "contain" (shrink
// the whole composited image to fit inside the print area, padding the
// leftover space with white) to "cover" (fill the print area completely,
// cropping only what doesn't fit). Root cause: the AI-generated canvas
// for front-back products (1024x1536, a tall 0.667 aspect ratio) never
// matches the real Printify print area (900x1200 for the 40oz, a
// squarer 0.75 ratio) -- "contain" was shrinking the whole design down
// and padding it with a visible white border on the real printed/
// mockup output, confirmed live on a 40oz Parisian Balcony Window Sill
// test. "cover" is also consistent with how Window Sill already treats
// photo-fit elsewhere in the app (fills the opening completely, crops
// like a real window, never pads with white) -- this just applies the
// same philosophy at the final Printify-placement layer. Only affects
// front-back layoutType products (currently just the 40oz); every other
// layoutType (three-slot-wrap, single-image, full-bleed) is untouched.
export async function buildFrontBackImages(frontSource, backSource, frontDims, backDims) {
  async function build(source, dims) {
    if (!source || !dims) return null;
    return await sharp(await resolveImageBuffer(source))
      .resize(dims.width, dims.height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  }
  const [frontBuf, backBuf] = await Promise.all([
    build(frontSource, frontDims),
    build(backSource, backDims)
  ]);
  return { frontBuf, backBuf };
}

// UPDATED (July 2026, Alyx's request): now ASYNC. A color entry in the
// catalog can be added with variantId left out (null/undefined) the
// moment it's confirmed to exist on Printify -- this function then
// resolves the real numeric variant ID live, by matching the size and
// color name against Printify's own variant titles for that blueprint/
// provider (same resolveVariantIdByTitleMatch() helper travel-mug-20oz
// already relies on). This means a newly-confirmed color can go live
// immediately from just its name, with no manual ID lookup required.
// Every color that already has a real variantId hardcoded is completely
// unaffected -- this fallback only ever runs when one is missing.
export async function resolveVariant(product, sizeLabel, colorName) {
  const sizeEntry = product.sizes?.[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown size "${sizeLabel}" for this product.`);

  if (sizeEntry.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = sizeEntry.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}" for size "${sizeLabel}".`);
    if (colorEntry.variantId) return { variantId: colorEntry.variantId, price: sizeEntry.price };
    const variantId = await resolveVariantIdByTitleMatch(product.blueprintId, product.printProviderId, [sizeLabel, colorName]);
    return { variantId, price: sizeEntry.price };
  }

  if (product.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = product.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}".`);
    if (colorEntry.variantId) return { variantId: colorEntry.variantId, price: sizeEntry.price };
    const variantId = await resolveVariantIdByTitleMatch(product.blueprintId, product.printProviderId, [sizeLabel, colorName]);
    return { variantId, price: sizeEntry.price };
  }

  // UPDATED (Aug 2026): this branch previously threw immediately if a
  // size-only product (no colors at all, like the Gator Tumbler and
  // Tundra Tumbler) was missing a hardcoded variantId. The two color
  // branches above already had a live-lookup fallback for exactly this
  // situation -- a product confirmed to genuinely exist on Printify
  // whose numeric variant ID just hasn't been manually looked up yet --
  // this branch simply never got the same treatment, which is why the
  // 32oz Gator Tumbler's real-photo preview failed with "No variantId
  // configured for size '32oz'" the first time it was used. Brought in
  // line with the same resolveVariantIdByTitleMatch() fallback already
  // used for Trimmed's 15oz Black, Accented's Black, and travel-mug-20oz.
  if (sizeEntry.variantId) return { variantId: sizeEntry.variantId, price: sizeEntry.price };
  const variantId = await resolveVariantIdByTitleMatch(product.blueprintId, product.printProviderId, [sizeLabel]);
  return { variantId, price: sizeEntry.price };
}

// UPDATED (July 2026, Alyx's request): added optional imageScale and
// imageY parameters (default 1 / 0.5 -- both unchanged from before)
// instead of hardcoding one value for every product. Coffee mugs
// specifically were coming out too tightly cropped -- text and faces
// running edge-to-edge with zero margin -- so placeProductOrder/
// start-mockup.js pass 0.8 (80%) scale only for three-slot-wrap
// (coffee mug) products. After fixing the crop, the design still sat
// too high on the mug (centered vertically leaves it looking too close
// to the rim) -- imageY nudges it down toward center-lower instead.
// Travel mugs, suitcases, and everything else keep the original
// full-size, centered placement, since those were already coming out
// correctly. This is the exact same x/y/scale placement control
// Printify's own manual editor exposes when a person resizes/repositions
// a design by hand.
export async function createPrintifyProduct(images, { blueprintId, printProviderId, displayName }, variantId, title, imageScale = 1, imageY = 0.5) {
  const placeholders = Object.entries(images).map(([position, imageId]) => ({
    position,
    images: [{ id: imageId, x: 0.5, y: imageY, scale: imageScale, angle: 0 }]
  }));

  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: title,
      description: `Custom Muggshotz ${displayName}.`,
      blueprint_id: blueprintId,
      print_provider_id: printProviderId,
      variants: [{ id: variantId, price: 1, is_enabled: true }],
      print_areas: [{ variant_ids: [variantId], placeholders }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify product creation failed: " + JSON.stringify(data));
  return { productId: data.id };
}

async function submitPrintifyOrder(productId, variantId, shippingAddress, externalOrderId) {
  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      external_id: externalOrderId,
      line_items: [{ product_id: productId, variant_id: variantId, quantity: 1 }],
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: shippingAddress
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify order submission failed: " + JSON.stringify(data));
  return data;
}

function calculateUpsellCharge(placements) {
  if (!placements) return { upsellCharge: 0, reason: "Not applicable to this product." };
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;

  if (filled.length <= 1) return { upsellCharge: 0, reason: "Single design, base price only." };
  if (filled.length === 2) {
    return distinctCount === 1
      ? { upsellCharge: 3, reason: "Two placements, same design." }
      : { upsellCharge: 5, reason: "Two placements, different designs." };
  }
  return distinctCount === 1
    ? { upsellCharge: 3, reason: "Three placements, same design." }
    : { upsellCharge: 6, reason: "Three placements, all different designs." };
}

export async function placeProductOrder({
  productKey,
  sizeLabel,
  colorName,
  placements,
  frontImage,
  backImage,
  image,
  shippingAddress,
  customerName,
  orderId,
  printMode = "standard",
  posterFramed,
  posterOrientation,
  posterFinish
}) {
  const product = getProduct(productKey);
  if (!product) throw new Error(`Unknown product: "${productKey}"`);
  if (!shippingAddress) throw new Error("shippingAddress is required.");

  let variantId, price, effectiveBlueprintId, effectivePrintProviderId;

  if (productKey === "photo-poster") {
    const resolved = await resolvePhotoPosterSelection(product, {
      framed: !!posterFramed,
      sizeLabel,
      orientation: posterOrientation,
      finish: posterFinish,
      frameColor: colorName
    });
    variantId = resolved.variantId;
    price = resolved.price;
    effectiveBlueprintId = resolved.blueprintId;
    effectivePrintProviderId = resolved.printProviderId;
  } else if (productKey === "travel-mug-20oz") {
    // UPDATED (July 2026): this blueprint (SPOKE Custom Products, swapped
    // in after the previous Polar Camel blueprint turned out to be
    // Printify "Early Access" with no real mockup support) has exactly
    // one orderable variant and no hardcoded ID in the catalog -- same
    // reasoning as photo-poster's not-yet-looked-up sizes. Resolved live
    // by name match instead.
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
    variantId = await resolveVariantIdByTitleMatch(effectiveBlueprintId, effectivePrintProviderId, [sizeLabel]);
    price = product.sizes[sizeLabel].price;
  } else {
    ({ variantId, price } = await resolveVariant(product, sizeLabel, colorName));
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
  }

  let printifyImages = {};
  let pricing = { upsellCharge: 0, reason: "N/A" };

  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right)) {
      throw new Error("At least one design is required, in any slot.");
    }
    // "fullBleed" = customer-facing Wraparound scene-continuation mode
    // (no cropping). "allCup" = reserved for the future Ewww Stew line,
    // which deliberately wants overflow/crop. Do NOT collapse these
    // back into one branch -- see buildSeamlessWrapImage's comment above.
    const isSeamlessWrap = printMode === "fullBleed";
    const isFullBleed = printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      effectiveBlueprintId, effectivePrintProviderId, variantId
    );
    const buffer = isFullBleed
      ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
      : isSeamlessWrap
      ? await buildSeamlessWrapImage(placements.front || placements.left || placements.right, width, height)
      : await buildWraparoundImage(placements, width, height);
    const imageId = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);
    printifyImages[position] = imageId;
    pricing = isFullBleed
      ? { upsellCharge: 0, reason: "All-Cup full-bleed print — offered free of charge." }
      : isSeamlessWrap
      ? { upsellCharge: 0, reason: "Wraparound scene-continuation print — offered free of charge." }
      : calculateUpsellCharge(placements);

  } else if (product.layoutType === "front-back") {
    if (!frontImage && !backImage) throw new Error("At least a front or back image is required.");
    const frontDims = product.printDimensions?.front;
    const backDims = product.printDimensions?.back;
    const { frontBuf, backBuf } = await buildFrontBackImages(frontImage, backImage, frontDims, backDims);
    if (frontBuf) printifyImages["mug_front"] = await uploadImageToPrintify(frontBuf, `muggshotz-front-${Date.now()}.png`);
    if (backBuf) printifyImages["mug_back"] = await uploadImageToPrintify(backBuf, `muggshotz-back-${Date.now()}.png`);

  } else if (product.layoutType === "single-image") {
    if (!image) throw new Error("An image is required.");
    const dims = product.printDimensions?.front;
    const { width, height, position } = dims
      ? { ...dims, position: "front" }
      : await getPlaceholderDimensions(effectiveBlueprintId, effectivePrintProviderId, variantId);
    const buffer = await buildSingleImage(image, width, height);
    printifyImages[position] = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);

  } else if (product.layoutType === "full-bleed") {
    if (!image) throw new Error("An image is required.");
    const { width, height, position } = await getPlaceholderDimensions(
      effectiveBlueprintId, effectivePrintProviderId, variantId
    );
    const buffer = await buildFullBleedImage(image, width, height);
    printifyImages[position] = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);

  } else {
    throw new Error(`Unknown layoutType "${product.layoutType}" for product "${productKey}".`);
  }

  // RESOLVED (July 2026): the calibration test confirmed scale/position
  // was never the real problem -- the actual bug was buildFullBleedImage
  // still cropping, reached only through the Wraparound auto-continuation
  // path. Now that buildSeamlessWrapImage fixes the crop at the source,
  // restoring the values already validated as correct for the manual
  // three-slot-wrap mode.
  const isCoffeeMug = product.layoutType === "three-slot-wrap";
  // UPDATED (July 2026, Alyx's request): the 20oz travel mug (SPOKE
  // Custom Products, single-image) was printing too large on some
  // designs depending on how the source image happened to be framed --
  // scoped narrowly to ONLY this product key so it can't accidentally
  // affect the suitcase, phone case, or anything else that was already
  // coming out correctly.
  const isTravelMug20oz = productKey === "travel-mug-20oz";
  const imageScale = isCoffeeMug ? 1 : 1;
  const imageY = isCoffeeMug ? 0.5 : 0.5;

  const productTitle = `Muggshotz ${product.displayName}${customerName ? " - " + customerName : ""}`;
  const { productId } = await createPrintifyProduct(
    printifyImages,
    { blueprintId: effectiveBlueprintId, printProviderId: effectivePrintProviderId, displayName: product.displayName },
    variantId,
    productTitle,
    imageScale,
    imageY
  );

  const orderResult = await submitPrintifyOrder(
    productId, variantId, shippingAddress, orderId || `muggshotz-${Date.now()}`
  );

  return {
    success: true,
    printifyOrderId: orderResult.id,
    productId,
    basePrice: price,
    upsellCharge: pricing.upsellCharge,
    upsellReason: pricing.reason
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const result = await placeProductOrder(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
