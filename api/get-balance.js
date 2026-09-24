import { findGiftCertificate, findGiftCertificateBySession } from "../lib/gift-certificates.js";
import { squareConfigured, giftCardFromGan, giftCardUsable } from "../lib/square.js";
import { cardOffer } from "../lib/card-bonus.js";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Simple read-only lookup: given a device ID, return its current token
// balance (and whether it's an admin/unlimited account) so the front end
// can display a live token meter without needing to run a generation
// first. Never creates a new customer row — if the device doesn't exist
// yet, it just hasn't generated anything, so we report 0 rather than
// creating a row here (the first real generate() call handles creation).
//
// hasPurchased added (July 2026): true once this customer has ever
// completed ANY real payment — a token pack, the $5 Preview
// Reservation, or a real product order. Used to gate the Wraparound
// generation option, since it costs more in API usage than a single
// image and shouldn't be available on a customer's very first free
// token (that would effectively hand out 3 images for the price of 1).

const TIER_SEQUENCE = ["PotShotz", "HotShotz", "BiggsHotz", "Muggshotz"];

// CORRECTED (July 2026): this used to query a table called
// referral_codes with just (code, balance) columns — that was the
// EARLY flat-rate draft of the flyer system, which got replaced when
// the real tiered schema (flyer_betas / flyer_codes / flyer_commission_
// events / the fn_credit_commission and fn_beta_available_balance
// functions) was actually run in Supabase. The old referral_codes
// table either doesn't exist anymore or is disconnected from live
// data — this was silently returning wrong/empty results on
// flyer-balance.html until caught. Now correctly reads from
// flyer_codes + flyer_betas, and also returns everything
// flyer-balance.html needs to decide whether to show a tier-upgrade
// button (current tier, whether it's fully matured, what the next
// tier is).
async function handleReferralLookup(req, res) {
  const { referralCode } = req.query;
  const cleanCode = (referralCode || "").trim().toUpperCase();
  if (!cleanCode) return res.status(400).json({ error: "Missing referral code." });

  try {
    const codeUrl = `${SUPABASE_URL}/rest/v1/flyer_codes?code=eq.${encodeURIComponent(cleanCode)}&select=id,beta_id,tier,matured`;
    const codeResp = await fetch(codeUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
    const codeRows = await codeResp.json();
    if (!codeResp.ok) throw new Error("flyer_codes lookup failed: " + JSON.stringify(codeRows));

    if (codeRows.length === 0) {
      return res.status(200).json({ code: cleanCode, found: false });
    }
    const flyerCode = codeRows[0];

    const betaUrl = `${SUPABASE_URL}/rest/v1/flyer_betas?id=eq.${flyerCode.beta_id}&select=id,base_code,full_name,current_tier`;
    const betaResp = await fetch(betaUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
    const betaRows = await betaResp.json();
    if (!betaResp.ok) throw new Error("flyer_betas lookup failed: " + JSON.stringify(betaRows));
    if (betaRows.length === 0) {
      return res.status(200).json({ code: cleanCode, found: false });
    }
    const beta = betaRows[0];

    const balResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_beta_available_balance`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_beta_id: beta.id })
    });
    const balanceRaw = await balResp.json();
    if (!balResp.ok) throw new Error("fn_beta_available_balance failed: " + JSON.stringify(balanceRaw));
    let totalBalance = Number(balanceRaw) || 0;
    // Money already paid out (recorded from the admin ledger) comes off the
    // balance the beta sees. The table may not exist yet on a project that
    // has not run supabase/flyer-ledger.sql -- then nothing is subtracted.
    try {
      const payResp = await fetch(`${SUPABASE_URL}/rest/v1/flyer_payouts?beta_id=eq.${encodeURIComponent(String(beta.id))}&select=amount`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      });
      if (payResp.ok) {
        const paid = (await payResp.json()).reduce((s, p) => s + Number(p.amount || 0), 0);
        totalBalance = Math.max(0, Math.round((totalBalance - paid) * 100) / 100);
      }
    } catch (err) {
      console.error("Payout lookup failed (balance shown unreduced):", err.message);
    }

    const tierCodesUrl = `${SUPABASE_URL}/rest/v1/flyer_codes?beta_id=eq.${beta.id}&tier=eq.${encodeURIComponent(beta.current_tier)}&select=matured`;
    const tierCodesResp = await fetch(tierCodesUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
    const tierCodesRows = await tierCodesResp.json();
    if (!tierCodesResp.ok) throw new Error("tier maturity check failed: " + JSON.stringify(tierCodesRows));
    const tierFullyMatured = tierCodesRows.length > 0 && tierCodesRows.every(r => r.matured === true);

    const currentIndex = TIER_SEQUENCE.indexOf(beta.current_tier);
    const nextTier = TIER_SEQUENCE[currentIndex + 1] || null;
    const canUpgrade = tierFullyMatured && !!nextTier;

    return res.status(200).json({
      code: cleanCode,
      found: true,
      betaId: beta.id,
      baseCode: beta.base_code,
      fullName: beta.full_name,
      currentTier: beta.current_tier,
      totalBalance,
      tierFullyMatured,
      canUpgrade,
      nextTier
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// RECOVER A GENERATION THAT WAS MADE BUT NEVER ARRIVED (Sep 2026).
//
// A generation can finish on the server and still never reach the customer:
// fetch() settles on the response HEADERS, and reading the BODY is a second
// wait that a dropped stream leaves hanging for ever. The picture exists, the
// token is spent, and the customer has nothing.
//
// Every generated image is already stored as `${deviceId}-${Date.now()}.png`
// in the public `generations` bucket -- the device is in the filename, so
// finding a customer's own recent work needs no table and no new endpoint.
// This rides on get-balance rather than standing alone because the Hobby plan
// caps this project at 12 serverless functions and it is sitting on exactly 12.
//
// Only that device's own files are listed, and only ones it produced, so this
// hands back nothing a customer did not already pay for.
async function handleRecentLookup(req, res) {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  const since = Number(req.query.since) || 0;
  try {
    const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/generations`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      // `prefix` in Supabase storage is a FOLDER path, not a filename prefix --
      // these files sit at the bucket root, so a prefix of "deviceId-" matches
      // a directory that does not exist and returns nothing. `search` is the
      // one that filters on the name. The JS filter below still enforces the
      // device boundary, so a loose search can never widen what comes back.
      body: JSON.stringify({
        prefix: "",
        search: `${deviceId}-`,
        limit: 100,
        sortBy: { column: "created_at", order: "desc" }
      })
    });
    const rows = await resp.json();
    if (!resp.ok) throw new Error("Storage list failed: " + JSON.stringify(rows));
    // The timestamp in the NAME is the one to trust: it is stamped at the
    // moment of upload by the same code that made the picture, so it lines up
    // with when the customer pressed Generate. created_at can drift.
    const recent = (Array.isArray(rows) ? rows : [])
      .map(r => {
        const name = r.name || "";
        // The device boundary is enforced HERE, on the name itself, so that
        // however the listing is filtered upstream nothing belonging to another
        // customer can come back.
        if (!name.startsWith(`${deviceId}-`)) return null;
        const m = /-(\d{10,})\.png$/.exec(name);
        return m ? { name, madeAt: Number(m[1]) } : null;
      })
      .filter(Boolean)
      .filter(r => r.madeAt >= since)
      .sort((a, b) => b.madeAt - a.madeAt)
      .slice(0, 10)
      .map(r => ({
        url: `${SUPABASE_URL}/storage/v1/object/public/generations/${r.name}`,
        madeAt: r.madeAt
      }));
    // A build marker, so a caller can tell which version answered. Polling a
    // deploy for "did my fix land" is guesswork without one -- an empty list
    // looks identical before and after.
    return res.status(200).json({ recent, listed: Array.isArray(rows) ? rows.length : 0, mode: "recent-v2" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}


// GIFT CERTIFICATE LOOKUPS (22 Sep 2026), here because every function slot is
// taken. ?giftCode= answers the order page's Apply button with the balance;
// ?giftSession= answers the buyer's thank-you page with the code, keyed on
// the Stripe session id only the buyer's browser was sent back with.
async function handleGiftLookup(req, res) {
  try {
    // A SQUARE GIFT CARD (24 Sep 2026): the plastic ones. Answered with what
    // is on it, so the order page can show it and route the sale to Square.
    if (req.query.squareGan) {
      if (!squareConfigured()) return res.status(200).json({ valid: false, reason: "square_off" });
      const card = await giftCardFromGan(req.query.squareGan);
      if (!giftCardUsable(card)) return res.status(200).json({ valid: false });
      return res.status(200).json({ valid: true, square: true, last4: card.last4, balanceCents: card.balanceCents });
    }
    if (req.query.giftCode) {
      const c = await findGiftCertificate(req.query.giftCode);
      if (!c || c.voided_at || c.balance_cents <= 0) return res.status(200).json({ valid: false });
      return res.status(200).json({ valid: true, code: c.code, balanceCents: c.balance_cents });
    }
    const c = await findGiftCertificateBySession(req.query.giftSession);
    if (!c) return res.status(200).json({ ready: false });
    return res.status(200).json({ ready: true, code: c.code, amountCents: c.amount_cents, recipientName: c.recipient_name, recipientEmail: c.recipient_email });
  } catch (err) {
    console.error("Gift lookup failed:", err.message);
    return res.status(503).json({ error: "Could not check the gift certificate just now." });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET" && (req.query.giftCode || req.query.giftSession || req.query.squareGan)) return handleGiftLookup(req, res);
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.query.referralCode) {
    return handleReferralLookup(req, res);
  }

  // ?card= : is this business-card code's offer on, and for how many spins.
  if (req.query.card) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const offer = cardOffer(req.query.card);
    return res.status(200).json(offer ? { on: true, spins: offer.spins } : { on: false });
  }

  if (req.query.recent) {
    return handleRecentLookup(req, res);
  }

  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ error: "Missing device ID." });
    }
    const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=token_balance,role,has_purchased,email_verified`;
    const resp = await fetch(url, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const rows = await resp.json();
    if (!resp.ok) throw new Error("Supabase lookup failed: " + JSON.stringify(rows));

    if (rows.length === 0) {
      // No customer row yet means this device hasn't generated anything --
      // report 0 rather than creating a row here (the first real generate()
      // call handles creation, per the comment at the top of this file).
      return res.status(200).json({ tokenBalance: 0, isAdmin: false, hasPurchased: false, emailVerified: false });
    }

    const customer = rows[0];
    return res.status(200).json({
      tokenBalance: customer.token_balance,
      isAdmin: customer.role === "admin",
      hasPurchased: !!customer.has_purchased,
      emailVerified: !!customer.email_verified
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
