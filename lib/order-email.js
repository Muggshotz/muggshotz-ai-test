// lib/order-email.js
//
// THE ORDER EMAIL (Alyx, 7 Oct 2026, after his own test order from the
// Halloween page came with no word from anyone: a neighbour who buys a mat
// "hears nothing"). Sent by the webhook (api/stripe-webhook.js) the moment
// the Printify order is placed -- never before, so it is only ever sent for
// an order that exists -- to the address the customer gave at checkout.
// It says what they bought, what they paid and where it is going, and that
// a reply reaches a person. It promises no dates and no tracking: neither
// is known here.
import { getProduct } from "./products-catalog.js";

const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** One line per item: the catalog's name, its size and colour when it has them. */
export function orderItemLines(items) {
  return (items || []).map((it) => {
    const p = it.productKey ? getProduct(it.productKey) : null;
    const name = p ? p.displayName : (it.productKey || "Your item");
    const bits = [it.sizeLabel, it.colorName].filter((v) => v && String(v).trim());
    return bits.length ? `${name} (${bits.join(", ")})` : name;
  });
}

/**
 * The email's subject and HTML. order: { items, amountCents, currency, firstName,
 * lastName, address1, address2, city, region, zip, country, orderId }.
 */
export function orderPlacedEmail(order) {
  const lines = orderItemLines(order.items);
  const paid = typeof order.amountCents === "number" && order.amountCents >= 0
    ? `${(order.amountCents / 100).toFixed(2)} ${String(order.currency || "usd").toUpperCase()}` : null;
  const name = [order.firstName, order.lastName].filter(Boolean).join(" ");
  const where = [name, order.address1, order.address2, [order.city, order.region, order.zip].filter(Boolean).join(" "), order.country].filter((v) => v && String(v).trim());
  const subject = lines.length === 1 ? `Your Muggshotz order is in: ${lines[0]}` : `Your Muggshotz order is in (${lines.length} items)`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">`
    + `<p>Hi${order.firstName ? " " + esc(order.firstName) : ""},</p>`
    + `<p>Thanks for your order. It's with our printer now, being made.</p>`
    + `<p><b>What you ordered</b><br>${lines.map(esc).join("<br>")}</p>`
    + (paid ? `<p><b>Paid</b><br>${esc(paid)}</p>` : "")
    + (where.length ? `<p><b>Shipping to</b><br>${where.map(esc).join("<br>")}</p>` : "")
    + `<p>If anything about it looks wrong, reply to this email and a person will sort it out.</p>`
    + `<p>See where it is any time, no account needed: <a href="https://muggshotz.com/orders">muggshotz.com/orders</a></p>`
    + `<p style="color:#777;font-size:13px">Order reference: ${esc(order.orderId || "")}</p>`
    + `<p>Muggshotz</p></div>`;
  return { subject, html };
}
