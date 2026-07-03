import sharp from "sharp";

const SHOP_ID = "27439202";

const MUG_SETTINGS = {
  "Classic White": {
    blueprint_id: 478,
    print_provider_id: 99,
    variants: { "11oz": 65216, "15oz": 104692 }
  }
};

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
// This handles both so buildWraparoundImage works correctly either way.
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
// hardcoding it, so this keeps working correctly even if 15oz (or a
// future size) turns out to use different dimensions than 11oz.
async function getPlaceholderDimensions(blueprintId, printProviderId, variantId) {
  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch blueprint variants: " + JSON.stringify(data));
  const variant = (data.variants || []).find(v => v.id === variantId);
  if (!variant || !variant.placeholders || !variant.placeholders[0]) {
    throw new Error(`No placeholder found for variant ${variantId}`);
  }
  const ph = variant.placeholders[0];
  return { width: ph.width, height: ph.height };
}

// Printify only exposes ONE print position on this mug ("front"), and it
// covers the entire wraparound surface, not just the front-facing side.
// To get Left / Front / Right onto one mug, we build that single wide
// image ourselves: three equal side-by-side sections, then upload the
// combined result as the one "front" image Printify expects.
//
// The canvas is ALWAYS white (an unprinted mug is white), and every
// design is scaled to fit INSIDE its own section without cropping
// (fit: "contain"). A single Center design therefore lands neatly in
// the middle third of the wraparound — the classic front-of-mug look —
// with the rest of the mug left clean white. Previously a single
// design was cover-stretched across the entire canvas, which produced
// a giant cropped image wrapping the whole mug; and empty slots were
// filled dark gray, which would have printed dark panels on a white
// mug. Both of those are what this version fixes.
async function buildWraparoundImage(placements, canvasWidth, canvasHeight) {
  const { left, front, right } = placements;

  const WHITE = { r: 255, g: 255, b: 255 };

  const sectionWidth = Math.round(canvasWidth / 3);
  const lastSectionWidth = canvasWidth - sectionWidth * 2; // absorb rounding into the right section

  // Renders one design scaled to fit fully inside its section, on a
  // white background. Returns null for empty slots — the white base
  // canvas already handles those.
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

async function createPrintifyProduct(imageId, mugType, sizeLabel, title) {
  const settings = MUG_SETTINGS[mugType];
  if (!settings) throw new Error(`Unknown mug type: ${mugType}`);
  const variantId = settings.variants[sizeLabel];
  if (!variantId) throw new Error(`Unknown size "${sizeLabel}" for mug type "${mugType}".`);

  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: title,
      description: "Custom Muggshotz caricature mug.",
      blueprint_id: settings.blueprint_id,
      print_provider_id: settings.print_provider_id,
      variants: [
        { id: variantId, price: 1, is_enabled: true }
      ],
      print_areas: [
        {
          variant_ids: [variantId],
          placeholders: [
            {
              position: "front",
              images: [
                { id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }
              ]
            }
          ]
        }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify product creation failed: " + JSON.stringify(data));
  return { productId: data.id, variantId };
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
      line_items: [
        { product_id: productId, variant_id: variantId, quantity: 1 }
      ],
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: shippingAddress
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify order submission failed: " + JSON.stringify(data));
  return data;
}

// Determines the $3 / $5 upsell charge based on how many placements were
// filled and whether they're duplicate or distinct designs.
//
// NOTE: pricing for filling all THREE placements with three DIFFERENT
// designs hasn't been finalized in the business rules yet. This
// currently falls back to the $5 tier for that case and flags it, so
// it's visible in the response rather than silently guessed.
function calculateUpsellCharge(placements) {
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;

  if (filled.length <= 1) {
    return { upsellCharge: 0, reason: "Single design, base price only." };
  }

  if (filled.length === 2) {
    return distinctCount === 1
      ? { upsellCharge: 3, reason: "Two placements, same design." }
      : { upsellCharge: 5, reason: "Two placements, different designs." };
  }

  if (distinctCount === 1) {
    return { upsellCharge: 3, reason: "Three placements, same design." };
  }
  return {
    upsellCharge: 5,
    reason: "Three placements with multiple designs — pricing for this exact combination is not finalized yet; defaulting to the $5 tier.",
    needsPricingConfirmation: true
  };
}

// The real, reusable order-placing logic. Called two ways: directly by
// the HTTP handler below (for the manual test-printify.html page), and
// directly by stripe-webhook.js once a real customer payment succeeds.
// Keeping this as one shared function means both paths always place
// orders exactly the same way — no risk of the "real" and "test" paths
// quietly drifting apart from each other over time.
export async function placeMugOrder({ placements, mugType, sizeLabel, shippingAddress, customerName, orderId }) {
  if (!placements || !placements.front) {
    throw new Error("At least a Center design is required.");
  }
  if (!mugType || !sizeLabel || !shippingAddress) {
    throw new Error("Missing required fields.");
  }

  const settings = MUG_SETTINGS[mugType];
  if (!settings) throw new Error(`Unknown mug type: ${mugType}`);
  const variantId = settings.variants[sizeLabel];
  if (!variantId) throw new Error(`Unknown size "${sizeLabel}" for mug type "${mugType}".`);

  const { width, height } = await getPlaceholderDimensions(
    settings.blueprint_id,
    settings.print_provider_id,
    variantId
  );

  const compositeImageBuffer = await buildWraparoundImage(placements, width, height);

  const fileName = `muggshotz-${Date.now()}.png`;
  const imageId = await uploadImageToPrintify(compositeImageBuffer, fileName);

  const productTitle = `Muggshotz Caricature Mug${customerName ? " - " + customerName : ""}`;
  const { productId } = await createPrintifyProduct(imageId, mugType, sizeLabel, productTitle);

  const orderResult = await submitPrintifyOrder(
    productId,
    variantId,
    shippingAddress,
    orderId || `muggshotz-${Date.now()}`
  );

  const pricing = calculateUpsellCharge(placements);

  return {
    success: true,
    printifyOrderId: orderResult.id,
    productId,
    upsellCharge: pricing.upsellCharge,
    upsellReason: pricing.reason,
    needsPricingConfirmation: pricing.needsPricingConfirmation || false
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const result = await placeMugOrder(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
