import Stripe from "stripe";
import { getProduct } from "../lib/products-catalog.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Token pack definitions
const TOKEN_PACKS = {
  "1token":  { tokens: 1,  amountCents: 50,  label: "1 Token — 50¢" },
  "3tokens": { tokens: 3,  amountCents: 100, label: "3 Tokens — $1.00" },
  "20tokens":{ tokens: 20, amountCents: 500, label: "20 Tokens — $5.00" }
};

const GIFT_MESSAGE_PRICE = 1.00;

// Flat charge for an auto-generated Wraparound set (the generator's
// scene-continuation pipeline — 3 real panels from 1 paid generation).
// Deliberately SEPARATE from calculateUpsellCharge() below, which is
// for the older, unrelated "customer manually placed 3 different
// designs" ladder. Both features happen to fill left/front/right, but
// they are not the same thing and must not share pricing logic — a
// wraparound set always costs a flat +$3, regardless of the ladder's
// same/different-design distinction (July 2026, Alyx: wraparound costs
// more in real API usage and shouldn't be priced like a free gimme).
const WRAPAROUND_SET_SURCHARGE = 3;

// Flat shipping estimate shown as its own line item so the customer
// sees "product price" and "shipping" as two separate numbers at
// Stripe checkout — this is a placeholder rate, not a real Printify
// shipping-cost lookup yet. Revisit once real shipping rates are wired
// in (Printify has a rates API for this).
const FLAT_SHIPPING_CENTS = 695; // $6.95

function calculateUpsellCharge(placements) {
  if (!placements) return 0;
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;
  if (filled.length <= 1) return 0;
  if (filled.length === 2) return distinctCount === 1 ? 3 : 5;
  return distinctCount === 1 ? 3 : 6;
}

// Resolves the base price for a product/size/color combo, handling
// the two catalog shapes (flat colors, or colors nested under size —
// see products-catalog.js for why Color Pop needs the nested form).
function resolvePrice(product, sizeLabel, colorName) {
  const sizeEntry = product.sizes?.[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown size "${sizeLabel}" for this product.`);
  return sizeEntry.price;
}

// Old live order.html sends { mugType: "Classic White" | "Color Pop" }.
// This translates that into the new catalog product key so existing
// checkout keeps working unchanged while order.html is updated to send
// productKey directly for new products.
const MUG_TYPE_TO_PRODUCT_KEY = {
  "Classic White": "classic-white-mug",
  "Color Pop": "color-pop-mug",
  "Trimmed": "trimmed-mug",
  "Accented": "accented-mug"
};

// ── Preview Reservation ($5, credits tokens, acts as deposit on mug) ──
async function handleReservation(req, res) {
  const { email, deviceId } = req.body || {};
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    customer_email: email || undefined,
    metadata: { device_id: deviceId || "" },
    success_url: `${process.env.PUBLIC_SITE_URL || "https://muggshotz-ai-test.vercel.app"}?checkout=success`,
    cancel_url:  `${process.env.PUBLIC_SITE_URL || "https://muggshotz-ai-test.vercel.app"}?checkout=cancelled`
  });
  return res.status(200).json({ url: session.url });
}

// ── Generic product order checkout — replaces the old mug-only handler ──
// Accepts EITHER:
//   old shape: { mugType, sizeLabel, color, placements }  (still sent by
//              the current live order.html — kept working on purpose)
//   new shape: { productKey, sizeLabel, colorName, placements,
//                frontImage, backImage, image }  (for travel mugs and
//              anything added going forward)
async function handleProductOrder(req, res) {
  const {
    deviceId, sizeLabel, customerName, giftMessage, shippingAddress, printMode, isWraparoundSet
  } = req.body;

  // Figure out which product this is, old-shape or new-shape.
  const productKey = req.body.productKey || MUG_TYPE_TO_PRODUCT_KEY[req.body.mugType];
  const colorName = req.body.colorName || req.body.color || null;
  const placements = req.body.placements || null;
  const frontImage = req.body.frontImage || null;
  const backImage = req.body.backImage || null;
  const singleImage = req.body.image || null;

  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  const product = productKey ? getProduct(productKey) : null;
  if (!product) return res.status(400).json({ error: `"${req.body.mugType || productKey}" isn't available yet.` });

  let basePrice;
  try {
    basePrice = resolvePrice(product, sizeLabel, colorName);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Colors nested under size (Color Pop) or a flat top-level list
  // (travel mugs) both require a color choice if either exists.
  const requiresColor = !!(product.sizes?.[sizeLabel]?.colors || product.colors);
  if (requiresColor && !colorName) return res.status(400).json({ error: "Please pick a color." });

  // Image validation depends on layout type.
  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right))
      return res.status(400).json({ error: "At least one design is required." });
  } else if (product.layoutType === "front-back") {
    if (!frontImage && !backImage)
      return res.status(400).json({ error: "At least a front or back image is required." });
  } else {
    if (!singleImage)
      return res.status(400).json({ error: "An image is required." });
  }

  if (!shippingAddress?.email || !shippingAddress?.address1 || !shippingAddress?.city ||
      !shippingAddress?.region || !shippingAddress?.zip)
    return res.status(400).json({ error: "Missing required shipping information." });

  const resolvedPrintMode = printMode === "fullBleed" ? "fullBleed" : "standard";

  // isWraparoundSet (flat +$3) and the manual-placement upsell ladder
  // ($3/$5/$6) are mutually exclusive — an auto-generated wraparound
  // set always uses the flat surcharge, never the ladder, even though
  // it also fills all three slots with genuinely distinct images. See
  // WRAPAROUND_SET_SURCHARGE above for why these must stay separate.
  const upsellCharge = product.layoutType === "three-slot-wrap"
    ? (isWraparoundSet ? WRAPAROUND_SET_SURCHARGE : calculateUpsellCharge(placements))
    : 0;
  const giftCharge = giftMessage?.trim() ? GIFT_MESSAGE_PRICE : 0;

  const productCents = Math.round((basePrice + upsellCharge + giftCharge) * 100);
  const shippingCents = product.shippingSeparate ? FLAT_SHIPPING_CENTS : 0;

  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";
  const productName = `Muggshotz ${product.displayName} (${sizeLabel})${colorName ? " - " + colorName : ""}`;

  const line_items = [
    { price_data: { currency: "usd", product_data: { name: productName, description: `Custom ${product.displayName}` }, unit_amount: productCents }, quantity: 1 }
  ];
  if (shippingCents > 0) {
    line_items.push({
      price_data: { currency: "usd", product_data: { name: "Shipping & Handling" }, unit_amount: shippingCents },
      quantity: 1
    });
  }

  // Generic image slots in metadata — image_url_a/b/c map to different
  // things depending on layoutType (see stripe-webhook.js for the
  // unpacking side of this):
  //   three-slot-wrap : a=left, b=front, c=right
  //   front-back      : a=front, b=back
  //   single-image / full-bleed : a=image
  let imageUrlA = "", imageUrlB = "", imageUrlC = "";
  if (product.layoutType === "three-slot-wrap") {
    imageUrlA = placements.left || "";
    imageUrlB = placements.front || "";
    imageUrlC = placements.right || "";
  } else if (product.layoutType === "front-back") {
    imageUrlA = frontImage || "";
    imageUrlB = backImage || "";
  } else {
    imageUrlA = singleImage || "";
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items,
    metadata: {
      order_type: "mug_order", // kept as-is intentionally — this is how stripe-webhook.js tells a product order apart from a token purchase
      device_id: deviceId,
      product_key: productKey,
      size_label: sizeLabel,
      color: colorName || "",
      print_mode: resolvedPrintMode,
      is_wraparound_set: isWraparoundSet ? "true" : "false",
      image_url_a: imageUrlA, image_url_b: imageUrlB, image_url_c: imageUrlC,
      customer_name: customerName || "", gift_message: giftMessage || "",
      first_name: shippingAddress.first_name || "", last_name: shippingAddress.last_name || "",
      email: shippingAddress.email || "", phone: shippingAddress.phone || "",
      country: shippingAddress.country || "", region: shippingAddress.region || "",
      address1: shippingAddress.address1 || "", address2: shippingAddress.address2 || "",
      city: shippingAddress.city || "", zip: shippingAddress.zip || ""
    },
    success_url: `${origin}/index.html?order=success`,
    cancel_url:  `${origin}/order.html`
  });
  return res.status(200).json({ url: session.url });
}

// ── Token pack purchase ──
async function handleTokenPack(req, res) {
  const { deviceId, packId } = req.body;
  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  const pack = TOKEN_PACKS[packId];
  if (!pack) return res.status(400).json({ error: `Unknown pack: ${packId}` });

  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: "usd", product_data: { name: `Muggshotz ${pack.label}`, description: `${pack.tokens} generation token${pack.tokens > 1 ? "s" : ""}` }, unit_amount: pack.amountCents }, quantity: 1 }],
    metadata: { order_type: "token_purchase", device_id: deviceId, pack_id: packId, tokens_to_credit: String(pack.tokens) },
    success_url: `${origin}/index.html?tokens=added`,
    cancel_url:  `${origin}/index.html`
  });
  return res.status(200).json({ url: session.url });
}

// ── Router ──
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const type = req.body?.type;
    if (type === "mug_order")      return await handleProductOrder(req, res);
    if (type === "token_purchase")  return await handleTokenPack(req, res);
    return await handleReservation(req, res);
  } catch (error) {
    return res.status(500).json({ error: error.message, type: error.type || "unknown" });
  }
}
