// THE BACK HALF, WITH PRINTIFY FAKED AT THE WIRE.
//
// Everything before this suite stops at the moment the order page hands a
// body to /api/create-checkout-session -- which every browser suite stubs.
// Past that point the code had never been executed by any test: the session
// builder's metadata, the webhook's reading of it, placeProductOrder's image
// build, variant resolution, upload, product creation and order submission.
// That is the layer the unorderable Tundra lived in (a null colour that only
// threw inside the webhook, after payment).
//
// This drives the REAL code for every product in the catalogue:
//   payment body -> create-checkout-session (real) -> captured Stripe args
//                -> a checkout.session.completed event built from them
//                -> stripe-webhook (real) -> placeProductOrder (real, sharp
//                   and all) -> outbound HTTP
// and fakes exactly two things: the `stripe` SDK (a module hook swaps it for
// a recorder) and outbound HTTP (Printify's catalogue, uploads, products and
// orders; the design images; Supabase; Resend). What it proves: the chain
// executes and what reaches Printify is shaped right. What it cannot prove:
// that Printify accepts it -- that is the staged rehearsal's job.
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');

register(pathToFileURL(path.join(__dirname, 'back-half', 'hooks.mjs')).href);

Object.assign(process.env, {
  STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake',
  PRINTIFY_API_TOKEN: 'printify_fake', SITE_BASE_URL: 'https://muggshotz.test',
  SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'sb_fake',
  RESEND_API_KEY: 're_fake', PUBLIC_SITE_URL: 'https://muggshotz.test',
});

const ROOT = path.join(__dirname, '..');
const IMG = 'https://cdn.muggshotz.test/design.jpg';
const JPEG = fs.readFileSync(path.join(__dirname, 'fake-generated.jpg'));

// ---- outbound HTTP, recorded ----
const wire = { uploads: 0, products: [], orders: [], unstubbed: [], variantsAsked: [], supaPatches: [], giftRows: [], baskets: {} };
let catalog = null;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

// Printify's variants for a blueprint/provider, generated from the catalogue
// so every real variantId is present, and every size/colour combination has
// a title the resolvers can match: "<size> / <colour>" or "<size>".
function variantsFor(bp, pp) {
  const out = []; let synthetic = 900000;
  const positions = ['front', 'back', 'inside', 'mug_front', 'mug_back', 'default', 'top'];
  const ph = positions.map((position) => ({ position, width: 2600, height: 1200 }));
  const push = (id, title) => { if (!out.some((v) => v.id === id)) out.push({ id, title, placeholders: ph }); };
  const walk = (p) => {
    if (!p || typeof p !== 'object') return;
    if (p.blueprintId === bp && p.printProviderId === pp) {
      const sizes = p.sizes || {};
      const sizeKeys = Object.keys(sizes).length ? Object.keys(sizes) : [p.sizeLabel || 'One Size'];
      for (const size of sizeKeys) {
        const s = sizes[size] || {};
        const colours = s.colors || p.colors || null;
        if (colours) for (const c of colours) push(c.variantId || synthetic++, `${size} / ${c.name}`);
        else if (s.variantIds) for (const [k, id] of Object.entries(s.variantIds)) push(id, `${size} / ${k}`);
        else push(s.variantId || synthetic++, size);
      }
    }
    for (const v of Object.values(p)) if (v && typeof v === 'object' && !Array.isArray(v)) walk(v);
  };
  for (const p of Object.values(catalog)) walk(p);
  return out;
}

global.fetch = async (url, opts = {}) => {
  const u = String(url); const m = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? (() => { try { return JSON.parse(opts.body); } catch (e) { return opts.body; } })() : null;
  if (u.startsWith('https://api.printify.com/')) {
    let mm;
    if ((mm = /catalog\/blueprints\/(\d+)\/print_providers\/(\d+)\/variants\.json/.exec(u))) {
      wire.variantsAsked.push(`${mm[1]}/${mm[2]}`);
      return json({ variants: variantsFor(Number(mm[1]), Number(mm[2])) });
    }
    // $5.99 for the first item from a maker, $1.99 for each after it -- the
    // basket charges both; a single order only ever reads the first.
    if (/shipping\.json/.test(u)) return json({ profiles: [{ countries: ['US'], first_item: { cost: 599 }, additional_items: { cost: 199 } }] });
    if (/uploads\/images\.json/.test(u)) { wire.uploads++; return json({ id: `img_${wire.uploads}` }); }
    if (/shops\/\d+\/products\.json/.test(u)) { wire.products.push(body); return json({ id: `prod_${wire.products.length}` }); }
    if (/shops\/\d+\/orders\.json/.test(u)) { wire.orders.push(body); return json({ id: `order_${wire.orders.length}` }); }
    wire.unstubbed.push(`${m} ${u}`); return json({ error: 'unstubbed printify call' }, 500);
  }
  if (u.startsWith(IMG) || /\.(jpe?g|png)(\?|$)/i.test(u)) return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  if (u.startsWith('https://supabase.test/')) {
    // The basket's items, written by checkout and read back by the webhook.
    { const bm = /storage\/v1\/object\/generations\/baskets\/([^/?]+)$/.exec(u);
      if (bm && m === 'POST') { wire.baskets[bm[1]] = body; return json({ Key: bm[1] }); }
      if (bm && m === 'GET') return wire.baskets[bm[1]] ? json(wire.baskets[bm[1]]) : json({ error: 'not found' }, 404); }
    if (/\/customers/.test(u) && m === 'GET') return json([]);
    if (/\/customers/.test(u) && m === 'POST') return json([{ id: 'cust_1', token_balance: 0, email: null, email_verified: false }]);
    if (/\/customers/.test(u) && m === 'PATCH') wire.supaPatches.push(body);
    if (/\/gift_certificates\?/.test(u) && m === 'GET') return json(wire.giftRows.filter((r) => u.includes(encodeURIComponent(r.stripe_session_id)) || u.includes(r.code)));
    if (/\/gift_certificates$/.test(u) && m === 'POST') { wire.giftRows.push(body); return json([body], 201); }
    return json([{}]);
  }
  if (u.startsWith('https://api.resend.com/')) return json({ id: 'email_1' });
  wire.unstubbed.push(`${m} ${u}`); return json({ error: 'unstubbed' }, 500);
};

// ---- fake Vercel req/res ----
const res = () => ({ code: null, body: null, status(n) { this.code = n; return this; }, json(o) { this.body = o; return this; } });
const jsonReq = (body) => ({ method: 'POST', body, headers: {} });
const rawReq = (obj) => { const r = Readable.from([Buffer.from(JSON.stringify(obj))]); r.method = 'POST'; r.headers = { 'stripe-signature': 't=1,v1=fake' }; return r; };

const ADDRESS = { first_name: 'Alyx', last_name: 'Tester', email: 'alyx@example.com', phone: '5555550100', country: 'US', region: 'MI', address1: '123 Test St', address2: '', city: 'Westland', zip: '48185' };
const base = (extra) => ({ type: 'mug_order', deviceId: 'dev_test', customerName: 'Alyx Tester', giftMessage: null, shippingAddress: ADDRESS, referralCode: null, ...extra });

const MUG_TYPE = { 'classic-white-mug': 'Classic White', 'color-pop-mug': 'Color Pop', 'trimmed-mug': 'Trimmed', 'accented-mug': 'Accented', 'color-burst-mug': 'Color Burst', 'all-nighter-mug': 'All-Nighter' };

// One payment body per product, built the way order.html builds them.
function bodiesFor(key, p) {
  const firstSize = Object.keys(p.sizes || {})[0];
  if (p.layoutType === 'three-slot-wrap') {
    const colour = p.sizes[firstSize].colors ? p.sizes[firstSize].colors[0].name : null;
    const three = base({ mugType: MUG_TYPE[key], sizeLabel: firstSize, color: colour, placements: { left: IMG, front: IMG, right: IMG }, placementAdjust: {}, printMode: 'standard', panoramaImage: null, isWraparoundSet: false });
    if (key !== 'classic-white-mug') return [[key, three]];
    return [[key, three], [key + ' (wraparound)', { ...three, printMode: 'fullBleed', panoramaImage: IMG, isWraparoundSet: true }]];
  }
  if (p.layoutType === 'front-back') return [[key, base({ productKey: key, sizeLabel: p.sizeLabel || firstSize, colorName: p.colors ? p.colors[0].name : null, frontImage: IMG, backImage: IMG })]];
  if (key === 'photo-poster') return [[key, base({ productKey: key, sizeLabel: '12x18', colorName: null, posterFramed: false, posterOrientation: 'Horizontal', posterFinish: 'Matte', image: IMG })]];
  const size = p.sizeLabel || firstSize;
  const colour = p.colors ? p.colors[0].name : ((p.sizes || {})[size] || {}).colors ? p.sizes[size].colors[0].name : null;
  const single = base({ productKey: key, sizeLabel: size, colorName: colour, image: IMG });
  if (key === 'greeting-card') return [[key + ' (blank inside)', single], [key + ' (printed inside)', { ...single, insideImage: IMG }]];
  return [[key, single]];
}

(async () => {
  const session = (await import(pathToFileURL(path.join(ROOT, 'api', 'create-checkout-session.js')).href)).default;
  const webhook = (await import(pathToFileURL(path.join(ROOT, 'api', 'stripe-webhook.js')).href)).default;
  catalog = (await import(pathToFileURL(path.join(ROOT, 'lib', 'products-catalog.js')).href)).PRODUCTS_CATALOG;

  const errors = []; const origErr = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); };
  const origWarn = console.warn; console.warn = () => {};
  const origLog = console.log; const quiet = () => {};

  let fails = 0;
  const cases = [];
  for (const [key, p] of Object.entries(catalog)) for (const c of bodiesFor(key, p)) cases.push(c);

  for (const [label, body] of cases) {
    wire.uploads = 0; wire.products.length = 0; wire.orders.length = 0; wire.unstubbed.length = 0; errors.length = 0;
    const before = globalThis.__stripe.sessions.length;
    console.log = quiet;
    let verdict;
    try {
      // 1. the real session builder
      const r1 = res(); await session(jsonReq(body), r1);
      if (r1.code !== 200) throw new Error(`create-checkout-session answered ${r1.code}: ${JSON.stringify(r1.body)}`);
      const s = globalThis.__stripe.sessions[before];
      if (!s) throw new Error('no Stripe session was created');
      const meta = s.metadata || {};
      // Every product ships separately, and the fake Printify quotes $5.99
      // for all of them -- so a session with no shipping line (or a $0
      // one) means the lookup silently failed. The poster did exactly
      // this (its blueprint lives under product.base) until Sep 2026.
      if (catalog[meta.product_key]?.shippingSeparate) {
        const ship = (s.line_items || []).find((li) => /^Shipping/.test(li.price_data?.product_data?.name || ''));
        if (!ship || !(ship.price_data.unit_amount > 0)) throw new Error('the Stripe session carries no shipping line -- the customer would have been charged $0 shipping');
      }
      if (meta.order_type !== 'mug_order') throw new Error(`order_type=${meta.order_type}`);
      // 2. the real webhook, fed a completed event built from what the builder produced
      const event = { type: 'checkout.session.completed', livemode: true, data: { object: { id: s.id, metadata: meta, customer_details: { email: ADDRESS.email }, amount_total: 1000 } } };
      const r2 = res(); await webhook(rawReq(event), r2);
      if (r2.code !== 200) throw new Error(`webhook answered ${r2.code}: ${JSON.stringify(r2.body)}`);
      const critical = errors.filter((e) => /CRITICAL|Error handling|failed|Failed/.test(e));
      if (critical.length) throw new Error(`the webhook logged: ${critical[0].slice(0, 220)}`);
      if (wire.unstubbed.length) throw new Error(`unstubbed call: ${wire.unstubbed[0]}`);
      // 3. what reached Printify
      if (wire.orders.length !== 1) throw new Error(`${wire.orders.length} Printify orders were submitted, expected 1`);
      const order = wire.orders[0];
      if (order.external_id !== s.id) throw new Error(`external_id=${order.external_id}, expected the Stripe session id ${s.id} (the retry guard)`);
      if (wire.products.length !== 1) throw new Error(`${wire.products.length} Printify products were created, expected 1`);
      const prod = wire.products[0];
      const placeholders = (prod.print_areas?.[0]?.placeholders || []).map((x) => x.position);
      const want = body.frontImage ? ['mug_front', 'mug_back'] : body.insideImage ? ['front', 'inside'] : [];
      for (const w of want) if (!placeholders.includes(w)) throw new Error(`Printify product has placeholders ${JSON.stringify(placeholders)}, missing ${w}`);
      if (!placeholders.length) throw new Error('Printify product has no print placeholders at all');
      if (wire.uploads < 1) throw new Error('no image was uploaded to Printify');
      if (order.line_items?.[0]?.variant_id !== prod.print_areas?.[0]?.variant_ids?.[0]) throw new Error('the order names a different variant than the product was created for');
      verdict = `PASS: ${placeholders.join('+')} on variant ${order.line_items[0].variant_id}, ${wire.uploads} upload(s), external_id=${s.id}`;
    } catch (e) {
      verdict = `FAIL: ${e.message}`; fails++;
    }
    console.log = origLog;
    console.log(`[${label}] ${verdict}`);
  }

  // Token packs (22 Sep 2026): each pack must credit exactly the tokens it
  // sold, and send the buyer back to the studio. The webhook used to ignore
  // the pack and credit 5 (or 4) for every purchase.
  {
    const packs = { '1token': 1, '3tokens': 3, '20tokens': 20 };
    const bad = [];
    for (const [packId, want] of Object.entries(packs)) {
      const before = globalThis.__stripe.sessions.length;
      wire.supaPatches.length = 0;
      console.log = quiet;
      const r1 = res(); await session(jsonReq({ type: 'token_purchase', deviceId: 'dev_test', packId }), r1);
      const s = globalThis.__stripe.sessions[before];
      if (r1.code !== 200 || !s) { console.log = origLog; bad.push(`${packId}: checkout answered ${r1.code}`); continue; }
      if (!/needles-studio\.html\?checkout=success/.test(s.success_url || '')) bad.push(`${packId}: success_url is ${s.success_url}`);
      const r2 = res(); await webhook(rawReq({ type: 'checkout.session.completed', livemode: true, data: { object: { id: s.id, metadata: s.metadata, customer_details: { email: 'buyer@x.test' } } } }), r2);
      console.log = origLog;
      const credit = wire.supaPatches.find((b) => b && typeof b.token_balance === 'number');
      if (!credit) bad.push(`${packId}: no token balance was written`);
      else if (credit.token_balance !== want) bad.push(`${packId}: credited ${credit.token_balance}, expected ${want}`);
    }
    const tv = bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS: 1, 3 and 20-token packs credit 1, 3 and 20, and return the buyer to the studio';
    if (bad.length) fails++;
    console.log(`[tokenPacksCreditWhatTheySold] ${tv}`);
  }

  // The $5 Preview Reservation (22 Sep 2026): the real checkout returns the
  // buyer to the studio with the session id, and the real webhook credits
  // tokens AND mints a $5 credit on the gift ledger, once, even on a retry.
  {
    const bad = [];
    const before = globalThis.__stripe.sessions.length;
    wire.supaPatches.length = 0; wire.giftRows.length = 0;
    console.log = quiet;
    const r1 = res(); await session(jsonReq({ type: 'reservation', deviceId: 'dev_res' }), r1);
    const s = globalThis.__stripe.sessions[before];
    if (r1.code !== 200 || !s) bad.push(`checkout answered ${r1.code}`);
    else {
      if (s.metadata?.order_type !== 'reservation') bad.push(`order_type=${s.metadata?.order_type}`);
      if (!/needles-studio\.html\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/.test(s.success_url || '')) bad.push(`success_url=${s.success_url}`);
      const ev = { type: 'checkout.session.completed', livemode: true, data: { object: { id: s.id, metadata: s.metadata, customer_details: { email: 'res@x.test' } } } };
      await webhook(rawReq(ev), res());
      await webhook(rawReq(ev), res());
      const credit = wire.supaPatches.find((b) => b && typeof b.token_balance === 'number');
      if (!credit || !(credit.token_balance > 0)) bad.push('no tokens were credited');
      if (wire.giftRows.length !== 1) bad.push(`${wire.giftRows.length} credit rows minted, expected exactly 1 across a retried webhook`);
      else if (wire.giftRows[0].amount_cents !== 500 || wire.giftRows[0].balance_cents !== 500) bad.push(`credit is ${wire.giftRows[0].amount_cents} cents`);
    }
    console.log = origLog;
    const rv = bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS: a reservation credits tokens, mints one $5 credit (even when the webhook is retried), and returns to the studio with its session';
    if (bad.length) fails++;
    console.log(`[reservationFundsSpinsAndCreditsFive] ${rv}`);
  }

  // THE BASKET (23 Sep 2026). Four products from three makers in one payment:
  // checkout prices each from the catalog, charges each maker's first-item
  // rate once and its additional rate after that (with the 3% cushion), and
  // stores the items; the webhook builds every product and submits ONE
  // Printify order carrying all four.
  {
    const bad = [];
    const itemOf = (b) => { const { type, deviceId, customerName, giftMessage, shippingAddress, referralCode, ...item } = b; return item; };
    const mug = itemOf(bodiesFor('classic-white-mug', catalog['classic-white-mug'])[0][1]);
    const items = [
      itemOf(base({ productKey: 'car-magnet', sizeLabel: '5 x 5 in', colorName: null, image: IMG })),
      itemOf(base({ productKey: 'car-magnet', sizeLabel: '10 x 3 in', colorName: null, image: IMG })),
      itemOf(base({ productKey: 'doormat', sizeLabel: '18 x 30', colorName: null, image: IMG })),
      mug
    ];
    // What the customer should pay for shipping: per blueprint/provider group,
    // one first item and additional items after it, each with the 3% cushion.
    const keyOf = (it) => it.productKey || { 'Classic White': 'classic-white-mug' }[it.mugType];
    const groups = {};
    for (const it of items) { const p = catalog[keyOf(it)]; if (!p.shippingSeparate) continue; const g = `${p.blueprintId}/${p.printProviderId}`; groups[g] = (groups[g] || 0) + 1; }
    const cushion = (c) => Math.ceil(c * 1.03);
    const wantShip = Object.values(groups).reduce((a, n) => a + cushion(599) + (n - 1) * cushion(199), 0);
    const wantProduct = items.reduce((a, it) => { const p = catalog[keyOf(it)]; return a + Math.round(p.sizes[it.sizeLabel].price * 100); }, 0);

    wire.uploads = 0; wire.products.length = 0; wire.orders.length = 0; wire.unstubbed.length = 0; errors.length = 0;
    const before = globalThis.__stripe.sessions.length;
    console.log = quiet;
    const r1 = res(); await session(jsonReq({ type: 'basket_order', deviceId: 'dev_basket', items, customerName: 'Alyx Tester', giftMessage: null, shippingAddress: ADDRESS, referralCode: null }), r1);
    const s = globalThis.__stripe.sessions[before];
    if (r1.code !== 200 || !s) bad.push(`checkout answered ${r1.code}: ${JSON.stringify(r1.body)}`);
    else {
      const meta = s.metadata || {};
      if (meta.order_type !== 'basket_order') bad.push(`order_type=${meta.order_type}`);
      const lines = s.line_items || [];
      const productLines = lines.filter((li) => /^Muggshotz /.test(li.price_data.product_data.name));
      if (productLines.length !== 4) bad.push(`${productLines.length} product lines, expected 4`);
      const productTotal = productLines.reduce((a, li) => a + li.price_data.unit_amount, 0);
      if (productTotal !== wantProduct) bad.push(`products total ${productTotal} cents, catalog says ${wantProduct}`);
      const ship = lines.find((li) => /^Shipping/.test(li.price_data.product_data.name));
      if (!ship || ship.price_data.unit_amount !== wantShip) bad.push(`shipping ${ship ? ship.price_data.unit_amount : 'none'} cents, expected ${wantShip} (one first item per maker, the rest at the additional rate)`);
      if (!lines.some((li) => /^Card Processing/.test(li.price_data.product_data.name))) bad.push('no card fee line');
      const stored = wire.baskets[meta.basket_id + '.json'];
      if (!stored || (stored.items || []).length !== 4) bad.push(`stored basket has ${stored ? (stored.items || []).length : 'no'} items`);
      if (/"(first_name|address1|email)"/.test(JSON.stringify(stored || {}))) bad.push('the stored basket carries the address -- it belongs in metadata only');
      const r2 = res(); await webhook(rawReq({ type: 'checkout.session.completed', livemode: true, data: { object: { id: s.id, metadata: meta, customer_details: { email: ADDRESS.email } } } }), r2);
      if (r2.code !== 200) bad.push(`webhook answered ${r2.code}`);
      const critical = errors.filter((e) => /CRITICAL|Error handling|failed|Failed/.test(e));
      if (critical.length) bad.push(`the webhook logged: ${critical[0].slice(0, 200)}`);
      if (wire.unstubbed.length) bad.push(`unstubbed: ${wire.unstubbed[0]}`);
      if (wire.products.length !== 4) bad.push(`${wire.products.length} Printify products, expected 4`);
      if (wire.orders.length !== 1) bad.push(`${wire.orders.length} Printify orders, expected ONE for the whole basket`);
      else {
        const order = wire.orders[0];
        if ((order.line_items || []).length !== 4) bad.push(`the order carries ${(order.line_items || []).length} items, expected 4`);
        if (order.external_id !== s.id) bad.push(`external_id=${order.external_id}`);
        const variants = wire.products.map((p) => p.print_areas[0].variant_ids[0]).sort();
        const ordered = (order.line_items || []).map((l) => l.variant_id).sort();
        if (JSON.stringify(variants) !== JSON.stringify(ordered)) bad.push(`ordered variants ${ordered} differ from the products built ${variants}`);
        if (order.address_to?.address1 !== ADDRESS.address1) bad.push('the order is not addressed to the customer');
      }
    }
    console.log = origLog;
    const bv = bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: 4 items from 3 makers, one payment (shipping ${wantShip} cents: one first item per maker, the rest at the additional rate), one Printify order with 4 line items`;
    if (bad.length) fails++;
    console.log(`[basketOneOrderManyMakers] ${bv}`);
  }

  // A basket item is checked like a single order, and the gift certificate
  // comes off the whole basket once.
  {
    const bad = [];
    console.log = quiet;
    const good = { productKey: 'car-magnet', sizeLabel: '5 x 5 in', image: IMG };
    const r1 = res(); await session(jsonReq({ type: 'basket_order', deviceId: 'd', items: [good, { productKey: 'car-magnet', sizeLabel: '9 x 9 in', image: IMG }], customerName: 'A', shippingAddress: ADDRESS }), r1);
    if (r1.code !== 400 || !/Basket item 2/.test(r1.body?.error || '')) bad.push(`a bad second item answered ${r1.code} ${JSON.stringify(r1.body)}`);
    const r2 = res(); await session(jsonReq({ type: 'basket_order', deviceId: 'd', items: Array(7).fill(good), customerName: 'A', shippingAddress: ADDRESS }), r2);
    if (r2.code !== 400) bad.push(`a 7-item basket answered ${r2.code}`);
    const r3 = res(); await session(jsonReq({ type: 'basket_order', deviceId: 'd', items: [], customerName: 'A', shippingAddress: ADDRESS }), r3);
    if (r3.code !== 400) bad.push(`an empty basket answered ${r3.code}`);
    wire.giftRows.length = 0;
    wire.giftRows.push({ code: 'MUG-TEST-GIFT', amount_cents: 1000, balance_cents: 1000, stripe_session_id: 'cs_gift_seed', voided_at: null });
    const before = globalThis.__stripe.sessions.length;
    const r4 = res(); await session(jsonReq({ type: 'basket_order', deviceId: 'd', items: [good, good], customerName: 'A', shippingAddress: ADDRESS, giftCode: 'MUG-TEST-GIFT' }), r4);
    const s = globalThis.__stripe.sessions[before];
    if (r4.code !== 200 || !s) bad.push(`a gift basket answered ${r4.code} ${JSON.stringify(r4.body)}`);
    else {
      if (s.metadata.gift_cents !== '1000' || !s.discounts) bad.push(`gift_cents=${s.metadata.gift_cents}, discounts=${JSON.stringify(s.discounts)}`);
    }
    console.log = origLog;
    const gv = bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS: a bad item is refused by number, 7 items and an empty basket are refused, and a gift certificate comes off the basket once';
    if (bad.length) fails++;
    console.log(`[basketChecksEveryItemAndTakesAGift] ${gv}`);
  }

  // The kill-switch: a TEST-mode event must place nothing.
  wire.orders.length = 0;
  const s = globalThis.__stripe.sessions[0];
  const r3 = res(); console.log = quiet;
  await webhook(rawReq({ type: 'checkout.session.completed', livemode: false, data: { object: { id: s.id, metadata: s.metadata } } }), r3);
  console.log = origLog;
  const ks = r3.code === 200 && wire.orders.length === 0 ? 'PASS: a test-mode event places no Printify order' : `FAIL: test-mode event -> ${r3.code}, ${wire.orders.length} order(s)`;
  if (/^FAIL/.test(ks)) fails++;
  console.log(`[testModeEventPlacesNothing] ${ks}`);

  console.error = origErr; console.warn = origWarn;
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL BACK-HALF VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
