// THE SQUARE TRACK, server side (Alyx, 24 Sep 2026: "either track would be
// fully wired ... when dealing with gift cards specifically, we would
// naturally switch automatically to the Square track"). Runs the real
// api/create-checkout-session.js and api/stripe-webhook.js against stand-ins
// for Supabase, Square's API, Printify's shipping and Stripe's SDK, and holds
// them to:
//   * the switch: Stripe by default, Square when the row says so, Stripe
//     again when Square is not configured;
//   * every checkout kind reaches Square's hosted page when the switch is on
//     Square, with the fee at Square's rate and our checkout id on the order;
//   * a Square gift card sends the order to Square whatever the switch says,
//     pays first by its id, and what is left comes back for the card form;
//     a card that covers it all pays the order outright;
//   * square_complete pays the rest, closes the order, settles once;
//   * the webhook: a bad signature is refused; a completed payment settles
//     its record; a record already settled on the page is not settled twice;
//     Stripe's own events still route.
// Sandbox keys throughout, so settling never places an order -- exactly the
// posture the webhook takes with Stripe test-mode events.
import { createHmac } from 'node:crypto';

process.env.SUPABASE_URL = 'https://fake.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
process.env.SQUARE_ACCESS_TOKEN = 'sq-token';
process.env.SQUARE_LOCATION_ID = 'LOC1';
process.env.SQUARE_APPLICATION_ID = 'sandbox-sq0idb-app';
process.env.SQUARE_ENV = 'sandbox';
process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'sig-key';
process.env.SQUARE_WEBHOOK_URL = 'https://muggshotz-ai-test.vercel.app/api/square-webhook';
process.env.PRINTIFY_API_TOKEN = 'printify';

// ---- the stand-ins ---------------------------------------------------------
const state = {
  rail: 'stripe',
  storage: new Map(),          // generations/<path> -> json
  giftCards: { '7782730000001234': { id: 'gftc:1', gan: '7782730000001234', state: 'ACTIVE', balance: 1000, type: 'PHYSICAL' } },
  square: { orders: new Map(), payments: new Map(), links: [], calls: [] },
  stripe: { sessions: [], coupons: [] },
  betas: [{ id: 'beta1', base_code: 'CHIPPER', current_tier: 'PotShotz' }],
};
let idn = 0; const nid = (p) => `${p}${++idn}`;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (url, opts = {}) => {
  url = String(url); const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : null;
  // Supabase rows
  if (url.startsWith('https://fake.supabase.test/rest/v1/site_settings')) {
    if (method === 'PATCH') { state.rail = body.payment_rail; return json([{ id: 1, payment_rail: state.rail }]); }
    return json([{ id: 1, maintenance_mode: false, maintenance_message: '', maintenance_eta: '', payment_rail: state.rail }]);
  }
  if (url.startsWith('https://fake.supabase.test/rest/v1/email_discounts')) return json([{ email: 'x' }]); // used: no discount
  if (url.startsWith('https://fake.supabase.test/rest/v1/gift_certificates')) {
    if (url.includes('code=eq.MUG-AAAA-BBBB')) return json([{ code: 'MUG-AAAA-BBBB', amount_cents: 500, balance_cents: 500, voided_at: null }]);
    return json([]);
  }
  if (url.startsWith('https://fake.supabase.test/rest/v1/flyer_betas')) return json(state.betas);
  if (url.startsWith('https://fake.supabase.test/rest/v1/flyer_codes')) return json([{ matured: true }]);
  if (url.startsWith('https://fake.supabase.test/rest/v1/customers')) return json([]);
  // Supabase storage
  const st = /https:\/\/fake\.supabase\.test\/storage\/v1\/object\/generations\/(.+)$/.exec(url);
  if (st) {
    const key = decodeURIComponent(st[1]);
    if (method === 'POST' || method === 'PUT') { state.storage.set(key, body); return json({ Key: key }); }
    if (!state.storage.has(key)) return json({ error: 'not found' }, 404);
    return json(state.storage.get(key));
  }
  // Printify shipping
  if (/api\.printify\.com\/v1\/catalog\/blueprints\/\d+\/print_providers\/\d+\/shipping\.json/.test(url)) {
    return json({ handling_time: { value: 2, unit: 'day' }, profiles: [{ variant_ids: [], first_item: { cost: 500, currency: 'USD' }, additional_items: { cost: 100, currency: 'USD' }, countries: ['US'] }] });
  }
  // Square
  const sq = /https:\/\/connect\.squareupsandbox\.com(\/v2\/.*)$/.exec(url);
  if (sq) {
    const path = sq[1]; state.square.calls.push({ method, path, body });
    if (path === '/v2/online-checkout/payment-links') {
      const oid = nid('ord'); state.square.orders.set(oid, { id: oid, ...body.order });
      const link = { id: nid('lnk'), order_id: oid, url: `https://square.link/u/${oid}` }; state.square.links.push({ link, body });
      return json({ payment_link: link });
    }
    if (path === '/v2/orders' && method === 'POST') {
      const oid = nid('ord'); const gross = body.order.line_items.reduce((a, li) => a + Number(li.base_price_money.amount), 0);
      const off = (body.order.discounts || []).reduce((a, d) => a + Number(d.amount_money.amount), 0);
      state.square.orders.set(oid, { id: oid, ...body.order, net_amount_due_money: { amount: gross - off, currency: 'USD' } });
      return json({ order: state.square.orders.get(oid) });
    }
    const ro = /^\/v2\/orders\/([^/]+)$/.exec(path);
    if (ro && method === 'GET') { const o = state.square.orders.get(ro[1]); return o ? json({ order: o }) : json({ errors: [{ code: 'NOT_FOUND' }] }, 404); }
    const pay = /^\/v2\/orders\/([^/]+)\/pay$/.exec(path);
    if (pay) { for (const pid of body.payment_ids) { const p = state.square.payments.get(pid); if (p) p.status = 'COMPLETED'; } return json({ order: state.square.orders.get(pay[1]) }); }
    if (path === '/v2/payments' && method === 'POST') {
      const pid = nid('pay'); let amount = Number(body.amount_money.amount);
      if (body.source_id.startsWith('gftc:')) {
        const card = Object.values(state.giftCards).find((c) => c.id === body.source_id);
        if (!card) return json({ errors: [{ category: 'INVALID_REQUEST_ERROR', code: 'NOT_FOUND', detail: 'no such card' }] }, 404);
        if (card.balance < amount) { if (!body.accept_partial_authorization) return json({ errors: [{ code: 'INSUFFICIENT_FUNDS', detail: 'short' }] }, 400); amount = card.balance; }
        card.balance -= amount;
      }
      const p = { id: pid, status: body.autocomplete === false ? 'APPROVED' : 'COMPLETED', order_id: body.order_id, amount_money: { amount, currency: 'USD' }, approved_money: { amount, currency: 'USD' }, source_type: body.source_id.startsWith('gftc:') ? 'GIFT_CARD' : 'CARD' };
      state.square.payments.set(pid, p); return json({ payment: p });
    }
    if (/^\/v2\/payments\/[^/]+\/cancel$/.test(path)) return json({ payment: {} });
    if (path === '/v2/gift-cards' && method === 'POST') { const g = { id: nid('gftc:'), gan: '77827300009' + String(idn).padStart(5, '0'), state: 'PENDING', balance: 0, type: body.gift_card.type }; state.giftCards[g.gan] = g; return json({ gift_card: { id: g.id, gan: g.gan, state: g.state, type: g.type, balance_money: { amount: 0, currency: 'USD' } } }); }
    if (path === '/v2/gift-cards/activities' && method === 'POST') { const a = body.gift_card_activity; const g = Object.values(state.giftCards).find((c) => c.id === a.gift_card_id); if (!g) return json({ errors: [{ code: 'NOT_FOUND' }] }, 404); g.balance += Number(a.activate_activity_details.amount_money.amount); g.state = 'ACTIVE'; return json({ gift_card_activity: { id: nid('act'), gift_card_gan: g.gan, gift_card_balance_money: { amount: g.balance, currency: 'USD' } } }); }
    if (path === '/v2/gift-cards/from-gan') { const c = state.giftCards[body.gan]; return c ? json({ gift_card: { id: c.id, gan: c.gan, state: c.state, balance_money: { amount: c.balance, currency: 'USD' }, type: c.type } }) : json({ errors: [{ code: 'NOT_FOUND' }] }, 404); }
    return json({ errors: [{ code: 'UNSTUBBED', detail: path }] }, 500);
  }
  throw new Error('unstubbed fetch: ' + method + ' ' + url);
};

// Stripe's SDK, stubbed on the shared prototypes so the module's own instance
// answers the same way (the ESM build, the one the api files import).
const Stripe = (await import('stripe')).default;
const probe = new Stripe('sk_test_probe');
Object.getPrototypeOf(probe.checkout.sessions).create = async function (spec) { const s = { id: nid('cs_test_'), url: 'https://checkout.stripe.test/' + idn, spec }; state.stripe.sessions.push(s); return s; };
Object.getPrototypeOf(probe.coupons).create = async function (c) { const cp = { id: nid('cpn'), ...c }; state.stripe.coupons.push(cp); return cp; };

// ---- the code under test ---------------------------------------------------
const checkout = (await import('../api/create-checkout-session.js')).default;
const webhook = (await import('../api/stripe-webhook.js')).default;
const { readPaymentRail } = await import('../lib/payment-rail.js');

function res() {
  const r = { code: 200, body: null, headers: {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; } };
  return r;
}
async function post(body) { const r = res(); await checkout({ method: 'POST', body, headers: { origin: 'https://muggshotz-ai-test.vercel.app' } }, r); return r; }
async function hook(rawBody, headers) {
  const r = res();
  const { Readable } = await import('node:stream');
  const req = Readable.from([Buffer.from(rawBody)]); req.method = 'POST'; req.headers = headers;
  await webhook(req, r); return r;
}
const ADDRESS = { first_name: 'Alyx', last_name: 'T', email: 'alyx@example.com', phone: '5555550100', country: 'US', region: 'MI', address1: '1 Test St', address2: '', city: 'Westland', zip: '48185' };
const mousePad = (extra = {}) => ({ type: 'mug_order', deviceId: 'dev1', productKey: 'mouse-pad', sizeLabel: '9" x 8"', image: 'https://img.test/a.png', shippingAddress: ADDRESS, ...extra });
const lastSquareLink = () => state.square.links[state.square.links.length - 1];
const feeOf = (lineItems) => lineItems.find((li) => /Card Processing/.test(li.price_data.product_data.name));
const sqFee = (order) => order.line_items.find((li) => /Card Processing/.test(li.name));
const checks = [];
const ok = (cond, pass, fail) => checks.push(cond ? `PASS: ${pass}` : `FAIL: ${fail}`);

// 1. Stripe by default: a token pack becomes a Stripe session at Stripe's rate.
{
  state.rail = 'stripe';
  const r = await post({ type: 'token_purchase', deviceId: 'dev1', packId: Object.keys((await import('../lib/token-packs.js')).TOKEN_PACKS)[0] });
  const s = state.stripe.sessions[state.stripe.sessions.length - 1];
  const fee = s && feeOf(s.spec.line_items);
  const pack = s && s.spec.line_items[0].price_data.unit_amount;
  ok(r.code === 200 && /checkout\.stripe\.test/.test(r.body?.url) && fee && fee.price_data.unit_amount === Math.ceil(0.029 * pack + 35) && /2\.9%/.test(fee.price_data.product_data.description),
    'the switch on Stripe: a token pack goes to Stripe with the fee at 2.9% + 30c + 5c',
    `Stripe token purchase: ${JSON.stringify({ code: r.code, body: r.body, fee: fee?.price_data })}`);
}

// 2. The switch on Square: every checkout kind reaches Square's hosted page.
{
  state.rail = 'square';
  ok((await readPaymentRail()) === 'square', 'the switch reads square', 'the switch did not read square');
  const kinds = [
    ['reservation', { type: 'reservation', deviceId: 'dev1', email: 'alyx@example.com' }],
    ['token_purchase', { type: 'token_purchase', deviceId: 'dev1', packId: Object.keys((await import('../lib/token-packs.js')).TOKEN_PACKS)[0] }],
    ['mug_order', mousePad()],
    ['basket_order', { type: 'basket_order', deviceId: 'dev1', items: [mousePad(), mousePad()], shippingAddress: ADDRESS }],
    ['tier_upgrade', { type: 'tier_upgrade', betaId: 'beta1' }],
    ['gift_certificate', { type: 'gift_certificate', amountCents: 2500, buyerEmail: 'alyx@example.com', recipientEmail: 'sis@example.com', recipientName: 'Laura' }],
  ];
  for (const [kind, body] of kinds) {
    const before = state.square.links.length;
    const r = await post(body);
    const l = state.square.links.length > before ? lastSquareLink() : null;
    const order = l && l.body.order;
    const record = l && state.storage.get(`checkouts/${order.reference_id}.json`);
    const fee = order && sqFee(order);
    const gross = order ? order.line_items.filter((li) => li !== fee).reduce((a, li) => a + Number(li.base_price_money.amount), 0) : 0;
    const feeRight = kind === 'tier_upgrade' ? !fee : (fee && Number(fee.base_price_money.amount) === Math.ceil(0.033 * gross + 35));
    const bad = [];
    if (r.code !== 200 || !/square\.link/.test(r.body?.url)) bad.push(`answered ${r.code} ${JSON.stringify(r.body)}`);
    if (!order) bad.push('no Square payment link was created');
    else {
      if (!/^sq_[0-9a-f-]{36}$/.test(order.reference_id)) bad.push(`reference_id ${order.reference_id}`);
      if (Object.keys(order.metadata || {}).length > 10) bad.push('more than 10 metadata entries');
      if (!record || record.orderType !== (body.type)) bad.push(`no checkout record for ${order.reference_id} (${record && record.orderType})`);
      if (!feeRight) bad.push(`fee line ${fee ? fee.base_price_money.amount : 'missing'} on ${gross} (Square's 3.3% + 30c + 5c)`);
      if (fee && !/3\.3%/.test(fee.note || '')) bad.push('the fee line does not say 3.3%');
      if (!/checkouts\//.test([...state.storage.keys()].join(' '))) bad.push('record not stored');
      if (l.body.checkout_options.redirect_url.includes('{CHECKOUT_SESSION_ID}')) bad.push('redirect url still carries the Stripe placeholder');
      if (kind === 'gift_certificate' && !l.body.checkout_options.redirect_url.includes(`session_id=${order.reference_id}`)) bad.push('gift.html is not sent our checkout id');
    }
    ok(!bad.length, `${kind} goes to Square's page with our checkout id and the fee at 3.3%`, `${kind}: ${bad.join('; ')}`);
  }
}

// (Square-not-configured falls back to Stripe in chooseRail; squareConfigured()
// reads its keys at import, so that rule is read, not run, here.)

// 4. A store certificate on the Stripe track: a one-off coupon, 50c minimum.
{
  state.rail = 'stripe';
  const before = state.stripe.coupons.length;
  const r = await post(mousePad({ giftCode: 'MUG-AAAA-BBBB' }));
  const cp = state.stripe.coupons[state.stripe.coupons.length - 1];
  ok(r.code === 200 && state.stripe.coupons.length === before + 1 && cp.amount_off === 500,
    'a store certificate on Stripe is a one-off coupon for its balance',
    `certificate on Stripe: ${r.code} ${JSON.stringify(r.body)} coupon=${JSON.stringify(cp)}`);
}

// 5. A Square gift card sends the order to Square whatever the switch says,
//    pays first by its id, and the rest comes back for the card form.
let squarePay;
{
  state.rail = 'stripe';
  state.giftCards['7782730000001234'].balance = 1000;
  const callsBefore = state.square.calls.length;
  const r = await post(mousePad({ squareGan: '7782 7300 0000 1234' }));
  squarePay = r.body?.squarePay;
  const calls = state.square.calls.slice(callsBefore);
  const giftPay = calls.find((c) => c.path === '/v2/payments' && c.body.source_id === 'gftc:1');
  const order = calls.find((c) => c.path === '/v2/orders' && c.method === 'POST')?.body.order;
  const fee = order && sqFee(order);
  const owed = order ? order.line_items.filter((li) => li !== fee).reduce((a, li) => a + Number(li.base_price_money.amount), 0) : 0;
  const bad = [];
  if (r.code !== 200 || !squarePay) bad.push(`answered ${r.code} ${JSON.stringify(r.body)}`);
  else {
    if (!giftPay || giftPay.body.accept_partial_authorization !== true || giftPay.body.autocomplete !== false) bad.push('the gift card was not charged by its id as a partial, uncompleted payment');
    if (squarePay.giftPaidCents !== 1000) bad.push(`gift paid ${squarePay.giftPaidCents}, expected 1000`);
    if (!fee || Number(fee.base_price_money.amount) !== Math.ceil(0.033 * (owed - 1000) + 35)) bad.push(`fee ${fee?.base_price_money.amount} not on the remainder after the gift card`);
    if (squarePay.remainderCents !== owed + Number(fee.base_price_money.amount) - 1000) bad.push(`remainder ${squarePay.remainderCents}`);
    if (squarePay.applicationId !== 'sandbox-sq0idb-app' || squarePay.locationId !== 'LOC1' || !/sandbox\.web\.squarecdn/.test(squarePay.sdkUrl)) bad.push('the page was not told how to draw the card form');
    const rec = state.storage.get(`checkouts/${squarePay.checkoutId}.json`);
    if (!rec || rec.giftPaymentId !== giftPay?.body && !rec.giftPaymentId) bad.push('record lacks the gift payment');
    if (rec && rec.settledAt) bad.push('settled before the card paid');
  }
  ok(!bad.length, 'a Square gift card routes to Square, pays $10 first, and asks for the rest on a card', `gift card order: ${bad.join('; ')}`);
}

// 6. The rest on a card: paid, the order closed with both payments, settled once.
{
  const callsBefore = state.square.calls.length;
  const r = await post({ type: 'square_complete', checkoutId: squarePay.checkoutId, sourceId: 'cnon:card-token' });
  const calls = state.square.calls.slice(callsBefore);
  const cardPay = calls.find((c) => c.path === '/v2/payments' && c.body.source_id === 'cnon:card-token');
  const pay = calls.find((c) => /\/pay$/.test(c.path));
  const rec = state.storage.get(`checkouts/${squarePay.checkoutId}.json`);
  const bad = [];
  if (r.code !== 200 || !/order\.html\?checkout=success/.test(r.body?.url)) bad.push(`answered ${r.code} ${JSON.stringify(r.body)}`);
  if (!cardPay || Number(cardPay.body.amount_money.amount) !== squarePay.remainderCents) bad.push('the card was not charged the remainder');
  if (!pay || pay.body.payment_ids.length !== 2) bad.push('PayOrder was not given both payments');
  if (!rec?.settledAt || rec.settledBy !== 'page' || rec.ignored !== 'sandbox') bad.push(`record ${JSON.stringify(rec && { settledAt: rec.settledAt, settledBy: rec.settledBy, ignored: rec.ignored })}`);
  const again = await post({ type: 'square_complete', checkoutId: squarePay.checkoutId, sourceId: 'cnon:card-token-2' });
  if (again.code !== 200 || !again.body?.paid || state.square.calls.slice(callsBefore + calls.length).some((c) => c.path === '/v2/payments')) bad.push('a second completion charged again');
  ok(!bad.length, 'square_complete charges the remainder, closes the order with both payments, settles once (sandbox: nothing fulfilled)', `square_complete: ${bad.join('; ')}`);
}

// 7. A gift card that covers everything pays the order outright: no card form.
{
  state.giftCards['7782730000001234'].balance = 100000;
  const callsBefore = state.square.calls.length;
  const r = await post(mousePad({ squareGan: '7782730000001234' }));
  const calls = state.square.calls.slice(callsBefore);
  const order = calls.find((c) => c.path === '/v2/orders' && c.method === 'POST')?.body.order;
  const pay = calls.find((c) => /\/pay$/.test(c.path));
  const bad = [];
  if (r.code !== 200 || !r.body?.paid || !/checkout=success/.test(r.body?.url)) bad.push(`answered ${r.code} ${JSON.stringify(r.body)}`);
  if (order && sqFee(order)) bad.push('a card fee was charged though no card is used');
  if (!pay || pay.body.payment_ids.length !== 1) bad.push('the order was not closed on the gift card alone');
  ok(!bad.length, 'a gift card that covers the order pays it outright, with no card fee and no card form', `gift covers all: ${bad.join('; ')}`);
}

// 8. A dead card is refused before anything is charged.
{
  const r = await post(mousePad({ squareGan: '0000000000000000' }));
  ok(r.code === 400 && /gift card/i.test(r.body?.error || ''), 'an unknown gift card number is refused', `unknown card: ${r.code} ${JSON.stringify(r.body)}`);
}

// 9. The webhook: signature, settle once, Stripe still routes.
{
  const sign = (body) => createHmac('sha256', 'sig-key').update(process.env.SQUARE_WEBHOOK_URL + body).digest('base64');
  // a fresh payment-link sale, paid on Square's page
  state.rail = 'square';
  await post({ type: 'token_purchase', deviceId: 'dev2', packId: Object.keys((await import('../lib/token-packs.js')).TOKEN_PACKS)[0] });
  const l = lastSquareLink();
  const evt = JSON.stringify({ type: 'payment.updated', data: { object: { payment: { id: 'payX', status: 'COMPLETED', order_id: l.link.order_id } } } });
  const badSig = await hook(evt, { 'x-square-hmacsha256-signature': 'nope' });
  const good = await hook(evt, { 'x-square-hmacsha256-signature': sign(evt) });
  const rec = state.storage.get(`checkouts/${l.body.order.reference_id}.json`);
  const twice = await hook(evt, { 'x-square-hmacsha256-signature': sign(evt) });
  const bad = [];
  if (badSig.code !== 400) bad.push(`a bad signature answered ${badSig.code}`);
  if (good.code !== 200 || good.body?.reason !== 'sandbox') bad.push(`a good signature answered ${good.code} ${JSON.stringify(good.body)}`);
  if (!rec?.settledAt || rec.settledBy !== 'webhook') bad.push('the record was not settled by the webhook');
  if (twice.body?.reason !== 'already_settled' && twice.body?.reason !== 'already_fulfilled') bad.push(`a replay answered ${JSON.stringify(twice.body)}`);
  // the page-settled record from step 6, reported by the webhook
  const evt2 = JSON.stringify({ type: 'payment.updated', data: { object: { payment: { id: 'payY', status: 'COMPLETED', order_id: squarePay.orderId } } } });
  const r2 = await hook(evt2, { 'x-square-hmacsha256-signature': sign(evt2) });
  if (!/already/.test(r2.body?.reason || '')) bad.push(`the page-settled order was settled again by the webhook: ${JSON.stringify(r2.body)}`);
  // Stripe's own event still routes (test mode: ignored, not refused)
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_test_1', metadata: { order_type: 'token_purchase' } } } });
  const header = probe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_fake' });
  const rs = await hook(payload, { 'stripe-signature': header });
  if (rs.code !== 200 || rs.body?.ignored !== 'test_mode') bad.push(`Stripe's event answered ${rs.code} ${JSON.stringify(rs.body)}`);
  ok(!bad.length, 'the webhook refuses a bad signature, settles a paid link once, leaves a page-settled order alone, and still routes Stripe', `webhook: ${bad.join('; ')}`);
}

// 10. The sandbox minter: a digital card, activated with the amount, usable.
{
  const { createGiftCard, activateGiftCard, giftCardFromGan, giftCardUsable } = await import('../lib/square.js');
  const card = await createGiftCard({ type: 'DIGITAL' });
  const act = await activateGiftCard({ giftCardId: card.id, amountCents: 2500, referenceId: 'sandbox-test', buyerPaymentInstrumentIds: ['sandbox-test'] });
  const back = await giftCardFromGan(card.gan);
  ok(card.state === 'PENDING' && act.balanceCents === 2500 && giftCardUsable(back) && back.balanceCents === 2500,
    'a minted card is registered, activated with $25, and looks up as usable',
    `minted card: ${JSON.stringify({ card, act, back })}`);
}

for (const c of checks) console.log(`[square-track] ${c}`);
const fails = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL SQUARE-TRACK VERIFICATIONS PASSED');
process.exit(fails ? 1 : 0);
