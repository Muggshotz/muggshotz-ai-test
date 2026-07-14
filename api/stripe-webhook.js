import Stripe from "stripe";
import { placeProductOrder } from "./create-printify-order.js";
import { getProduct } from "../lib/products-catalog.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// RESTORED (July 2026): flyer/referral commission rate. Kept as a flat
// rate here since the full tiered PotShotz/HotShotz/BiggsHotz/Muggshotz
// commission-rate-per-tier system is a separate, not-yet-built project.
// This is the simpler standalone version: one flat rate against a
// product's estimatedProfit field (still 0 on every product right now,
// so nothing pays out until real numbers are filled in).
const FLYER_COMMISSION_RATE = 0.05;

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

// Marks a customer as having made a real payment at least once. Used
// to gate the Wraparound generation option (see get-balance.js) — a
// simple, permanent flag once true, never reset. Failure here is
// logged but never allowed to block order/token fulfillment, since the
// customer has already been charged real money by the time this runs.
async function markHasPurchased(customerId) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`;
    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ has_purchased: true })
    });
    if (!resp.ok) {
      const err = await resp.json();
      console.warn("Could not mark has_purchased (non-fatal):", JSON.stringify(err));
    }
  } catch (err) {
    console.warn("Could not mark has_purchased (non-fatal):", err.message);
  }
}

// RESTORED: credits commission to a flyer/referral code's running
// balance after a REAL order has genuinely succeeded. Table:
// referral_codes (code text primary key, balance numeric default 0).
// Uses Supabase's upsert-on-conflict so a first-time code creates its
// row automatically. Commission = FLYER_COMMISSION_RATE * product's
// estimatedProfit — which is 0 for every product right now, so this
// safely credits $0 until real profit numbers are filled in. Never
// allowed to throw and block order fulfillment — logged and swallowed
// on failure, same pattern as markHasPurchased above.
async function creditFlyerCommission(referralCode, productKey, stripeSessionId) {
  if (!referralCode) return;
  try {
    const product = getProduct(productKey);
    const estimatedProfit = typeof product?.estimatedProfit === "number" ? product.estimatedProfit : 0;
    const commission = Math.round(estimatedProfit * FLYER_COMMISSION_RATE * 100) / 100;

    if (commission <= 0) {
      console.log(`Flyer code ${referralCode} used on session ${stripeSessionId} — $0 commission (estimatedProfit not yet set for "${productKey}").`);
      return;
    }

    // Read current balance (if any), then write back balance + commission.
    // Two-step read-then-write rather than a single atomic increment,
    // since Supabase's REST interface doesn't support a raw SQL
    // increment through PostgREST without a custom RPC function.
    const lookupUrl = `${SUPABASE_URL}/rest/v1/referral_codes?code=eq.${encodeURIComponent(referralCode)}&select=code,balance`;
    const lookupResp = await fetch(lookupUrl, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const rows = await lookupResp.json();
    if (!lookupResp.ok) throw new Error("Referral code lookup failed: " + JSON.stringify(rows));

    const currentBalance = rows.length > 0 ? Number(rows[0].balance) || 0 : 0;
    const newBalance = Math.round((currentBalance + commission) * 100) / 100;

    const upsertResp = await fetch(`${SUPABASE_URL}/rest/v1/referral_codes`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({ code: referralCode, balance: newBalance })
    });
    if (!upsertResp.ok) {
      const err = await upsertResp.json();
      throw new Error("Referral code balance update failed: " + JSON.stringify(err));
    }

    console.log(`Credited $${commission} commission to flyer code ${referralCode} (new balance $${newBalance}) for session ${stripeSessionId}.`);
  } catch (err) {
    console.error("CRITICAL: Flyer commission credit failed (order still fulfilled normally):", {
      referralCode, stripeSessionId, error: err.message
    });
  }
}

// RESTORED: permanently records that this email has now used its
// one-time 10% discount, so it can never be applied again for this
// email. Table: email_discounts (email text primary key, used_at
// timestamp). Only ever called AFTER a real successful order — an
// abandoned or failed checkout never burns the discount. Never allowed
// to throw and block order fulfillment.
async function recordEmailDiscount(email, stripeSessionId) {
  if (!email) return;
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/email_discounts`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({ email: email.toLowerCase(), used_at: new Date().toISOString() })
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error("Email discount record failed: " + JSON.stringify(err));
    }
    console.log(`Recorded one-time email discount as used for ${email} (session ${stripeSessionId}).`);
  } catch (err) {
    console.error("CRITICAL: Email discount recording failed (order still fulfilled normally):", {
      email, stripeSessionId, error: err.message
    });
  }
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
      has_unlocked_starter_pack: true,
      has_purchased: true
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
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // CRITICAL SAFETY CHECK: a test-mode Stripe session can "complete"
      // successfully using Stripe's well-known public test card numbers,
      // with zero real money ever collected. event.livemode is set
      // directly by Stripe itself (not something this code or a
      // customer can fake) — true only for genuine live payments.
      // Anything test-mode is stopped here, before it ever reaches
      // Printify, token-crediting, or flyer commission logic.
      if (!event.livemode) {
        console.warn("Ignored a TEST-MODE checkout.session.completed event — no order placed, no tokens or commission credited.", {
          stripeSessionId: session.id,
          orderType: session.metadata?.order_type || "token/reservation"
        });
        return res.status(200).json({ received: true, ignored: "test_mode" });
      }

      if (session.metadata?.order_type === "mug_order") {
        await handleMugOrderPayment(session);
      } else {
        await handleTokenPayment(session);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error handling webhook event:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

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

  const printMode = m.print_mode === "fullBleed" ? "fullBleed" : "standard";

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

    if (m.device_id) {
      let customer = await findCustomerByDeviceId(m.device_id);
      if (!customer) customer = await createCustomerForDevice(m.device_id);
      await markHasPurchased(customer.id);
    }

    // RESTORED: only after the order has genuinely succeeded — a
    // failed/undeliverable order never credits commission or burns the
    // customer's one-time discount.
    if (m.referral_code) {
      await creditFlyerCommission(m.referral_code, productKey, session.id);
    }
    if (m.email_discount_eligible === "true" && m.email) {
      await recordEmailDiscount(m.email, session.id);
    }
  } catch (error) {
    console.error("CRITICAL: Order payment succeeded but Printify order failed.", {
      stripeSessionId: session.id,
      deviceId: m.device_id,
      customerEmail: m.email,
      error: error.message
    });
  }
}

async function handleTokenPayment(session) {
  const deviceId = session.metadata?.device_id;

  if (!deviceId) {
    console.error("Checkout completed with no device_id in metadata:", session.id);
    return;
  }

  const stripeEmail = session.customer_details?.email || session.customer_email || null;

  let customer = await findCustomerByDeviceId(deviceId);
  if (!customer) {
    customer = await createCustomerForDevice(deviceId);
  }

  await creditTokensForPayment(customer, stripeEmail);
}
