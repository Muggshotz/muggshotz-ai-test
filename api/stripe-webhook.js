import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// The three token packs. Prices in cents for Stripe.
// Note: the $5 pack is a pure token purchase — it does NOT apply as a
// deposit toward a mug order. That's the $5 Preview Reservation, which
// is a separate product. Both cost $5 but serve different customers:
// the pack is for players who want to explore; the reservation is for
// buyers who want a mug.
const TOKEN_PACKS = {
  "1token":  { tokens: 1,  amountCents: 50,  label: "1 Token — 50¢" },
  "3tokens": { tokens: 3,  amountCents: 100, label: "3 Tokens — $1.00" },
  "20tokens":{ tokens: 20, amountCents: 500, label: "20 Tokens — $5.00" }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { deviceId, packId } = req.body;

    if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
    const pack = TOKEN_PACKS[packId];
    if (!pack) return res.status(400).json({ error: `Unknown pack: ${packId}` });

    const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Muggshotz ${pack.label}`,
              description: `${pack.tokens} generation token${pack.tokens > 1 ? "s" : ""} — use them to create caricatures in the Muggshotz generator.`
            },
            unit_amount: pack.amountCents
          },
          quantity: 1
        }
      ],
      metadata: {
        order_type: "token_purchase",
        device_id: deviceId,
        pack_id: packId,
        tokens_to_credit: String(pack.tokens)
      },
      success_url: `${origin}/index.html?tokens=added`,
      cancel_url:  `${origin}/index.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
