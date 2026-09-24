// lib/square.js
//
// THE SQUARE TRACK (Alyx, 24 Sep 2026): a second payment company beside
// Stripe, wired for every checkout the shop has, so either can carry a sale
// and the other is the backup ("switching tracks on a train"). Stripe stays
// the default because its online rate is the cheaper one for the customer;
// Square is there for what Stripe cannot do: Square's physical gift cards,
// the plastic ones that "look and act almost just like credit cards".
//
// Two ways to take a Square payment, and the shop uses both:
//
//   * A PAYMENT LINK: Square's own hosted checkout page, the twin of a Stripe
//     Checkout session. The customer is sent to Square's page and comes back
//     to ours. Used when the admin switch moves the shop onto Square.
//
//   * A PAYMENT ON OUR OWN PAGE, through the Payments API. Square's hosted
//     page does NOT accept Square gift cards (checked 24 Sep 2026: the
//     Checkout API takes cards, wallets and Afterpay; gift cards need the
//     Payments API), so an order paid with a gift card is charged here: the
//     card's balance first, by the card's id, then whatever is left on a
//     bank card tokenised by Square's Web Payments SDK on order.html. Both
//     payments hang on one Square Order and PayOrder closes it.
//
// Lives in lib/ because api/ is full (twelve functions, Vercel Hobby).
// Nothing here knows about mugs: the checkout builds the line items, the
// webhook and the settle path read them back.
//
// Environment (Vercel):
//   SQUARE_ACCESS_TOKEN          the application's access token
//   SQUARE_LOCATION_ID           the location the orders belong to
//   SQUARE_APPLICATION_ID        public; the Web Payments SDK needs it
//   SQUARE_ENV                   "sandbox" (default) or "production"
//   SQUARE_WEBHOOK_SIGNATURE_KEY the subscription's signature key
//   SQUARE_WEBHOOK_URL           the exact notification URL of the
//                                subscription (part of the signature)

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const APPLICATION_ID = process.env.SQUARE_APPLICATION_ID;
const ENV = (process.env.SQUARE_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
const SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

export function squareEnv() { return ENV; }
export function squareConfigured() { return !!(ACCESS_TOKEN && LOCATION_ID); }
export function squareLocationId() { return LOCATION_ID; }
// What order.html needs to draw Square's card form. All of it is public.
export function squarePublicConfig() {
  return { applicationId: APPLICATION_ID || null, locationId: LOCATION_ID || null, env: ENV };
}
export function squareApiBase() {
  return ENV === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}
// The Web Payments SDK script for the page, per environment.
export function squareSdkUrl() {
  return ENV === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
}

export class SquareError extends Error {
  constructor(message, { status, errors } = {}) { super(message); this.status = status; this.errors = errors || []; }
}

// One call to Square. The API version is left to the application's default
// (set in the developer dashboard) rather than pinned to a date here.
export async function squareCall(path, { method = "POST", body } = {}) {
  if (!squareConfigured()) throw new SquareError("Square is not configured (SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID).");
  const resp = await fetch(`${squareApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await resp.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!resp.ok) {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const first = errors[0];
    const msg = first ? `${first.category || ""} ${first.code || ""}: ${first.detail || ""}`.trim() : `Square returned ${resp.status}`;
    throw new SquareError(`Square ${method} ${path} failed: ${msg}`, { status: resp.status, errors });
  }
  return data;
}

const money = (cents) => ({ amount: Math.round(cents), currency: "USD" });

// A Square Order body from the shop's own line-item shape: [{ name,
// description, cents }] and [{ name, cents }] discounts. reference_id carries
// our checkout id (40 chars max at Square; ours are 39), and metadata is
// capped at ten short entries, which is why the real order record lives in
// our own storage and only its id travels here.
export function buildSquareOrder({ checkoutId, orderType, lineItems, discounts = [] }) {
  const order = {
    location_id: LOCATION_ID,
    reference_id: String(checkoutId).slice(0, 40),
    metadata: { checkout_id: String(checkoutId).slice(0, 255), order_type: String(orderType || "").slice(0, 255) },
    line_items: lineItems.filter((li) => li.cents > 0).map((li) => ({
      name: String(li.name || "Item").slice(0, 512),
      quantity: "1",
      base_price_money: money(li.cents),
      ...(li.description ? { note: String(li.description).slice(0, 2000) } : {})
    }))
  };
  const ds = discounts.filter((d) => d.cents > 0);
  if (ds.length) {
    order.discounts = ds.map((d, i) => ({
      uid: `disc-${i + 1}`,
      name: String(d.name || "Discount").slice(0, 255),
      amount_money: money(d.cents),
      scope: "ORDER"
    }));
  }
  return order;
}

// The order's total after discounts, in cents: what has to be paid.
export function orderTotalCents(lineItems, discounts = []) {
  const gross = lineItems.reduce((a, li) => a + Math.max(0, Math.round(li.cents || 0)), 0);
  const off = discounts.reduce((a, d) => a + Math.max(0, Math.round(d.cents || 0)), 0);
  return Math.max(0, gross - off);
}

// SQUARE'S HOSTED PAGE. Square creates the order from the body and answers
// with the page's url and the order's id. Square appends its own ids to the
// redirect url when the customer comes back (orderId, transactionId), so the
// url must already carry whatever we need to recognise the sale.
export async function createPaymentLink({ order, redirectUrl, buyerEmail, description }) {
  const data = await squareCall("/v2/online-checkout/payment-links", {
    body: {
      idempotency_key: randomUUID(),
      ...(description ? { description: String(description).slice(0, 4096) } : {}),
      order,
      checkout_options: {
        redirect_url: redirectUrl,
        ask_for_shipping_address: false
      },
      ...(buyerEmail ? { pre_populated_data: { buyer_email: String(buyerEmail).slice(0, 255) } } : {})
    }
  });
  const link = data.payment_link || {};
  if (!link.url) throw new SquareError("Square returned a payment link with no url.");
  return { url: link.url, orderId: link.order_id || null, linkId: link.id || null };
}

// AN ORDER OF OUR OWN, for the on-page path: the gift card and the bank card
// are paid against it one after the other.
export async function createOrder(order) {
  const data = await squareCall("/v2/orders", { body: { idempotency_key: randomUUID(), order } });
  const o = data.order || {};
  if (!o.id) throw new SquareError("Square returned an order with no id.");
  return { orderId: o.id, totalCents: Number(o.net_amount_due_money?.amount ?? o.total_money?.amount ?? 0), version: o.version };
}

export async function retrieveOrder(orderId) {
  const data = await squareCall(`/v2/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  return data.order || null;
}

// ONE PAYMENT against an order. sourceId is a gift card's id (charged by id,
// as Square's own guide has it: "a gift card ID -- used for other payment
// scenarios, such as payments from a gift card on file") or the token the
// Web Payments SDK made from the customer's bank card. Left uncompleted
// (autocomplete:false) so a second payment can join it; PayOrder completes
// both. partial:true lets a gift card short of the amount pay what it has:
// Square then "creates a payment equal to the gift card balance".
export async function createPayment({ sourceId, orderId, amountCents, buyerEmail, partial = false, note, referenceId }) {
  const data = await squareCall("/v2/payments", {
    body: {
      idempotency_key: randomUUID(),
      source_id: sourceId,
      order_id: orderId,
      location_id: LOCATION_ID,
      amount_money: money(amountCents),
      autocomplete: false,
      accept_partial_authorization: !!partial,
      ...(buyerEmail ? { buyer_email_address: String(buyerEmail).slice(0, 255) } : {}),
      ...(note ? { note: String(note).slice(0, 500) } : {}),
      ...(referenceId ? { reference_id: String(referenceId).slice(0, 40) } : {})
    }
  });
  const p = data.payment || {};
  if (!p.id) throw new SquareError("Square returned a payment with no id.");
  return {
    paymentId: p.id,
    status: p.status || null,
    amountCents: Number(p.amount_money?.amount ?? 0),
    approvedCents: Number(p.approved_money?.amount ?? p.amount_money?.amount ?? 0),
    sourceType: p.source_type || null,
    orderId: p.order_id || orderId
  };
}

export async function cancelPayment(paymentId) {
  try { await squareCall(`/v2/payments/${encodeURIComponent(paymentId)}/cancel`, { body: {} }); return true; }
  catch (err) { console.error("Square payment cancel failed:", paymentId, err.message); return false; }
}

// Closes the order with the payments that cover it; the payments complete.
export async function payOrder(orderId, paymentIds) {
  const data = await squareCall(`/v2/orders/${encodeURIComponent(orderId)}/pay`, {
    body: { idempotency_key: randomUUID(), payment_ids: paymentIds }
  });
  return data.order || null;
}

// A GIFT CARD BY ITS NUMBER. Square's own cards carry a 16-digit GAN starting
// 778273; a card someone typed with spaces or dashes is cleaned first.
export function normalizeGan(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 13 && digits.length <= 255 ? digits : null;
}
export function looksLikeGan(raw) {
  const s = String(raw || "").trim();
  return /^[\d\s-]+$/.test(s) && !!normalizeGan(s);
}
export async function giftCardFromGan(gan) {
  const clean = normalizeGan(gan);
  if (!clean) return null;
  let data;
  try { data = await squareCall("/v2/gift-cards/from-gan", { body: { gan: clean } }); }
  catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
  const g = data.gift_card;
  if (!g) return null;
  return {
    id: g.id,
    gan: g.gan || clean,
    state: g.state || null,
    balanceCents: Number(g.balance_money?.amount ?? 0),
    type: g.type || null,
    last4: String(g.gan || clean).slice(-4)
  };
}

// A card that can pay: on Square's books, active, with money on it.
export function giftCardUsable(card) {
  return !!card && card.state === "ACTIVE" && card.balanceCents > 0;
}

// THE WEBHOOK'S SIGNATURE: HMAC-SHA256 over the notification url followed by
// the raw body, base64, in x-square-hmacsha256-signature. The url is part of
// what is signed, so it has to be the subscription's url byte for byte.
export function verifyWebhookSignature({ rawBody, signature, notificationUrl }) {
  if (!SIGNATURE_KEY || !signature || !notificationUrl) return false;
  const expected = createHmac("sha256", SIGNATURE_KEY)
    .update(notificationUrl + (Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody)))
    .digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function squareWebhookUrl() {
  return process.env.SQUARE_WEBHOOK_URL || `${process.env.PUBLIC_SITE_URL || "https://muggshotz-ai-test.vercel.app"}/api/square-webhook`;
}
