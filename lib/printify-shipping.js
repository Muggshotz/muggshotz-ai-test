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
