import sharp from "sharp";
import { getProduct } from "../lib/products-catalog.js";

const SHOP_ID = "27439202";

async function uploadImageToPrintify(imageBuffer, fileName) {
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

// Placements coming from a real customer order are live Supabase
// Storage URLs (the actual generated design), not base64 data — only
// the manual test-printify.html page still sends raw base64 uploads.
async function resolveImageBuffer(source) {
  if (source.startsWith("data:")) {
    return dataUrlToBuffer(source);
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Could not fetch design image: ${source}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Asks Printify for this variant's actual print-area size, rather than
// trusting a hardcoded number, so this keeps working correctly even if
// Printify changes a product's dimensions later.
async function getPlaceholderDimensions(blueprintId, printProviderId, variantId, position) {
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

// ===== LAYOUT BUILDERS =====
// Each one takes whatever image source(s) the customer approved and
// returns a finished PNG buffer ready to upload to Printify. Adding a
// future layout type (a fifth pattern nobody's invented yet) means
// adding one more function here — nothing else needs to change.

// "three-slot-wrap" — existing coffee mug behavior. Left/Center/Right
// sections side by side on one wide image, white canvas, each design
// scaled to fit inside its own third without cropping.
async function buildWraparoundImage(placements, canvasWidth, canvasHeight) {
  const { left, front, right } = placements;
  const WHITE = { r: 255, g: 255, b: 255 };
  const sectionWidth = Math.round(canvasWidth / 3);
  const lastSectionWidth = canvasWidth - sectionWidth * 2;

  async function renderSection(imageSource, width) {
    if (!imageSource) return null;
    return await sharp(await resolveImageBuffer(imageSource))
      .resize(width, canvasHeight, { fit: "contain", background: WHITE })
      .png()
      .toBuffer();
  }

  const [leftBuf, frontBuf, rightBuf] = await Promise.all([
    renderSection(left, sectionWidth),
    renderSection(front, sectionWidth),
    renderSection(right, lastSectionWidth)
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

// "full-bleed" — one design floods the entire print area edge to edge
// (Ewww Stew / Second Glance Funny line). Deliberate opposite of the
// wraparound builder's polite manners.
async function buildFullBleedImage(imageSource, canvasWidth, canvasHeight) {
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

// "single-image" — one design, contain-fit onto a white canvas sized to
// the product's one print area. For products with exactly one design
// slot and no left/right sections (e.g. Travel Mug with Handle, 14oz).
async function buildSingleImage(imageSource, canvasWidth, canvasHeight) {
  const WHITE = { r: 255, g: 255, b: 255 };
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();
}

// "front-back" — two independent designs, each contain-fit onto its own
// separate print area (e.g. Travel Mug 20oz, which has distinct
// mug_front and mug_back placeholders instead of one wraparound image).
// Uses the SAME two builder calls as single-image, just run twice.
async function buildFrontBackImages(frontSource, backSource, frontDims, backDims) {
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

// ===== VARIANT RESOLUTION =====
// Looks up the correct Printify variant ID for a given product/size/
// color combination, handling the two different catalog shapes:
// flat sizes (most products) and colors-nested-under-size (Color Pop,
// where available colors differ by size).
function resolveVariant(product, sizeLabel, colorName) {
  const sizeEntry = product.sizes?.[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown size "${sizeLabel}" for this product.`);

  // Case 1: colors nested under this size (e.g. Color Pop)
  if (sizeEntry.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = sizeEntry.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}" for size "${sizeLabel}".`);
    return { variantId: colorEntry.variantId, price: sizeEntry.price };
  }

  // Case 2: flat top-level colors array (e.g. Travel Mug 20oz)
  if (product.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = product.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}".`);
    return { variantId: colorEntry.variantId, price: sizeEntry.price };
  }

  // Case 3: no color choice at all — variant ID lives directly on the size
  if (!sizeEntry.variantId) throw new Error(`No variantId configured for size "${sizeLabel}".`);
  return { variantId: sizeEntry.variantId, price: sizeEntry.price };
}

async function createPrintifyProduct(images, product, variantId, title) {
  // images is either { position: imageId } for single/full-bleed/front-back,
  // built into the placeholders array below.
  const placeholders = Object.entries(images).map(([position, imageId]) => ({
    position,
    images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }]
  }));

  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: title,
      description: `Custom Muggshotz ${product.displayName}.`,
      blueprint_id: product.blueprintId,
      print_provider_id: product.printProviderId,
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

// Determines the $3 / $5 / $6 upsell charge based on how many placements
// were filled and whether they're duplicate or distinct designs.
// Only meaningful for "three-slot-wrap" products — other layout types
// don't have multiple slots, so this returns 0 for them.
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

// ===== THE MAIN ENTRY POINT =====
// Generic across every product in the catalog. Called by stripe-webhook.js
// once payment succeeds, and directly by the HTTP handler below for
// manual testing.
//
// Expected input shape varies slightly by layoutType:
//   three-slot-wrap : { placements: {left, front, right}, printMode }
//   front-back      : { frontImage, backImage }
//   single-image     : { image }
//   full-bleed       : { image }
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
  printMode = "standard"
}) {
  const product = getProduct(productKey);
  if (!product) throw new Error(`Unknown product: "${productKey}"`);
  if (!shippingAddress) throw new Error("shippingAddress is required.");

  const { variantId, price } = resolveVariant(product, sizeLabel, colorName);

  let printifyImages = {};
  let pricing = { upsellCharge: 0, reason: "N/A" };

  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right)) {
      throw new Error("At least one design is required, in any slot.");
    }
    const isFullBleed = printMode === "fullBleed" || printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      product.blueprintId, product.printProviderId, variantId
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
      : await getPlaceholderDimensions(product.blueprintId, product.printProviderId, variantId);
    const buffer = await buildSingleImage(image, width, height);
    printifyImages[position] = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);

  } else if (product.layoutType === "full-bleed") {
    if (!image) throw new Error("An image is required.");
    const { width, height, position } = await getPlaceholderDimensions(
      product.blueprintId, product.printProviderId, variantId
    );
    const buffer = await buildFullBleedImage(image, width, height);
    printifyImages[position] = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);

  } else {
    throw new Error(`Unknown layoutType "${product.layoutType}" for product "${productKey}".`);
  }

  const productTitle = `Muggshotz ${product.displayName}${customerName ? " - " + customerName : ""}`;
  const { productId } = await createPrintifyProduct(printifyImages, product, variantId, productTitle);

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
