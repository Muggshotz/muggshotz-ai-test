// Travel-cup deep coverage: every variant in TRAVEL_MUG_CATALOG driven
// from product pick -> variant -> colour (where it has one) -> generate ->
// approve -> mockup body. The handoff listed this as offered but never
// done; mug coverage was deep, travel coverage was not.
//
// Pins per variant: the productKey and sizeLabel that reach the server, the
// front-back vs single-image body shape (the 40oz insulated is the only
// front-back one), and that a colour is actually sent for the variants whose
// catalog entry carries colours -- resolveVariant() throws without one.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const pickTravel = async (page) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="water bottle"]').click({ force: true });
  await page.waitForTimeout(1000);
};

// Drive one variant all the way to its start-mockup body.
async function driveVariant(page, mockupBodies, key) {
  await pickTravel(page);
  await page.evaluate((k) => pickPreGenTravelVariant(k), key);
  await page.waitForTimeout(900);

  // Pick a colour if this variant offers one.
  const picked = await page.evaluate(() => {
    const card = document.getElementById('travelMugColorCard');
    if (!card || card.style.display === 'none') return null;
    const btn = document.querySelector('#travelMugColorGridGen .color-btn');
    if (!btn) return null;
    btn.click();
    return btn.dataset.color || null;
  });
  await page.waitForTimeout(600);

  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Continue to Order")').first().click({ timeout: 8000 });
  await page.waitForTimeout(6000);
  return { start: mockupBodies.find(b => b && b.action === 'start'), pickedColor: picked };
}

function checkBody(key, start, pickedColor, expectSize, expectFrontBack, hasColors) {
  if (!start) return `FAIL: no start-mockup fired for ${key}`;
  if (start.productKey !== key) return `FAIL: productKey=${start.productKey}, expected ${key}`;
  if (start.sizeLabel !== expectSize) return `FAIL: sizeLabel=${start.sizeLabel}, expected ${expectSize}`;
  if (expectFrontBack) {
    if (!('frontImage' in start) && !('backImage' in start))
      return `FAIL: ${key} is front-back but body carries neither frontImage nor backImage`;
    if (!start.frontImage && !start.backImage)
      return `FAIL: ${key} front-back body has no image on either face`;
  } else if (!start.image) {
    return `FAIL: ${key} single-image body has no image`;
  }
  if (hasColors && !start.colorName)
    return `FAIL: ${key} carries colours in the catalog but colorName=${JSON.stringify(start.colorName)} — resolveVariant() would throw`;
  const shape = expectFrontBack ? 'front-back' : 'single-image';
  return `PASS: {${key}, ${start.sizeLabel}, ${shape}${start.colorName ? ', ' + start.colorName : ''}}`;
}

// key -> [sizeLabel, isFrontBack, hasColours]
const VARIANTS = {
  'travel-mug-20oz':           ['20oz', false, false],
  // 14oz has colors:null on BOTH sides (studio TRAVEL_MUG_CATALOG and
  // lib/products-catalog.js), so resolveVariant() takes its final branch
  // and reads variantId 88210 directly -- no colour is expected or needed.
  'travel-mug-14oz-handle':    ['14oz', false, false],
  'travel-mug-40oz-insulated': ['40oz', true,  true],
  'travel-mug-32oz-gator':     ['32oz', false, false],
  'travel-mug-30oz-tundra':    ['30oz', false, false],
};

const scenarios = {};

// One scenario per variant, each in its own fresh browser.
for (const [key, [size, fb, cols]] of Object.entries(VARIANTS)) {
  scenarios[key.replace(/-/g, '_')] = async (page, log, mockupBodies) => {
    const { start, pickedColor } = await driveVariant(page, mockupBodies, key);
    return checkBody(key, start, pickedColor, size, fb, cols);
  };
}

// The studio's TRAVEL_MUG_CATALOG must not silently drift from the server's.
scenarios.catalogParity = async (page) => {
  const uiKeys = await page.evaluate(() => Object.keys(TRAVEL_MUG_CATALOG));
  const missing = Object.keys(VARIANTS).filter(k => !uiKeys.includes(k));
  if (missing.length) return `FAIL: UI catalog missing ${missing.join(', ')}`;
  const extra = uiKeys.filter(k => !(k in VARIANTS));
  if (extra.length) return `FAIL: UI catalog has unexpected ${extra.join(', ')}`;
  return `PASS: UI travel catalog matches the ${uiKeys.length} variants under test`;
};

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
      await openStudio(page);
      await uploadPhoto(page);
      await dismissAlerts(page);
      const result = await fn(page, log, mockupBodies);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
      await page.screenshot({ path: `shot-travel-fail-${name}.png` }).catch(() => {});
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL TRAVEL VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
