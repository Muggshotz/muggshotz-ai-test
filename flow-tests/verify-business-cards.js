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

// YOUR CARD (Alyx, 23 Sep 2026: "How is there no text box?"): after
// painting, a card gets a panel with the details boxes, where the words go,
// and Size/pan for the picture. The painter is told to paint no lettering.
// Yes saves the card exactly as the panel shows it, and that is what the
// mockup is made from.
OPTS.yourCard = { echoUploads: true };
scenarios.yourCard = async (page, log) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="business cards"]').click({ force: true });
  await T(page, 900);
  await page.click('#businessCardOptionGrid .btn-select[data-opt="100 cards"]');
  await T(page, 1200); await dismissAlerts(page);
  await paint(page, log);
  const gen = log.apiCalls.find((x) => x.path === '/api/generate');
  if (!/no words, letters or numbers/.test(gen.prompt || '')) return 'FAIL: the painter was not told to leave the lettering off the card';
  await T(page, 1200);
  const st = await page.evaluate(() => {
    const w = document.getElementById('cardLayoutWrap'), r = w.getBoundingClientRect();
    return { shown: getComputedStyle(w).display !== 'none', top: Math.round(r.top), H: innerHeight,
      caption: document.getElementById('captionCard').classList.contains('visible') };
  });
  if (!st.shown) return 'FAIL: no Your Card panel after painting a business card';
  if (st.caption) return 'FAIL: the one-line caption tool shows beside Your Card';
  if (st.top < 0 || st.top > st.H * 0.3) return `FAIL: the page did not land on Your Card (its top at ${st.top} of ${st.H})`;
  const before = await page.evaluate(() => findDesignById(currentDesignId).url);
  await page.fill('#cardName', 'Alyx Needles');
  await page.fill('#cardTitle', 'Designer');
  await page.fill('#cardPhone', '(555) 010-0100');
  await page.fill('#cardEmail', 'hello@example.com');
  await page.evaluate(() => { const z = document.getElementById('cardZoom'); z.value = '160'; z.dispatchEvent(new Event('input')); });
  // The words land on the right by default: that side of the preview must
  // now carry white text over a shade.
  const shaded = await page.evaluate(() => {
    const c = document.getElementById('cardLayoutCanvas'), g = c.getContext('2d');
    const d = g.getImageData(Math.round(c.width * 0.55), 0, Math.round(c.width * 0.4), c.height).data;
    let white = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) white++;
    return { white, ratio: c.width / c.height };
  });
  if (shaded.white < 200) return `FAIL: the preview shows no words on the right (${shaded.white} white pixels)`;
  // PRINTIFY'S SAFE ZONE: on every card product the words, rendered on the
  // card itself (no guides), sit inside the dashed safe line measured from
  // Printify's design screen, and the saved card carries no guide lines.
  const safe = await page.evaluate(() => {
    const out = [];
    const keep = selectedBusinessCard;
    for (const opt of ['100 cards', 'Boxed, 100', 'Card holder']) {
      selectedBusinessCard = opt;
      for (const side of ['right', 'left', 'bottom']) {
        cardLayout.side = side;
        const c = document.createElement('canvas'); renderCardOnto(c, 1200);
        const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        const g = cardGuides();
        if (x1 < 0) out.push(`${opt}/${side}: no words`);
        else if (x0 < W * g.safeX - 1 || x1 > W * (1 - g.safeX) + 1 || y0 < H * g.safeY - 1 || y1 > H * (1 - g.safeY) + 1)
          out.push(`${opt}/${side}: words at x ${x0}-${x1}, y ${y0}-${y1} of ${W}x${H}, safe is ${Math.round(W * g.safeX)}-${Math.round(W * (1 - g.safeX))}, ${Math.round(H * g.safeY)}-${Math.round(H * (1 - g.safeY))}`);
      }
    }
    selectedBusinessCard = keep; cardLayout.side = 'right';
    return out;
  });
  if (safe.length) return `FAIL: words outside Printify's safe zone: ${safe.join('; ')}`;
  log.apiCalls.length = 0;
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await passFadePage(page);
  await T(page, 8000);
  const start = log.apiCalls.find((x) => x.path === '/api/start-mockup' && x.action === 'start');
  if (!start) return 'FAIL: Yes fetched no mockup';
  const img = start.body.image;
  if (!img || img === before) return 'FAIL: the mockup was made from the painting, not the card with its details';
  const out = await page.evaluate(async (u) => { const im = await loadImageFromUrl(u); return im.naturalWidth / im.naturalHeight; }, img);
  if (Math.abs(out - 1125 / 675) > 0.01) return `FAIL: the saved card is ${out.toFixed(3)}:1, not the card's 1.667:1`;
  return `PASS: Your Card opens and lands after painting (no caption tool, painter told no lettering); typed details show on the right, inside Printify's safe line on all three card products; Yes sends the card itself, ${out.toFixed(3)}:1, to the mockup`;
};

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
