// Edge Fade, rebuilt (2026-08-27).
//
// It had been killed outright: `const skipEdgeFade = true;` hardcoded in
// generate(), at Alyx's request, because "fade kept sneaking back in through
// paths that reset hardEdgesEnabled to false". That sentence is the whole
// diagnosis. Fade rode on the ABSENCE of a boolean, so every reset path
// switched it on by accident, and the paths could not be confidently
// enumerated.
//
// The rebuild inverts the polarity instead of hunting the paths:
// edgeFadeChoice is null / 'fade' / 'hard', and fade requires the POSITIVE
// value. "Cleared" and "chosen" are now different states, so a reset can no
// longer mean yes.
//
// What this suite pins:
//   * THE POLARITY. Untouched must mean no fade, and a reset must return to
//     untouched rather than to fade. This is the actual bug; everything else
//     here is secondary.
//   * the card is offered on every product, not just mugs and travel cups.
//   * the fade colour follows the PRODUCT's surface, because a fade is a
//     background. The tote's canvas, the cup's finish, white otherwise.
//   * the depth slider reaches the renderer. 12% was hardcoded inside
//     applyEdgeFadeToImageUrl, so a slider could exist and change nothing --
//     the same shape of defect as the Style panel being overridden.
const { launch, openStudio, uploadPhoto, dismissAlerts, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1000);
}

const fadeState = (page) => page.evaluate(() => ({
  choice: edgeFadeChoice,
  amount: edgeFadeAmountPct,
  hex: getSelectedProductColorHex(),
  cardShown: getComputedStyle(document.getElementById('panoramaFadeCard')).display !== 'none',
  sliderShown: getComputedStyle(document.getElementById('edgeFadeAmountWrap')).display !== 'none',
}));

const scenarios = {};

// ---- 1. THE BUG. Untouched must mean no fade. ----
scenarios.untouchedMeansNoFade = async (page) => {
  await pickProduct(page, 'coaster');
  const st = await fadeState(page);
  if (st.choice !== null) return `FAIL: edgeFadeChoice starts as ${JSON.stringify(st.choice)} — it must start unchosen, or a fresh session fades without being asked`;
  if (st.sliderShown) return 'FAIL: the depth slider is showing before fade was chosen';
  return 'PASS: nobody has chosen, so no fade — matching the kill-switch behaviour it replaces';
};

// ---- 2. A reset returns to UNCHOSEN, not to fade. ----
// This is the precise failure that forced the kill-switch: something clears
// state, the cleared value reads as "fade", and fade reappears unasked.
scenarios.resetCannotTurnFadeOn = async (page) => {
  await pickProduct(page, 'coaster');
  await page.evaluate(() => pickEdgeFade('fade'));
  await T(page, 300);
  if ((await fadeState(page)).choice !== 'fade') return 'FAIL: picking fade did not register';

  page.once('dialog', d => d.accept());
  await page.evaluate(() => resetEverythingFreshStart());
  await T(page, 1500);
  const after = await page.evaluate(() => ({
    choice: edgeFadeChoice,
    hard: typeof hardEdgesEnabled === 'undefined' ? null : hardEdgesEnabled,
  }));
  if (after.choice === 'fade') return 'FAIL: a reset left fade ON — this is the exact bug the kill-switch was hiding';
  return `PASS: reset returns to ${JSON.stringify(after.choice)}, which is not 'fade' — a cleared flag can no longer mean yes`;
};

// ---- 3. The PRE-GENERATION card stays retired. ----
// An earlier pass made it visible on every product and this scenario asserted
// that as correct. It was wrong, and the assertion hid it: the note in the
// HTML says the card was retired because it "asked the customer to rule on
// how an image should feather at its edges BEFORE the image existed". Alyx
// hit the symptom immediately -- a dimmed card above the idea box, about an
// image that does not exist yet, is invisible in practice even when it is
// technically on screen. The decision belongs after generation.
scenarios.preGenerationCardStaysRetired = async (page) => {
  const bad = [];
  for (const val of ['coaster', 'tote bag', 'mug']) {
    await pickProduct(page, val);
    const st = await fadeState(page);
    if (st.cardShown) bad.push(val);
    await page.goto(BASE + '/needles-studio.html', { waitUntil: 'domcontentloaded' });
    await uploadPhoto(page); await dismissAlerts(page);
  }
  if (bad.length) return `FAIL: the retired pre-generation fade card is showing for: ${bad.join(', ')} — it asks about an image that does not exist yet`;
  return 'PASS: the pre-generation card stays retired on every product';
};

// ---- 3b. And the fade page IS reached after generation. ----
// Alyx got all the way to a coaster mockup without ever being offered a fade:
// mugs reached openFrameFadeOverlay() from enterRevealStage(), and every
// single-image product went straight from approve to the mockup. Same page,
// same slider -- it simply was not on that route.
scenarios.singleImageProductsReachTheFadePage = async (page) => {
  await pickProduct(page, 'coaster');
  await page.evaluate(() => pickCoasterShape('square'));
  await T(page, 800);
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await page.locator('#approveRow button:has-text("Yes")').first().click();

  const reached = await page.waitForFunction(() => {
    const o = document.getElementById('frameFadeOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!reached) return 'FAIL: a coaster went from approve straight to the mockup — the fade page was never offered';

  const live = await page.evaluate(() => ({
    slider: !!document.getElementById('frameFadeAmountSlider'),
    art: (document.getElementById('frameFadeArtworkImg') || {}).src ? 'shown' : 'missing',
    exits: fadeExitsToMockup,
  }));
  if (!live.slider) return 'FAIL: no depth slider on the fade page';
  if (live.art !== 'shown') return 'FAIL: the finished artwork is not on the fade page — the whole point is deciding edges while you can see them';
  if (live.exits !== true) return 'FAIL: fadeExitsToMockup is not set — Continue would drop a coaster onto the mug frame offer';
  return 'PASS: single-image products reach the real fade page, artwork and slider present, exiting to the mockup';
};

// ---- 4. The fade colour follows the product's surface. ----
scenarios.fadeColourFollowsTheProduct = async (page) => {
  await pickProduct(page, 'tote bag');
  await T(page, 600);
  const picked = await page.evaluate(() => {
    const btn = document.querySelector('#toteBagColorGridGen .color-btn[data-color="Black"]')
             || document.querySelector('#toteBagColorGridGen .color-btn');
    if (!btn) return null;
    btn.click();
    return btn.dataset.color || null;
  });
  if (!picked) return 'FAIL: no tote colour tiles to pick from';
  await T(page, 500);
  const st = await fadeState(page);
  const want = await page.evaluate((n) => (TOTE_BAG_COLORS_GEN.find(c => c.name === n) || {}).hex, picked);
  if (!want) return `FAIL: "${picked}" is not in TOTE_BAG_COLORS_GEN`;
  if (st.hex.toUpperCase() !== want.toUpperCase())
    return `FAIL: tote in ${picked} fades to ${st.hex}, expected the bag's own ${want} — a fade is a background, not a white halo`;
  return `PASS: a ${picked} tote fades into ${want}, the colour actually behind the artwork`;
};

// ---- 5. The depth slider reaches the renderer. ----
// 12% was hardcoded inside applyEdgeFadeToImageUrl. A slider that cannot
// change the output is the Style panel bug wearing a different hat.
scenarios.depthSliderActuallyChangesTheOutput = async (page) => {
  await pickProduct(page, 'coaster');
  await page.evaluate(() => pickEdgeFade('fade'));
  await T(page, 300);
  const widths = await page.evaluate(async () => {
    // A flat red square; measure how far in from the edge the fade reaches
    // by finding the first column that is still pure red along the middle row.
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const cx = c.getContext('2d'); cx.fillStyle = '#FF0000'; cx.fillRect(0, 0, 200, 200);
    const src = c.toDataURL('image/png');
    async function reach(pct) {
      const out = await applyEdgeFadeToImageUrl(src, { top: false, bottom: false, left: true, right: false }, '#FFFFFF', pct);
      const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = out; });
      const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height;
      const x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0);
      const row = x2.getImageData(0, Math.floor(im.height / 2), im.width, 1).data;
      for (let x = 0; x < im.width; x++) {
        if (row[x * 4] > 250 && row[x * 4 + 1] < 8 && row[x * 4 + 2] < 8) return x;
      }
      return -1;
    }
    return { small: await reach(6), large: await reach(30) };
  });
  if (widths.small < 0 || widths.large < 0) return `FAIL: could not measure the fade (${JSON.stringify(widths)})`;
  if (!(widths.large > widths.small + 10))
    return `FAIL: 6% and 30% produce nearly the same fade (${widths.small}px vs ${widths.large}px) — the slider is not reaching the renderer`;
  return `PASS: depth slider genuinely drives the render (6% → ${widths.small}px, 30% → ${widths.large}px)`;
};

// ---- 6. A round print area fades from the RIM, not from four corners. ----
// Alyx: "for products that the surface area of the image presents as a circle
// rather than a square, make sure that the slide has the right geometry."
// Nothing we sell is round yet -- the coaster is square hardboard -- so this
// exercises the shape directly. It exists so that adding a round product is a
// data entry rather than a geometry bug found on a printed sample.
scenarios.roundPrintAreasFadeRadially = async (page) => {
  const probe = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const cx = c.getContext('2d'); cx.fillStyle = '#FF0000'; cx.fillRect(0, 0, 200, 200);
    const src = c.toDataURL('image/png');
    const out = await applyEdgeFadeToImageUrl(src, {}, '#FFFFFF', 20, 'circle');
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = out; });
    const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height;
    const x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0);
    const at = (x, y) => { const d = x2.getImageData(x, y, 1, 1).data; return { r: d[0], g: d[1], b: d[2] }; };
    return {
      centre: at(100, 100),   // inside the disc: untouched artwork
      corner: at(4, 4),       // outside the disc: never printed, must be solid
      rimMid: at(100, 8),     // just inside the top of the rim: faded
    };
  });
  const isRed = c => c.r > 240 && c.g < 15 && c.b < 15;
  const isWhite = c => c.r > 245 && c.g > 245 && c.b > 245;
  if (!isRed(probe.centre)) return `FAIL: the centre of a round fade is not clean artwork (${JSON.stringify(probe.centre)})`;
  if (!isWhite(probe.corner)) return `FAIL: a corner outside the disc is ${JSON.stringify(probe.corner)} — it is never printed, so it must not carry artwork`;
  if (isRed(probe.rimMid)) return 'FAIL: the rim is not faded at all — this is still square geometry on a round product';
  return 'PASS: round print areas fade inward from the rim, corners filled, centre clean';
};

// ---- 7. And square products are untouched by any of that. ----
scenarios.squareProductsStayRectangular = async (page) => {
  const shape = await page.evaluate(() => {
    // Every product we currently sell must read as rectangular; the coaster
    // is the one people assume is a disc, and it is not.
    const out = {};
    for (const p of ['coaster', 'mouse pad', 'tote bag', 'photo poster', 'mug', 'puzzle']) {
      window.product = p; out[p] = getProductFadeShape();
    }
    return out;
  });
  const wrong = Object.entries(shape).filter(([, v]) => v !== 'rect').map(([k]) => k);
  if (wrong.length) return `FAIL: ${wrong.join(', ')} claim a round print area — verify against Printify before trusting that`;
  return `PASS: all ${Object.keys(shape).length} current products are rectangular, as their blueprints say`;
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    try {
      await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
      const result = await fn(page, log);
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
  console.log(fails === 0 ? '\nALL EDGE-FADE VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
