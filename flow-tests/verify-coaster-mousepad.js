// Coasters (blueprint 2764 / provider 59) and mouse pads (608 / 28), added
// 2026-08-26 after a live cost probe gave real wholesale for the first time.
// Both carry exactly ONE variant, so picking the product finishes the product
// and the rail goes straight to the description.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const modalOf = (page) => page.evaluate(() => {
  const b = document.getElementById('bigAlertOverlay');
  return b && getComputedStyle(b).display !== 'none' ? document.getElementById('bigAlertMsg')?.textContent : null;
});

async function pick(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await page.waitForTimeout(1600);
}

const EXPECT = {
  'coaster':   { key: 'coaster-set', size: '4" x 4"',  price: 45.95, cost: 19.79 },
  'mouse pad': { key: 'mouse-pad',   size: '9" x 8"',  price: 11.95, cost: 4.88 },
};

const scenarios = {};

for (const [val, want] of Object.entries(EXPECT)) {
  const slug = val.replace(/[^a-z]/gi, '_');

  // Picking the product lands straight on the description -- nothing else to choose.
  scenarios['straightToIdea_' + slug] = async (page) => {
    await pick(page, val);
    const st = await page.evaluate(() => {
      const c = document.getElementById('ideaCard');
      const sec = c.closest('.snap-section');
      const r = c.getBoundingClientRect();
      return {
        collapsed: sec ? sec.classList.contains('snap-collapsed') : null,
        inViewport: r.top < innerHeight && r.bottom > 0,
        height: Math.round(r.height),
      };
    });
    if (st.collapsed) return `FAIL: ${val}: idea card still collapsed`;
    if (!st.inViewport) return `FAIL: ${val}: idea card not on screen after picking the product`;
    return `PASS: ${val} goes straight to the description (${st.height}px, on screen)`;
  };

  // Blank description is refused, same as every other print-onto-object product.
  scenarios['blankBlocked_' + slug] = async (page) => {
    await pick(page, val);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await page.waitForTimeout(1200);
    const m = await modalOf(page);
    if (!m || !/tell us what/i.test(m)) return `FAIL: ${val}: blank description not blocked (modal=${JSON.stringify(m)})`;
    return `PASS: ${val}: blank description blocked`;
  };

  // Full rail, and the mockup must fire on approve with the right catalog key.
  scenarios['fullRail_' + slug] = async (page, log, mockupCalls) => {
    await pick(page, val);
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    await dismissAlerts(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    mockupCalls.length = 0;
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await page.waitForTimeout(9000);
    const started = mockupCalls.filter(b => b && b.action === 'start');
    if (!started.length) return `FAIL: ${val}: no mockup fired on approve`;
    const b = started[0];
    if (b.productKey !== want.key) return `FAIL: ${val}: productKey=${b.productKey}, expected ${want.key}`;
    if (b.sizeLabel !== want.size) return `FAIL: ${val}: sizeLabel=${JSON.stringify(b.sizeLabel)}, expected ${JSON.stringify(want.size)}`;
    if (!b.image) return `FAIL: ${val}: no image in the mockup body`;
    return `PASS: ${val}: auto-mockup {${b.productKey}, ${JSON.stringify(b.sizeLabel)}}`;
  };

  // Gimmicks are mug/travel-cup only; these must never see them.
  scenarios['noGimmicks_' + slug] = async (page) => {
    await pick(page, val);
    const shown = await page.evaluate(() => {
      showDesignMethodCard();
      return document.getElementById('designMethodCard').style.display === 'block';
    });
    if (shown) return `FAIL: ${val} was shown the gimmick panels`;
    return `PASS: ${val} skips the gimmick panels`;
  };
}

// Prices on the grid must match the catalog, and the margin must be the one
// the probe justified -- a silent price edit shouldn't slip past unnoticed.
scenarios.pricesMatchProbe = async (page) => {
  const got = await page.evaluate(() => ({
    coaster: PRODUCTS_CATALOG_TEST?.coaster ?? null,
  })).catch(() => ({}));
  // Read straight from the served catalog module instead of the DOM.
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/products-catalog.js', 'utf8');
  // Retail set by Alyx on affordability grounds, not margin-maximising:
  // coasters $29.95 (down from an initial $45.95), mouse pad $9.95 (down from
  // $11.95, to keep it an easy sub-$10 add-on). Wholesale is $19.79 and $4.88.
  const checks = [
    ['coaster-set', '29.95', '149519'],
    ['mouse-pad', '9.95', '71923'],
  ];
  for (const [key, price, variantId] of checks) {
    const i = src.indexOf(`"${key}"`);
    if (i < 0) return `FAIL: ${key} missing from the catalog`;
    const seg = src.slice(i, i + 900);
    if (!seg.includes(price)) return `FAIL: ${key} price is not ${price}`;
    if (!seg.includes(variantId)) return `FAIL: ${key} variantId is not ${variantId}`;
  }
  return 'PASS: catalog prices and variant IDs match the probed numbers';
};

// The puzzle flip must stay reverted -- the probe proved 96 pcs costs MORE.
scenarios.puzzleFlipStaysReverted = async (page) => {
  const tiles = await page.$$eval('#puzzleSizeGrid .btn-select', els => els.map(e => ({
    size: e.dataset.puzzleSize,
    price: parseFloat((e.textContent.match(/\$([0-9.]+)/) || [])[1]),
  })));
  const p96 = tiles.find(t => t.size === '96 pcs');
  const p252 = tiles.find(t => t.size === '252 pcs');
  if (!p96 || !p252) return 'FAIL: puzzle tiles missing';
  if (p96.price !== 40.95) return `FAIL: 96 pcs is $${p96.price}, expected $40.95 (costs $35.07 to make)`;
  if (p252.price !== 38.95) return `FAIL: 252 pcs is $${p252.price}, expected $38.95 (costs $33.62 to make)`;
  return 'PASS: puzzle ladder tracks wholesale cost again (96=$40.95, 252=$38.95)';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    const mockupCalls = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/start-mockup')) {
        try { mockupCalls.push(r.postDataJSON()); } catch (e) {}
      }
    });
    try {
      await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
      const result = await fn(page, log, mockupCalls);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL COASTER/MOUSE-PAD VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
