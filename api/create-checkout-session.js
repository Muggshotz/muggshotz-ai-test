import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { getProduct } from "../lib/products-catalog.js";
import { calculateShippingCharge, calculateBasketShipping } from "../lib/printify-shipping.js";
import { readMaintenance } from "../lib/maintenance.js";
import { TOKEN_PACKS } from "../lib/token-packs.js";
import { GIFT_AMOUNTS_CENTS, findGiftCertificate, normalizeGiftCode, giftLedgerReady } from "../lib/gift-certificates.js";
import { chooseRail, feeLineCentsFor, feeLineDescriptionFor, minChargeCentsFor, newCheckoutId, storeCheckoutRecord, readCheckoutRecord, updateCheckoutRecord } from "../lib/payment-rail.js";
import { squareEnv, squarePublicConfig, squareSdkUrl, buildSquareOrder, orderTotalCents, createPaymentLink, createOrder, createPayment, payOrder, cancelPayment, giftCardFromGan, giftCardUsable } from "../lib/square.js";
import { settleSquareCheckout } from "./stripe-webhook.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The packs live in lib/token-packs.js so the webhook credits from the same
// table checkout sells from.

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
// TWO TRACKS (24 Sep 2026): the rate is the track's -- Stripe 2.9% + 30c,
// Square 3.3% + 30c -- and the line says which (lib/payment-rail.js).
function feeLineCents(subtotalCents, rail) { return feeLineCentsFor(subtotalCents, rail); }
function feeLine(cents, rail) {
  return { price_data: { currency: "usd", product_data: { name: "Card Processing & Handling", description: feeLineDescriptionFor(rail) }, unit_amount: cents }, quantity: 1 };
}

// THE HAND-OFF TO THE PAYMENT COMPANY. Every checkout builds one spec -- the
// shape of a Stripe Checkout Session, which the six builders below always
// built -- and this sends it down the chosen track:
//   stripe: a Checkout Session, as ever (a certificate is a one-off coupon);
//   square: Square's hosted page, the twin of the above; or, when the order
//           pays with a Square gift card, an order of our own charged on
//           order.html: the gift card's balance now, by its id, and the rest
//           on a bank card tokenised by Square's form (type square_complete).
// The answer is what the page does next: { url } to go there, or
// { squarePay } to draw the card form for what is left.
async function createCheckout(rail, spec, extras = {}) {
  const discounts = (extras.discounts || []).filter((d) => d.cents > 0);
  if (rail !== "square") {
    let stripeDiscounts;
    if (discounts.length) {
      const coupon = await stripe.coupons.create({
        amount_off: discounts.reduce((a, d) => a + d.cents, 0), currency: "usd", duration: "once", max_redemptions: 1,
        name: discounts.map((d) => d.name).join(" + ").slice(0, 40)
      });
      stripeDiscounts = [{ coupon: coupon.id }];
    }
    const session = await stripe.checkout.sessions.create({ ...spec, ...(stripeDiscounts ? { discounts: stripeDiscounts } : {}) });
    return { url: session.url, rail: "stripe" };
  }
  return createSquareCheckout(spec, { ...extras, discounts });
}

// SQUARE'S FLOOR: a card payment under $1.00 is refused by Square, so a
// checkout that small is refused here first, with the reason (the 50c token
// pack plus its fee is 87c). A Square gift card can pay any amount.
const SQUARE_MIN_CARD_CENTS = 100;
async function createSquareCheckout(spec, extras) {
  {
    const owed = orderTotalCents(spec.line_items.map((li) => ({ cents: Math.round(li.price_data.unit_amount * (li.quantity || 1)) })), extras.discounts || []);
    if (owed > 0 && owed < SQUARE_MIN_CARD_CENTS && !extras.squareGift) {
      throw orderError(`A card payment has to be at least $1.00 through our card processor just now; this comes to $${(owed / 100).toFixed(2)}. Please pick a larger pack.`);
    }
  }
  const checkoutId = newCheckoutId();
  const orderType = spec.metadata?.order_type || "token_purchase";
  const lineItems = spec.line_items.map((li) => ({
    name: li.price_data.product_data.name,
    description: li.price_data.product_data.description || "",
    cents: Math.round(li.price_data.unit_amount * (li.quantity || 1))
  }));
  const successUrl = String(spec.success_url).replace("{CHECKOUT_SESSION_ID}", checkoutId);
  const customerEmail = spec.customer_email || spec.metadata?.email || spec.metadata?.buyer_email || extras.buyerEmail || null;
  const record = {
    rail: "square", env: squareEnv(), orderType, metadata: spec.metadata || {}, customerEmail, successUrl,
    lineItems, discounts: extras.discounts || [], createdAt: new Date().toISOString()
  };
  await storeCheckoutRecord(checkoutId, record);
  const order = buildSquareOrder({ checkoutId, orderType, lineItems, discounts: extras.discounts || [] });

  if (!extras.squareGift) {
    const link = await createPaymentLink({ order, redirectUrl: successUrl, buyerEmail: customerEmail, description: lineItems[0]?.name });
    await updateCheckoutRecord(checkoutId, { squareOrderId: link.orderId, paymentLinkId: link.linkId });
    return { url: link.url, rail: "square" };
  }

  // The gift card pays first, by its id, for as much as it holds.
  const total = orderTotalCents(lineItems, extras.discounts || []);
  const { orderId } = await createOrder(order);
  let giftPayment = null;
  if (extras.squareGift.cents > 0 && total > 0) {
    giftPayment = await createPayment({
      sourceId: extras.squareGift.card.id, orderId, amountCents: total, partial: true,
      buyerEmail: customerEmail, note: `Muggshotz ${orderType}`, referenceId: checkoutId
    });
  }
  const giftPaidCents = giftPayment ? Math.min(total, giftPayment.approvedCents || giftPayment.amountCents || 0) : 0;
  const remainderCents = Math.max(0, total - giftPaidCents);
  await updateCheckoutRecord(checkoutId, {
    squareOrderId: orderId, giftPaymentId: giftPayment?.paymentId || null, giftCardLast4: extras.squareGift.card.last4,
    giftPaidCents, remainderCents, totalCents: total
  });
  if (remainderCents === 0) {
    // The card covered it all: close the order and fulfil it now.
    await updateCheckoutRecord(checkoutId, { settledAt: new Date().toISOString(), settledBy: "page" });
    try { await payOrder(orderId, giftPayment ? [giftPayment.paymentId] : []); }
    catch (err) { await updateCheckoutRecord(checkoutId, { settledAt: null, settledBy: null }); throw err; }
    await settleSquareCheckout(checkoutId, { alreadyMarked: true });
    return { url: successUrl, rail: "square", paid: true };
  }
  return {
    rail: "square",
    squarePay: { checkoutId, orderId, totalCents: total, giftPaidCents, remainderCents, giftCardLast4: extras.squareGift.card.last4, successUrl, sdkUrl: squareSdkUrl(), ...squarePublicConfig() }
  };
}

// THE REST ON A BANK CARD (the on-page Square path). order.html tokenised
// the card with Square's form and sends the token; the payment joins the
// gift card's on the order, PayOrder closes it, and the order is fulfilled.
async function handleSquareComplete(req, res) {
  const { checkoutId, sourceId } = req.body || {};
  if (!checkoutId || !sourceId) return res.status(400).json({ error: "Missing checkout or card token." });
  const record = await readCheckoutRecord(checkoutId);
  if (!record || record.rail !== "square" || !record.squareOrderId) return res.status(404).json({ error: "That checkout wasn't found. Please start again." });
  if (record.settledAt) return res.status(200).json({ url: record.successUrl, paid: true });
  const remainder = Number(record.remainderCents || 0);
  if (remainder <= 0) return res.status(400).json({ error: "Nothing is left to pay on this order." });
  const cardPayment = await createPayment({
    sourceId, orderId: record.squareOrderId, amountCents: remainder,
    buyerEmail: record.customerEmail, note: `Muggshotz ${record.orderType}`, referenceId: checkoutId
  });
  const paymentIds = [record.giftPaymentId, cardPayment.paymentId].filter(Boolean);
  await updateCheckoutRecord(checkoutId, { cardPaymentId: cardPayment.paymentId, settledAt: new Date().toISOString(), settledBy: "page" });
  try { await payOrder(record.squareOrderId, paymentIds); }
  catch (err) {
    await updateCheckoutRecord(checkoutId, { settledAt: null, settledBy: null, cardPaymentId: null });
    await cancelPayment(cardPayment.paymentId);
    throw err;
  }
  await settleSquareCheckout(checkoutId, { alreadyMarked: true });
  return res.status(200).json({ url: record.successUrl, paid: true });
}

// A SQUARE GIFT CARD ON THE ORDER (Alyx: "when dealing with gift cards
// specifically, we would naturally switch automatically to the Square
// track"). Looked up by its number; what it holds comes off before the card
// fee is worked out, since Square charges no processing on a gift card.
async function squareGiftFor(body, owedCents) {
  if (!body.squareGan) return null;
  let card = null;
  try { card = await giftCardFromGan(body.squareGan); }
  catch (err) { console.error("Square gift card lookup failed:", err.message); throw orderError("We couldn't check that gift card just now. Please try again in a moment.", 503); }
  if (!giftCardUsable(card)) throw orderError("That gift card isn't active or has no balance left.");
  return { card, cents: Math.max(0, Math.min(card.balanceCents, owedCents)) };
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
  // A colour with its own price outranks the size price. The card-holder
  // phone case is billed this way: its gift box is a "colour" of the same
  // model at $3 more (lib/products-catalog.js, phone-case-card-holder).
  const colorEntry = colorName && sizeEntry.colors ? sizeEntry.colors.find((c) => c.name === colorName) : null;
  if (typeof colorEntry?.price === "number") return colorEntry.price;
  return sizeEntry.price;
}

const MUG_TYPE_TO_PRODUCT_KEY = {
  "Classic White": "classic-white-mug",
  "Color Pop": "color-pop-mug",
  "Trimmed": "trimmed-mug",
  "Accented": "accented-mug",
  "Color Burst": "color-burst-mug",
  "All-Nighter": "all-nighter-mug"
};

// THE $5 PREVIEW RESERVATION (restored and wired, Alyx, 22 Sep 2026: "The $5
// preview button was doing a lot of work ... a portion of that to be diverted
// to pay for more spins"). It buys tokens now AND $5 of credit toward the
// product: the webhook credits the tokens and mints a $5 credit code on the
// gift-certificate ledger, the studio saves that code on the device when the
// buyer returns, and the order page applies it at checkout by itself.
const RESERVATION_CENTS = 500;
async function handleReservation(req, res) {
  const { email, deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  const origin = req.headers.origin || process.env.PUBLIC_SITE_URL || "https://muggshotz-ai-test.vercel.app";
  const rail = await chooseRail(req.body);
  const spec = {
    mode: "payment",
    // Priced inline, like every other product. It used to name a saved Stripe
    // price (STRIPE_PRICE_ID) that does not exist in the live account --
    // "No such price", checked 22 Sep 2026 -- so every reservation failed.
    line_items: [
      { price_data: { currency: "usd", product_data: { name: "$5 Preview Reservation", description: "Tokens now, and $5 off your product at checkout." }, unit_amount: RESERVATION_CENTS }, quantity: 1 },
      feeLine(feeLineCents(RESERVATION_CENTS, rail), rail)
    ],
    customer_email: email || undefined,
    metadata: { order_type: "reservation", device_id: deviceId },
    success_url: `${origin}/needles-studio.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/needles-studio.html?checkout=cancelled`
  };
  return res.status(200).json(await createCheckout(rail, spec));
}

// ONE ITEM, CHECKED AND PRICED (23 Sep 2026). What handleProductOrder always
// did for its one product, lifted out so a basket checks every item the same
// way: the product exists, the size (and colour, and poster pair) is real, the
// artwork its layout needs is present. Throws an Error carrying .status on
// anything a customer must fix. Prices come from the catalog, never the page.
function orderError(message, status = 400) { const e = new Error(message); e.status = status; return e; }
function catalogVariantId(product, sizeLabel, colorName) {
  const s = product.sizes?.[sizeLabel];
  if (!s) return null;
  if (s.colors && colorName) { const c = s.colors.find((x) => x.name === colorName); if (c?.variantId) return c.variantId; }
  return s.variantId || null;
}
function resolveOrderItem(b) {
  const sizeLabel = b.sizeLabel;
  const productKey = b.productKey || MUG_TYPE_TO_PRODUCT_KEY[b.mugType];
  const colorName = b.colorName || b.color || null;
  const placements = b.placements || null;
  const placementAdjust = b.placementAdjust || null;
  const frontImage = b.frontImage || null;
  const backImage = b.backImage || null;
  const singleImage = b.image || null;

  const product = productKey ? getProduct(productKey) : null;
  if (!product) throw orderError(`"${b.mugType || productKey}" isn't available yet.`);

  const basePrice = (() => {
    try {
      return resolvePrice(product, sizeLabel, colorName, { orientation: b.posterOrientation, finish: b.posterFinish });
    } catch (err) { throw orderError(err.message); }
  })();

  const requiresColor = !!(product.sizes?.[sizeLabel]?.colors || product.colors);
  if (requiresColor && !colorName) throw orderError("Please pick a color.");

  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right))
      throw orderError("At least one design is required.");
  } else if (product.layoutType === "front-back") {
    if (!frontImage && !backImage)
      throw orderError("At least a front or back image is required.");
  } else {
    if (!singleImage)
      throw orderError("An image is required.");
  }

  const upsellCharge = product.layoutType === "three-slot-wrap"
    ? (b.isWraparoundSet ? WRAPAROUND_SET_SURCHARGE : calculateUpsellCharge(placements))
    : 0;

  return {
    product, productKey, sizeLabel, colorName, basePrice, upsellCharge,
    variantId: catalogVariantId(product, sizeLabel, colorName),
    placements, placementAdjust, frontImage, backImage, singleImage,
    printMode: b.printMode === "fullBleed" ? "fullBleed" : "standard",
    isWraparoundSet: !!b.isWraparoundSet,
    panoramaImage: b.panoramaImage || null,
    insideImage: b.insideImage || null,
    posterOrientation: b.posterOrientation || null,
    posterFinish: b.posterFinish || null
  };
}
function shipsToOrThrow(product, shipCountry) {
  if (Array.isArray(product.shipsTo) && !product.shipsTo.includes(shipCountry))
    throw orderError(`Sorry — the ${product.displayName} can only be shipped to ${product.shipsTo.join(" and ")} at the moment.`);
}

async function handleProductOrder(req, res) {
  const {
    deviceId, customerName, giftMessage, shippingAddress, isWraparoundSet, referralCode
  } = req.body;

  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  let item;
  try { item = resolveOrderItem(req.body); }
  catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
  const { product, productKey, sizeLabel, colorName, basePrice, upsellCharge, placements, placementAdjust, frontImage, backImage, singleImage } = item;

  if (!shippingAddress?.email || !shippingAddress?.address1 || !shippingAddress?.city ||
      !shippingAddress?.region || !shippingAddress?.zip)
    return res.status(400).json({ error: "Missing required shipping information." });

  const resolvedPrintMode = item.printMode;
  const giftCharge = giftMessage?.trim() ? GIFT_MESSAGE_PRICE : 0;
  let rail;
  try { rail = await chooseRail(req.body); }
  catch (err) { return res.status(err.status || 400).json({ error: err.message }); }

  // one-time 10% email discount, checked fresh at checkout creation time.
  const cleanReferralCode = (referralCode || "").trim().toUpperCase() || null;
  const emailDiscountEligible = await checkEmailDiscountEligibility(shippingAddress.email);
  const discountAmount = emailDiscountEligible ? Math.round(basePrice * FLYER_DISCOUNT_RATE * 100) / 100 : 0;

  const productCents = Math.round((basePrice - discountAmount + upsellCharge + giftCharge) * 100);

  // calculateShippingCharge THROWS rather than returning $0 when it can
  // resolve no real cost (see lib/printify-shipping.js). Caught here so the
  // customer gets a plain retry message instead of a raw internal error.
  // A product Printify only ships to some countries (Color Burst: US and
  // Canada) says so, instead of failing as a generic shipping error below.
  const shipCountry = (shippingAddress.country || "US").toUpperCase();
  try { shipsToOrThrow(product, shipCountry); }
  catch (err) { return res.status(400).json({ error: err.message }); }
  let shippingCharge = 0;
  if (product.shippingSeparate) {
    try {
      shippingCharge = await calculateShippingCharge(product, basePrice, shippingAddress.country || "US", item.variantId);
    } catch (err) {
      console.error("Shipping resolution failed, refusing to create session:", err.message);
      return res.status(503).json({
        error: "We couldn't confirm the shipping cost for this order just now. Please try again in a moment."
      });
    }
  }
  const shippingCents = Math.round(shippingCharge * 100);

  // GIFT CERTIFICATE (22 Sep 2026). The code's balance comes off product and
  // shipping before the card fee is worked out, so the fee is only charged on
  // what the card actually pays. Stripe will not take under 50 cents, so a
  // certificate that would cover the whole order leaves 50 cents on the card
  // and keeps the rest of its balance. Nothing is spent here: the webhook
  // spends it when the payment completes, so an abandoned checkout costs the
  // certificate nothing.
  let giftCode = null, giftCents = 0;
  if (req.body.giftCode) {
    giftCode = normalizeGiftCode(req.body.giftCode);
    let cert = null;
    try { cert = giftCode ? await findGiftCertificate(giftCode) : null; }
    catch (err) { console.error("Gift certificate lookup failed:", err.message); return res.status(503).json({ error: "We couldn't check that gift certificate just now. Please try again in a moment." }); }
    if (!cert || cert.voided_at || cert.balance_cents <= 0)
      return res.status(400).json({ error: "That gift certificate code isn't valid or has no balance left." });
    giftCents = Math.max(0, Math.min(cert.balance_cents, productCents + shippingCents - minChargeCentsFor(rail)));
  }
  // A Square gift card, when one was given: it pays before the card fee is
  // worked out, and there is no minimum left for a bank card -- it can pay
  // the whole order and no bank card is asked for.
  let squareGift = null;
  try { squareGift = await squareGiftFor(req.body, productCents + shippingCents - giftCents); }
  catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
  const squareGiftCents = squareGift ? squareGift.cents : 0;

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
  const feeCents = feeLineCents(productCents + shippingCents - giftCents - squareGiftCents, rail);
  if (feeCents > 0) line_items.push(feeLine(feeCents, rail));
  const discounts = giftCents > 0 ? [{ name: `Gift certificate ${giftCode}`, cents: giftCents }] : [];

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

  const spec = {
    mode: "payment",
    payment_method_types: ["card"],
    automatic_tax: { enabled: true },
    line_items,
    metadata: {
      order_type: "mug_order",
      gift_code: giftCode && giftCents > 0 ? giftCode : "",
      gift_cents: String(giftCents),
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
      fees_cents: String(feeCents),
      square_gift_last4: squareGift ? squareGift.card.last4 : "",
      square_gift_cents: String(squareGiftCents)
    },
    success_url: `${origin}/order.html?checkout=success`,
    cancel_url: `${origin}/order.html?checkout=cancelled`
  };

  return res.status(200).json(await createCheckout(rail, spec, { discounts, squareGift }));
}

// THE BASKET (Alyx, 23 Sep 2026: "Begin build a basket"). Several products,
// one payment, one Printify order. Every item is checked and priced exactly as
// a single order is (resolveOrderItem); shipping is Printify's per maker
// (calculateBasketShipping); the gift message, the first-order discount, the
// gift certificate and the card fee apply to the whole order once.
//
// The items do not travel in Stripe's metadata -- 500 characters a value,
// already split four ways for one mug's placements. They are written to
// storage as baskets/<id>.json (artwork URLs and options only; the name,
// address and message stay in metadata, as on a single order) and the
// webhook reads them back by basket_id.
const MAX_BASKET_ITEMS = 6;
async function storeBasket(basketId, items) {
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/generations/baskets/${basketId}.json`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, items })
  });
  if (!resp.ok) throw new Error("Basket storage failed: " + await resp.text());
}
async function handleBasketOrder(req, res) {
  const { deviceId, items, customerName, giftMessage, shippingAddress, referralCode } = req.body;
  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "Your basket is empty." });
  if (items.length > MAX_BASKET_ITEMS) return res.status(400).json({ error: `A basket holds up to ${MAX_BASKET_ITEMS} items. Please check out and start a new basket for the rest.` });
  if (!shippingAddress?.email || !shippingAddress?.address1 || !shippingAddress?.city ||
      !shippingAddress?.region || !shippingAddress?.zip)
    return res.status(400).json({ error: "Missing required shipping information." });
  const shipCountry = (shippingAddress.country || "US").toUpperCase();
  let rail;
  try { rail = await chooseRail(req.body); }
  catch (err) { return res.status(err.status || 400).json({ error: err.message }); }

  let resolved;
  try {
    resolved = items.map((b, i) => {
      try { const r = resolveOrderItem(b); shipsToOrThrow(r.product, shipCountry); return r; }
      catch (err) { err.message = `Basket item ${i + 1}: ${err.message}`; throw err; }
    });
  } catch (err) { return res.status(err.status || 400).json({ error: err.message }); }

  const cleanReferralCode = (referralCode || "").trim().toUpperCase() || null;
  const emailDiscountEligible = await checkEmailDiscountEligibility(shippingAddress.email);
  const giftCharge = giftMessage?.trim() ? GIFT_MESSAGE_PRICE : 0;

  const itemCents = resolved.map((r) => {
    const discount = emailDiscountEligible ? Math.round(r.basePrice * FLYER_DISCOUNT_RATE * 100) / 100 : 0;
    return Math.round((r.basePrice - discount + r.upsellCharge) * 100);
  });
  const giftChargeCents = Math.round(giftCharge * 100);
  const productCents = itemCents.reduce((a, b) => a + b, 0) + giftChargeCents;

  let shippingCents = 0;
  try {
    const ship = await calculateBasketShipping(resolved.map((r) => ({ product: r.product, basePrice: r.basePrice, variantId: r.variantId })), shipCountry);
    shippingCents = Math.round(ship.total * 100);
  } catch (err) {
    console.error("Basket shipping resolution failed, refusing to create session:", err.message);
    return res.status(503).json({ error: "We couldn't confirm the shipping cost for this order just now. Please try again in a moment." });
  }

  let giftCode = null, giftCents = 0;
  if (req.body.giftCode) {
    giftCode = normalizeGiftCode(req.body.giftCode);
    let cert = null;
    try { cert = giftCode ? await findGiftCertificate(giftCode) : null; }
    catch (err) { console.error("Gift certificate lookup failed:", err.message); return res.status(503).json({ error: "We couldn't check that gift certificate just now. Please try again in a moment." }); }
    if (!cert || cert.voided_at || cert.balance_cents <= 0)
      return res.status(400).json({ error: "That gift certificate code isn't valid or has no balance left." });
    giftCents = Math.max(0, Math.min(cert.balance_cents, productCents + shippingCents - minChargeCentsFor(rail)));
  }
  let squareGift = null;
  try { squareGift = await squareGiftFor(req.body, productCents + shippingCents - giftCents); }
  catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
  const squareGiftCents = squareGift ? squareGift.cents : 0;

  const discountSuffix = emailDiscountEligible ? " (10% first-order discount applied)" : "";
  const line_items = resolved.map((r, i) => ({
    price_data: { currency: "usd", product_data: {
      name: `Muggshotz ${r.product.displayName} (${r.sizeLabel})${r.colorName ? " - " + r.colorName : ""}${discountSuffix}`,
      description: `Custom ${r.product.displayName}` }, unit_amount: itemCents[i] },
    quantity: 1
  }));
  if (giftChargeCents > 0) line_items.push({ price_data: { currency: "usd", product_data: { name: "Gift message" }, unit_amount: giftChargeCents }, quantity: 1 });
  if (shippingCents > 0) line_items.push({ price_data: { currency: "usd", product_data: { name: "Shipping & Handling" }, unit_amount: shippingCents }, quantity: 1 });
  const feeCents = feeLineCents(productCents + shippingCents - giftCents - squareGiftCents, rail);
  if (feeCents > 0) line_items.push(feeLine(feeCents, rail));
  const discounts = giftCents > 0 ? [{ name: `Gift certificate ${giftCode}`, cents: giftCents }] : [];

  const basketId = randomUUID();
  const stored = resolved.map((r) => ({
    productKey: r.productKey, sizeLabel: r.sizeLabel, colorName: r.colorName, printMode: r.printMode,
    placements: r.product.layoutType === "three-slot-wrap" ? r.placements : undefined,
    placementAdjust: r.product.layoutType === "three-slot-wrap" ? (r.placementAdjust || {}) : undefined,
    panoramaImage: r.panoramaImage || undefined,
    frontImage: r.frontImage || undefined, backImage: r.backImage || undefined,
    image: r.singleImage || undefined, insideImage: r.insideImage || undefined,
    posterFramed: r.productKey === "photo-poster" ? false : undefined,
    posterOrientation: r.posterOrientation || undefined, posterFinish: r.posterFinish || undefined
  }));
  try { await storeBasket(basketId, stored); }
  catch (err) {
    console.error("Basket could not be stored, refusing to create session:", err.message);
    return res.status(503).json({ error: "We couldn't save your basket just now. Please try again in a moment." });
  }
  const netProfit = resolved.reduce((a, r) => a + (typeof r.product.estimatedProfit === "number" ? r.product.estimatedProfit : 0), 0);

  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";
  const spec = {
    mode: "payment",
    payment_method_types: ["card"],
    automatic_tax: { enabled: true },
    line_items,
    metadata: {
      order_type: "basket_order",
      basket_id: basketId,
      item_count: String(resolved.length),
      product_keys: resolved.map((r) => r.productKey).join(",").slice(0, 490),
      gift_code: giftCode && giftCents > 0 ? giftCode : "",
      gift_cents: String(giftCents),
      device_id: deviceId,
      gift_message: (giftMessage || "").trim().slice(0, 450),
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
      net_profit: String(Math.round(netProfit * 100) / 100),
      fees_cents: String(feeCents),
      square_gift_last4: squareGift ? squareGift.card.last4 : "",
      square_gift_cents: String(squareGiftCents)
    },
    success_url: `${origin}/order.html?checkout=success&basket=1`,
    cancel_url: `${origin}/order.html?checkout=cancelled`
  };
  return res.status(200).json(await createCheckout(rail, spec, { discounts, squareGift }));
}

async function handleTokenPurchase(req, res) {
  const { deviceId, packId } = req.body || {};
  const pack = TOKEN_PACKS[packId];
  if (!pack) return res.status(400).json({ error: `Unknown token pack "${packId}".` });
  if (!deviceId) return res.status(400).json({ error: "Missing device ID." });

  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";

  // Fees on token packs too -- proportionally these hurt the most
  // uncovered (30c fixed on a $5 pack is where Stripe's bite peaks).
  const rail = await chooseRail(req.body);
  const packFeeCents = feeLineCents(pack.amountCents, rail);
  const spec = {
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: pack.label },
        unit_amount: pack.amountCents
      },
      quantity: 1
    },
    feeLine(packFeeCents, rail)],
    metadata: { order_type: "token_purchase", device_id: deviceId, pack_id: packId, fees_cents: String(packFeeCents) },
    // Back to the studio, where the tokens are spent. These used to send the
    // buyer to index.html, the old generator.
    success_url: `${origin}/needles-studio.html?checkout=success`,
    cancel_url: `${origin}/needles-studio.html?checkout=cancelled`
  };

  return res.status(200).json(await createCheckout(rail, spec));
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
    const rail = await chooseRail(req.body);

    const spec = {
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
    };

    return res.status(200).json(await createCheckout(rail, spec));
  } catch (err) {
    console.error("Tier upgrade checkout failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// BUYING A GIFT CERTIFICATE (22 Sep 2026). One of four amounts, the same card
// fee line every order carries ("if I pay, you pay"), and the recipient's
// details in metadata. The webhook mints the code when payment completes.
async function handleGiftCertificatePurchase(req, res) {
  const { amountCents, buyerEmail, recipientEmail, recipientName, message, fromName } = req.body;
  const amt = Number(amountCents);
  if (!GIFT_AMOUNTS_CENTS.includes(amt)) return res.status(400).json({ error: "Please pick one of the certificate amounts." });
  const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
  if (!emailOk(buyerEmail)) return res.status(400).json({ error: "Please enter your email address." });
  if (!emailOk(recipientEmail)) return res.status(400).json({ error: "Please enter the recipient's email address." });
  if (!(await giftLedgerReady())) return res.status(503).json({ error: "Gift certificates aren't on sale just yet. Please check back soon." });
  const origin = req.headers.origin || "https://muggshotz-ai-test.vercel.app";
  const rail = await chooseRail(req.body);
  const feeCents = feeLineCents(amt, rail);
  const spec = {
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: String(buyerEmail).trim(),
    line_items: [
      { price_data: { currency: "usd", product_data: { name: `Muggshotz Gift Certificate — $${amt / 100}`, description: "Store credit, emailed to the recipient. Never expires." }, unit_amount: amt }, quantity: 1 },
      feeLine(feeCents, rail)
    ],
    metadata: {
      order_type: "gift_certificate",
      amount_cents: String(amt),
      buyer_email: String(buyerEmail).trim().slice(0, 200),
      recipient_email: String(recipientEmail).trim().slice(0, 200),
      recipient_name: String(recipientName || "").trim().slice(0, 100),
      from_name: String(fromName || "").trim().slice(0, 100),
      message: String(message || "").trim().slice(0, 450)
    },
    success_url: `${origin}/gift.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/gift.html?checkout=cancelled`
  };
  return res.status(200).json(await createCheckout(rail, spec));
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
    if (type === "basket_order") {
      return await handleBasketOrder(req, res);
    }
    if (type === "tier_upgrade") {
      return await handleTierUpgrade(req, res);
    }
    if (type === "gift_certificate") {
      return await handleGiftCertificatePurchase(req, res);
    }
    if (type === "square_complete") {
      return await handleSquareComplete(req, res);
    }
    return res.status(400).json({ error: `Unknown checkout type "${type}".` });
  } catch (error) {
    console.error("Checkout session creation failed:", error.message);
    // A refusal with a reason for the customer (orderError) is a 400, not a 500.
    return res.status(error.status || 500).json({ error: error.message });
  }
}
