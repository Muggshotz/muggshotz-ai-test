// lib/orders-ledger.js
//
// WHERE'S MY ORDER? (Alyx, 7 Oct 2026: "if I order a package from Amazon I
// can just go into my amazon account and I can track every package"). The
// site has no accounts: a customer is the email they typed at checkout. So
// the webhook keeps one small file per email address of the orders placed
// with it (recordOrder, the moment the Printify order exists), and the
// orders page (orders.html, api/orders.js) opens it for whoever proves they
// hold that inbox: they type the address, a one-tap link goes to it, and the
// link shows every order with its state read live from Printify.
//
// The file lives in the generations bucket, in a folder of its own, keyed by
// a hash of the address so the listing names nobody.
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}` });

export function cleanEmail(email) { return String(email || "").trim().toLowerCase(); }
export function emailKey(email) { return crypto.createHash("sha256").update(cleanEmail(email)).digest("hex"); }
const fileUrl = (email) => `${SUPABASE_URL}/storage/v1/object/generations/orders/${emailKey(email)}.json`;

/** The orders placed with this address, newest first. None: []. */
export async function readOrders(email) {
  if (!SUPABASE_URL || !KEY || !cleanEmail(email)) return [];
  const resp = await fetch(fileUrl(email), { headers: headers() });
  if (resp.status === 404 || resp.status === 400) return [];
  if (!resp.ok) throw new Error(`The orders for that address could not be read: ${resp.status}`);
  const d = await resp.json();
  return Array.isArray(d.orders) ? d.orders.slice().sort((a, b) => String(b.placedAt).localeCompare(String(a.placedAt))) : [];
}

/**
 * One more order for this address: { ref (the checkout session), printify
 * (Printify's order id), placedAt, items (names), amountCents, currency,
 * firstName }. An order already there (a webhook replay) is left as it is.
 */
export async function recordOrder(email, entry) {
  if (!SUPABASE_URL || !KEY || !cleanEmail(email) || !entry || !entry.ref) return null;
  const orders = await readOrders(email);
  if (orders.some((o) => o.ref === entry.ref)) return orders;
  const next = orders.concat([{ ...entry, placedAt: entry.placedAt || new Date().toISOString() }]);
  const resp = await fetch(fileUrl(email), {
    method: "POST", headers: { ...headers(), "Content-Type": "application/json", "x-upsert": "true" },
    body: JSON.stringify({ email: cleanEmail(email), orders: next })
  });
  if (!resp.ok) throw new Error("The order could not be noted: " + await resp.text());
  return next;
}

// THE ONE-TAP LINK: the address and an expiry, signed with a secret derived
// from the server's own key, so nothing else has to be kept anywhere. Seven
// days, then they ask for another.
export const LINK_DAYS = 7;
export function linkSecret() { return KEY ? crypto.createHash("sha256").update(`${KEY}:orders-link`).digest("hex") : null; }
const b64u = (s) => Buffer.from(s).toString("base64url");
export function makeOrdersToken(email, now = Date.now()) {
  const secret = linkSecret(); if (!secret) return null;
  const body = b64u(JSON.stringify({ e: cleanEmail(email), x: now + LINK_DAYS * 86400000 }));
  return body + "." + crypto.createHmac("sha256", secret).update(body).digest("hex");
}
/** The address a token stands for, or null when it is forged or stale. */
export function readOrdersToken(token, now = Date.now()) {
  const secret = linkSecret(); if (!secret || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const want = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(sig, "hex"), b = Buffer.from(want, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return d && d.e && typeof d.x === "number" && d.x > now ? d.e : null;
  } catch (e) { return null; }
}

// WHAT PRINTIFY SAYS, IN WORDS. Its statuses (API reference, 7 Oct 2026):
// pending, on-hold, sending-to-production, in-production, canceled,
// fulfilled, partially-fulfilled, payment-not-received, has-issues,
// cost-calculation, unfulfillable, ...; shipments carry carrier, number,
// url, delivered_at.
export function orderState(printifyOrder) {
  const o = printifyOrder || {};
  const shipments = (o.shipments || []).map((s) => ({ carrier: s.carrier || null, number: s.number || null, url: s.url || null, deliveredAt: s.delivered_at || null }));
  const status = String(o.status || "");
  let state, words;
  if (shipments.length && shipments.every((s) => s.deliveredAt)) { state = "delivered"; words = "Delivered"; }
  else if (shipments.length) { state = "shipped"; words = shipments.length > 1 ? "Shipped, in more than one parcel" : "Shipped"; }
  else if (status === "canceled") { state = "cancelled"; words = "Cancelled"; }
  else if (["has-issues", "unfulfillable", "payment-not-received", "source-check-failed"].includes(status)) { state = "attention"; words = "Needs a look from us. We'll be in touch."; }
  else if (["in-production", "sending-to-production", "fulfilled", "partially-fulfilled"].includes(status)) { state = "made"; words = "Being made"; }
  else { state = "placed"; words = "Order received"; }
  return { state, words, shipments };
}
