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
    const totalBalance = Number(balanceRaw) || 0;

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.query.referralCode) {
    return handleReferralLookup(req, res);
  }

  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ error: "Missing device ID." });
    }
    const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=token_balance,role,has_purchased`;
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
      return res.status(200).json({ tokenBalance: 0, isAdmin: false, hasPurchased: false });
    }

    const customer = rows[0];
    return res.status(200).json({
      tokenBalance: customer.token_balance,
      isAdmin: customer.role === "admin",
      hasPurchased: !!customer.has_purchased
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
