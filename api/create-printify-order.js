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

  async function renderSection(imageSource, width, position) {
    if (!imageSource) return null;
    return await sharp(await resolveImageBuffer(imageSource))
      .resize(width, canvasHeight, { fit: "cover", position })
      .png()
      .toBuffer();
  }

  const [leftBuf, frontBuf, rightBuf] = await Promise.all([
    renderSection(left, sectionWidth, "right"),
    renderSection(front, sectionWidth, "centre"),
    renderSection(right, lastSectionWidth, "left")
  ]);

  const composites = [];
  if (leftBuf) composites.push({ input: leftBuf, left: 0, top: 0 });
  if (frontBuf) composites.push({ input: frontBuf, left: sectionWidth, top: 0 });
  if (rightBuf) composites.push({ input: rightBuf, left: sectionWidth * 2, top: 0 });

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

export async function buildSingleImage(imageSource, canvasWidth, canvasHeight) {
  const WHITE = { r: 255, g: 255, b: 255 };
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();
}

export async function buildFrontBackImages(frontSource, backSource, frontDims, backDims) {
  const WHITE = { r: 255, g: 255, b: 255 };
  async function build(source, dims) {
    if (!source || !dims) return null;
    return await sharp(await resolveImageBuffer(source))
      .resize(dims.width, dims.height, { fit: "contain", background: WHITE })
      .png()
      .toBuffer();
  }
  const [frontBuf, backBuf] = await Promise.all([
    build(frontSource, frontDims),
    build(backSource, backDims)
  ]);
  return { frontBuf, backBuf };
}

export function resolveVariant(product, sizeLabel, colorName) {
  const sizeEntry = product.sizes?.[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown size "${sizeLabel}" for this product.`);

  if (sizeEntry.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = sizeEntry.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}" for size "${sizeLabel}".`);
    return { variantId: colorEntry.variantId, price: sizeEntry.price };
  }

  if (product.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = product.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}".`);
    return { variantId: colorEntry.variantId, price: sizeEntry.price };
  }

  if (!sizeEntry.variantId) throw new Error(`No variantId configured for size "${sizeLabel}".`);
  return { variantId: sizeEntry.variantId, price: sizeEntry.price };
}

// UPDATED (July 2026, Alyx's request): scale reduced from 1.0 (100% —
// filling the entire print area edge-to-edge, zero margin) to 0.8 (80%)
// after real printed/mocked-up results looked too tightly cropped —
// text and faces were running right to the edge of the print area. This
// is the exact same x/y/scale placement control Printify's own manual
// editor exposes when a person resizes a design by hand; we're just
// setting a smaller default here instead of leaving it at full size.
// Applies everywhere a product gets created — both real orders and
// real-photo mockup previews — since both go through this one function.
export async function createPrintifyProduct(images, { blueprintId, printProviderId, displayName }, variantId, title) {
  const placeholders = Object.entries(images).map(([position, imageId]) => ({
    position,
    images: [{ id: imageId, x: 0.5, y: 0.5, scale: 0.8, angle: 0 }]
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
    // one orderable variant and no hardcoded ID in the catalog — same
    // reasoning as photo-poster's not-yet-looked-up sizes. Resolved live
    // by name match instead.
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
    variantId = await resolveVariantIdByTitleMatch(effectiveBlueprintId, effectivePrintProviderId, [sizeLabel]);
    price = product.sizes[sizeLabel].price;
  } else {
    ({ variantId, price } = resolveVariant(product, sizeLabel, colorName));
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
  }

  let printifyImages = {};
  let pricing = { upsellCharge: 0, reason: "N/A" };

  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right)) {
      throw new Error("At least one design is required, in any slot.");
    }
    const isFullBleed = printMode === "fullBleed" || printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      effectiveBlueprintId, effectivePrintProviderId, variantId
    );
    const buffer = isFullBleed
      ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
      : await buildWraparoundImage(placements, width, height);
    const imageId = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);
    printifyImages[position] = imageId;
    pricing = isFullBleed
      ? { upsellCharge: 0, reason: "All-Cup full-bleed print — offered free of charge." }
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

  const productTitle = `Muggshotz ${product.displayName}${customerName ? " - " + customerName : ""}`;
  const { productId } = await createPrintifyProduct(
    printifyImages,
    { blueprintId: effectiveBlueprintId, printProviderId: effectivePrintProviderId, displayName: product.displayName },
    variantId,
    productTitle
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
