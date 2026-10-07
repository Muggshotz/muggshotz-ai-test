// api/printify-webhook.js
//
// PRINTIFY'S SHIPPING NOTICE (Alyx, 7 Oct 2026). Printify calls this when a
// shipment leaves (order:shipment:created, registered from the admin page:
// api/admin.js printify-webhooks). The delivery is checked against the
// secret derived from the server's Printify token (lib/shipping-notice.js),
// the order it names is read back from Printify for the customer's email
// and what they bought, and the customer is told, with the tracking link.
// Any other event is acknowledged and ignored. Printify retries a delivery
// that is not answered 2xx, so a signed delivery is always answered 200
// once it has been read, whatever the email did.
import { SHOP_ID } from "./create-printify-order.js";
import { webhookSecret, verifyPrintifySignature, shipmentFromEvent, shippedEmail, orderItemNames } from "../lib/shipping-notice.js";

export const config = { api: { bodyParser: false } };

const EMAIL_FROM = process.env.RESEND_FROM || "Muggshotz <hello@muggshotz.com>";
const EMAIL_REPLY_TO = process.env.RESEND_REPLY_TO || "muggshotzreplies@gmail.com";

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readOrder(orderId) {
  const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${encodeURIComponent(orderId)}.json`, {
    headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
  });
  if (!resp.ok) throw new Error(`Printify order ${orderId} could not be read: ${resp.status}`);
  return resp.json();
}

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, reply_to: EMAIL_REPLY_TO, to, subject, html })
  });
  if (!resp.ok) throw new Error("Resend send failed: " + await resp.text());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const secret = webhookSecret(process.env.PRINTIFY_API_TOKEN);
  const rawBody = await readRawBody(req);
  if (!verifyPrintifySignature(rawBody, req.headers["x-pfy-signature"], secret)) {
    console.warn("Printify webhook: bad signature");
    return res.status(401).json({ error: "Bad signature." });
  }
  let event;
  try { event = JSON.parse(rawBody.toString("utf8")); }
  catch (e) { return res.status(400).json({ error: "Not JSON." }); }

  const shipment = shipmentFromEvent(event);
  if (!shipment) return res.status(200).json({ ok: true, ignored: event && event.type });

  try {
    const order = await readOrder(shipment.orderId);
    const to = order.address_to && order.address_to.email;
    if (!to) { console.warn("Shipping notice not sent: no email on Printify order", shipment.orderId); return res.status(200).json({ ok: true, sent: false }); }
    const { subject, html } = shippedEmail({
      firstName: order.address_to.first_name, items: orderItemNames(order),
      carrier: shipment.carrier, number: shipment.number, url: shipment.url,
      orderRef: order.external_id || shipment.orderId
    });
    await sendEmail(to, subject, html);
    console.log("Shipping notice sent for Printify order", shipment.orderId);
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error("Shipping notice failed:", shipment.orderId, err.message);
    return res.status(200).json({ ok: true, sent: false, error: err.message });
  }
}
