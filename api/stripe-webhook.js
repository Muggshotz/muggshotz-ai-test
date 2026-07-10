import Stripe from "stripe";
import { placeProductOrder } from "./create-printify-order.js";
import { getProduct } from "../lib/products-catalog.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Stripe sends the raw, unparsed request body so it can verify the
// signature. Vercel parses JSON bodies by default, so we have to turn
// that off specifically for this one endpoint.
export const config = {
  api: {
    bodyParser: false
  }
};

// Reads the raw request body as a single Buffer, which Stripe's
// signature verification requires.
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Looks up a customer row by device ID. Now also pulls email_verified
// so we can decide whether this payment also owes them the separate
// email-verification bonus token.
async function findCustomerByDeviceId(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance,email,email_verified`;
  const resp = await fetch(url, {
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase lookup failed: " + JSON.stringify(rows));
  return rows.length > 0 ? rows[0] : null;
}

// Creates a brand-new customer row if this device somehow paid before
// ever generating an image (shouldn't normally happen, but handled just
// in case), starting with 0 tokens and unverified email before this
// payment's tokens get added.
async function createCustomerForDevice(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ device_id: deviceId, token_balance: 0, email_verified: false })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase insert failed: " + JSON.stringify(rows));
  return rows[0];
}

// Credits tokens to a customer's balance. If they hadn't already earned
// the separate email-verification bonus token, this payment covers that
// too — 5 tokens instead of 4. This keeps the total tokens a customer
// can reach the same (6) no matter which order they go through
// free-email-verification vs. paying the $5 deposit.
//
// Token crediting and the email update are done as two SEPARATE steps
// on purpose. Token crediting is tied to real money already paid and
// must always succeed. The email update is just bookkeeping on top of
// that — if it fails for any reason (like the email already being used
// by a different customer row), that should never cost the customer
// the tokens they already paid for. It just gets logged instead.
async function creditTokensForPayment(customer, stripeEmail) {
  const alreadyVerified = customer.email_verified === true;
  const tokensToAdd = alreadyVerified ? 4 : 5;

  const tokenUrl = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customer.id}`;
  const tokenResp = await fetch(tokenUrl, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      token_balance: customer.token_balance + tokensToAdd,
      has_unlocked_starter_pack: true
    })
  });
  const tokenRows = await tokenResp.json();
  if (!tokenResp.ok) throw new Error("Supabase token credit failed: " + JSON.stringify(tokenRows));

  // Only attempt this if they hadn't already verified by some other
  // path — never downgrade or overwrite an existing verified email.
  if (!alreadyVerified && stripeEmail) {
    try {
      const emailUrl = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customer.id}`;
      const emailResp = await fetch(emailUrl, {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({ email: stripeEmail, email_verified: true })
      });
      if (!emailResp.ok) {
        const emailErr = await emailResp.json();
        console.warn("Email update after payment failed (tokens were still credited):", JSON.stringify(emailErr));
      }
    } catch (emailErr) {
      console.warn("Email update after payment failed (tokens were still credited):", emailErr.message);
    }
  }

  return tokenRows[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    // Signature verification failed, or the request wasn't really from
    // Stripe. Reject it rather than trusting it.
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Two completely different kinds of payment come through this
      // same webhook: token purchases/the $5 Preview Reservation (credits
      // tokens) and a real mug order (fires the actual Printify order).
      // The order_type metadata field set at checkout creation is what
      // tells them apart.
      if (session.metadata?.order_type === "mug_order") {
        await handleMugOrderPayment(session);
      } else {
        await handleTokenPayment(session);
      }
    }

    // Acknowledge receipt so Stripe knows not to retry this event again.
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error handling webhook event:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

// Handles a real product order payment: reconstructs the order details
// from the session metadata and fires the actual Printify order. If
// Printify fails for any reason, this is logged clearly for manual
// follow-up — but the webhook still acknowledges receipt to Stripe (the
// customer already paid; a fulfillment failure needs a human to fix,
// not an endless Stripe retry loop).
//
// Old-mug-type fallback: create-checkout-session.js was recently
// updated to send product_key directly, but keeping this fallback
// means any checkout session created moments before that deploy (still
// in flight with the old mug_type-only metadata) doesn't silently fail.
const MUG_TYPE_TO_PRODUCT_KEY = {
  "Classic White": "classic-white-mug",
  "Color Pop": "color-pop-mug",
  "Trimmed": "trimmed-mug",
  "Accented": "accented-mug"
};

async function handleMugOrderPayment(session) {
  const m = session.metadata || {};

  const productKey = m.product_key || MUG_TYPE_TO_PRODUCT_KEY[m.mug_type];
  const product = productKey ? getProduct(productKey) : null;
  if (!product) {
    console.error("CRITICAL: Unknown product in session metadata, cannot place order.", {
      stripeSessionId: session.id,
      productKey,
      mugType: m.mug_type
    });
    return;
  }

  const shippingAddress = {
    first_name: m.first_name,
    last_name: m.last_name,
    email: m.email,
    phone: m.phone,
    country: m.country,
    region: m.region,
    address1: m.address1,
    address2: m.address2,
    city: m.city,
    zip: m.zip
  };

  // print_mode was added by create-checkout-session.js — "fullBleed" for
  // the free full-wrap option, "standard" otherwise. Defaults safely to
  // "standard" if it's ever missing from older/edge-case sessions.
  const printMode = m.print_mode === "fullBleed" ? "fullBleed" : "standard";

  // image_url_a/b/c mean different things depending on layoutType — see
  // create-checkout-session.js for the packing side of this same map.
  const orderInput = {
    productKey,
    sizeLabel: m.size_label,
    colorName: m.color || null,
    printMode,
    shippingAddress,
    customerName: m.customer_name,
    orderId: session.id
  };

  if (product.layoutType === "three-slot-wrap") {
    orderInput.placements = {
      left: m.image_url_a || null,
      front: m.image_url_b || null,
      right: m.image_url_c || null
    };
  } else if (product.layoutType === "front-back") {
    orderInput.frontImage = m.image_url_a || null;
    orderInput.backImage = m.image_url_b || null;
  } else {
    orderInput.image = m.image_url_a || null;
  }

  try {
    const result = await placeProductOrder(orderInput);
    console.log("Order placed successfully for session", session.id, "-> Printify order", result.printifyOrderId);
  } catch (error) {
    // Never let a Printify failure look like it silently vanished —
    // this is the one thing that genuinely needs a human to notice and
    // manually fix, since the customer has already been charged.
    console.error("CRITICAL: Order payment succeeded but Printify order failed.", {
      stripeSessionId: session.id,
      deviceId: m.device_id,
      customerEmail: m.email,
      error: error.message
    });
  }
}

// Handles token-crediting payments: both the $5 Preview Reservation and
// the standalone token pack purchases land here, since neither sets
// order_type to "mug_order".
async function handleTokenPayment(session) {
  const deviceId = session.metadata?.device_id;

  if (!deviceId) {
    // Payment succeeded but we have no device to credit. Log it so
    // it can be manually resolved.
    console.error("Checkout completed with no device_id in metadata:", session.id);
    return;
  }

  // Stripe Checkout collects the email during the payment form
  // itself, under customer_details.
  const stripeEmail = session.customer_details?.email || session.customer_email || null;

  let customer = await findCustomerByDeviceId(deviceId);
  if (!customer) {
    customer = await createCustomerForDevice(deviceId);
  }

  await creditTokensForPayment(customer, stripeEmail);
}
