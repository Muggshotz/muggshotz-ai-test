// Coasters (blueprint 2764 / provider 59) and mouse pads (608 / 28), added
// 2026-08-26 after a live cost probe gave real wholesale for the first time.
// Both carry exactly ONE variant, so picking the product finishes the product
// and the rail goes straight to the description.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

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

// UPDATED (Aug 2026): coasters gained a real decision when the round set was
// added -- two different Printify blueprints, so shape is a genuine product
// fork, not a cosmetic one. They now stop at the shape card before the
// description, per the rail rule that picking a product means FINISHING it.
// Mouse pads still have exactly one variant and still hand straight off.
// Not a weakened assertion: these scenarios are about the description rail
// and the mockup body, so they settle the shape explicitly and leave the
// fork itself to the dedicated checks at the bottom of this file.
async function settleShape(page, val, shape = 'square') {
  if (val !== 'coaster') return;
  await page.evaluate((sh) => pickCoasterShape(sh), shape);
  await page.waitForTimeout(900);
}

const scenarios = {};

for (const [val, want] of Object.entries(EXPECT)) {
  const slug = val.replace(/[^a-z]/gi, '_');

  // Picking the product lands straight on the description -- nothing else to choose.
  scenarios['straightToIdea_' + slug] = async (page) => {
    await pick(page, val);
    await settleShape(page, val);
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

  // UPDATED (2026-08-28, Alyx's exact-transfer feature): a blank description
  // is no longer refused -- it now OFFERS the pass-through ("use your photo
  // exactly as it is") via one confirm. Declining must land the customer
  // back at the idea box with no API call and no charge, exactly like the
  // old block did. The accepted path is verify-exact-transfer.js's job.
  scenarios['blankOffersExactTransfer_' + slug] = async (page, log) => {
    await pick(page, val);
    await settleShape(page, val);
    await page.evaluate(() => {
      window.__confirmCalls = [];
      window.confirm = (msg) => { window.__confirmCalls.push(msg); return false; };
    });
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await page.waitForTimeout(1200);
    const calls = await page.evaluate(() => window.__confirmCalls || []);
    if (!calls.length) return `FAIL: ${val}: blank description no longer asks anything (old block gone, no confirm either)`;
    if (!/exactly as it is/i.test(calls[0])) return `FAIL: ${val}: confirm doesn't offer the photo as-is: ${calls[0]}`;
    const gen = log.apiCalls.filter(c => c.path === '/api/generate');
    if (gen.length) return `FAIL: ${val}: declining the transfer still fired ${gen.length} generate call(s)`;
    return `PASS: ${val}: blank description offers the exact transfer, declining costs nothing`;
  };

  // Full rail, and the mockup must fire on approve with the right catalog key.
  scenarios['fullRail_' + slug] = async (page, log, mockupCalls) => {
    await pick(page, val);
    await settleShape(page, val);
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    await dismissAlerts(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    mockupCalls.length = 0;
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await passFadePage(page);
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
    await settleShape(page, val);
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
  const path = require('path');
  // The catalog lives in lib/, one level up -- this read pointed at
  // flow-tests/products-catalog.js, which has never existed, so the whole
  // scenario died on ENOENT before it compared a single price. Anchored to
  // __dirname so it does not care what directory the suite is run from
  // either; running from the wrong cwd has bitten this repo before.
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'products-catalog.js'), 'utf8');
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
  if (p96.price !== 39.95) return `FAIL: 96 pcs is $${p96.price}, expected $39.95 (costs $35.07 to make)`;
  if (p252.price !== 38.95) return `FAIL: 252 pcs is $${p252.price}, expected $38.95 (costs $33.62 to make)`;
  // The POINT of this check is the inversion, not the literal figures: 96 pcs
  // must stay dearer than 252 pcs because it genuinely costs more to make.
  // Pinning only the numbers would let a future edit flip them and still pass
  // if it happened to edit this line too.
  if (!(p96.price > p252.price))
    return `FAIL: 96 pcs ($${p96.price}) is no longer dearer than 252 pcs ($${p252.price}) — the flip is back`;
  return 'PASS: puzzle ladder tracks wholesale cost again (96=$39.95 > 252=$38.95)';
};

// ---- Round coasters: a real fork, and the shape must survive to checkout ----
// Round and square are different Printify blueprints (994 vs 2764), so a
// shape that gets lost between the studio and the order page does not degrade
// gracefully -- it ships the wrong physical product.
scenarios.roundCoasterReachesTheOrder = async (page, log, mockupBodies) => {
  await pick(page, 'coaster');
  const shown = await page.evaluate(() => {
    const c = document.getElementById('coasterShapeCard');
    return c ? getComputedStyle(c).display !== 'none' : false;
  });
  if (!shown) return 'FAIL: no shape card — coasters have two blueprints now, that is a decision';
  const focus = await page.evaluate(() => Array.from(document.body.classList).filter(c => c.endsWith('-focus')));
  if (focus.join() !== 'coaster-shape-focus') return `FAIL: spotlight is ${JSON.stringify(focus)}, expected [coaster-shape-focus]`;

  await settleShape(page, 'coaster', 'round');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await page.locator('#approveRow button:has-text("Yes")').first().click();
    await passFadePage(page);
  await page.waitForTimeout(6000);

  const start = mockupBodies.find(b => b && b.action === 'start');
  if (!start) return 'FAIL: no mockup fired for a round coaster';
  if (start.productKey !== 'coaster-set-round')
    return `FAIL: round coaster ordered as ${start.productKey} — that is the square blueprint`;

  // And the shape has to survive the hop to the order page, which is a
  // separate localStorage payload written by goToOrder(), not shared state.
  // Drive the real handoff rather than reading a key nothing has written yet
  // -- the first version of this check asserted against a payload that only
  // exists once goToOrder() actually runs, and "undefined" told us nothing
  // about whether the shape is carried.
  await page.evaluate(() => goToOrder());
  await page.waitForURL(/order\.html/, { timeout: 15000 }).catch(() => {});
  const carried = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('muggshotz_pending_order') || '{}').coasterShape; }
    catch (e) { return 'unreadable'; }
  });
  if (carried !== 'round')
    return `FAIL: order payload carries coasterShape=${JSON.stringify(carried)} — order.html would default to square`;
  return 'PASS: round coaster routes to its own blueprint and the shape reaches the order page';
};

// A round print area must fade radially; a square one must not.
scenarios.coasterShapeDrivesFadeGeometry = async (page) => {
  await pick(page, 'coaster');
  await settleShape(page, 'coaster', 'round');
  const round = await page.evaluate(() => getProductFadeShape());
  await settleShape(page, 'coaster', 'square');
  const square = await page.evaluate(() => getProductFadeShape());
  if (round !== 'circle') return `FAIL: a round coaster reports fade shape "${round}" — it would feather toward corners that get cut off`;
  if (square !== 'rect') return `FAIL: a square coaster reports fade shape "${square}"`;
  return 'PASS: fade geometry follows the coaster shape (round → circle, square → rect)';
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
