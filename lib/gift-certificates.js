// lib/gift-certificates.js
//
// GIFT CERTIFICATES (Alyx, 22 Sep 2026): store credit on a ledger. The bill
// and the coin are pictures of it; the code in an email is the only thing
// the recipient carries, and the ledger is the only thing that counts. See
// GIFT-CERTIFICATES.md for the plan and supabase/gift-certificates.sql for
// the tables.
//
// Lives in lib/, not api/, because the project's twelve serverless function
// slots are all taken. Checkout, the webhook and the balance endpoint import
// from here.
//
// No expiry: federal law forbids a sold certificate expiring inside five
// years and several states forbid expiry at all.

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const GIFT_AMOUNTS_CENTS = [2500, 5000, 7500, 10000];
// Stripe will not take a card payment under 50 cents, so a certificate that
// would cover a whole order leaves 50 cents on the card and keeps the rest.
export const STRIPE_MIN_CHARGE_CENTS = 50;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
export function newGiftCode() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const c = Array.from(bytes, b => ALPHABET[b % 32]).join("");
  return `MUG-${c.slice(0, 4)}-${c.slice(4)}`;
}
export function normalizeGiftCode(raw) {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("MUG") ? s.slice(3) : s;
  return body.length === 8 ? `MUG-${body.slice(0, 4)}-${body.slice(4)}` : null;
}

function headers(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...extra };
}

// Is the ledger there? Checked before a certificate is SOLD, so nobody can pay
// for one while the table is missing and the webhook would have nowhere to
// mint it.
export async function giftLedgerReady() {
  if (!SUPABASE_URL || !KEY) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/gift_certificates?select=code&limit=1`, { headers: headers() });
    return r.ok;
  } catch { return false; }
}

export async function findGiftCertificate(code) {
  const norm = normalizeGiftCode(code);
  if (!norm || !SUPABASE_URL || !KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/gift_certificates?code=eq.${encodeURIComponent(norm)}&select=*`, { headers: headers() });
  if (!r.ok) throw new Error("Gift certificate lookup failed: " + await r.text());
  const rows = await r.json();
  return rows[0] || null;
}

export async function findGiftCertificateBySession(sessionId) {
  if (!sessionId || !SUPABASE_URL || !KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/gift_certificates?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=code,amount_cents,balance_cents,recipient_name,recipient_email`, { headers: headers() });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

// Mint on payment. Idempotent on the Stripe session: a webhook retried by
// Stripe finds the row it already wrote and returns it instead of minting a
// second certificate for one payment.
export async function mintGiftCertificate({ sessionId, amountCents, buyerEmail, recipientEmail, recipientName, message }) {
  const existing = await findGiftCertificateBySession(sessionId);
  if (existing) return { ...existing, alreadyMinted: true };
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newGiftCode();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/gift_certificates`, {
      method: "POST",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({
        code, amount_cents: amountCents, balance_cents: amountCents,
        buyer_email: buyerEmail || "", recipient_email: recipientEmail || "",
        recipient_name: recipientName || "", message: message || "",
        stripe_session_id: sessionId
      })
    });
    if (r.ok) return (await r.json())[0];
    const text = await r.text();
    if (/stripe_session_id/.test(text)) {
      const again = await findGiftCertificateBySession(sessionId);
      if (again) return { ...again, alreadyMinted: true };
    }
    if (!/duplicate key/.test(text)) throw new Error("Gift certificate mint failed: " + text);
  }
  throw new Error("Gift certificate mint failed: could not find a free code.");
}

// Spend on payment. Optimistic: the balance only moves if it still reads what
// was read, so two orders racing on one code cannot both spend the same
// dollars. The use row is unique per order session, so a retried webhook
// cannot spend twice either.
export async function spendGiftCertificate(code, cents, orderSessionId) {
  const norm = normalizeGiftCode(code);
  if (!norm || !(cents > 0)) return { spent: 0 };
  const already = await fetch(`${SUPABASE_URL}/rest/v1/gift_certificate_uses?order_session_id=eq.${encodeURIComponent(orderSessionId)}&select=id`, { headers: headers() });
  if (already.ok && (await already.json()).length) return { spent: 0, alreadySpent: true };
  for (let attempt = 0; attempt < 4; attempt++) {
    const cert = await findGiftCertificate(norm);
    if (!cert || cert.voided_at) throw new Error(`Gift certificate ${norm} not found or void at spend time.`);
    const before = cert.balance_cents;
    const take = Math.min(cents, before);
    if (take <= 0) throw new Error(`Gift certificate ${norm} had no balance left at spend time.`);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/gift_certificates?code=eq.${encodeURIComponent(norm)}&balance_cents=eq.${before}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({ balance_cents: before - take })
    });
    if (!r.ok) throw new Error("Gift certificate spend failed: " + await r.text());
    if ((await r.json()).length) {
      await fetch(`${SUPABASE_URL}/rest/v1/gift_certificate_uses`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ code: norm, order_session_id: orderSessionId, cents_used: take })
      });
      return { spent: take, balanceLeft: before - take, short: cents - take };
    }
  }
  throw new Error(`Gift certificate ${norm}: balance kept changing under the spend.`);
}

export function giftEmailHtml({ code, amountCents, recipientName, message, fromName, siteUrl, forBuyer }) {
  const amt = `$${(amountCents / 100).toFixed(0)}`;
  const esc = s => String(s || "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const head = forBuyer
    ? `<p>Thank you! Your ${amt} Muggshotz gift certificate${recipientName ? ` for ${esc(recipientName)}` : ""} is ready. We have emailed it to them. Here is the code in case you would rather hand it over yourself:</p>`
    : `<p>${recipientName ? `Hi ${esc(recipientName)},` : "Hi,"}</p><p>${fromName ? esc(fromName) + " sent" : "Someone sent"} you a <b>${amt}</b> Muggshotz gift certificate.</p>`;
  return `<div style="font-family:system-ui,sans-serif;max-width:620px;margin:auto;color:#111">
<img src="${siteUrl}/art/gift-certificate-bill-preview.png" alt="Muggshotz gift certificate" style="width:100%;border-radius:10px">
${head}
${message && !forBuyer ? `<p style="font-style:italic;border-left:3px solid #c9a227;padding-left:10px">${esc(message)}</p>` : ""}
<p style="font-size:22px;letter-spacing:2px;text-align:center;background:#f6f0dc;border:2px solid #c9a227;border-radius:8px;padding:12px"><b>${code}</b></p>
<p>Spend it on anything at <a href="${siteUrl}/needles-studio.html">Muggshotz</a>: make a design, and at checkout enter the code in the Gift Certificate box. Whatever is left stays on the code for next time. It never expires.</p>
</div>`;
}
