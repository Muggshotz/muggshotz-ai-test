// BUSINESS CARDS AND THE LUGGAGE TAG (Alyx, 23 Sep 2026). One tile for the
// cards: Taylor's 50, 100 or 200 on a choice of paper, Print Pigeons' boxed
// 100 (plain or laminated), and the metal card holder. Each prints on its own
// shape, and buildSingleImage fits rather than fills, so a picture of any
// other shape prints with white bars. What this pins, per choice:
//   * the tile opens the card, and a choice hands off to the idea box;
//   * the painter gets the right canvas and is told what it is painting;
//   * the design that comes back is cut to that product's exact print shape;
//   * approving fetches Printify's mockup for that product, size and paper;
//   * the order page sends the same product, size and paper to checkout at
//     Alyx's price.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const BASE = 'http://127.0.0.1:8788';

const CASES = {
  '50 cards': { key: 'business-cards', size: '50 cards', paper: 'White Matte', shape: 1125 / 675, canvas: '1536x1024', says: /business card/, price: 24.95 },
  '200 cards': { key: 'business-cards', size: '200 cards', paper: 'Uncoated', shape: 1125 / 675, canvas: '1536x1024', says: /business card/, price: 61.95 },
  'Boxed, 100 laminated': { key: 'business-cards-boxed', size: '100 cards, laminated', paper: null, shape: 1075 / 720, canvas: '1536x1024', says: /business card/, price: 33.95 },
  'Card holder': { key: 'business-card-holder', size: 'One size', paper: null, shape: 1022 / 566, canvas: '1536x1024', says: /business card holder/, price: 16.95 },
};
const TAG = { key: 'luggage-tag', size: '2.4 x 4 in', shape: 750 / 1237, canvas: '1024x1536', says: /luggage tag/, price: 16.95 };

async function paint(page, log) {
  await page.fill('#ideaDesc', 'a golden retriever in a bow tie');
  await dismissAlerts(page);
  log.apiCalls.length = 0;
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await T(page, 800);
}

async function checkPaintAndMockup(page, log, c, label) {
  const gen = log.apiCalls.find((x) => x.path === '/api/generate');
  if (!gen) return 'FAIL: nothing was painted';
  if (gen.body.size !== c.canvas) return `FAIL: ${label} painted on ${gen.body.size}, not ${c.canvas}`;
  if (!c.says.test(gen.prompt || '')) return `FAIL: the painter was not told this is a ${label}`;
  const shape = await page.evaluate(async () => {
    const d = findDesignById(currentDesignId);
    const im = await loadImageFromUrl(d.url);
    return im.naturalWidth / im.naturalHeight;
  });
  if (Math.abs(shape - c.shape) > 0.01) return `FAIL: the ${label} design is ${shape.toFixed(3)}:1, not ${c.shape.toFixed(3)}:1 -- it would print with white bars`;
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await passFadePage(page);
  await T(page, 8000);
  const start = log.apiCalls.find((x) => x.path === '/api/start-mockup' && x.action === 'start');
  if (!start) return `FAIL: approving the ${label} fetched no Printify mockup`;
  const b = start.body;
  if (b.productKey !== c.key || b.sizeLabel !== c.size) return `FAIL: the mockup asked for ${b.productKey} / ${b.sizeLabel}`;
  if ((b.colorName || null) !== (c.paper || null)) return `FAIL: the mockup asked for paper ${b.colorName}, not ${c.paper}`;
  return `PASS: ${label} paints on ${gen.body.size}, comes back ${shape.toFixed(3)}:1, and the mockup is ${c.key} / ${c.size}${c.paper ? ' / ' + c.paper : ''}`;
}

const scenarios = {};
const OPTS = {};

for (const [opt, c] of Object.entries(CASES)) {
  const name = 'cards_' + opt.replace(/[^a-z0-9]+/gi, '_');
  // echoUploads: the default stub answers every upload with one fixed square,
  // which would hide exactly the shape this checks.
  OPTS[name] = { echoUploads: true };
  scenarios[name] = async (page, log) => {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await T(page, 700);
    await page.locator('#productCard .btn-select[data-val="business cards"]').click({ force: true });
    await page.waitForFunction(() => { const el = document.getElementById('businessCardOptionCard'); return el && getComputedStyle(el).display !== 'none'; }, null, { timeout: 5000 }).catch(() => {});
    const card = await page.evaluate(() => {
      const el = document.getElementById('businessCardOptionCard');
      return { shown: !!el && getComputedStyle(el).display !== 'none', opts: [...el.querySelectorAll('#businessCardOptionGrid .btn-select')].map((b) => b.dataset.opt) };
    });
    if (!card.shown) return 'FAIL: the Business Cards tile did not open its card';
    const want = '50 cards,100 cards,200 cards,Boxed, 100,Boxed, 100 laminated,Card holder';
    if (card.opts.join(',') !== want) return `FAIL: the card offers ${card.opts.join(' | ')}`;
    if (c.paper) await page.click(`#businessCardPaperGrid .btn-select[data-paper="${c.paper}"]`);
    await page.click(`#businessCardOptionGrid .btn-select[data-opt="${opt}"]`);
    await T(page, 1200);
    await dismissAlerts(page);
    if (!(await page.evaluate(() => document.body.classList.contains('ideafirst-focus')))) return `FAIL: picking ${opt} did not hand off to the idea box`;
    await paint(page, log);
    return checkPaintAndMockup(page, log, c, opt);
  };
}

OPTS.luggageTag = { echoUploads: true };
scenarios.luggageTag = async (page, log) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="luggage tag"]').click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  if (!(await page.evaluate(() => document.body.classList.contains('ideafirst-focus')))) return 'FAIL: the Luggage Tag tile did not reach the idea box';
  await paint(page, log);
  return checkPaintAndMockup(page, log, TAG, 'luggage tag');
};

// The order page: what the studio chose is what is priced and sent.
const IMG = 'https://example.com/design.png';
async function orderPage(page, pending) {
  await page.addInitScript((pending) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('muggshotz_pending_order', JSON.stringify(pending));
    localStorage.removeItem('muggshotz_basket');
  }, pending);
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 10.79, shippingSeparate: true, source: 'live' } }));
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 2000);
  const base = await page.evaluate(() => document.getElementById('summaryBase').textContent);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  return { base, body: bodies[bodies.length - 1] };
}
for (const [opt, c] of Object.entries(CASES)) {
  scenarios['order_' + opt.replace(/[^a-z0-9]+/gi, '_')] = async (page) => {
    const { base, body } = await orderPage(page, { placements: { left: IMG }, deviceId: 'test-dev', productIcon: 'business cards', preselectedBusinessCard: opt, preselectedCardPaper: c.paper || 'Coated (both sides)' });
    if (base !== '$' + c.price.toFixed(2)) return `FAIL: the order page prices ${opt} at ${base}, not $${c.price.toFixed(2)}`;
    if (!body) return 'FAIL: nothing was sent to checkout';
    if (body.productKey !== c.key || body.sizeLabel !== c.size || (body.colorName || null) !== (c.paper || null))
      return `FAIL: checkout got ${body.productKey} / ${body.sizeLabel} / ${body.colorName}`;
    return `PASS: the order page prices ${opt} at ${base} and checks out ${c.key} / ${c.size}${c.paper ? ' / ' + c.paper : ''}`;
  };
}
scenarios.order_luggage_tag = async (page) => {
  const { base, body } = await orderPage(page, { placements: { left: IMG }, deviceId: 'test-dev', productIcon: 'luggage tag' });
  if (base !== '$16.95') return `FAIL: the order page prices the luggage tag at ${base}`;
  if (!body || body.productKey !== 'luggage-tag' || body.sizeLabel !== '2.4 x 4 in') return `FAIL: checkout got ${JSON.stringify(body && { k: body.productKey, s: body.sizeLabel })}`;
  return `PASS: the order page prices the luggage tag at ${base} and checks out luggage-tag / 2.4 x 4 in`;
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch(OPTS[name] || {});
    let result;
    try {
      if (!name.startsWith('order_')) { await openStudio(page); await uploadPhoto(page); await dismissAlerts(page); }
      result = await fn(page, log);
    } catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
    console.log(`[${name}] ${result}`);
    if (!/^PASS/.test(result)) fails++;
    // The order page's console carries the maintenance check (no server here)
    // and the placeholder picture's host; verify-basket ignores it likewise.
    const errs = name.startsWith('order_') ? [] : log.consoleErrors.filter((e) => !/ERR_TUNNEL|ERR_CONNECTION/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs.slice(0, 5))}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL BUSINESS-CARD VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
