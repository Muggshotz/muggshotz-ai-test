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

export async function getRealShippingCost(blueprintId, printProviderId, countryCode) {
  if (!blueprintId || !printProviderId) {
    return null;
  }

  const profiles = await fetchShippingProfiles(blueprintId, printProviderId);

  let profile = profiles.find(p => p.countries?.includes(countryCode));
  if (!profile) {
    profile = profiles.find(p => p.countries?.includes("REST_OF_THE_WORLD"));
  }
  if (!profile || typeof profile.first_item?.cost !== "number") {
    return null;
  }

  return profile.first_item.cost / 100;
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

export async function calculateShippingCharge(product, basePrice, countryCode) {
  let printifyShippingCost = null;

  try {
    // The poster keeps its blueprint/provider under product.base (see
    // resolvePrice); reading the top level here silently shipped posters
    // for $0 -- $6.79 of real cost, the entire margin. Found Sep 2026.
    const blueprintId = product.base?.blueprintId ?? product.blueprintId;
    const printProviderId = product.base?.printProviderId ?? product.printProviderId;
    printifyShippingCost = await getRealShippingCost(blueprintId, printProviderId, countryCode);
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
