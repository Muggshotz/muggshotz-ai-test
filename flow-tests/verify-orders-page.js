// WHERE'S MY ORDER? (Alyx, 7 Oct 2026). The ledger the webhook keeps per
// email, the one-tap link, Printify's statuses in words, the endpoint both
// ways, and the page on a laptop and a phone -- every call to Supabase,
// Printify and Resend faked. Run with the repo served on 127.0.0.1:8788.
const path = require('path');
const { Readable } = require('stream');
const { pathToFileURL } = require('url');
const { launch, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const results = [];
const check = (name, ok, detail) => results.push([name, !!ok, detail]);

async function theServer() {
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.PRINTIFY_API_TOKEN = 'ptoken'; process.env.RESEND_API_KEY = 'rkey';
  const store = {}, calls = [];
  const printify = { 'po-1': { id: 'po-1', status: 'in-production', shipments: [] }, 'po-2': { id: 'po-2', status: 'fulfilled', shipments: [{ carrier: 'USPS', number: '9400', url: 'https://t.example/9400', delivered_at: null }] } };
  global.fetch = async (url, init = {}) => {
    const u = String(url); calls.push({ u, init });
    const m = u.match(/\/orders\/([0-9a-f]{64})\.json$/);
    if (m) {
      if ((init.method || 'GET') === 'POST') { store[m[1]] = init.body; return { ok: true, text: async () => '' }; }
      return store[m[1]] ? { ok: true, status: 200, json: async () => JSON.parse(store[m[1]]) } : { ok: false, status: 404 };
    }
    const p = u.match(/api\.printify\.com\/v1\/shops\/\d+\/orders\/([\w-]+)\.json$/);
    if (p) return printify[p[1]] ? { ok: true, json: async () => printify[p[1]] } : { ok: false, status: 404 };
    if (/api\.resend\.com\/emails$/.test(u)) return { ok: true, text: async () => '{}' };
    throw new Error('unexpected fetch ' + u);
  };
  const L = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'orders-ledger.js')).href);
  // The ledger: one file per address, newest first, a replay noted once.
  await L.recordOrder('Casper@Example.com ', { ref: 'cs_1', printify: 'po-1', placedAt: '2026-10-01T10:00:00Z', items: ['Doormat (18 x 30)'], amountCents: 2794, currency: 'usd', firstName: 'Casper' });
  await L.recordOrder('casper@example.com', { ref: 'cs_2', printify: 'po-2', placedAt: '2026-10-05T10:00:00Z', items: ['SURPRISE!!! Smart Mug (11oz)'], amountCents: 2590, currency: 'usd' });
  await L.recordOrder('casper@example.com', { ref: 'cs_2', printify: 'po-2', placedAt: '2026-10-05T10:00:00Z', items: ['again'] });
  const mine = await L.readOrders('casper@example.com');
  check('the ledger keeps both orders under one address, newest first, a replay once', mine.length === 2 && mine[0].ref === 'cs_2' && mine[1].ref === 'cs_1' && mine[0].items[0] !== 'again', JSON.stringify(mine));
  check('another address has none', (await L.readOrders('nobody@example.com')).length === 0);
  // The link: signed, for that address, for seven days.
  const tok = L.makeOrdersToken('casper@example.com');
  check('a fresh link reads back to its address', L.readOrdersToken(tok) === 'casper@example.com');
  check('a stale link does not', L.readOrdersToken(tok, Date.now() + 8 * 86400000) === null);
  check('a forged link does not', L.readOrdersToken(tok.slice(0, -1) + (tok.endsWith('0') ? '1' : '0')) === null && L.readOrdersToken('x.y') === null);
  // Printify's statuses in words.
  const w = (o) => L.orderState(o).words;
  check('statuses read in words', w({ status: 'in-production' }) === 'Being made' && w({ status: 'pending' }) === 'Order received' && w({ status: 'canceled' }) === 'Cancelled' && w({ status: 'has-issues' }).startsWith('Needs a look')
    && w(printify['po-2']) === 'Shipped' && w({ status: 'fulfilled', shipments: [{ delivered_at: '2026-10-09' }] }) === 'Delivered', [w({ status: 'in-production' }), w(printify['po-2'])].join(' | '));
  // The endpoint: POST sends a link only where orders exist, and says the same either way; GET lists them live.
  const H = (await import(pathToFileURL(path.join(__dirname, '..', 'api', 'orders.js')).href)).default;
  const run = async (method, body, query) => {
    const req = Readable.from([Buffer.from(body ? JSON.stringify(body) : '')]); req.method = method; req.headers = {}; req.body = body; req.query = query || {};
    let status = 0, out = null; const res = { setHeader() {}, status(s) { status = s; return this; }, json(j) { out = j; return this; }, end() { return this; } };
    await H(req, res); return { status, out };
  };
  calls.length = 0;
  let r = await run('POST', { email: 'Casper@example.com' });
  const mail = calls.filter((c) => /resend/.test(c.u)).map((c) => JSON.parse(c.init.body))[0];
  check('an address with orders gets the link, to that address, pointing at the page', r.status === 200 && r.out.ok && mail && mail.to === 'casper@example.com' && /muggshotz\.com\/orders\?t=/.test(mail.html), JSON.stringify({ r, mail: mail && mail.to }));
  calls.length = 0;
  r = await run('POST', { email: 'nobody@example.com' });
  check('an address with none gets the same answer and no email', r.status === 200 && r.out.ok && !calls.some((c) => /resend/.test(c.u)), JSON.stringify(r));
  r = await run('POST', { email: 'not an email' });
  check('a bad address is refused', r.status === 400);
  r = await run('GET', null, { t: tok });
  check('the link lists the orders with their live state and tracking', r.status === 200 && r.out.email === 'casper@example.com' && r.out.orders.length === 2 && r.out.orders[0].ref === 'cs_2' && r.out.orders[0].words === 'Shipped' && r.out.orders[0].shipments[0].url === 'https://t.example/9400' && r.out.orders[1].words === 'Being made', JSON.stringify(r.out));
  r = await run('GET', null, { t: 'forged.deadbeef' });
  check('a bad link is refused', r.status === 401);
}

async function thePage(viewport, screen) {
  const { browser, page, log } = await launch({ viewport });
  try {
    await page.route('**/api/orders**', (route) => {
      const req = route.request();
      if (req.method() === 'POST') return route.fulfill({ json: { ok: true } });
      const t = new URL(req.url()).searchParams.get('t');
      if (t !== 'good') return route.fulfill({ status: 401, json: { error: 'That link is not valid any more. Ask for a new one.' } });
      return route.fulfill({ json: { email: 'casper@example.com', orders: [
        { ref: 'cs_2', placedAt: '2026-10-05T10:00:00Z', items: ['SURPRISE!!! Smart Mug (11oz)'], amountCents: 2590, currency: 'usd', state: 'shipped', words: 'Shipped', shipments: [{ carrier: 'USPS', number: '9400', url: 'https://t.example/9400', deliveredAt: null }] },
        { ref: 'cs_1', placedAt: '2026-10-01T10:00:00Z', items: ['Doormat (18 x 30)'], amountCents: 2794, currency: 'usd', state: 'made', words: 'Being made', shipments: [] }
      ] } });
    });
    await page.goto(`${BASE}/orders.html`); await T(page, 600);
    await page.fill('#email', 'casper@example.com'); await page.click('#send'); await T(page, 600);
    const note = await page.textContent('#note');
    check(`[${screen}] asking sends the link and says so without revealing anything`, /a link is on its way/.test(note) && /casper@example\.com/.test(note), note);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(`[${screen}] the page fits the screen`, fits);
    await page.goto(`${BASE}/orders.html?t=good`); await T(page, 900);
    const got = await page.evaluate(() => ({ ask: document.getElementById('ask').style.display, sub: document.querySelector('.sub').textContent,
      orders: [...document.querySelectorAll('.order')].map((o) => ({ ref: o.dataset.ref, nm: o.querySelector('.nm').textContent, st: o.querySelector('.st').textContent, link: (o.querySelector('a') || {}).href || null, ln: o.textContent })) }));
    check(`[${screen}] the link shows every order with its state, tracking and date`, got.ask === 'none' && /casper@example\.com/.test(got.sub) && got.orders.length === 2 && got.orders[0].st === 'Shipped' && got.orders[0].link === 'https://t.example/9400' && /USPS · 9400/.test(got.orders[0].ln) && /\$25\.90/.test(got.orders[0].ln) && got.orders[1].st === 'Being made' && !got.orders[1].link && /Doormat/.test(got.orders[1].nm), JSON.stringify(got));
    await page.goto(`${BASE}/orders.html?t=bad`); await T(page, 900);
    const err = await page.textContent('#list');
    check(`[${screen}] a dead link says so and the form stays`, /not valid any more/.test(err) && (await page.evaluate(() => document.getElementById('ask').style.display !== 'none')), err);
    const errs = log.pageErrors.filter((e) => !/ResizeObserver/.test(e));
    check(`[${screen}] no page errors`, errs.length === 0, errs.join(' | '));
  } finally { await browser.close(); }
}

(async () => {
  await theServer().catch((e) => check('the server side', false, e.stack || e.message));
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1366, height: 860 }, phone: { width: 390, height: 844 } })) {
    await thePage(viewport, screen).catch((e) => check(`[${screen}] the page`, false, e.message));
  }
  let fails = 0;
  for (const [name, ok, detail] of results) { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '\n        ' + String(detail).slice(0, 500)}`); }
  console.log(fails ? `\n${fails} ORDERS-PAGE VERIFICATION(S) FAILED` : '\nALL ORDERS-PAGE VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
