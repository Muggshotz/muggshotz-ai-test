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
// (fit: "contain"). Designs land only in the slots the customer chose —
// a Right-only mug prints with art on the right third and clean white
// everywhere else, which is a deliberate, legitimate product choice
// (e.g. so the art faces outward for a left-handed drinker).
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

// THE ALL-CUP SWITCH (Second Glance Funny / Ewww Stew engine).
//
// The deliberate opposite of buildWraparoundImage's polite manners:
// ONE design is scaled UP with fit: "cover" until it floods the ENTIRE
// printable canvas edge to edge — bottom of the mug, around past the
// handle, up to the print ceiling — and any overflow is cropped away.
// This is the intentionally-resurrected "accident" behavior that gave
// the lifeguard test mug its near-full coverage: liquid doesn't respect
// margins. Art for this mode should be designed at the full print-area
// proportions with sacrificial bleed at the edges, and with the top
// inch fading pale so the print ceiling melts into the white ceramic
// (the "Cleanish principle").
async function buildFullBleedImage(imageSource, canvasWidth, canvasHeight) {
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "cover", position: "centre" })
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

// Determines the $3 / $5 / $6 upsell charge based on how many placements
// were filled and whether they're duplicate or distinct designs.
// Finalized to match order.html and create-checkout-session.js exactly:
// three distinct designs on all three placements is $6, not $5.
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

  return distinctCount === 1
    ? { upsellCharge: 3, reason: "Three placements, same design." }
    : { upsellCharge: 6, reason: "Three placements, all different designs." };
}

// The real, reusable order-placing logic. Called two ways: directly by
// the HTTP handler below (for the manual test-printify.html page), and
// directly by stripe-webhook.js once a real customer payment succeeds.
// Keeping this as one shared function means both paths always place
// orders exactly the same way — no risk of the "real" and "test" paths
// quietly drifting apart from each other over time.
//
// printMode (the switch):
//   "standard" (default) — the existing three-slot caricature layout:
//       each design contain-fits politely inside its own third with
//       white everywhere else. Right for faces.
//   "fullBleed" (aliases: "allCup") — ONE design floods the entire
//       print area edge to edge via buildFullBleedImage. Right for
//       Ewww Stew / Second Glance Funny / All-Cup products. Uses the
//       first design found (front, then left, then right); slot choice
//       is meaningless in this mode since the art covers everything.
//       This option is offered to customers at no extra charge.
export async function placeMugOrder({ placements, mugType, sizeLabel, shippingAddress, customerName, orderId, printMode = "standard" }) {
  // A design can live in ANY slot — Left, Center, or Right. No single
  // slot is mandatory; the only rule is at least one design somewhere.
  if (!placements || !(placements.left || placements.front || placements.right)) {
    throw new Error("At least one design is required, in any slot.");
  }
  if (!mugType || !sizeLabel || !shippingAddress) {
    throw new Error("Missing required fields.");
  }

  const settings = MUG_SETTINGS[mugType];
  if (!settings) throw new Error(`Unknown mug type: ${mugType}`);
  const variantId = settings.variants[sizeLabel];
  if (!variantId) throw new Error(`Unknown size "${sizeLabel}" for mug type "${mugType}".`);

  const isFullBleed = printMode === "fullBleed" || printMode === "allCup";

  const { width, height } = await getPlaceholderDimensions(
    settings.blueprint_id,
    settings.print_provider_id,
    variantId
  );

  const compositeImageBuffer = isFullBleed
    ? await buildFullBleedImage(
        placements.front || placements.left || placements.right,
        width,
        height
      )
    : await buildWraparoundImage(placements, width, height);

  const fileName = `muggshotz-${Date.now()}.png`;
  const imageId = await uploadImageToPrintify(compositeImageBuffer, fileName);

  const productTitle = isFullBleed
    ? `Muggshotz All-Cup Mug${customerName ? " - " + customerName : ""}`
    : `Muggshotz Caricature Mug${customerName ? " - " + customerName : ""}`;
  const { productId } = await createPrintifyProduct(imageId, mugType, sizeLabel, productTitle);

  const orderResult = await submitPrintifyOrder(
    productId,
    variantId,
    shippingAddress,
    orderId || `muggshotz-${Date.now()}`
  );

  // In full-bleed mode there's only one design covering everything, so
  // the multi-placement upsell doesn't apply — full-wrap printing is a
  // free style choice, not an upsell (it costs nothing extra to fulfill).
  const pricing = isFullBleed
    ? { upsellCharge: 0, reason: "All-Cup full-bleed print — single design covers the entire mug; offered free of charge." }
    : calculateUpsellCharge(placements);

  return {
    success: true,
    printifyOrderId: orderResult.id,
    productId,
    printMode: isFullBleed ? "fullBleed" : "standard",
    upsellCharge: pricing.upsellCharge,
    upsellReason: pricing.reason
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
