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
const wire = { uploads: 0, products: [], orders: [], unstubbed: [], variantsAsked: [] };
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
    if (/shipping\.json/.test(u)) return json({ profiles: [{ countries: ['US'], first_item: { cost: 599 } }] });
    if (/uploads\/images\.json/.test(u)) { wire.uploads++; return json({ id: `img_${wire.uploads}` }); }
    if (/shops\/\d+\/products\.json/.test(u)) { wire.products.push(body); return json({ id: `prod_${wire.products.length}` }); }
    if (/shops\/\d+\/orders\.json/.test(u)) { wire.orders.push(body); return json({ id: `order_${wire.orders.length}` }); }
    wire.unstubbed.push(`${m} ${u}`); return json({ error: 'unstubbed printify call' }, 500);
  }
  if (u.startsWith(IMG) || /\.(jpe?g|png)(\?|$)/i.test(u)) return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  if (u.startsWith('https://supabase.test/')) {
    if (/\/customers/.test(u) && m === 'GET') return json([]);
    if (/\/customers/.test(u) && m === 'POST') return json([{ id: 'cust_1', token_balance: 0, email: null, email_verified: false }]);
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

const MUG_TYPE = { 'classic-white-mug': 'Classic White', 'color-pop-mug': 'Color Pop', 'trimmed-mug': 'Trimmed', 'accented-mug': 'Accented' };

// One payment body per product, built the way order.html builds them.
function bodiesFor(key, p) {
  const firstSize = Object.keys(p.sizes || {})[0];
  if (p.layoutType === 'three-slot-wrap') {
    const colour = p.sizes['11oz'].colors ? p.sizes['11oz'].colors[0].name : null;
    const three = base({ mugType: MUG_TYPE[key], sizeLabel: '11oz', color: colour, placements: { left: IMG, front: IMG, right: IMG }, placementAdjust: {}, printMode: 'standard', panoramaImage: null, isWraparoundSet: false });
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
