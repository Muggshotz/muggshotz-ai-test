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
//
// RESTORED (July 2026, flyer system Step 3): also handles a second,
// unrelated lookup — a flyer/referral code's running commission
// balance, for the self-serve Beta balance-check page (flyer-
// balance.html). Added as a second branch in this same file rather
// than a new endpoint file, since Vercel's Hobby plan caps a project at
// 12 serverless functions and this project is already sitting right at
// that limit — adding a new file would break deployment the same way
// admin-lookup.js briefly did earlier this month.
async function handleReferralLookup(req, res) {
  const { referralCode } = req.query;
  const cleanCode = (referralCode || "").trim().toUpperCase();
  if (!cleanCode) return res.status(400).json({ error: "Missing referral code." });

  try {
    const url = `${SUPABASE_URL}/rest/v1/referral_codes?code=eq.${encodeURIComponent(cleanCode)}&select=code,balance`;
    const resp = await fetch(url, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const rows = await resp.json();
    if (!resp.ok) throw new Error("Supabase referral lookup failed: " + JSON.stringify(rows));

    if (rows.length === 0) {
      // A code with no commission earned yet has no row (see
      // creditFlyerCommission in stripe-webhook.js — rows are only
      // created the first time a code actually earns something).
      // That's a normal, valid state, not an error — a brand-new code
      // simply has a $0 balance.
      return res.status(200).json({ code: cleanCode, balance: 0, found: false });
    }

    return res.status(200).json({ code: rows[0].code, balance: Number(rows[0].balance) || 0, found: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Branch by which query param is present — deviceId is the original
  // token-meter lookup, referralCode is the new flyer-balance lookup.
  if (req.query.referralCode) {
    return handleReferralLookup(req, res);
  }

  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ error: "Missing device ID." });
    }
    const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=token_balance,role,has_purchased`
