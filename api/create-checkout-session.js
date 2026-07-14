import Stripe from "stripe";
import { getProduct } from "../lib/products-catalog.js";
import { getRealShippingCost } from "../lib/printify-shipping.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const TOKEN_PACKS = {
  "1token":  { tokens: 1,  amountCents: 50,  label: "1 Token — 50¢" },
  "3tokens": { tokens: 3,  amountCents: 100, label: "3 Tokens — $1.00" },
  "20tokens":{ tokens: 20, amountCents: 500, label: "20 Tokens — $5.00" }
};

const GIFT_MESSAGE_PRICE = 1.00;
const WRAPAROUND_SET_SURCHARGE = 3;

const SHIPPING_MARKUP_THRESHOLD = 50;
const SHIPPING_MARKUP_RATE = 0.10;

// Now ASYNC — calls Printify's live Catalog Shipping endpoint instead
// of reading a static number. Falls back to product.shippingCost (the
// placeholder field) only if the live lookup fails or returns nothing,
// and logs loudly either way so a silent $0 never happens quietly.
async function calculateShippingCharge(product, basePrice, countryCode) {
  let printifyShippingCost = null;

  try {
    printifyShippingCost = await getRealShippingCost(product.blueprintId, product.printProviderId, countryCode);
  } catch (err) {
    console.error(`CRITICAL: Live shipping lookup failed for "${product.displayName}": ${err.message}`);
  }

  if (printifyShippingCost === null) {
    if (typeof product.shippingCost === "number" && product.shippingCost > 0) {
      console.error(`Falling back to static shippingCost for "${product.displayName}" — live lookup returned nothing.`);
      printifyShippingCost = product.shippingCost;
    } else {
      console.error(`CRITICAL: No shipping cost available (live or static) for "${product.displayName}" — charging $0 shipping.`);
      return 0;
    }
  }

  if (basePrice >= SHIPPING_MARKUP_THRESHOLD) {
    return Math.round(printifyShippingCost * (1 + SHIPPING_MARKUP_RATE) * 100) / 100;
  }
  return printifyShippingCost;
}

function calculateUpsellCharge(placements) {
  if (!placements) return 0;
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;
  if (filled.length <= 1) return 0;
  if (filled.length === 2) return distinctCount === 1 ? 3 : 5;
  return distinctCount === 1 ? 3 : 6;
}

function resolvePrice(product, sizeLabel, colorName) {
  const sizeEntry = product.sizes?.[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown size "${sizeLabel}" for this product.`);
  return sizeEntry.price;
}

const MUG_TYPE_TO_PRODUCT_KEY = {
  "Classic White": "classic-white-mug",
  "Color Pop": "color-pop-mug",
  "Trimmed": "trimmed-mug",
  "Accented": "accented-mug"
};

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

// RESTORED (July 2026): this file was found truncated mid-way through
// handleProductOrder's metadata object — cut off right at "image_url_a:"
// with no closing braces, no shipping fields in metadata, and critically
// NO export default handler at all, meaning Vercel had nothing callable
// to run for this endpoint. Everything from here down through the end
// of the file is reconstructed from two solid sources: (1) exactly what
// stripe-webhook.js's handleMugOrderPayment() reads out of
// session.metadata — first_name, last_name, email, phone, country,
// region, address1, address2, city, zip, customer_name, image_url_a/b/c
// — and (2) TOKEN_PACKS above, which was defined but had no function
// left in the file that actually used it, meaning token-pack purchases
// (the Credits & Extras panel's 1/3/20 token buttons) had no working
// endpoint to call either.
async function handleProductOrder(req, res) {
  const {
    deviceId, sizeLabel, customerName, giftMessage, shippingAddress, printMode, isWraparoundSet
  } = req.body;

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

  const requiresColor = !!(product.sizes?.[sizeLabel]?.colors || product.colors);
  if (requiresColor && !colorName) return res.status(400).json({ error: "Please pick a color." });

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

  const upsellCharge = product.layoutType === "three-slot-wrap"
    ? (isWraparoundSet ? WRAPAROUND_SET_SURCHARGE : calculateUpsellCharge(placements))
    : 0;
  const giftCharge = giftMessage?.trim() ? GIFT_MESSAGE_PRICE : 0;

  const productCents = Math.round((basePrice + upsellCharge + giftCharge) * 100);

  const shippingCharge = product.shippingSeparate
    ? await calculateShippingCharge(product, basePrice, shippingAddress.country || "US")
    : 0;
  const shippingCents = Math.round(shippingCharge * 100);

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
    automatic_tax: { enabled: true },
    line_items,
    metadata: {
      order_type: "mug_order",
      device_id: deviceId,
      product_key: productKey,
      size_label: sizeLabel,
      color: colorName || "",
      print_mode: resolvedPrintMode,
      is_wraparound_set: isWraparoundSet ? "true" : "false",
      image_url_a: imageUrlA,
      image_url_b: imageUrlB,
      image_url_c: imageUrlC,
      customer_name: customerName || "",
      first_name: shippingAddress.first_name || "",
      last_name: shippingAddress.last_name || "",
      email: shippingAddress.email || "",
      phone: shippingAddress.phone || "",
      country: shippingAddress.country || "US",
      region: shippingAddress.region || "",
      address1: shippingAddress.address1 || "",
      address2: shippingAddress.address2 || "",
      city: shippingAddress.city || "",
      zip: shippingAddress.zip || ""
    },
    success_url: `${origin}/order.html?checkout=success`,
    cancel_url: `${origin}/order.html?checkout=cancelled`
  });

  return res.status(200).json({ url: session.url });
}

// RESTORED (July 2026): TOKEN_PACKS was defined at the top of this file
// but no function existed anywhere below to actually use it — meaning
// the Credits & Extras panel's "1 Token", "3 Tokens", and "20 Tokens"
// buttons (which call this endpoint with type: "token_purchase") had no
// working handler to reach. Reconstructed here to match exactly how
// index.html's buyTokenPack() calls this endpoint, and how
// stripe-webhook.js's handleTokenPayment() reads device_id back out of
// metadata on completion.
async function handleTokenPurchase(req, res) {
  const { deviceId, packId } = req.body || {};
  const pack = TOKEN_PACKS[packId];
  if (!pack) return res.status(400).json({ error: `Unknown token pack "${packId}".` });
  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });

  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: pack.label },
        unit_amount: pack.amountCents
      },
      quantity: 1
    }],
    metadata: { device_id: deviceId, pack_id: packId },
    success_url: `${origin}/index.html?checkout=success`,
    cancel_url: `${origin}/index.html?checkout=cancelled`
  });

  return res.status(200).json({ url: session.url });
}

// RESTORED (July 2026): the file had NO export default at all — nothing
// for Vercel to actually invoke when this endpoint was called. This
// router matches how every caller in the codebase already sends its
// request: index.html's buyTokenPack() sends { type: "token_purchase" },
// order.html's submitOrder() sends { type: "mug_order" }, and the $5
// Preview Reservation flow (checkout.html) is expected to send
// { type: "reservation" }.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type } = req.body || {};
    if (type === "reservation") {
      return await handleReservation(req, res);
    }
    if (type === "token_purchase") {
      return await handleTokenPurchase(req, res);
    }
    if (type === "mug_order") {
      return await handleProductOrder(req, res);
    }
    return res.status(400).json({ error: `Unknown checkout type "${type}".` });
  } catch (error) {
    console.error("Checkout session creation failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
