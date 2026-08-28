import Stripe from "stripe";
import { placeProductOrder } from "./create-printify-order.js";
import { getProduct } from "../lib/products-catalog.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Matches the exact sender address already confirmed working in
// send-verification.js — Resend's own default testing domain, not a
// custom verified domain. Kept identical here so these new flyer
// emails send successfully the same way verification emails already do.
const EMAIL_FROM = "Muggshotz <onboarding@resend.dev>";

// Stripe sends the raw, unparsed request body so it can verify the
// signature. Vercel parses JSON bodies by default, so we have to turn
// that off specifically for this one endpoint.
export const config = {
  api: {
    bodyParser: false
  }
};

// Reads the raw request body as a single Buffer, which Stripe's
// signature verification requires.
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Looks up a customer row by device ID. Now also pulls email_verified
// so we can decide whether this payment also owes them the separate
// email-verification bonus token.
async function findCustomerByDeviceId(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance,email,email_verified`;
  const resp = await fetch(url, {
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase lookup failed: " + JSON.stringify(rows));
  return rows.length > 0 ? rows[0] : null;
}

// Creates a brand-new customer row if this device somehow paid before
// ever generating an image (shouldn't normally happen, but handled just
// in case), starting with 0 tokens and unverified email before this
// payment's tokens get added.
async function createCustomerForDevice(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ device_id: deviceId, token_balance: 0, email_verified: false })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase insert failed: " + JSON.stringify(rows));
  return rows[0];
}

// Marks a customer as having made a real payment at least once. Used
// to gate the Wraparound generation option (see get-balance.js) — a
// simple, permanent flag once true, never reset. Failure here is
// logged but never allowed to block order/token fulfillment, since the
// customer has already been charged real money by the time this runs.
async function markHasPurchased(customerId) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`;
    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ has_purchased: true })
    });
    if (!resp.ok) {
      const err = await resp.json();
      console.warn("Could not mark has_purchased (non-fatal):", JSON.stringify(err));
    }
  } catch (err) {
    console.warn("Could not mark has_purchased (non-fatal):", err.message);
  }
}

// ============================================================
// FLYER TIER SYSTEM (July 2026)
// ============================================================

async function sendResendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.error("CRITICAL: RESEND_API_KEY not set — cannot send flyer notification email.");
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html })
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error("Resend send failed: " + JSON.stringify(err));
    }
  } catch (err) {
    console.error("CRITICAL: Flyer notification email failed to send:", { to, subject, error: err.message });
  }
}

// Looks up which beta and tier a code belongs to — needed after
// crediting commission, to check whether this credit just completed a
// whole tier or pushed the beta's total past $100.
async function getFlyerCodeContext(code) {
  const url = `${SUPABASE_URL}/rest/v1/flyer_codes?code=eq.${encodeURIComponent(code)}&select=id,beta_id,tier,matured`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("flyer_codes lookup failed: " + JSON.stringify(rows));
  return rows.length > 0 ? rows[0] : null;
}

async function getBeta(betaId) {
  const url = `${SUPABASE_URL}/rest/v1/flyer_betas?id=eq.${betaId}&select=id,base_code,full_name,contact_email,current_tier,total_balance_notified_100`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("flyer_betas lookup failed: " + JSON.stringify(rows));
  return rows.length > 0 ? rows[0] : null;
}

// Checks whether every code belonging to this beta, in this tier, is
// now matured — meaning the whole tier is complete and it's time for
// the upsell email + next-tier unlock.
async function isTierFullyMatured(betaId, tier) {
  const url = `${SUPABASE_URL}/rest/v1/flyer_codes?beta_id=eq.${betaId}&tier=eq.${encodeURIComponent(tier)}&select=matured`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("flyer_codes maturity check failed: " + JSON.stringify(rows));
  if (rows.length === 0) return false;
  return rows.every(r => r.matured === true);
}

// Guards against ever sending the same one-time notification twice.
async function tryClaimNotification(betaId, notificationType, tier) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/flyer_notifications_sent`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ beta_id: betaId, notification_type: notificationType, tier: tier || null })
  });
  if (resp.ok) return true;
  const err = await resp.json().catch(() => ({}));
  const alreadyExists = resp.status === 409 || JSON.stringify(err).includes("duplicate");
  if (!alreadyExists) {
    console.error("Could not claim flyer notification (non-fatal):", JSON.stringify(err));
  }
  return false;
}

const TIER_SEQUENCE = ["PotShotz", "HotShotz", "BiggsHotz", "Muggshotz"];

// Rate, per-flyer cap, and flyer count for each tier — the same rules
// the admin onboarding tool uses for PotShotz, extended here to cover
// every tier so an upgrade generates the correct set of codes.
const TIER_RULES = {
  PotShotz:  { rate: 0.03, cap: 20.00,  flyerCount: 20 },
  HotShotz:  { rate: 0.04, cap: 30.00,  flyerCount: 20 },
  BiggsHotz: { rate: 0.05, cap: 50.00,  flyerCount: 20 },
  Muggshotz: { rate: 0.05, cap: 100.00, flyerCount: 40 }
};

// A code's printed suffix needs a tier-specific prefix, because
// flyer_codes.code is a globally unique primary key — without this, a
// beta upgrading tiers would try to create CHIPPER-01 a second time
// (their PotShotz tier already used it) and the insert would fail.
// PotShotz keeps a bare number (matches flyers already onboarded/
// printed by the admin tool before this prefix scheme existed).
const TIER_CODE_PREFIX = {
  PotShotz: "",
  HotShotz: "H",
  BiggsHotz: "B",
  Muggshotz: "M"
};

const TIER_UPGRADE_LABEL = {
  PotShotz: { next: "HotShotz", buyIn: "$20" },
  HotShotz: { next: "BiggsHotz", buyIn: "$50" },
  BiggsHotz: { next: "Muggshotz", buyIn: "$200" },
  Muggshotz: { next: null, buyIn: null }
};

async function maybeSendTierMaturityEmail(betaId, tier) {
  try {
    const fullyMatured = await isTierFullyMatured(betaId, tier);
    if (!fullyMatured) return;

    const claimed = await tryClaimNotification(betaId, "tier_maturity", tier);
    if (!claimed) return; // already sent for this beta+tier

    const beta = await getBeta(betaId);
    if (!beta?.contact_email) {
      console.warn(`Tier ${tier} matured for beta ${betaId}, but no contact_email on file — email skipped.`);
      return;
    }

    const upgrade = TIER_UPGRADE_LABEL[tier];
    const upgradeLine = upgrade?.next
      ? `<p>You're now eligible to move up to <strong>${upgrade.next}</strong> for a one-time ${upgrade.buyIn} buy-in — higher commission rate, higher per-flyer cap. Head to your balance page and tap the upgrade button, or reply to this email.</p>`
      : `<p>You've completed the top tier, Muggshotz! One additional flyer pack is available if you'd like to keep going — reach out anytime.</p>`;

    await sendResendEmail(
      beta.contact_email,
      `You matured your entire ${tier} tier! 🎉`,
      `<p>Hi ${beta.full_name || "there"},</p>
       <p>Great news — every flyer code in your <strong>${tier}</strong> tier has hit its cap. That tier is fully matured.</p>
       ${upgradeLine}
       <p>— MuggsHotz</p>`
    );
    console.log(`Tier maturity email sent to beta ${betaId} for tier ${tier}.`);
  } catch (err) {
    console.error("Tier maturity email check failed (non-fatal):", err.message);
  }
}

async function maybeSendBalance100Email(betaId) {
  try {
    const beta = await getBeta(betaId);
    if (!beta || beta.total_balance_notified_100) return; // already sent, ever

    const balResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_beta_available_balance`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_beta_id: betaId })
    });
    const balance = await balResp.json();
    if (!balResp.ok) throw new Error("fn_beta_available_balance failed: " + JSON.stringify(balance));
    if (Number(balance) < 100) return;

    const claimed = await tryClaimNotification(betaId, "balance_100_threshold", null);
    if (!claimed) return;

    await fetch(`${SUPABASE_URL}/rest/v1/flyer_betas?id=eq.${betaId}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ total_balance_notified_100: true })
    });

    if (!beta.contact_email) {
      console.warn(`Beta ${betaId} crossed $100, but no contact_email on file — email skipped.`);
      return;
    }

    await sendResendEmail(
      beta.contact_email,
      "You've crossed $100 in flyer earnings! 💰",
      `<p>Hi ${beta.full_name || "there"},</p>
       <p>Your MuggsHotz flyers have earned you over <strong>$100</strong> so far — nice work!</p>
       <p>Whenever you're ready, you can request a payout of any amount up to your full balance — just reply to this email or text Alyx.</p>
       <p>— MuggsHotz</p>`
    );
    console.log(`$100 milestone email sent to beta ${betaId}.`);
  } catch (err) {
    console.error("$100 milestone email check failed (non-fatal):", err.message);
  }
}

// Credits commission via the real fn_credit_commission Postgres
// function, then checks for tier maturity and the $100 milestone.
async function creditFlyerCommission(referralCode, productKey, stripeSessionId) {
  if (!referralCode) return;
  try {
    const product = getProduct(productKey);
    const netProfit = typeof product?.estimatedProfit === "number" ? product.estimatedProfit : 0;

    if (netProfit <= 0) {
      console.log(`Flyer code ${referralCode} used on session ${stripeSessionId} — $0 net profit set for "${productKey}", nothing to credit yet.`);
      return;
    }

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_credit_commission`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_code: referralCode,
        p_order_id: stripeSessionId,
        p_net_profit: netProfit
      })
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error("fn_credit_commission failed: " + JSON.stringify(result));

    const row = Array.isArray(result) ? result[0] : result;
    console.log(`Credited $${row.credited_amount} to flyer code ${referralCode} (code total now $${row.new_total}) for session ${stripeSessionId}.`);

    const context = await getFlyerCodeContext(referralCode);
    if (!context) return;

    if (row.newly_matured) {
      await maybeSendTierMaturityEmail(context.beta_id, context.tier);
    }
    await maybeSendBalance100Email(context.beta_id);
  } catch (err) {
    console.error("CRITICAL: Flyer commission credit failed (order still fulfilled normally):", {
      referralCode, stripeSessionId, error: err.message
    });
  }
}

// NEW (July 2026): processes a successful tier-upgrade buy-in payment.
// Bumps the beta's current_tier and generates their full set of codes
// for the new tier. Idempotency guard: if the beta's current_tier is
// already the target tier (e.g. a duplicate webhook retry), this is a
// no-op — codes never get generated twice for the same upgrade.
async function handleTierUpgradePayment(session) {
  const m = session.metadata || {};
  const betaId = m.beta_id;
  const targetTier = m.target_tier;

  if (!betaId || !targetTier) {
    console.error("CRITICAL: tier_upgrade session missing beta_id or target_tier in metadata.", { stripeSessionId: session.id });
    return;
  }

  const rules = TIER_RULES[targetTier];
  if (!rules) {
    console.error(`CRITICAL: No TIER_RULES entry for "${targetTier}".`, { stripeSessionId: session.id });
    return;
  }

  try {
    const beta = await getBeta(betaId);
    if (!beta) {
      console.error("CRITICAL: tier_upgrade payment succeeded but beta no longer exists.", { betaId, stripeSessionId: session.id });
      return;
    }

    if (beta.current_tier === targetTier) {
      console.log(`Beta ${betaId} is already on ${targetTier} — skipping duplicate tier-upgrade processing for session ${session.id}.`);
      return;
    }

    // Bump the tier first.
    const patchResp = await fetch(`${SUPABASE_URL}/rest/v1/flyer_betas?id=eq.${betaId}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ current_tier: targetTier })
    });
    const patchRows = await patchResp.json();
    if (!patchResp.ok) throw new Error("Could not update current_tier: " + JSON.stringify(patchRows));

    // Generate the new tier's full set of codes.
    const prefix = TIER_CODE_PREFIX[targetTier] ?? "";
    const codesToInsert = [];
    for (let i = 1; i <= rules.flyerCount; i++) {
      const suffix = String(i).padStart(2, "0");
      codesToInsert.push({
        beta_id: betaId,
        tier: targetTier,
        code: `${beta.base_code}-${prefix}${suffix}`,
        flyer_number: i,
        commission_rate: rules.rate,
        cap_amount: rules.cap,
        commission_total: 0,
        matured: false
      });
    }

    const codesResp = await fetch(`${SUPABASE_URL}/rest/v1/flyer_codes`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(codesToInsert)
    });
    const codesRows = await codesResp.json();
    if (!codesResp.ok) throw new Error("Tier bumped, but code generation failed: " + JSON.stringify(codesRows));

    console.log(`Beta ${betaId} (${beta.base_code}) upgraded to ${targetTier} — ${codesRows.length} new codes generated. Session ${session.id}.`);

    if (beta.contact_email) {
      await sendResendEmail(
        beta.contact_email,
        `Welcome to ${targetTier}! Your new codes are ready`,
        `<p>Hi ${beta.full_name || "there"},</p>
         <p>You're officially upgraded to <strong>${targetTier}</strong>! Your ${rules.flyerCount} new flyer codes are ready — check your balance page for the full list, or reach out to Alyx to get your printed flyers.</p>
         <p>— MuggsHotz</p>`
      );
    }
  } catch (err) {
    console.error("CRITICAL: Tier upgrade payment succeeded but processing failed — customer paid, needs manual follow-up.", {
      betaId, targetTier, stripeSessionId: session.id, error: err.message
    });
  }
}

// RESTORED: permanently records that this email has now used its
// one-time 10% discount, so it can never be applied again for this
// email. Table: email_discounts (email text primary key, used_at
// timestamp). Only ever called AFTER a real successful order — an
// abandoned or failed checkout never burns the discount. Never allowed
// to throw and block order fulfillment.
async function recordEmailDiscount(email, stripeSessionId) {
  if (!email) return;
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/email_discounts`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({ email: email.toLowerCase(), used_at: new Date().toISOString() })
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error("Email discount record failed: " + JSON.stringify(err));
    }
    console.log(`Recorded one-time email discount as used for ${email} (session ${stripeSessionId}).`);
  } catch (err) {
    console.error("CRITICAL: Email discount recording failed (order still fulfilled normally):", {
      email, stripeSessionId, error: err.message
    });
  }
}

// Credits tokens to a customer's balance. If they hadn't already earned
// the separate email-verification bonus token, this payment covers that
// too — 5 tokens instead of 4. This keeps the total tokens a customer
// can reach the same (6) no matter which order they go through
// free-email-verification vs. paying the $5 deposit.
async function creditTokensForPayment(customer, stripeEmail) {
  const alreadyVerified = customer.email_verified === true;
  const tokensToAdd = alreadyVerified ? 4 : 5;

  const tokenUrl = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customer.id}`;
  const tokenResp = await fetch(tokenUrl, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      token_balance: customer.token_balance + tokensToAdd,
      has_unlocked_starter_pack: true,
      has_purchased: true
    })
  });
  const tokenRows = await tokenResp.json();
  if (!tokenResp.ok) throw new Error("Supabase token credit failed: " + JSON.stringify(tokenRows));

  if (!alreadyVerified && stripeEmail) {
    try {
      const emailUrl = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customer.id}`;
      const emailResp = await fetch(emailUrl, {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({ email: stripeEmail, email_verified: true })
      });
      if (!emailResp.ok) {
        const emailErr = await emailResp.json();
        console.warn("Email update after payment failed (tokens were still credited):", JSON.stringify(emailErr));
      }
    } catch (emailErr) {
      console.warn("Email update after payment failed (tokens were still credited):", emailErr.message);
    }
  }

  return tokenRows[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (!event.livemode) {
        console.warn("Ignored a TEST-MODE checkout.session.completed event — no order placed, no tokens or commission credited.", {
          stripeSessionId: session.id,
          orderType: session.metadata?.order_type || "token/reservation"
        });
        return res.status(200).json({ received: true, ignored: "test_mode" });
      }

      if (session.metadata?.order_type === "mug_order") {
        await handleMugOrderPayment(session);
      } else if (session.metadata?.order_type === "tier_upgrade") {
        await handleTierUpgradePayment(session);
      } else {
        await handleTokenPayment(session);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error handling webhook event:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

const MUG_TYPE_TO_PRODUCT_KEY = {
  "Classic White": "classic-white-mug",
  "Color Pop": "color-pop-mug",
  "Trimmed": "trimmed-mug",
  "Accented": "accented-mug"
};

async function handleMugOrderPayment(session) {
  const m = session.metadata || {};

  const productKey = m.product_key || MUG_TYPE_TO_PRODUCT_KEY[m.mug_type];
  const product = productKey ? getProduct(productKey) : null;
  if (!product) {
    console.error("CRITICAL: Unknown product in session metadata, cannot place order.", {
      stripeSessionId: session.id,
      productKey,
      mugType: m.mug_type
    });
    return;
  }

  const shippingAddress = {
    first_name: m.first_name,
    last_name: m.last_name,
    email: m.email,
    phone: m.phone,
    country: m.country,
    region: m.region,
    address1: m.address1,
    address2: m.address2,
    city: m.city,
    zip: m.zip
  };

  const printMode = m.print_mode === "fullBleed" ? "fullBleed" : "standard";

  const orderInput = {
    productKey,
    sizeLabel: m.size_label,
    colorName: m.color || null,
    printMode,
    shippingAddress,
    customerName: m.customer_name,
    orderId: session.id
  };

  if (product.layoutType === "three-slot-wrap") {
    orderInput.placements = {
      left: m.image_url_a || null,
      front: m.image_url_b || null,
      right: m.image_url_c || null
    };
    // The uncut panorama strip (mug Wraparound). placeProductOrder builds the
    // print file straight from it when present; the thirds above remain the
    // fallback and the classic per-panel path.
    orderInput.panoramaImage = m.image_url_d || null;
  } else if (product.layoutType === "front-back") {
    orderInput.frontImage = m.image_url_a || null;
    orderInput.backImage = m.image_url_b || null;
  } else {
    orderInput.image = m.image_url_a || null;
  }

  try {
    const result = await placeProductOrder(orderInput);
    console.log("Order placed successfully for session", session.id, "-> Printify order", result.printifyOrderId);

    if (m.device_id) {
      let customer = await findCustomerByDeviceId(m.device_id);
      if (!customer) customer = await createCustomerForDevice(m.device_id);
      await markHasPurchased(customer.id);
    }

    if (m.referral_code) {
      await creditFlyerCommission(m.referral_code, productKey, session.id);
    }
    if (m.email_discount_eligible === "true" && m.email) {
      await recordEmailDiscount(m.email, session.id);
    }
  } catch (error) {
    console.error("CRITICAL: Order payment succeeded but Printify order failed.", {
      stripeSessionId: session.id,
      deviceId: m.device_id,
      customerEmail: m.email,
      error: error.message
    });
  }
}

async function handleTokenPayment(session) {
  const deviceId = session.metadata?.device_id;

  if (!deviceId) {
    console.error("Checkout completed with no device_id in metadata:", session.id);
    return;
  }

  const stripeEmail = session.customer_details?.email || session.customer_email || null;

  let customer = await findCustomerByDeviceId(deviceId);
  if (!customer) {
    customer = await createCustomerForDevice(deviceId);
  }

  await creditTokensForPayment(customer, stripeEmail);
}
