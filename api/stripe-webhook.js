import Stripe from "stripe";

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
      const deviceId = session.metadata?.device_id;

      if (!deviceId) {
        // Payment succeeded but we have no device to credit. Log it so
        // it can be manually resolved, but still acknowledge the event
        // so Stripe doesn't keep retrying forever.
        console.error("Checkout completed with no device_id in metadata:", session.id);
        return res.status(200).json({ received: true, warning: "No device_id in metadata" });
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

    // Acknowledge receipt so Stripe knows not to retry this event again.
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error handling webhook event:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
