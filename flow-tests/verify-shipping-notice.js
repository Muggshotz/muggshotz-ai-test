// THE SHIPPING NOTICE (Alyx, 7 Oct 2026: "is there any way that we can let
// them track it?"). Printify signs a delivery when a shipment leaves; the
// site checks the signature, reads the order for the customer's email, and
// emails the tracking link. Every call to Printify and Resend is faked here.
//   node flow-tests/verify-shipping-notice.js   (no browser, no server)
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pathToFileURL } = require('url');

const results = [];
const check = (name, ok, detail) => results.push([name, !!ok, detail]);

(async () => {
  process.env.PRINTIFY_API_TOKEN = 'test-token';
  process.env.RESEND_API_KEY = 'test-resend';
  const S = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'shipping-notice.js')).href);
  const secret = S.webhookSecret('test-token');
  check('the secret comes from the token alone', secret === S.webhookSecret('test-token') && secret !== S.webhookSecret('other') && /^[0-9a-f]{64}$/.test(secret));

  const event = { id: 'evt-1', type: 'order:shipment:created', created_at: '2026-10-07 20:00:00+00:00',
    resource: { id: 'order-abc', type: 'order', data: { shop_id: 27439202, shipped_at: '2026-10-07 19:59:00+00:00', carrier: { code: 'USPS', tracking_number: '9400111899223', tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223' }, skus: ['1'] } } };
  const body = Buffer.from(JSON.stringify(event));
  const sign = (b, s) => 'sha256=' + crypto.createHmac('sha256', s).update(b).digest('hex');
  check('a delivery signed with our secret verifies', S.verifyPrintifySignature(body, sign(body, secret), secret));
  check('a delivery signed with another secret does not', !S.verifyPrintifySignature(body, sign(body, 'wrong'), secret));
  check('a tampered body does not', !S.verifyPrintifySignature(Buffer.from(body.toString() + ' '), sign(body, secret), secret));
  check('no header, no secret: refused', !S.verifyPrintifySignature(body, undefined, secret) && !S.verifyPrintifySignature(body, sign(body, secret), null));
  const sh = S.shipmentFromEvent(event);
  check('the shipment is read from the delivery', sh && sh.orderId === 'order-abc' && sh.carrier === 'USPS' && sh.number === '9400111899223' && /usps/.test(sh.url), JSON.stringify(sh));
  check('another event is not a shipment', S.shipmentFromEvent({ type: 'order:created', resource: { id: 'x' } }) === null);
  const em = S.shippedEmail({ firstName: 'Casper', items: ['Doormat (18 x 30)'], carrier: 'USPS', number: '9400111899223', url: 'https://t.example/1', orderRef: 'cs_1' });
  check('the email names the item, the carrier and the link', /shipped: Doormat/.test(em.subject) && /Hi Casper/.test(em.html) && /Doormat \(18 x 30\)/.test(em.html) && /href="https:\/\/t\.example\/1"/.test(em.html) && /USPS · 9400111899223/.test(em.html) && /cs_1/.test(em.html), em.html);
  const em2 = S.shippedEmail({ items: [], carrier: null, number: null, url: null });
  check('with nothing to track it still says it is on its way', /on its way/.test(em2.html) && !/Track it/.test(em2.html));

  // The endpoint itself, with Printify and Resend faked.
  const calls = [];
  global.fetch = async (url, init = {}) => {
    const u = String(url); calls.push({ u, init });
    if (/\/orders\/order-abc\.json$/.test(u)) return { ok: true, status: 200, json: async () => ({ id: 'order-abc', external_id: 'cs_test_9', address_to: { email: 'casper@example.com', first_name: 'Casper', last_name: 'Ghost' }, line_items: [{ metadata: { title: 'Doormat', variant_label: '18 x 30' } }] }) };
    if (/api\.resend\.com\/emails$/.test(u)) return { ok: true, status: 200, text: async () => '{}', json: async () => ({ id: 'em' }) };
    return { ok: false, status: 404, text: async () => 'nope', json: async () => ({}) };
  };
  const H = (await import(pathToFileURL(path.join(__dirname, '..', 'api', 'printify-webhook.js')).href)).default;
  const run = async (buf, sig, method = 'POST') => {
    const req = Readable.from([buf]); req.method = method; req.headers = sig ? { 'x-pfy-signature': sig } : {};
    let status = 0, out = null;
    const res = { status(s) { status = s; return this; }, json(j) { out = j; return this; }, end() { return this; } };
    await H(req, res);
    return { status, out };
  };
  calls.length = 0;
  let r = await run(body, sign(body, 'wrong'));
  check('a badly signed delivery is refused and nothing is called', r.status === 401 && calls.length === 0, JSON.stringify(r));
  calls.length = 0;
  r = await run(body, sign(body, secret));
  const sent = calls.find((c) => /resend/.test(c.u));
  const mail = sent ? JSON.parse(sent.init.body) : null;
  check('a signed shipment reads the order and emails the customer', r.status === 200 && r.out && r.out.sent === true && calls.some((c) => /orders\/order-abc\.json/.test(c.u) && /Bearer test-token/.test(c.init.headers.Authorization)) && mail && mail.to === 'casper@example.com' && /shipped: Doormat \(18 x 30\)/.test(mail.subject) && /9400111899223/.test(mail.html) && /hello@muggshotz\.com/.test(mail.from) && /muggshotzreplies@gmail\.com/.test(mail.reply_to), JSON.stringify({ r, mail: mail && { to: mail.to, subject: mail.subject } }));
  calls.length = 0;
  const other = Buffer.from(JSON.stringify({ id: 'evt-2', type: 'order:created', resource: { id: 'order-abc', type: 'order', data: {} } }));
  r = await run(other, sign(other, secret));
  check('another event is acknowledged and nothing is sent', r.status === 200 && r.out.ignored === 'order:created' && calls.length === 0, JSON.stringify(r));

  let fails = 0;
  for (const [name, ok, detail] of results) { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '\n        ' + String(detail).slice(0, 400)}`); }
  console.log(fails ? `\n${fails} SHIPPING-NOTICE VERIFICATION(S) FAILED` : '\nALL SHIPPING-NOTICE VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });
