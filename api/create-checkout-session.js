import Stripe from "stripe";
import { getProduct } from "../lib/products-catalog.js";
import { calculateShippingCharge } from "../lib/printify-shipping.js";
import { readMaintenance } from "../lib/maintenance.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TOKEN_PACKS = {
  "1token":  { tokens: 1,  amountCents: 50,  label: "1 Token — 50¢" },
  "3tokens": { tokens: 3,  amountCents: 100, label: "3 Tokens — $1.00" },
  "20tokens":{ tokens: 20, amountCents: 500, label: "20 Tokens — $5.00" }
};

const GIFT_MESSAGE_PRICE = 1.00;
// Wraparound = 3 real generation runs at 50c each. Charged at cost, not
// marked up (Alyx, Sep 2026). Was $3. NOTE: the file carrying this change
// had been uploaded to the repo ROOT instead of api/, so it never routed
// and customers kept paying the old $3 -- merged into the live file here.
const WRAPAROUND_SET_SURCHARGE = 1.5;

// flyer/referral code support (July 2026)
const FLYER_DISCOUNT_RATE = 0.10;

// Checks Supabase for whether this email has already redeemed the
// one-time 10% discount. Table: email_discounts (email text primary
// key, used_at timestamp). If the table doesn't exist yet, or the
// lookup fails for any reason, we fail CLOSED — meaning no discount is
// applied — rather than fail open and risk giving the discount out
// unlimited times due to an infrastructure hiccup.
async function checkEmailDiscountEligibility(email) {
  if (!email || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/email_discounts?email=eq.${encodeURIComponent(email.toLowerCase())}&select=email`;
    const resp = await fetch(url, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    if (!resp.ok) {
      console.error("Email discount eligibility check failed (failing closed, no discount):", await resp.text());
      return false;
    }
    const rows = await resp.json();
    return rows.length === 0; // eligible only if no prior redemption row exists
  } catch (err) {
    console.error("Email discount eligibility check errored (failing closed, no discount):", err.message);
    return false;
  }
}

// calculateShippingCharge now lives in lib/printify-shipping.js (Sep 2026)
// so that order.html's Order Summary and this checkout session bill from
// the SAME function. They used to disagree: the page showed a hardcoded
// flat $6.95 for every product while this file charged the real per-product
// Printify rate. See lib/printify-shipping.js for the markup/buffer rules.

function calculateUpsellCharge(placements) {
  if (!placements) return 0;
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;
  if (filled.length <= 1) return 0;

  // Only charge for the real cost driver: each additional DISTINCT design
  // actually generated beyond the first. Repeating the same finished design
  // across 2 or 3 panels costs nothing extra -- reprinting is free, another
  // generation run is what actually costs 50 cents. Replaces the old panel-
  // count tiers (3/5/6), which billed up to $6 for work that could cost us
  // nothing (Alyx, Sep 2026: "I don't want to be jacking up the cost of the
  // bill for a mug by $6 just because they wanted to add an extra image").
  return Math.max(0, (distinctCount - 1) * 0.5);
}

// FEES (Alyx, 2026-08-28, revised same day): originally a mysterious
// grossed-up "Fees" line; Alyx pushed back -- "Customers may resent that.
// Why not simply tell them what it's for?" So the fee is now EXACTLY what
// we tell the customer it is: Stripe's published per-transaction rate
// (2.9% + 30c) passed through at cost, plus a 5c handling fee. The 5c
// quietly covers Stripe's bite on the fee line itself (~2-3c on typical
// orders), so we stay whole WITHOUT a gross-up formula that would
// contradict the stated rate. Every word of the customer-facing
// explanation is verifiable -- deliberately no invented regulatory
// justification, because nothing external mandates this fee and a
// customer who looks it up should find we told the truth.
// Applied uniformly to every order regardless of payment method, which
// makes it plain pricing (a service fee), NOT a card surcharge -- card
// surcharges are restricted in some states; a uniform fee line is not.
// Tax's share of Stripe's cut is not recouped (tax is computed by Stripe
// after this session is built); the 5c absorbs most of that residue too.
const STRIPE_FEE_RATE = 0.029;
const STRIPE_FEE_FIXED_CENTS = 30;
const HANDLING_FEE_CENTS = 5;
function feeLineCents(subtotalCents) {
  if (!subtotalCents || subtotalCents <= 0) return 0;
  return Math.ceil(STRIPE_FEE_RATE * subtotalCents + STRIPE_FEE_FIXED_CENTS + HANDLING_FEE_CENTS);
}

function resolvePrice(product, sizeLabel, colorName, posterChoice) {
  // The poster keeps its sizes one level down (product.base.sizes) because
  // it once carried a framed upsell tree beside them. Found Sep 2026 by the
  // back-half suite: every poster checkout answered 400 "Unknown size" at
  // the Pay click, so no poster was ever purchasable. Orientation and finish
  // are checked here too, so a bad pair fails BEFORE the card is charged
  // rather than inside the webhook after it.
  if (product.base?.sizes) {
    const tree = product.base;
    const sizeEntry = tree.sizes[sizeLabel];
    if (!sizeEntry) throw new Error(`Unknown poster size "${sizeLabel}".`);
    const orientation = posterChoice?.orientation;
    if (!orientation || !sizeEntry.orientations.includes(orientation))
      throw new Error(`Unknown or missing orientation "${orientation}" for size "${sizeLabel}".`);
    const finish = posterChoice?.finish;
    if (!finish || !tree.finishes.includes(finish))
      throw new Error(`Unknown or missing finish "${finish}".`);
    return sizeEntry.price;
  }
  const sizeEntry = product.sizes?.[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown size "${sizeLabel}" for this product.`);
  return sizeEntry.price;
}

const MUG_TYPE_TO_PRODUCT_KEY = {
  "Classic White": "classic-white-mug",
  "Color Pop": "color-pop-mug",
  "Trimmed": "trimmed-mug",
  "Accented": "accented-mug"
};

async function handleReservation(req, res) {
  const { email, deviceId } = req.body || {};
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    customer_email: email || undefined,
    metadata: { device_id: deviceId || "" },
    success_url: `${process.env.PUBLIC_SITE_URL || "https://muggshotz-ai-test.vercel.app"}?checkout=success`,
    cancel_url:  `${process.env.PUBLIC_SITE_URL || "https://muggshotz-ai-test.vercel.app"}?checkout=cancelled`
  });
  return res.status(200).json({ url: session.url });
}

async function handleProductOrder(req, res) {
  const {
    deviceId, sizeLabel, customerName, giftMessage, shippingAddress, printMode, isWraparoundSet, referralCode
  } = req.body;

  const productKey = req.body.productKey || MUG_TYPE_TO_PRODUCT_KEY[req.body.mugType];
  const colorName = req.body.colorName || req.body.color || null;
  const placements = req.body.placements || null;
  const placementAdjust = req.body.placementAdjust || null;
  const frontImage = req.body.frontImage || null;
  const backImage = req.body.backImage || null;
  const singleImage = req.body.image || null;

  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  const product = productKey ? getProduct(productKey) : null;
  if (!product) return res.status(400).json({ error: `"${req.body.mugType || productKey}" isn't available yet.` });

  let basePrice;
  try {
    basePrice = resolvePrice(product, sizeLabel, colorName, {
      orientation: req.body.posterOrientation, finish: req.body.posterFinish
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const requiresColor = !!(product.sizes?.[sizeLabel]?.colors || product.colors);
  if (requiresColor && !colorName) return res.status(400).json({ error: "Please pick a color." });

  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right))
      return res.status(400).json({ error: "At least one design is required." });
  } else if (product.layoutType === "front-back") {
    if (!frontImage && !backImage)
      return res.status(400).json({ error: "At least a front or back image is required." });
  } else {
    if (!singleImage)
      return res.status(400).json({ error: "An image is required." });
  }

  if (!shippingAddress?.email || !shippingAddress?.address1 || !shippingAddress?.city ||
      !shippingAddress?.region || !shippingAddress?.zip)
    return res.status(400).json({ error: "Missing required shipping information." });

  const resolvedPrintMode = printMode === "fullBleed" ? "fullBleed" : "standard";

  const upsellCharge = product.layoutType === "three-slot-wrap"
    ? (isWraparoundSet ? WRAPAROUND_SET_SURCHARGE : calculateUpsellCharge(placements))
    : 0;
  const giftCharge = giftMessage?.trim() ? GIFT_MESSAGE_PRICE : 0;

  // one-time 10% email discount, checked fresh at checkout creation time.
  const cleanReferralCode = (referralCode || "").trim().toUpperCase() || null;
  const emailDiscountEligible = await checkEmailDiscountEligibility(shippingAddress.email);
  const discountAmount = emailDiscountEligible ? Math.round(basePrice * FLYER_DISCOUNT_RATE * 100) / 100 : 0;

  const productCents = Math.round((basePrice - discountAmount + upsellCharge + giftCharge) * 100);

  // calculateShippingCharge THROWS rather than returning $0 when it can
  // resolve no real cost (see lib/printify-shipping.js). Caught here so the
  // customer gets a plain retry message instead of a raw internal error.
  let shippingCharge = 0;
  if (product.shippingSeparate) {
    try {
      shippingCharge = await calculateShippingCharge(product, basePrice, shippingAddress.country || "US");
    } catch (err) {
      console.error("Shipping resolution failed, refusing to create session:", err.message);
      return res.status(503).json({
        error: "We couldn't confirm the shipping cost for this order just now. Please try again in a moment."
      });
    }
  }
  const shippingCents = Math.round(shippingCharge * 100);

  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";
  const discountSuffix = emailDiscountEligible ? " (10% first-order discount applied)" : "";
  const productName = `Muggshotz ${product.displayName} (${sizeLabel})${colorName ? " - " + colorName : ""}${discountSuffix}`;

  const line_items = [
    { price_data: { currency: "usd", product_data: { name: productName, description: `Custom ${product.displayName}` }, unit_amount: productCents }, quantity: 1 }
  ];
  if (shippingCents > 0) {
    line_items.push({
      price_data: { currency: "usd", product_data: { name: "Shipping & Handling" }, unit_amount: shippingCents },
      quantity: 1
    });
  }
  const feeCents = feeLineCents(productCents + shippingCents);
  if (feeCents > 0) {
    line_items.push({
      price_data: { currency: "usd", product_data: { name: "Card Processing & Handling", description: "Payment processing at our processor's standard rate (2.9% + 30¢) plus a 5¢ handling fee" }, unit_amount: feeCents },
      quantity: 1
    });
  }

  let imageUrlA = "", imageUrlB = "", imageUrlC = "";
  if (product.layoutType === "three-slot-wrap") {
    imageUrlA = placements.left || "";
    imageUrlB = placements.front || "";
    imageUrlC = placements.right || "";
  } else if (product.layoutType === "front-back") {
    imageUrlA = frontImage || "";
    imageUrlB = backImage || "";
  } else {
    imageUrlA = singleImage || "";
  }
  // The uncut panorama, when the studio produced one (mug Wraparound). The
  // print file is built straight from this single strip; without it the
  // server falls back to reassembling the three thirds -- same pixels, but
  // the strip is the source of truth and it must survive the payment hop.
  const imageUrlD = req.body.panoramaImage || "";
  // The greeting card's inside page, when the customer asked for one. It gets
  // a NAMED key rather than borrowing image_url_b: on a single-image product
  // b and c happen to be empty today, but "empty today" is how a future
  // second placement silently overwrites somebody's card. Blank inside -- the
  // default and the ordinary card -- stores an empty string and prints
  // nothing, exactly as before.
  const imageUrlInside = req.body.insideImage || "";
  // The customer PAYS for the gift message (GIFT_MESSAGE_PRICE above), so the
  // text itself must survive into the order record -- it used to be charged
  // and then dropped on the floor, never stored anywhere. Stripe metadata
  // values cap at 500 chars, so trim with room to spare.
  const giftMessageText = (giftMessage || "").trim().slice(0, 450);
  // Same 500-char metadata cap as gift_message above. The per-panel
  // adjustments used to be a few dozen chars of small numbers; since the
  // caption became its own hosted layer (Sep 2026) each panel can carry a
  // caption URL as well, and three of those alone pass 490. The JSON is
  // therefore split across up to four metadata values (placement_adjust,
  // placement_adjust_2..4) that the webhook joins back together before
  // parsing. Anything beyond that would be a garbled placement, which the
  // webhook reads as "no adjustment" -- so it is logged loudly here.
  const placementAdjustText = product.layoutType === "three-slot-wrap" && placementAdjust
    ? JSON.stringify(placementAdjust)
    : "";
  const ADJUST_CHUNK = 490;
  const placementAdjustChunks = [];
  for (let i = 0; i < placementAdjustText.length && placementAdjustChunks.length < 4; i += ADJUST_CHUNK) {
    placementAdjustChunks.push(placementAdjustText.slice(i, i + ADJUST_CHUNK));
  }
  if (placementAdjustText.length > ADJUST_CHUNK * 4) {
    console.error("placementAdjust too long for Stripe metadata; the order will print without adjustments:", placementAdjustText.length);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    automatic_tax: { enabled: true },
    line_items,
    metadata: {
      order_type: "mug_order",
      device_id: deviceId,
      product_key: productKey,
      size_label: sizeLabel,
      color: colorName || "",
      print_mode: resolvedPrintMode,
      is_wraparound_set: isWraparoundSet ? "true" : "false",
      image_url_a: imageUrlA,
      image_url_b: imageUrlB,
      image_url_c: imageUrlC,
      image_url_d: imageUrlD,
      image_url_inside: imageUrlInside,
      // The poster's variant is picked by orientation + finish, not by size
      // alone; without these the webhook could not place a poster at all.
      poster_orientation: req.body.posterOrientation || "",
      poster_finish: req.body.posterFinish || "",
      placement_adjust: placementAdjustChunks[0] || "",
      placement_adjust_2: placementAdjustChunks[1] || "",
      placement_adjust_3: placementAdjustChunks[2] || "",
      placement_adjust_4: placementAdjustChunks[3] || "",
      gift_message: giftMessageText,
      customer_name: customerName || "",
      first_name: shippingAddress.first_name || "",
      last_name: shippingAddress.last_name || "",
      email: shippingAddress.email || "",
      phone: shippingAddress.phone || "",
      country: shippingAddress.country || "US",
      region: shippingAddress.region || "",
      address1: shippingAddress.address1 || "",
      address2: shippingAddress.address2 || "",
      city: shippingAddress.city || "",
      zip: shippingAddress.zip || "",
      referral_code: cleanReferralCode || "",
      email_discount_eligible: emailDiscountEligible ? "true" : "false",
      base_price: String(basePrice),
      fees_cents: String(feeCents)
    },
    success_url: `${origin}/order.html?checkout=success`,
    cancel_url: `${origin}/order.html?checkout=cancelled`
  });

  return res.status(200).json({ url: session.url });
}

async function handleTokenPurchase(req, res) {
  const { deviceId, packId } = req.body || {};
  const pack = TOKEN_PACKS[packId];
  if (!pack) return res.status(400).json({ error: `Unknown token pack "${packId}".` });
  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });

  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";

  // Fees on token packs too -- proportionally these hurt the most
  // uncovered (30c fixed on a $5 pack is where Stripe's bite peaks).
  const packFeeCents = feeLineCents(pack.amountCents);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: pack.label },
        unit_amount: pack.amountCents
      },
      quantity: 1
    },
    {
      price_data: {
        currency: "usd",
        product_data: { name: "Card Processing & Handling", description: "Payment processing at our processor's standard rate (2.9% + 30¢) plus a 5¢ handling fee" },
        unit_amount: packFeeCents
      },
      quantity: 1
    }],
    metadata: { device_id: deviceId, pack_id: packId, fees_cents: String(packFeeCents) },
    success_url: `${origin}/index.html?checkout=success`,
    cancel_url: `${origin}/index.html?checkout=cancelled`
  });

  return res.status(200).json({ url: session.url });
}

// NEW (July 2026, flyer tier system): a Beta buying into the next tier
// once their current tier is fully matured. Priced by TIER_BUY_INS
// below — kept as a flat lookup here rather than a database table,
// since these five values essentially never change and this avoids an
// extra round-trip on every checkout.
//
// SECURITY NOTE: eligibility is re-verified server-side here — never
// trust that the "Upgrade" button was only shown because the tier was
// actually matured. A Beta (or anyone with a betaId) hitting this
// endpoint directly must still be correctly blocked if their tier
// isn't really fully matured yet, or if they try to skip a tier.
const TIER_SEQUENCE = ["PotShotz", "HotShotz", "BiggsHotz", "Muggshotz"];
const TIER_BUY_INS = {
  HotShotz:  { amountCents: 2000,  label: "HotShotz Tier Upgrade — $20" },
  BiggsHotz: { amountCents: 5000,  label: "BiggsHotz Tier Upgrade — $50" },
  Muggshotz: { amountCents: 20000, label: "Muggshotz Tier Upgrade — $200" }
};

async function getBetaForUpgrade(betaId) {
  const url = `${SUPABASE_URL}/rest/v1/flyer_betas?id=eq.${encodeURIComponent(betaId)}&select=id,base_code,current_tier`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("flyer_betas lookup failed: " + JSON.stringify(rows));
  return rows.length > 0 ? rows[0] : null;
}

async function isCurrentTierFullyMatured(betaId, tier) {
  const url = `${SUPABASE_URL}/rest/v1/flyer_codes?beta_id=eq.${encodeURIComponent(betaId)}&tier=eq.${encodeURIComponent(tier)}&select=matured`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("flyer_codes maturity check failed: " + JSON.stringify(rows));
  if (rows.length === 0) return false;
  return rows.every(r => r.matured === true);
}

async function handleTierUpgrade(req, res) {
  const { betaId } = req.body || {};
  if (!betaId) return res.status(400).json({ error: "Missing betaId." });

  try {
    const beta = await getBetaForUpgrade(betaId);
    if (!beta) return res.status(404).json({ error: "Beta not found." });

    const currentIndex = TIER_SEQUENCE.indexOf(beta.current_tier);
    const nextTier = TIER_SEQUENCE[currentIndex + 1];
    if (!nextTier) {
      return res.status(400).json({ error: "You're already on the top tier — there's no further upgrade available." });
    }

    const fullyMatured = await isCurrentTierFullyMatured(beta.id, beta.current_tier);
    if (!fullyMatured) {
      return res.status(400).json({ error: `Your ${beta.current_tier} tier isn't fully matured yet — keep sharing your current flyers first.` });
    }

    const buyIn = TIER_BUY_INS[nextTier];
    if (!buyIn) return res.status(500).json({ error: `No buy-in price configured for ${nextTier}.` });

    const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: buyIn.label, description: `Beta ${beta.base_code} upgrading from ${beta.current_tier} to ${nextTier}` },
          unit_amount: buyIn.amountCents
        },
        quantity: 1
      }],
      metadata: {
        order_type: "tier_upgrade",
        beta_id: beta.id,
        base_code: beta.base_code,
        from_tier: beta.current_tier,
        target_tier: nextTier
      },
      success_url: `${origin}/flyer-balance.html?upgrade=success`,
      cancel_url: `${origin}/flyer-balance.html?upgrade=cancelled`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Tier upgrade checkout failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // KILL SWITCH. Checked before anything is routed, so it stops every kind
  // of checkout: product orders, token purchases, reservations and tier
  // upgrades alike. If the generator is producing bad print files then
  // selling tokens for it is also the wrong thing to do.
  //
  // This has to live here rather than only in the page. order.html is a
  // static asset and the site installs as a standalone app, so a cached
  // copy will keep posting to this endpoint long after the banner went up.
  // Hiding the button is courtesy; this is the actual control.
  //
  // readMaintenance() fails open by design — see lib/maintenance.js.
  const maintenance = await readMaintenance();
  if (maintenance.on) {
    console.log("Checkout refused: maintenance mode is on.");
    return res.status(503).json({
      maintenance: true,
      error: maintenance.message,
      eta: maintenance.eta
    });
  }

  try {
    const { type } = req.body || {};
    if (type === "reservation") {
      return await handleReservation(req, res);
    }
    if (type === "token_purchase") {
      return await handleTokenPurchase(req, res);
    }
    if (type === "mug_order") {
      return await handleProductOrder(req, res);
    }
    if (type === "tier_upgrade") {
      return await handleTierUpgrade(req, res);
    }
    return res.status(400).json({ error: `Unknown checkout type "${type}".` });
  } catch (error) {
    console.error("Checkout session creation failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
