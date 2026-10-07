// lib/shipping-notice.js
//
// THE SHIPPING NOTICE (Alyx, 7 Oct 2026: "is there any way that we can let
// them track it?"). Printify tells the site when a shipment leaves, by a
// webhook it signs; the site reads the order it belongs to and emails the
// customer the carrier and the tracking link (api/printify-webhook.js). The
// pieces that can be tested without Printify live here.
//
// Printify's own rules (developers.printify.com, read 7 Oct 2026):
//   topic   order:shipment:created  ("Some/all items have been fulfilled.")
//   header  X-Pfy-Signature: sha256=<HMAC-SHA256 hex of the raw body, keyed by the webhook's secret>
//   payload { id, type, created_at, resource: { id: <order id>, type: "order",
//             data: { shop_id, shipped_at, carrier: { code, tracking_number, tracking_url }, skus } } }
import crypto from "crypto";

export const SHIPMENT_TOPIC = "order:shipment:created";

/**
 * The webhook's secret, derived from the Printify token the server already
 * holds, so registering the webhook and checking its deliveries agree
 * without a second secret to keep anywhere.
 */
export function webhookSecret(apiToken) {
  if (!apiToken) return null;
  return crypto.createHash("sha256").update(`${apiToken}:printify-webhook`).digest("hex");
}

/** True when the delivery was signed with our secret. Constant-time, as Printify asks. */
export function verifyPrintifySignature(rawBody, header, secret) {
  if (!secret || typeof header !== "string") return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(m[1].toLowerCase(), "hex"), b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The shipment in a delivery, or null when the delivery is some other event. */
export function shipmentFromEvent(event) {
  if (!event || event.type !== SHIPMENT_TOPIC || !event.resource || !event.resource.id) return null;
  const d = event.resource.data || {}, c = d.carrier || {};
  return {
    orderId: String(event.resource.id),
    shippedAt: d.shipped_at || null,
    carrier: c.code || null,
    number: c.tracking_number || null,
    url: c.tracking_url || null
  };
}

const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/**
 * The email: who it is for (firstName), what left (items: a list of names),
 * and the shipment (carrier, number, url). Without a tracking link it still
 * says the order is on its way.
 */
export function shippedEmail({ firstName, items, carrier, number, url, orderRef }) {
  const names = (items || []).filter(Boolean);
  const subject = names.length === 1 ? `Your Muggshotz order has shipped: ${names[0]}` : "Your Muggshotz order has shipped";
  const track = url
    ? `<p><b>Track it</b><br><a href="${esc(url)}">${esc(url)}</a>${carrier ? `<br>${esc(carrier)}${number ? ` · ${esc(number)}` : ""}` : ""}</p>`
    : (carrier || number) ? `<p><b>Shipped with</b><br>${esc([carrier, number].filter(Boolean).join(" · "))}</p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">`
    + `<p>Hi${firstName ? " " + esc(firstName) : ""},</p>`
    + `<p>Good news: your order is on its way.</p>`
    + (names.length ? `<p><b>What's in the box</b><br>${names.map(esc).join("<br>")}</p>` : "")
    + track
    + `<p>If it hasn't turned up when the tracking says it should have, reply to this email and a person will chase it.</p>`
    + `<p>Every order you've placed, any time: <a href="https://muggshotz.com/orders">muggshotz.com/orders</a></p>`
    + (orderRef ? `<p style="color:#777;font-size:13px">Order reference: ${esc(orderRef)}</p>` : "")
    + `<p>Muggshotz</p></div>`;
  return { subject, html };
}

/** The names of what an order holds, from Printify's line items. */
export function orderItemNames(order) {
  return ((order && order.line_items) || []).map((li) => {
    const md = li.metadata || {};
    const title = md.title || li.title || null;
    const variant = md.variant_label || null;
    return title ? (variant ? `${title} (${variant})` : title) : null;
  }).filter(Boolean);
}
