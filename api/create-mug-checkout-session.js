import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Same pricing table as order.html and create-printify-order.js. This
// copy is the one that actually matters — it's what decides how much
// money gets charged, so it never trusts whatever price the browser
// sends back.
const PRICING = {
  "Classic White": { "11oz": 19.95, "15oz": 24.95 },
  "Color Pop": { "11oz": 34.95, "15oz": 39.95 }
};

const GIFT_MESSAGE_PRICE = 1.00;

// Mirrors the upsell logic in create-printify-order.js exactly, so the
// price shown at checkout always matches what the order will actually
// charge later. Full price table:
//   1 placement                      → $0 (base price)
//   2 placements, same design        → $3
//   2 placements, different designs  → $5
//   3 placements, same design        → $3
//   3 placements, different designs  → $6 (set-discount vs. buying à la carte)
function calculateUpsellCharge(placements) {
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;

  if (filled.length <= 1) return 0;
  if (filled.length === 2) return distinctCount === 1 ? 3 : 5;
  return distinctCount === 1 ? 3 : 6;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      deviceId,
      placements,
      mugType,
      sizeLabel,
      color,
      customerName,
      giftMessage,
      shippingAddress
    } = req.body;

    // --- Validation: never trust the client, always verify server-side ---
    if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
    // A design can live in ANY slot — Left, Center, or Right. Customers
    // often deliberately want side placement (e.g. facing outward for a
    // right- or left-handed drinker), so no single slot is mandatory.
    // The only rule: the mug must have at least one design somewhere.
    if (!placements || !(placements.left || placements.front || placements.right)) {
      return res.status(400).json({ error: "At least one design is required, in any slot." });
    }
    const mugSettings = PRICING[mugType];
    if (!mugSettings) {
      return res.status(400).json({ error: `"${mugType}" isn't available to order yet.` });
    }
    const basePrice = mugSettings[sizeLabel];
    if (basePrice === undefined) {
      return res.status(400).json({ error: `Unknown size "${sizeLabel}" for "${mugType}".` });
    }
    if (mugType === "Color Pop" && !color) {
      return res.status(400).json({ error: "Please pick a mug color." });
    }
    if (!shippingAddress || !shippingAddress.email || !shippingAddress.address1 ||
        !shippingAddress.city || !shippingAddress.region || !shippingAddress.zip) {
      return res.status(400).json({ error: "Missing required shipping information." });
    }

    // --- Price, calculated fresh here, in cents for Stripe ---
    const upsellCharge = calculateUpsellCharge(placements);
    const giftCharge = giftMessage && giftMessage.trim() ? GIFT_MESSAGE_PRICE : 0;
    const totalPrice = basePrice + upsellCharge + giftCharge;
    const totalCents = Math.round(totalPrice * 100);

    const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";

    const productName = `Muggshotz ${mugType} Mug (${sizeLabel})${color ? " - " + color : ""}`;

    // NOTE: We deliberately do NOT pass customer_email here. Locking the
    // session to the shipping email caused Stripe's
    // "customer_and_confirmation_email_mismatch" error whenever Link
    // signed the buyer in under a different saved email. The shipping
    // email still travels safely in metadata below, which is what the
    // webhook actually uses to place the Printify order.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: "Custom Muggshotz caricature mug"
            },
            unit_amount: totalCents
          },
          quantity: 1
        }
      ],
      metadata: {
        order_type: "mug_order",
        device_id: deviceId,
        mug_type: mugType,
        size_label: sizeLabel,
        color: color || "",
        left_image_url: placements.left || "",
        front_image_url: placements.front || "",
        right_image_url: placements.right || "",
        customer_name: customerName || "",
        gift_message: giftMessage || "",
        first_name: shippingAddress.first_name || "",
        last_name: shippingAddress.last_name || "",
        email: shippingAddress.email || "",
        phone: shippingAddress.phone || "",
        country: shippingAddress.country || "",
        region: shippingAddress.region || "",
        address1: shippingAddress.address1 || "",
        address2: shippingAddress.address2 || "",
        city: shippingAddress.city || "",
        zip: shippingAddress.zip || ""
      },
      success_url: `${origin}/index.html?order=success`,
      cancel_url: `${origin}/order.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
