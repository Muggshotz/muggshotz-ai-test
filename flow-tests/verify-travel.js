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

  // UPDATED (Aug 2026): Wraparound is unshelved, so every variant except
  // the 40oz now stops at the Print Style card first -- with the one-time
  // "pick your print format" modal in front of it, which swallowed the
  // Generate click and produced four bogus timeouts here. Not a weakened
  // assertion: this suite is about variant -> productKey/sizeLabel/body
  // shape, so it takes the default (Three Panels) explicitly and leaves
  // Wraparound's own behaviour to verify-wraparound.js.
  await dismissAlerts(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const card = document.getElementById('mugPrintModeCard');
    if (card && card.style.display !== 'none') pickMugPrintMode('three-panel');
  });
  await page.waitForTimeout(600);
  await dismissAlerts(page);

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
  // The OTHER 40oz: a single 3710x2817 print area (a genuine full wrap)
  // where the insulated one has four placeholders split by its handle.
  // Same size label, single-image body shape, and it carries colours, so
  // resolveVariant() needs a colorName the way the insulated one does.
  'travel-mug-40oz-vacuum':    ['40oz', false, true],
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

// ---- Picking Print Style must land on Generate, lit. ----
// Alyx: "When I pick the type of mug I wanted the screen just went subdued,
// veiled, and did nothing. I scrolled further down and I found a lit up
// generate button. But I shouldn't have had to scroll down."
//
// pickMugPrintMode adds final-generate-focus, which dims every card but
// Upload Photo -- the rail declaring Generate the last step -- and then
// scrolled back to the colour or Style card it had just dimmed. Spotlight and
// scroll disagreed, so the customer landed on a greyed-out card with the only
// lit control below the fold.
//
// Asserts the landing the way a customer experiences it: the Generate button
// is inside the viewport after the pick. Checking which function was called,
// or that a class is set, would both have passed while this was broken.
const GEN_LANDING = ['travel-mug-20oz', 'travel-mug-14oz-handle'];
for (const key of GEN_LANDING) {
  scenarios['printStyleLandsOnGenerate_' + key.replace(/-/g, '_')] = async (page) => {
    await pickTravel(page);
    await page.evaluate((k) => pickPreGenTravelVariant(k), key);
    await page.waitForTimeout(1200);
    await dismissAlerts(page);
    const card = await page.evaluate(() => {
      const c = document.getElementById('mugPrintModeCard');
      return c ? getComputedStyle(c).display : 'missing';
    });
    if (card === 'none' || card === 'missing')
      return `PASS (n/a): ${key} never shows the Print Style card`;

    // Park the window somewhere unhelpful first, so a passing result means
    // the app scrolled and not that the button happened to already be there.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.evaluate(() => pickMugPrintMode('wraparound'));
    await page.waitForTimeout(2500);

    const st = await page.evaluate(() => {
      const btn = document.getElementById('generateBtn');
      if (!btn) return { missing: true };
      const r = btn.getBoundingClientRect();
      const onScreen = r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 2;
      return {
        onScreen,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        viewportH: innerHeight,
        below: Math.round(r.bottom - innerHeight),
        veiled: document.body.classList.contains('final-generate-focus'),
      };
    });
    if (st.missing) return 'FAIL: no Generate button on the page at all';
    if (!st.onScreen)
      return `FAIL: ${key} — after picking Print Style the Generate button sits ${st.below}px below the fold (top ${st.top}, viewport ${st.viewportH}); the customer has to go find it`;
    return `PASS: ${key} lands on Generate (${st.top}px from the top, veil ${st.veiled ? 'on' : 'off'})`;
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
