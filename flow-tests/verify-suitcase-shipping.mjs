// SUITCASE SHIPPING (Alyx, 30 Sep 2026): set US charges, Small $31, Medium and
// Large $40, never below the live charge; other countries at Printify's rate
// plus the cushion. No browser, Printify's reply stubbed.
//   node flow-tests/verify-suitcase-shipping.mjs   (from the repo root)
let usCents = 495;
globalThis.fetch = async () => ({ ok: true, json: async () => ({ profiles: [
  { variant_ids: [72133, 79350, 79351], first_item: { cost: usCents }, additional_items: { cost: usCents }, countries: ['US'] },
  { variant_ids: [72133, 79350, 79351], first_item: { cost: 3000 }, additional_items: { cost: 3000 }, countries: ['CA'] }] }) });
const { calculateShippingCharge, calculateBasketShipping } = await import('../lib/printify-shipping.js');
const { getProduct } = await import('../lib/products-catalog.js');
const p = getProduct('suitcase'), fails = [];
const want = { Small: 31, Medium: 40, Large: 40 };
for (const [size, s] of Object.entries(p.sizes)) {
  const us = await calculateShippingCharge(p, s.price, 'US', s.variantId), ca = await calculateShippingCharge(p, s.price, 'CA', s.variantId);
  if (us !== want[size]) fails.push(`${size} to the US is ${us}, not ${want[size]}`);
  if (ca !== 33) fails.push(`${size} to Canada is ${ca}, not Printify's $30 plus 10%`);
}
const b = await calculateBasketShipping([{ product: p, basePrice: 214.95, variantId: 79351 }, { product: p, basePrice: 169.95, variantId: 72133 }], 'US');
if (b.total !== 71) fails.push(`a Large and a Small in a basket ship for ${b.total}, not 71`);
const { calculateShippingCharge: again } = await import('../lib/printify-shipping.js?dear');
usCents = 9000;   // Printify's rate rising past the set charge: the live figure wins
const dear = await again(p, 214.95, 'US', 79351);
if (!(dear >= 99)) fails.push(`with Printify at $90 the Large charged ${dear}, below the live $99`);
if (fails.length) { fails.forEach((f) => console.log('[suitcase-shipping] FAIL: ' + f)); console.log(`\n${fails.length} FAILURE(S)`); process.exit(1); }
console.log('[suitcase-shipping] PASS: US Small $31, Medium $40, Large $40; Canada at the live rate plus 10%; a basket charges each its own; a live rate above the set charge wins\n\nALL SUITCASE-SHIPPING VERIFICATIONS PASSED');
