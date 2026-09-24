// lib/payment-rail.js
//
// WHICH TRACK A SALE RUNS ON (Alyx, 24 Sep 2026): "either track would be
// fully wired, but the track that we use the most will be the Stripe track
// because it's the cheapest for the customer. But when dealing with gift
// cards specifically, we would naturally switch automatically to the Square
// track."
//
// So:
//   * an order paying with a Square gift card goes to Square, whatever the
//     switch says -- only Square can charge that card;
//   * otherwise the admin switch decides (site_settings.payment_rail),
//     Stripe by default;
//   * and if Square is not configured, Stripe, so a half-set-up Square can
//     never refuse a sale.
//
// The switch is a row, not an environment variable, for the reason
// lib/maintenance.js gives: a row flips from a phone in seconds, an env var
// needs a redeploy. Reading it fails open to Stripe -- a Supabase hiccup
// must not move the shop onto a track by itself.
//
// Also here: the fee line per track, the minimum a card is charged per
// track, and the checkout record a Square sale keeps in our own storage
// (Square's order metadata holds ten short values; a mug order carries
// forty, some of them 490 characters, so only the record's id goes to Square
// and the webhook reads the record back by it).

import { randomUUID } from "node:crypto";
import { squareConfigured } from "./square.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const RAILS = ["stripe", "square"];

function headers(extra = {}) {
  return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...extra };
}

// The switch. Never throws; unreadable means Stripe.
export async function readPaymentRail() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return "stripe";
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=payment_rail`, { headers: headers() });
    if (!resp.ok) return "stripe";
    const rows = await resp.json();
    const rail = String(rows?.[0]?.payment_rail || "stripe").toLowerCase();
    return RAILS.includes(rail) ? rail : "stripe";
  } catch (err) {
    console.error("Payment rail unreadable (Stripe it is):", err.message);
    return "stripe";
  }
}

// Set the switch. Throws on failure, like writeMaintenance: a write that
// silently did nothing would leave the shop on the wrong track.
export async function writePaymentRail(rail) {
  const r = String(rail || "").toLowerCase();
  if (!RAILS.includes(r)) throw new Error(`Unknown payment rail "${rail}".`);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase is not configured, so the payment rail cannot be set.");
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.1`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ payment_rail: r, updated_at: new Date().toISOString() })
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(`Could not set the payment rail: ${JSON.stringify(body)}`);
  if (!Array.isArray(body) || !body.length) throw new Error("site_settings row is missing — run supabase/site-settings.sql first.");
  return String(body[0].payment_rail || "stripe");
}

// The track for this checkout. `body` is the checkout request.
export async function chooseRail(body = {}) {
  if (body.squareGan) {
    if (!squareConfigured()) {
      const e = new Error("Square gift cards aren't accepted just yet. Please pay another way.");
      e.status = 400; throw e;
    }
    return "square";
  }
  const wanted = await readPaymentRail();
  if (wanted === "square" && !squareConfigured()) {
    console.error("Payment rail is set to Square but Square is not configured; using Stripe.");
    return "stripe";
  }
  return wanted;
}

// THE FEE LINE, per track. Stripe: 2.9% + 30c. Square on the Free plan:
// 3.3% + 30c (Square's published online rate, 2026; the Plus plan brings it
// to 2.9% for $49 a month -- change SQUARE_FEE_RATE here if Alyx moves up).
// Plus the 5c handling fee either way. Passed through at cost and described
// truthfully on the line, as create-checkout-session.js's FEES note insists.
export const STRIPE_FEE_RATE = 0.029;
export const SQUARE_FEE_RATE = 0.033;
export const FEE_FIXED_CENTS = 30;
export const HANDLING_FEE_CENTS = 5;
export function feeRateFor(rail) { return rail === "square" ? SQUARE_FEE_RATE : STRIPE_FEE_RATE; }
// handling:false waives the 5c (the dollar token pack, "3 for $1.33").
export function feeLineCentsFor(subtotalCents, rail, { handling = true } = {}) {
  if (!subtotalCents || subtotalCents <= 0) return 0;
  return Math.ceil(feeRateFor(rail) * subtotalCents + FEE_FIXED_CENTS + (handling ? HANDLING_FEE_CENTS : 0));
}
export function feeLineDescriptionFor(rail, { handling = true } = {}) {
  const pct = (feeRateFor(rail) * 100).toFixed(1);
  return `Payment processing at our processor's standard rate (${pct}% + 30¢)` + (handling ? " plus a 5¢ handling fee" : "");
}
// The least a card can be charged: Stripe 50c, Square $1.00. A store
// certificate that would cover a whole order leaves this much on the card.
export function minChargeCentsFor(rail) { return rail === "square" ? 100 : 50; }

// THE CHECKOUT RECORD, for the Square track: everything the webhook would
// have read from Stripe's session metadata, kept as
// generations/checkouts/<id>.json. Settling marks the record, so a payment
// settled on the page and reported again by the webhook is settled once.
export function newCheckoutId() { return `sq_${randomUUID()}`; }
function recordUrl(id) {
  return `${SUPABASE_URL}/storage/v1/object/generations/checkouts/${encodeURIComponent(id)}.json`;
}
export async function storeCheckoutRecord(id, record) {
  const resp = await fetch(recordUrl(id), {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", "x-upsert": "true" },
    body: JSON.stringify({ version: 1, ...record })
  });
  if (!resp.ok) throw new Error("Checkout record storage failed: " + await resp.text());
}
export async function readCheckoutRecord(id) {
  if (!/^sq_[0-9a-f-]{36}$/.test(String(id || ""))) return null;
  const resp = await fetch(recordUrl(id), { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
  if (resp.status === 404 || resp.status === 400) return null;
  if (!resp.ok) throw new Error(`Checkout record ${id} could not be read: ${resp.status}`);
  return resp.json();
}
export async function updateCheckoutRecord(id, patch) {
  const cur = (await readCheckoutRecord(id)) || {};
  const next = { ...cur, ...patch };
  await storeCheckoutRecord(id, next);
  return next;
}

// What the webhook handlers read: the same shape as a Stripe Checkout
// Session, built from our record, so one settle path serves both tracks.
export function sessionFromRecord(id, record) {
  return {
    id,
    rail: "square",
    metadata: record.metadata || {},
    customer_email: record.customerEmail || null,
    customer_details: { email: record.customerEmail || null },
    livemode: record.env === "production"
  };
}
