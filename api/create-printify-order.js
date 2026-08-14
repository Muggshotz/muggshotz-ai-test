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

export async function buildSeamlessWrapImage(placements, canvasWidth, canvasHeight) {
  const WHITE = { r: 255, g: 255, b: 255 };
  const CROP_FRACTION = 0.10;
  const { left, front, right } = placements;
  const sources = [left, front, right].filter(Boolean);
  if (sources.length === 0) throw new Error("No design provided for seamless wrap.");

  const buffers = await Promise.all(sources.map(s => resolveImageBuffer(s)));
  const metas = await Promise.all(buffers.map(b => sharp(b).metadata()));
  const panelHeight = metas[0].height;
  let x = 0;
  const composites = buffers.map((buf, i) => {
    const c = { input: buf, left: x, top: 0 };
    x += metas[i].width;
    return c;
  });
  const stripBuffer = await sharp({
    create: { width: x, height: panelHeight, channels: 3, background: WHITE }
  })
    .composite(composites)
    .png()
    .toBuffer();

  const meta = await sharp(stripBuffer).metadata();
  const cropWidth = Math.round(meta.width * (1 - CROP_FRACTION));
  const cropLeft = Math.round((meta.width - cropWidth) / 2);
  return await sharp(stripBuffer)
    .extract({ left: cropLeft, top: 0, width: cropWidth, height: meta.height })
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

  if (sizeEntry.variantId) return { variantId: sizeEntry.variantId, price: sizeEntry.price };
  const variantId = await resolveVariantIdByTitleMatch(product.blueprintId, product.printProviderId, [sizeLabel]);
  return { variantId, price: sizeEntry.price };
}

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
    const isSeamlessWrap = printMode === "fullBleed";
    const isFullBleed = printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      effectiveBlueprintId, effectivePrintProviderId, variantId
    );
    const buffer = isFullBleed
      ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
      : isSeamlessWrap
      ? await buildSeamlessWrapImage(placements, width, height)
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

  const isCoffeeMug = product.layoutType === "three-slot-wrap";
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
