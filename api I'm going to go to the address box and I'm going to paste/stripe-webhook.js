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

// Looks up a customer row by device ID.
async function findCustomerByDeviceId(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance`;
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
// in case), starting with 0 tokens before the 4 bonus tokens are added.
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
    body: JSON.stringify({ device_id: deviceId, token_balance: 0 })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase insert failed: " + JSON.stringify(rows));
  return rows[0];
}

// Adds 4 tokens to a customer's existing balance.
async function addFourTokens(customerId, currentBalance) {
  const url = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      token_balance: currentBalance + 4,
      has_unlocked_starter_pack: true
    })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase token credit failed: " + JSON.stringify(rows));
  return rows[0];
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

      let customer = await findCustomerByDeviceId(deviceId);
      if (!customer) {
        customer = await createCustomerForDevice(deviceId);
      }

      await addFourTokens(customer.id, customer.token_balance);
    }

    // Acknowledge receipt so Stripe knows not to retry this event again.
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error handling webhook event:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
