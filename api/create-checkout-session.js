import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Token pack definitions
const TOKEN_PACKS = {
  "1token":  { tokens: 1,  amountCents: 50,  label: "1 Token — 50¢" },
  "3tokens": { tokens: 3,  amountCents: 100, label: "3 Tokens — $1.00" },
  "20tokens":{ tokens: 20, amountCents: 500, label: "20 Tokens — $5.00" }
};

// Mug pricing table
const MUG_PRICING = {
  "Classic White": { "11oz": 19.95, "15oz": 24.95 },
  "Color Pop":     { "11oz": 34.95, "15oz": 39.95 }
};

const GIFT_MESSAGE_PRICE = 1.00;

function calculateUpsellCharge(placements) {
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;
  if (filled.length <= 1) return 0;
  if (filled.length === 2) return distinctCount === 1 ? 3 : 5;
  return distinctCount === 1 ? 3 : 6;
}

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

// ── Mug order checkout ──
async function handleMugOrder(req, res) {
  const {
    deviceId, placements, mugType, sizeLabel, color,
    customerName, giftMessage, shippingAddress, printMode
  } = req.body;

  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  if (!placements || !(placements.left || placements.front || placements.right))
    return res.status(400).json({ error: "At least one design is required." });

  const mugSettings = MUG_PRICING[mugType];
  if (!mugSettings) return res.status(400).json({ error: `"${mugType}" isn't available yet.` });
  const basePrice = mugSettings[sizeLabel];
  if (basePrice === undefined) return res.status(400).json({ error: `Unknown size "${sizeLabel}".` });
  if (mugType === "Color Pop" && !color) return res.status(400).json({ error: "Please pick a mug color." });
  if (!shippingAddress?.email || !shippingAddress?.address1 || !shippingAddress?.city ||
      !shippingAddress?.region || !shippingAddress?.zip)
    return res.status(400).json({ error: "Missing required shipping information." });

  // Full-wrap printing (fullBleed/allCup) is a free style choice, not an
  // upsell — it costs nothing extra to fulfill, so it never touches price.
  // Defaults to "standard" (front-facing panel) unless the customer opts in.
  const resolvedPrintMode = printMode === "fullBleed" ? "fullBleed" : "standard";

  const upsellCharge = calculateUpsellCharge(placements);
  const giftCharge   = giftMessage?.trim() ? GIFT_MESSAGE_PRICE : 0;
  const totalCents   = Math.round((basePrice + upsellCharge + giftCharge) * 100);
  const origin       = req.headers.origin || "https://muggshotz-ai-test.vercel.app";
  const productName  = `Muggshotz ${mugType} Mug (${sizeLabel})${color ? " - " + color : ""}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: "usd", product_data: { name: productName, description: "Custom Muggshotz caricature mug" }, unit_amount: totalCents }, quantity: 1 }],
    metadata: {
      order_type: "mug_order",
      device_id: deviceId,
      mug_type: mugType, size_label: sizeLabel, color: color || "",
      print_mode: resolvedPrintMode,
      left_image_url: placements.left || "", front_image_url: placements.front || "", right_image_url: placements.right || "",
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
    if (type === "mug_order")      return await handleMugOrder(req, res);
    if (type === "token_purchase")  return await handleTokenPack(req, res);
    return await handleReservation(req, res);
  } catch (error) {
    return res.status(500).json({ error: error.message, type: error.type || "unknown" });
  }
}
