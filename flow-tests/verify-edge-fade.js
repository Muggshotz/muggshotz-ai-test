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

// FRAMES THAT BRING THEIR OWN FADE (Alyx, Sep 2026).
// Twelve of the twenty-seven frames have decoration reaching into the opening,
// so a picture with a hard rectangular edge lands on top of it and you can see
// where the picture stops. Alyx found all twelve by hand, clicking each frame
// and looking. These lock in what the code does about it.
scenarios.theTwelveFramesAreFlagged = async (page) => {
  const r = await page.evaluate(() => {
    const {plain, fading} = frameCatalogSections();
    return { plain: plain.map(([n]) => n), fading: fading.map(([n]) => n) };
  });
  const expected = ['Retro Arcade','Neon Dreams','Wrought Iron','Pressed Flowers',
    'Celestial Deco','Moonlit Ivy','Enchanted Grove','Lantern Vine','Trailblazer',
    'Astral','Mirror Mirror','Royal'];
  const missing = expected.filter(n => !r.fading.includes(n));
  const extra = r.fading.filter(n => !expected.includes(n));
  if (missing.length) return 'FAIL: these need a fade and are not flagged: ' + missing.join(', ');
  if (extra.length) return 'FAIL: these are flagged and should not be: ' + extra.join(', ');
  if (r.plain.length !== 15) return `FAIL: the plain section holds ${r.plain.length}, expected 15`;
  return `PASS: ${r.plain.length} frames stand on their own, ${r.fading.length} bring their own fade`;
};

scenarios.theCatalogueSplitsIntoTwoSections = async (page) => {
  const r = await page.evaluate(() => {
    renderFrameGrid();
    const g = document.getElementById('frameGrid');
    const kids = [...g.children];
    const grids = kids.filter(e => e.style.display === 'grid');
    const note = kids.find(e => e.className === 'note-prominent');
    return {
      sizes: grids.map(s => s.children.length),
      columns: grids.map(s => s.style.gridTemplateColumns),
      note: note ? note.textContent : null,
      total: grids.reduce((a, s) => a + s.children.length, 0),
    };
  });
  if (r.total !== 27) return `FAIL: ${r.total} tiles rendered, the catalogue holds 27: ` + JSON.stringify(r);
  if (r.sizes.join(',') !== '15,12') return 'FAIL: sections are ' + r.sizes.join(' and ') + ', expected 15 and 12';
  if (!r.columns.every(c => /repeat\(3/.test(c))) return 'FAIL: sections are not three across: ' + JSON.stringify(r.columns);
  if (!r.note || !/require a fade/.test(r.note)) return 'FAIL: the explanation between the sections is missing: ' + r.note;
  return `PASS: ${r.sizes[0]} then ${r.sizes[1]}, three across, with the explanation between them`;
};

scenarios.aFadingFrameIsNeverOfferedHardEdges = async (page) => {
  const probe = (f) => page.evaluate((frame) => {
    selectedFrame = frame;
    revealFlowThreePanel = false;
    revealOriginalArtworkUrls = ['http://127.0.0.1:8788/__fake/panorama.jpg'];
    wrapDisplayOverrideUrl = null;
    revealFadeSliderTouched = false;
    revealFadeAmountPct = 30;
    showEdgeQuestion();
    const row = document.getElementById('revealEdgeButtonsRow');
    const panel = document.getElementById('revealFadeSliderPanel');
    const why = document.getElementById('revealRequiredFadeNote');
    const slider = document.getElementById('revealFadeAmountSlider');
    return {
      hardOffered: row.style.display !== 'none',
      fadeOpen: panel.style.display === 'block',
      whyShown: why.style.display === 'block',
      min: Number(slider.min),
      value: Number(slider.value),
      hardEdgesEnabled,
    };
  }, f);

  const fading = await probe('Wrought Iron');
  if (fading.hardOffered) return 'FAIL: Hard Edges was offered against a frame that needs a fade: ' + JSON.stringify(fading);
  if (!fading.fadeOpen) return 'FAIL: the fade panel did not open: ' + JSON.stringify(fading);
  if (!fading.whyShown) return 'FAIL: nothing on screen says why the choice was skipped: ' + JSON.stringify(fading);
  if (fading.value !== 40) return `FAIL: a fading frame should start at 40%, got ${fading.value}`;
  // NO FLOOR (Alyx): "The slide isn't permanent it's adjustable. That's the
  // reason why it's a slide." 0 is no fade, 100 is a whiteout, and the choice
  // belongs to whoever is holding it.
  if (fading.min !== 0) return `FAIL: the fade slider is capped at ${fading.min}% — it should reach zero`;
  if (fading.hardEdgesEnabled) return 'FAIL: hard edges is still flagged on: ' + JSON.stringify(fading);

  // The floor must not leak onto the next frame the customer tries.
  const plain = await probe('Ornate Gold');
  if (!plain.hardOffered) return 'FAIL: a plain frame lost its Hard Edges choice: ' + JSON.stringify(plain);
  if (plain.min !== 0) return `FAIL: the fade slider is capped at ${plain.min}% on a plain frame`;
  if (plain.whyShown) return 'FAIL: the explanation is showing against a plain frame';

  // And Hard must not be reachable by calling straight into the handler.
  const forced = await page.evaluate(() => {
    selectedFrame = 'Royal';
    revealFlowThreePanel = false;
    showEdgeQuestion();
    chooseEdgeStyleAndContinue(true);
    return {
      fadeOpen: document.getElementById('revealFadeSliderPanel').style.display === 'block',
      hardEdgesEnabled,
    };
  });
  if (!forced.fadeOpen || forced.hardEdgesEnabled) {
    return 'FAIL: hard edges got through the back door: ' + JSON.stringify(forced);
  }
  return 'PASS: the twelve skip the question and start at 40%, with the slider free to run 0-100';
};

// THE FADE MUST ACTUALLY BE ON THE PICTURE (Alyx, Sep 2026).
//
// This test exists because the first cut of the forced fade shipped green and
// did nothing. The fade was wired to the Hard/Fade question -- a screen that
// only appears when a customer says No Thank You to frames -- so it fired for
// everyone EXCEPT the people choosing the twelve frames it was built for.
// The tests passed because they checked that the question screen behaved,
// never that a framed picture came out faded.
//
// So this one reads pixels. It cannot pass unless the strip a frame is drawn
// onto has genuinely been faded toward the product colour. The fade is an
// elliptical vignette by design ("like a cloud, vaguely oval"), so the
// corners go to the product colour and the centre stays untouched -- that is
// what gets measured.
scenarios.aFadingFrameActuallyGetsFaded = async (page) => {
  const r = await page.evaluate(async () => {
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    lastWraparoundMethod = 'panorama';
    revealFadeSliderTouched = false;
    product = 'mug';
    windowSillChoice = null;
    customFrameCalibration = {};
    // v94: the fade is painted on the BOX the picture shows through, inside
    // the real composite, not on the picture file beforehand. So measure the
    // composite: count near-white pixels inside the frame's opening, and
    // read the centre of the picture.
    const measure = async (pct) => {
      const framed = await compositeFrameAcrossPanorama(wraparoundPanoramaBaseUrl, pct);
      const im = await loadImageFromUrl(framed.combined);
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const frac = await getFrameInsetFraction(FRAME_CATALOG[selectedFrame].asset);
      const bx = Math.floor(frac.x * c.width), by = Math.floor(frac.y * c.height);
      const bw = Math.floor(frac.w * c.width), bh = Math.floor(frac.h * c.height);
      const d = ctx.getImageData(bx, by, bw, bh).data;
      let white = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] > 215 && d[k + 1] > 215 && d[k + 2] > 215) white++;
      const cp = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
      return { whiteShare: white / (bw * bh), centre: [cp[0], cp[1], cp[2]] };
    };
    selectedFrame = 'Mirror Mirror';                  // on the list
    frameStudioFadePct = null;
    const pct = frameStudioFadeAmount();
    const fading = await measure(pct);
    const plain = await measure(0);
    selectedFrame = 'Ornate Gold';                    // not on the list
    frameStudioFadePct = null;
    const unlistedPct = frameStudioFadeAmount();
    return { pct, unlistedPct, fading, plain, hex: getSelectedProductColorHex() };
  });

  if (r.pct !== 40) return `FAIL: a frame that comes with a fade should carry 40%, got ${r.pct}`;
  // The product is a white mug, so a fade lifts the corners of the opening
  // toward white (the band is soft, so count pixels that are clearly light).
  // Without the fade the opening is the picture.
  if (r.plain.whiteShare > 0.05) {
    return `FAIL: the opening is already ${Math.round(r.plain.whiteShare * 100)}% white before any fade: ` + JSON.stringify(r);
  }
  if (r.fading.whiteShare < 0.12) {
    return `FAIL: with the fade on, only ${Math.round(r.fading.whiteShare * 100)}% of the opening went to the mug's white — the fade never happened: ` + JSON.stringify(r);
  }
  // The middle of the picture must survive untouched -- a fade that washes
  // the whole image out would also pass the corner check.
  if (r.fading.centre.join() !== r.plain.centre.join()) {
    return `FAIL: the fade reached the centre of the picture: rgb(${r.fading.centre}) vs rgb(${r.plain.centre})`;
  }
  // A frame NOT on the list gets none unless asked.
  if (r.unlistedPct !== 0) {
    return `FAIL: a frame that needs no fade got ${r.unlistedPct}% anyway`;
  }
  return `PASS: a listed frame's opening goes ${Math.round(r.fading.whiteShare * 100)}% to the mug's ${r.hex} with the fade on (centre untouched), an unlisted one carries none`;
};

// THE FADE SURVIVES THE FIT SLIDERS (Alyx, v94: "the fade doesn't take until
// Height is lowered"). The fade used to be painted on the picture file's own
// edges; when the fit sliders set a box the picture FILLS, the overflow that
// got clipped away was exactly where the fade lived, so the slider looked
// dead. Now the box itself fades. Measured: with Height at 150% (the strip
// overflowing and cropped) the opening must still go white at its corners.
scenarios.theFadeSurvivesTheHeightSlider = async (page) => {
  const r = await page.evaluate(async () => {
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    lastWraparoundMethod = 'panorama';
    product = 'mug'; windowSillChoice = null;
    selectedFrame = 'Mirror Mirror';
    const asset = FRAME_CATALOG[selectedFrame].asset;
    const measure = async (pct) => {
      const framed = await compositeFrameAcrossPanorama(wraparoundPanoramaBaseUrl, pct);
      const im = await loadImageFromUrl(framed.combined);
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const cal = customFrameCalibration[asset];
      const bw = Math.floor(c.width * cal.widthPct / 100), bh = Math.floor(c.height * cal.heightPct / 100);
      const bx = Math.floor((c.width - bw) / 2), by = Math.floor((c.height - bh) / 2);
      // Only the part of the box you can see: through the frame's opening.
      const frac = await getFrameInsetFraction(asset);
      const x0 = Math.max(0, bx, Math.floor(frac.x * c.width)), y0 = Math.max(0, by, Math.floor(frac.y * c.height));
      const x1 = Math.min(c.width, bx + bw, Math.floor((frac.x + frac.w) * c.width));
      const y1 = Math.min(c.height, by + bh, Math.floor((frac.y + frac.h) * c.height));
      const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let white = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] > 215 && d[k + 1] > 215 && d[k + 2] > 215) white++;
      const cp = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
      // The top of the frame's opening, at the middle: at Height 150% the
      // picture runs right up to it, and it must be softened too (v95).
      const tp = ctx.getImageData(Math.floor(c.width / 2), y0 + 6, 1, 1).data;
      return { whiteShare: white / ((x1 - x0) * (y1 - y0)), centre: [cp[0], cp[1], cp[2]], topEdge: [tp[0], tp[1], tp[2]] };
    };
    customFrameCalibration[asset] = { widthPct: 100, heightPct: 150, offsetXPct: 0, offsetYPct: 0 };
    const tall = { plain: await measure(0), faded: await measure(40) };
    customFrameCalibration = {};
    return tall;
  });
  if (r.plain.whiteShare > 0.05) return `FAIL: the tall box is ${Math.round(r.plain.whiteShare * 100)}% white with no fade: ` + JSON.stringify(r);
  // Mirror Mirror's opening is an oval, so the rectangle's corners -- where a
  // fade whitens first -- sit under the gold. The area count can only rise a
  // little here; the edge sample below is the real measurement.
  if (r.faded.whiteShare < r.plain.whiteShare + 0.02) {
    return `FAIL: with Height at 150% the fade only turned ${Math.round(r.faded.whiteShare * 100)}% of the box white — the crop ate the fade again: ` + JSON.stringify(r);
  }
  if (r.faded.centre.join() !== r.plain.centre.join()) return `FAIL: the fade reached the centre: ` + JSON.stringify(r);
  const lift = r.faded.topEdge.reduce((a, v, i) => a + (v - r.plain.topEdge[i]), 0);
  if (lift < 60) {
    return `FAIL: the visible top edge barely faded (rgb(${r.plain.topEdge}) -> rgb(${r.faded.topEdge})) — the oval was fitted to the part of the box hanging off the canvas: ` + JSON.stringify(r);
  }
  return `PASS: with Height at 150% the box still fades (${Math.round(r.faded.whiteShare * 100)}% of it to white, centre untouched)`;
};

// THE NUMBER ON THE SLIDER IS THE AMOUNT OF PICTURE GONE (Alyx, Sep 2026).
//
// Two separate complaints, both right, both about the same line of code:
//   "it should completely disappear and it should completely white out the
//    picture, one extreme to the next. Right now you barely get any fade."
//   "zero should be zero, twenty five should be 25, 50 should be 50% and a
//    100 should be 100%. Why are we doing all this in between bullshit?"
//
// The gradient used to pin its centre stop fully transparent at every
// setting, so 100% left the middle of the picture untouched and whitened
// barely 1% of it -- neither end of the slider did what it said. And the
// slider drove a RADIUS, so with area growing as the square of radius, 0->40
// covered 8% while 40->60 jumped from 8% to 56%: the same twenty points of
// travel doing wildly different amounts of work depending where you were.
//
// This measures real pixels at thirteen points and demands the slider track
// coverage one for one. It cannot pass on either of the old behaviours.
scenarios.theFadeSliderMeansWhatItSays = async (page) => {
  const rows = await page.evaluate(async () => {
    product = 'mug';
    const src = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    const out = [];
    for (const pct of [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100]) {
      const url = pct === 0 ? src : await renderFadedArtwork(src, '#FFFFFF', pct);
      const im = await loadImageFromUrl(url);
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      // "gone" = the original ink is at least half replaced by mug colour.
      let gone = 0, total = 0;
      for (let i = 0; i < d.length; i += 4) { total++; if (d[i] >= 191) gone++; }
      const px = (a, b) => { const q = x.getImageData(a, b, 1, 1).data; return [q[0], q[1], q[2]]; };
      out.push({
        slider: pct,
        gone: Math.round(gone / total * 100),
        centre: px(Math.floor(c.width / 2), Math.floor(c.height / 2)),
        corner: px(2, 2),
      });
    }
    return out;
  });
  const at = (p) => rows.find((r) => r.slider === p);

  // Both ends must be absolute.
  if (at(0).gone !== 0) return `FAIL: 0 already covers ${at(0).gone}% of the picture`;
  if (at(100).gone !== 100) return `FAIL: 100 leaves ${100 - at(100).gone}% of the picture showing`;
  if (!at(100).centre.every((c) => c > 245)) {
    return `FAIL: 100 left the centre at rgb(${at(100).centre}) — the centre never fades, the old bug`;
  }

  // And every step in between must mean what it says, within a couple of points.
  const off = rows.map((r) => ({ slider: r.slider, gone: r.gone, by: r.gone - r.slider }))
                  .filter((r) => Math.abs(r.by) > 3);
  if (off.length) {
    return 'FAIL: the slider does not match what it covers: '
      + off.map((o) => `${o.slider} covers ${o.gone}%`).join(', ');
  }

  // Corners still go before the middle -- the oval, cloud shape.
  if (at(50).centre.every((c) => c > 245)) return 'FAIL: at 50 the centre is gone — the fade is not working from the corners in';
  if (!at(50).corner.every((c) => c > 245)) return `FAIL: at 50 the corners are still rgb(${at(50).corner})`;

  const worst = Math.max(...rows.map((r) => Math.abs(r.gone - r.slider)));
  return `PASS: the slider tracks coverage 1:1 across ${rows.length} points (worst error ${worst}%), 0 untouched, 100 completely gone, corners first`;
};

// ---- THE FADE IS TRIED ON, NOT IMAGINED. ----
// Alyx: "when we have these attachable items that can be attached even after
// mockup, we should present them with the mockup and afford them the
// opportunity to see the enhancements applied in real time. That would be
// dramatically more effective than having them imagine what it would look like
// before deciding."
//
// Edge Fade is the strongest case of the three, because it is a SLIDER: the old
// screen asked somebody to drag it against a flat square and picture how that
// melts into glaze. What this pins:
//   * the real cup is running on the fade screen, in the flat picture's own
//     slot -- and the flat picture only stands down once the cup is actually up,
//     so a machine with no WebGL keeps the preview it always had;
//   * moving the slider repaints the cup, and further along the slider really
//     is more of the picture gone -- the cup is not showing a stale wrap;
//   * Back gives the picture back and RELEASES MUG3D, which is a singleton:
//     hold it here and whatever opens next renders into a hidden div.
scenarios.theFadeIsTriedOnTheCup = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-40oz-vacuum'));
  await T(page, 900);
  await dismissAlerts(page);

  const r = await page.evaluate(async () => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    // A picture with a strong, uniform colour right out to its corners, so
    // "how much has been eaten by the fade" is a straight pixel count.
    const c = document.createElement('canvas'); c.width = 1400; c.height = 1063;
    const x = c.getContext('2d'); x.fillStyle = '#1188FF'; x.fillRect(0, 0, 1400, 1063);
    const art = c.toDataURL('image/jpeg', 0.95);

    selectedTravelProductKey = 'travel-mug-40oz-vacuum';
    revealFlowThreePanel = false;
    revealOriginalArtworkUrls = [art];
    wrapDisplayOverrideUrl = null;
    revealFadeSliderTouched = false;
    revealFadePreviewFor = null;

    const seen = [];
    const real = MUG3D.setArtwork;
    MUG3D.setArtwork = function (a) { seen.push(a); return real.call(MUG3D, a); };

    chooseFadeEdges();
    await new Promise((s) => setTimeout(s, 3000));

    const stage = document.getElementById('revealFade3DStage');
    const img = document.getElementById('revealArtworkImg');
    const canvas = stage ? stage.querySelector('canvas') : null;
    const up = {
      stageShown: !!stage && getComputedStyle(stage).display !== 'none',
      flatHidden: !!img && img.style.display === 'none',
      mounted: MUG3D.mounted(),
      canvas: !!canvas && canvas.width > 4 && canvas.height > 4
    };

    // How much of the picture is left, measured on the very wrap the cup was
    // handed -- not on some other render made for the test.
    const survives = async (u) => {
      const im = await load(u);
      const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let keep = 0, total = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { total++; if (d[i] < 120 && d[i + 2] > 180) keep++; }
      return Math.round(100 * keep / total);
    };

    const setTo = async (v) => {
      seen.length = 0;
      document.getElementById('revealFadeAmountSlider').value = String(v);
      await updateRevealFadePreview();
      await new Promise((s) => setTimeout(s, 900));
      return seen.length ? seen[seen.length - 1] : null;
    };

    const at0 = await setTo(0);
    const at40 = await setTo(40);
    const at90 = await setTo(90);

    const out = {
      up,
      repaints: { zero: !!at0, forty: !!at40, ninety: !!at90 },
      left: { zero: at0 ? await survives(at0) : -1, forty: at40 ? await survives(at40) : -1, ninety: at90 ? await survives(at90) : -1 }
    };

    revealFadeBack();
    await new Promise((s) => setTimeout(s, 600));
    out.after = {
      stageShown: !!stage && getComputedStyle(stage).display !== 'none',
      flatBack: !!img && img.style.display !== 'none',
      released: !MUG3D.mounted()
    };
    MUG3D.setArtwork = real;
    return out;
  });

  if (!r.up.stageShown) return 'FAIL: the cup is not on the fade screen — the customer is still imagining it';
  if (!r.up.mounted || !r.up.canvas) return `FAIL: the stage is there but nothing is rendering in it (mounted ${r.up.mounted}, canvas ${r.up.canvas})`;
  if (!r.up.flatHidden) return 'FAIL: the flat picture is still in the card alongside the cup — two previews of the same thing, and the card grew to hold both';
  if (!r.repaints.zero || !r.repaints.forty || !r.repaints.ninety) {
    return `FAIL: moving the slider did not repaint the cup (${JSON.stringify(r.repaints)}) — it shows a stale wrap while the number underneath changes`;
  }
  if (r.left.zero < 90) return `FAIL: at 0 only ${r.left.zero}% of the picture survives — untouched must mean untouched`;
  if (!(r.left.forty < r.left.zero - 10 && r.left.ninety < r.left.forty - 10)) {
    return `FAIL: further along the slider is not more fade — ${r.left.zero}% left at 0, ${r.left.forty}% at 40, ${r.left.ninety}% at 90`;
  }
  if (r.after.stageShown) return 'FAIL: Back left the cup on screen';
  if (!r.after.flatBack) return 'FAIL: Back did not give the flat picture back — the card is left with an empty slot';
  if (!r.after.released) return 'FAIL: the fade screen kept hold of MUG3D — whatever opens next would render into a hidden div and come up blank';

  return `PASS: the real cup runs on the fade slider in the picture's own slot, repaints on every move (${r.left.zero}% of the picture left at 0, ${r.left.forty}% at 40, ${r.left.ninety}% at 90), and Back gives the picture back and releases the cup`;
};

// The fade slider now spins the real cup, which needs a software GL in this
// headless sandbox. Only the scenario that opens it pays for one.
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
const OPTS = { theFadeIsTriedOnTheCup: { chromiumArgs: GL } };

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch(OPTS[name] || {});
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
