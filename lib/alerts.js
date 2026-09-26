// ALERTS TO ALYX'S PHONE (Alyx, 26 Sep 2026: "a cuckoo clock" for ideas, "a
// broken spring ... boing-yoing-yoing" for bugs, "a cash register tone for
// sales that have just occurred"). Sent through ntfy.sh: he installs the ntfy
// app (Android) and subscribes to the three channels below, one per kind, and
// gives each its own sound in the app.
//
// The channel names are the only secret: anyone who knew one could read its
// alerts. They are derived from a server secret, never written in the repo,
// and read back through the admin page (api/admin.js, action "alert-topics").
// Each kind also carries its own priority, so Android's per-priority
// notification channels can tell them apart even without per-channel sounds.
//
// An alert must never hold up or break the thing it reports: it times out
// after a few seconds, and every failure is logged and swallowed.
import crypto from "crypto";

const KINDS = {
  idea: { label: "ideas", priority: "3", tags: "bulb" },
  bug: { label: "bugs", priority: "2", tags: "beetle" },
  sale: { label: "sales", priority: "4", tags: "moneybag" }
};

function secret() {
  return process.env.RESEND_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_PASSWORD || "";
}

export function alertTopic(kind) {
  const k = KINDS[kind];
  if (!k || !secret()) return null;
  const h = crypto.createHash("sha256").update(`muggshotz-alerts:${kind}:${secret()}`).digest("hex").slice(0, 16);
  return `muggshotz-${k.label}-${h}`;
}

export function alertTopics() {
  return Object.fromEntries(Object.keys(KINDS).map((k) => [k, alertTopic(k)]));
}

// ntfy's Title header must be plain ASCII-safe text.
const headerSafe = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "").slice(0, 120);

export async function sendAlert(kind, title, message, { timeoutMs = 4000 } = {}) {
  const topic = alertTopic(kind);
  if (!topic) { console.warn("Alert not sent: no topic for", kind); return false; }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: { Title: headerSafe(title), Priority: KINDS[kind].priority, Tags: KINDS[kind].tags },
      body: String(message || "").slice(0, 1000),
      signal: ctl.signal
    });
    if (!resp.ok) { console.warn("Alert not delivered:", kind, resp.status); return false; }
    return true;
  } catch (err) {
    console.warn("Alert not delivered:", kind, err.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// The sale alert's words, from a settled checkout (Stripe's session, or the
// Square record shaped like one). Kept here so the webhook only calls it.
export function saleAlertText(session, productName) {
  const m = session?.metadata || {};
  const cents = Number(session?.amount_total);
  const amount = Number.isFinite(cents) && cents > 0 ? ` · $${(cents / 100).toFixed(2)}` : "";
  const type = m.order_type || "token_purchase";
  let what;
  if (type === "mug_order") what = `${productName || m.product_key || "Product"}${m.size_label ? ` (${m.size_label})` : ""}${m.color ? `, ${m.color}` : ""}`;
  else if (type === "basket_order") what = "Basket order";
  else if (type === "gift_certificate") what = `Gift certificate $${(Number(m.amount_cents) / 100 || 0).toFixed(2)}`;
  else if (type === "reservation") what = "Preview reservation";
  else if (type === "tier_upgrade") what = "Flyer tier upgrade";
  else what = `Tokens${m.pack_id ? ` (${m.pack_id})` : ""}`;
  return { title: `Sale: ${what}`, message: `${what}${amount}${session?.rail === "square" ? " · Square" : ""}` };
}
