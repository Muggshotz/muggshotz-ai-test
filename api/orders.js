// api/orders.js -- WHERE'S MY ORDER? (Alyx, 7 Oct 2026). See lib/orders-ledger.js.
//   POST { email }   a one-tap link to that inbox, when any order was placed
//                    with it; the answer is the same either way, so the page
//                    never tells a stranger whether an address has ordered.
//   GET  ?t=<token>  the orders behind a link, each with its state and
//                    tracking read live from Printify.
import { SHOP_ID } from "./create-printify-order.js";
import { readOrders, makeOrdersToken, readOrdersToken, orderState, cleanEmail } from "../lib/orders-ledger.js";

const EMAIL_FROM = process.env.RESEND_FROM || "Muggshotz <hello@muggshotz.com>";
const EMAIL_REPLY_TO = process.env.RESEND_REPLY_TO || "muggshotzreplies@gmail.com";
export const ORDERS_PAGE = "https://muggshotz.com/orders";

const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sendLink(email, token) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const url = `${ORDERS_PAGE}?t=${encodeURIComponent(token)}`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM, reply_to: EMAIL_REPLY_TO, to: email, subject: "Your Muggshotz orders, one tap away",
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222"><p>Tap below to see every order placed with this address, where each one is, and its tracking.</p>`
        + `<p><a href="${esc(url)}" style="display:inline-block;padding:12px 18px;background:#ff7a1a;color:#1a0f05;font-weight:700;border-radius:8px;text-decoration:none">See my orders</a></p>`
        + `<p style="color:#777;font-size:13px">The link works for 7 days. If you didn't ask for it, ignore this email; nothing happens without the tap.</p><p>Muggshotz</p></div>`
    })
  });
  if (!resp.ok) throw new Error("Resend send failed: " + await resp.text());
}

async function printifyOrder(id) {
  const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${encodeURIComponent(id)}.json`, {
    headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
  });
  if (!resp.ok) return null;
  return resp.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "POST") {
    let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const email = cleanEmail(body && body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "That email doesn't look right." });
    try {
      const orders = await readOrders(email);
      if (orders.length) await sendLink(email, makeOrdersToken(email));
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Orders link failed:", err.message);
      return res.status(500).json({ error: "Could not send the link just now. Please try again in a minute." });
    }
  }
  if (req.method === "GET") {
    const email = readOrdersToken(req.query && req.query.t);
    if (!email) return res.status(401).json({ error: "That link is not valid any more. Ask for a new one." });
    try {
      const orders = (await readOrders(email)).slice(0, 20);
      const out = await Promise.all(orders.map(async (o) => {
        const live = o.printify ? await printifyOrder(o.printify).catch(() => null) : null;
        const st = orderState(live);
        return { ref: o.ref, placedAt: o.placedAt, items: o.items || [], amountCents: o.amountCents ?? null, currency: o.currency || "usd", state: st.state, words: live ? st.words : "Order received", shipments: st.shipments };
      }));
      return res.status(200).json({ email, orders: out });
    } catch (err) {
      console.error("Orders read failed:", err.message);
      return res.status(500).json({ error: "Could not read your orders just now. Please try again in a minute." });
    }
  }
  return res.status(405).end();
}
