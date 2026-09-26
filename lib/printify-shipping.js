// lib/printify-shipping.js
//
// Looks up REAL shipping cost from Printify's own Catalog Shipping
// endpoint — no order needs to be created, no full carrier address
// lookup needed. Printify's shipping is a flat rate per blueprint +
// print provider + country group (not a live carrier quote), so all
// we need is which country the customer is shipping to.
//
// Endpoint: GET /v1/catalog/blueprints/{blueprintId}/print_providers/{printProviderId}/shipping.json
// Returns a list of "profiles," each with a first_item cost, an
// additional_items cost, and the list of countries it applies to
// (e.g. ["US"] or ["REST_OF_THE_WORLD"]). We match the customer's
// country against these profiles and use first_item.cost — for a
// single-item order (which every Muggshotz order is), that's the
// real number Printify actually charges us.
//
// PRINTIFY_API_TOKEN must be set in Vercel's environment variables —
// same token already used by create-printify-order.js for placing
// real orders.

const PRINTIFY_API_TOKEN = process.env.PRINTIFY_API_TOKEN;

const shippingProfileCache = new Map();

async function fetchShippingProfiles(blueprintId, printProviderId) {
  const cacheKey = `${blueprintId}-${printProviderId}`;
  if (shippingProfileCache.has(cacheKey)) {
    return shippingProfileCache.get(cacheKey);
  }

  const url = `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/shipping.json`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${PRINTIFY_API_TOKEN}`,
      "User-Agent": "Muggshotz"
    }
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Printify shipping lookup failed for blueprint ${blueprintId}/provider ${printProviderId}: ${JSON.stringify(data)}`);
  }

  const profiles = data.profiles || [];
  shippingProfileCache.set(cacheKey, profiles);
  return profiles;
}

export async function getRealShippingCost(blueprintId, printProviderId, countryCode, variantId = null) {
  const rates = await getShippingRates(blueprintId, printProviderId, countryCode, variantId);
  return rates ? rates.first : null;
}

// BOTH OF PRINTIFY'S NUMBERS, for one item (23 Sep 2026, the basket). A
// profile carries a first-item cost and an each-additional cost; a single
// order only ever needed the first, a basket needs both. variantId narrows
// the choice to the profile that lists that variant -- business cards ship at
// $6.19 for 10 and $13.19 for 100 from the same blueprint -- and is only
// passed for a product that declares shippingByVariant, so every product
// that existed before this keeps exactly the profile it was charged before
// (the first one for its country). Null when nothing matches.
export async function getShippingRates(blueprintId, printProviderId, countryCode, variantId = null) {
  if (!blueprintId || !printProviderId) {
    return null;
  }

  const profiles = await fetchShippingProfiles(blueprintId, printProviderId);
  const inCountry = (c) => (p) => p.countries?.includes(c);
  const listsVariant = (p) => variantId == null || !Array.isArray(p.variant_ids) || p.variant_ids.includes(variantId);

  const profile =
    profiles.find(p => inCountry(countryCode)(p) && listsVariant(p)) ||
    profiles.find(inCountry(countryCode)) ||
    profiles.find(p => inCountry("REST_OF_THE_WORLD")(p) && listsVariant(p)) ||
    profiles.find(inCountry("REST_OF_THE_WORLD"));
  if (!profile || typeof profile.first_item?.cost !== "number") {
    return null;
  }

  const first = profile.first_item.cost / 100;
  const additional = typeof profile.additional_items?.cost === "number" ? profile.additional_items.cost / 100 : first;
  return { first, additional };
}

// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for what we charge a customer for shipping.
//
// Moved here from api/create-checkout-session.js (Sep 2026) so that the
// checkout session and the Order Summary on order.html can no longer
// disagree. Before this, order.html used a hardcoded FLAT_SHIPPING of
// $6.95 for every product while the server resolved the real Printify
// cost per product -- so the mouse pad DISPLAYED $6.95 and CHARGED $4.99.
// Anything that needs a shipping number now calls this one function.
//
// Falls back to product.shippingCost only if the live lookup fails or
// returns nothing, and THROWS if neither is available -- we never ship
// a product for $0 just because a lookup failed.
// ---------------------------------------------------------------------------

const SHIPPING_MARKUP_THRESHOLD = 50;
const SHIPPING_MARKUP_RATE = 0.10;

// Universal safety buffer (Alyx, Sep 2026): "our shipping charges should
// never be less than what they charge us, or we'll be paying part of
// their shipping." Printify's rate can move between our lookup and their
// invoice, so every product carries a small cushion on top of real cost.
// NOT stacked on top of the $50+ tier -- we take whichever is larger, so
// a high-ticket item keeps its 10% and never gets 13%.
const SHIPPING_BUFFER_RATE = 0.03;

export async function calculateShippingCharge(product, basePrice, countryCode, variantId = null) {
  let printifyShippingCost = null;

  try {
    // The poster keeps its blueprint/provider under product.base (see
    // resolvePrice); reading the top level here silently shipped posters
    // for $0 -- $6.79 of real cost, the entire margin. Found Sep 2026.
    const blueprintId = product.base?.blueprintId ?? product.blueprintId;
    const printProviderId = product.base?.printProviderId ?? product.printProviderId;
    printifyShippingCost = await getRealShippingCost(blueprintId, printProviderId, countryCode,
      product.shippingByVariant ? variantId : null);
  } catch (err) {
    console.error(`CRITICAL: Live shipping lookup failed for "${product.displayName}": ${err.message}`);
  }

  if (printifyShippingCost === null) {
    if (typeof product.shippingCost === "number" && product.shippingCost > 0) {
      console.error(`Falling back to static shippingCost for "${product.displayName}" — live lookup returned nothing.`);
      printifyShippingCost = product.shippingCost;
    } else {
      // CHANGED Sep 2026. This used to `return 0`, which meant a failed
      // lookup shipped the product FREE -- on a suitcase that is ~$35 of
      // real freight out of pocket, and shippingCost is still 0 on most
      // of the catalog. We now fail CLOSED, exactly like the email
      // discount check does: the order errors out and the customer is
      // asked to retry, which costs us one sale instead of costing us
      // money on every sale that slips through during an outage.
      throw new Error(
        `No shipping cost available (live or static) for "${product.displayName}" — refusing to charge $0 shipping.`
      );
    }
  }

  // Never below real cost. The tier and the buffer are alternatives, not
  // additives -- whichever is larger wins.
  const rate = basePrice >= SHIPPING_MARKUP_THRESHOLD
    ? Math.max(SHIPPING_MARKUP_RATE, SHIPPING_BUFFER_RATE)
    : SHIPPING_BUFFER_RATE;

  // Round UP to the cent. Rounding to nearest could land a half-cent
  // below real cost, which is the exact thing this function exists to
  // prevent.
  return Math.ceil(printifyShippingCost * (1 + rate) * 100) / 100;
}


// THE BASKET'S SHIPPING (Alyx, 23 Sep 2026: "Begin build a basket"). Printify
// bills an order per maker: the first item from a blueprint + provider at its
// first-item rate, each further one at the cheaper additional rate. So within
// a group the dearest first-item rate is charged once and every other item
// pays its own additional rate -- never less than Printify bills. Two
// different blueprints from one provider are charged a first item each,
// which can only err on the high side. Each item carries the same cushion
// calculateShippingCharge applies (3%, or 10% on a $50+ item), and a
// product with shipping built into its price adds nothing, as it does now.
// entries: [{ product, basePrice, variantId }]. Throws, like its sibling,
// rather than charge $0 for a product it cannot price.
export async function calculateBasketShipping(entries, countryCode) {
  const priced = [];
  for (const [index, e] of entries.entries()) {
    const product = e.product;
    if (!product.shippingSeparate) { priced.push({ index, first: 0, additional: 0, zero: true }); continue; }
    const blueprintId = product.base?.blueprintId ?? product.blueprintId;
    const printProviderId = product.base?.printProviderId ?? product.printProviderId;
    let rates = null;
    try {
      rates = await getShippingRates(blueprintId, printProviderId, countryCode,
        product.shippingByVariant ? (e.variantId ?? null) : null);
    } catch (err) {
      console.error(`CRITICAL: Live shipping lookup failed for "${product.displayName}": ${err.message}`);
    }
    if (!rates) {
      if (typeof product.shippingCost === "number" && product.shippingCost > 0) {
        rates = { first: product.shippingCost, additional: product.shippingCost };
      } else {
        throw new Error(`No shipping cost available (live or static) for "${product.displayName}" — refusing to charge $0 shipping.`);
      }
    }
    // A SET (setOf: 4, the SURPRISE!!! holiday sets) is that many mugs in the
    // parcel: each ships as one item of the group, at its share of the set's
    // price for the cushion, and the set's shipping is their sum.
    const units = Number.isInteger(product.setOf) && product.setOf > 1 ? product.setOf : 1;
    for (let u = 0; u < units; u++)
      priced.push({ index, group: `${blueprintId}/${printProviderId}`, ...rates, basePrice: e.basePrice / units });
  }
  const perItem = new Array(entries.length).fill(0);
  const groups = {};
  for (const p of priced) if (!p.zero) (groups[p.group] = groups[p.group] || []).push(p);
  for (const list of Object.values(groups)) {
    list.sort((a, b) => b.first - a.first);
    list.forEach((p, i) => {
      const cost = i === 0 ? p.first : p.additional;
      const rate = p.basePrice >= SHIPPING_MARKUP_THRESHOLD
        ? Math.max(SHIPPING_MARKUP_RATE, SHIPPING_BUFFER_RATE)
        : SHIPPING_BUFFER_RATE;
      perItem[p.index] = Math.round((perItem[p.index] + Math.ceil(cost * (1 + rate) * 100) / 100) * 100) / 100;
    });
  }
  const total = Math.round(perItem.reduce((a, b) => a + b, 0) * 100) / 100;
  return { total, perItem };
}
