// THE TWO GRADUATES. Greeting cards and Post-it pads sat on the picker as
// "Art only" leftovers from the legacy generator until 2026-08-28, when Alyx
// said to plug them in. The printer was chosen by SHIPPING, not unit cost --
// the $1.00 card (Prima) has no US shipping profile at all, and the $2.97
// card (Duplium) ships US at $16.79. CatPrint (cards) and Taylor (pads) are
// US printers with sane rates. This suite pins the full path for both:
// studio pick -> description -> generate -> approve -> fade -> mockup body,
// and the paid-order body on the order page.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const BASE = 'http://127.0.0.1:8788';

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
}

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const PRODUCTS = [
  // Reflex-buy prices (Alyx, 2026-08-28): ~$2 over wholesale, on purpose.
  { tile: 'greeting card', key: 'greeting-card', sizeLabel: '8-Pack', price: '15.95' },
  { tile: 'post-it note', key: 'post-it-notes', sizeLabel: '3" x 3"', price: '7.95' },
];

const scenarios = {};

for (const P of PRODUCTS) {
  const slug = P.tile.replace(/\W+/g, '_');

  // ---- The studio rail, photo to mockup body. ----
  scenarios['fullRail_' + slug] = async (page, log, mockupBodies) => {
    await pickProduct(page, P.tile);
    const tilePrice = await page.evaluate((v) =>
      document.querySelector(`#productCard .btn-select[data-val="${v}"] .product-tile-price`)?.textContent, P.tile);
    if (!tilePrice || !tilePrice.includes(P.price))
      return `FAIL: tile shows "${tilePrice}" — expected $${P.price} (Art only must be gone)`;
    await page.fill('#ideaDesc', 'a cheerful sunrise over rolling hills');
    await dismissAlerts(page);
    await T(page, 400);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await T(page, 1500);
    // Both are in PRODUCTS_AUTO_MOCKUP now, so the fade page stands between
    // approve and the mockup, same as every other single-image product.
    const faded = await passFadePage(page);
    if (!faded) return 'FAIL: the fade page never opened — the product is not on the auto-mockup rail';
    await T(page, 8000);
    const start = mockupBodies.find(b => b && b.action === 'start');
    if (!start) return 'FAIL: no start-mockup fired after the fade page';
    if (start.productKey !== P.key) return `FAIL: productKey=${start.productKey}, expected ${P.key}`;
    if (start.sizeLabel !== P.sizeLabel) return `FAIL: sizeLabel=${JSON.stringify(start.sizeLabel)}, expected ${JSON.stringify(P.sizeLabel)}`;
    if (!start.image) return 'FAIL: no image in the mockup body';
    return `PASS: ${P.tile} runs photo -> generate -> fade -> mockup {${P.key}, ${P.sizeLabel}}`;
  };

  // ---- The paid-order body on the order page. ----
  scenarios['orderBody_' + slug] = async (page) => {
    await page.addInitScript((icon) => {
      localStorage.setItem('muggshotz_pending_order', JSON.stringify({
        placements: { left: null, front: 'https://example.com/art.png', right: null },
        deviceId: 'test-dev', productIcon: icon
      }));
    }, P.tile);
    const bodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/create-checkout-session')) {
        try { bodies.push(r.postDataJSON()); } catch (e) {}
      }
    });
    await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
    await T(page, 1500);
    const na = await page.evaluate(() =>
      getComputedStyle(document.getElementById('notAvailableCard')).display);
    if (na !== 'none')
      return `FAIL: order.html still treats ${P.tile} as not available`;
    await page.evaluate(() => {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('fullName', 'Test Customer'); set('email', 'test@example.com');
      set('address1', '123 Test St'); set('city', 'Westland');
      set('state', 'MI'); set('zip', '48185'); set('country', 'US');
      submitOrder();
    });
    await T(page, 2500);
    const b = bodies[bodies.length - 1];
    if (!b) return 'FAIL: submit never reached create-checkout-session';
    const bad = [];
    if (b.productKey !== P.key) bad.push(`productKey=${b.productKey}`);
    if (b.sizeLabel !== P.sizeLabel) bad.push(`sizeLabel=${JSON.stringify(b.sizeLabel)}`);
    if (b.image !== 'https://example.com/art.png') bad.push('image missing');
    if (bad.length) return `FAIL: order body wrong — ${bad.join('; ')}`;
    return `PASS: ${P.tile} order body carries {${P.key}, ${P.sizeLabel}, image} to payment`;
  };
}

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    const mockupBodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/start-mockup')) {
        try { mockupBodies.push(r.postDataJSON()); } catch (e) {}
      }
    });
    try {
      if (name.startsWith('fullRail')) { await openStudio(page); await uploadPhoto(page); await dismissAlerts(page); }
      const result = await fn(page, log, mockupBodies);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL|Failed to load resource/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL CARD/POST-IT VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
