// The Style panel was inert, and nobody could see why (2026-08-27).
//
// The customer's choice reached the server as "Selected style: <directive>."
// in the MIDDLE of the request, and a fixed house STYLE block was appended at
// the END. Image models weight later instructions more heavily, so the house
// block won every time: pick Comic Strip, get "flat cel-shaded comic strip
// illustration" in the middle and "not cartoon, not vector" at the end. Line
// Art was the only style that visibly survived, being concrete enough to
// punch through. It read as a weak panel; it was an overridden one.
//
// What this suite pins, and why each line earns its place:
//   * the chosen style actually LEAVES THE BROWSER. The whole defect was
//     invisible in the UI -- the tile lit up correctly, the variable was set
//     correctly, and the request still could not carry the decision. Only the
//     request body proves it.
//   * the default const matches the tile byte-for-byte. They are compared by
//     exact string. A one-character drift would mark every generation as
//     "customer chose", silently retiring the house style for everyone, with
//     nothing on screen to show for it.
//   * EVERY generation path sends it. Three call sites (single image,
//     panorama, per-panel continuation) and three server-side style blocks.
//     Wiring two of three leaves a path that still overrides the customer.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1000);
}

// Every /api/generate body this page sends, so the assertions can be made
// against what actually went over the wire rather than page state.
function captureGenerateBodies(page) {
  const bodies = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/generate')) {
      try { bodies.push(r.postDataJSON()); } catch (e) {}
    }
  });
  return bodies;
}

const styleTiles = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('#styleSectionCard .btn-select')).map(b => ({
    label: b.textContent.trim(),
    val: b.dataset.val,
    selected: b.classList.contains('selected'),
  })));

const scenarios = {};

// ---- 1. The const and the tile must be the same string. ----
scenarios.defaultConstMatchesTheTile = async (page) => {
  const tiles = await styleTiles(page);
  const konst = await page.evaluate(() => MUGGSHOTZ_CLASSIC_STYLE);
  const preselected = tiles.filter(t => t.selected);
  if (preselected.length !== 1)
    return `FAIL: expected exactly one preselected style tile, found ${preselected.length}`;
  if (preselected[0].val !== konst)
    return `FAIL: MUGGSHOTZ_CLASSIC_STYLE does not match the preselected tile's data-val.\n    const: ${JSON.stringify(konst)}\n    tile:  ${JSON.stringify(preselected[0].val)}`;
  const live = await page.evaluate(() => currentStylePayload());
  if (live.styleIsDefault !== true)
    return 'FAIL: a freshly loaded page does not report the house style as default';
  return `PASS: default const matches the preselected tile, reported as default (${tiles.length} styles on the panel)`;
};

// ---- 2. Choosing a style flips the flag and carries the directive. ----
scenarios.choosingAStyleIsReported = async (page) => {
  const tiles = await styleTiles(page);
  const other = tiles.find(t => !t.selected);
  if (!other) return 'FAIL: no non-default style tile to choose';
  await page.evaluate((v) => {
    const el = Array.from(document.querySelectorAll('#styleSectionCard .btn-select')).find(b => b.dataset.val === v);
    pick(el, 'style');
  }, other.val);
  await T(page, 400);
  const live = await page.evaluate(() => currentStylePayload());
  if (live.styleIsDefault !== false)
    return `FAIL: chose "${other.label}" but styleIsDefault is still ${live.styleIsDefault} — the server would keep overriding it`;
  if (live.styleDirective !== other.val)
    return `FAIL: styleDirective is not the chosen tile's directive`;
  return `PASS: choosing "${other.label}" reports styleIsDefault=false and carries its directive`;
};

// ---- 3. It has to actually leave the browser, on the plain path. ----
scenarios.singleImagePathSendsTheChoice = async (page, log, bodies) => {
  await pickProduct(page, 'coaster');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await dismissAlerts(page);
  await T(page, 400);
  const tiles = await styleTiles(page);
  const other = tiles.find(t => /line art/i.test(t.label)) || tiles.find(t => !t.selected);
  await page.evaluate((v) => {
    const el = Array.from(document.querySelectorAll('#styleSectionCard .btn-select')).find(b => b.dataset.val === v);
    pick(el, 'style');
  }, other.val);
  await T(page, 400);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });

  const gen = bodies.filter(b => b && !b.action);
  if (!gen.length) return 'FAIL: no plain generate request was sent';
  const b = gen[0];
  if (!('styleDirective' in b)) return 'FAIL: single-image request carries no styleDirective — the server falls back to the house block and overrides the customer';
  if (b.styleIsDefault !== false) return `FAIL: styleIsDefault=${b.styleIsDefault} on the wire after choosing "${other.label}"`;
  if (b.styleDirective !== other.val) return 'FAIL: the directive on the wire is not the chosen one';
  return `PASS: single-image path sends "${other.label}" as the deciding style`;
};

// ---- 4. And on the panorama path, which has its own style block. ----
scenarios.panoramaPathSendsTheChoice = async (page, log, bodies) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-14oz-handle'));
  await T(page, 1000);
  await dismissAlerts(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1000);
  await dismissAlerts(page);
  const tiles = await styleTiles(page);
  const other = tiles.find(t => !t.selected);
  await page.evaluate((v) => {
    const el = Array.from(document.querySelectorAll('#styleSectionCard .btn-select')).find(b => b.dataset.val === v);
    pick(el, 'style');
  }, other.val);
  await T(page, 400);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 120000 });

  const pano = bodies.filter(b => b && b.action === 'wraparoundPanorama');
  if (!pano.length) return 'FAIL: no panorama request was sent';
  if (!('styleDirective' in pano[0]))
    return 'FAIL: panorama request carries no styleDirective — that path has its own style block and would override the customer';
  if (pano[0].styleIsDefault !== false)
    return `FAIL: panorama styleIsDefault=${pano[0].styleIsDefault} after choosing "${other.label}"`;
  return `PASS: panorama path sends "${other.label}" as the deciding style`;
};

// ---- 5. The house default still identifies itself as the default. ----
scenarios.untouchedStyleStaysDefault = async (page, log, bodies) => {
  await pickProduct(page, 'coaster');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await dismissAlerts(page);
  await T(page, 400);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  const gen = bodies.filter(b => b && !b.action);
  if (!gen.length) return 'FAIL: no generate request was sent';
  if (gen[0].styleIsDefault !== true)
    return `FAIL: nobody touched the panel but styleIsDefault=${gen[0].styleIsDefault} — the house style would be retired for everyone`;
  return 'PASS: an untouched panel still reports the house default';
};

// ---- 6. Art Style is now a REAL rail step: first after the photo, lit. ----
// It used to sit between the tote colour picker and Degree of Caricature,
// two thirds down the page, with nothing pointing at it. Alyx: "I don't want
// that panel to be mid rail. Activate it, highlight it, and dim everything
// else." Position and spotlight are both pinned here because either one
// failing alone puts the panel back to being invisible in practice.
scenarios.styleIsTheFirstLitStepAfterThePhoto = async (page) => {
  const st = await page.evaluate(() => {
    const style = document.getElementById('styleSectionCard');
    const upload = document.getElementById('uploadPhotoCard');
    const track = document.getElementById('trackForkCard');
    const product = document.getElementById('productCard');
    if (!style || !upload || !track || !product) return { missing: true };
    const r = style.getBoundingClientRect();
    return {
      focus: Array.from(document.body.classList).filter(c => c.endsWith('-focus')),
      // DOM order is what makes this a rail step rather than a card that
      // happens to light up somewhere far below.
      afterUpload: !!(upload.compareDocumentPosition(style) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeTrack: !!(style.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeProduct: !!(style.compareDocumentPosition(product) & Node.DOCUMENT_POSITION_FOLLOWING),
      onScreen: r.top < innerHeight && r.bottom > 0,
      height: Math.round(r.height),
      continueVisible: getComputedStyle(document.getElementById('styleContinueBtn')).display !== 'none',
      productOpacity: getComputedStyle(product).opacity,
    };
  });
  if (st.missing) return 'FAIL: styleSectionCard / trackForkCard / productCard not all present';
  if (!st.afterUpload) return 'FAIL: Art Style is not after Upload Photo in the DOM';
  if (!st.beforeTrack) return 'FAIL: Art Style comes AFTER the track fork — style must be chosen first';
  if (!st.beforeProduct) return 'FAIL: Art Style still sits below Product — that is the mid-rail position it was moved out of';
  if (st.focus.join() !== 'style-focus') return `FAIL: spotlight is ${JSON.stringify(st.focus)}, expected exactly [style-focus]`;
  if (!st.onScreen || st.height === 0) return `FAIL: Art Style is not on screen (h=${st.height})`;
  if (!st.continueVisible) return 'FAIL: no Continue button — Muggshotz Classic is preselected, so there is no way forward without one';
  if (parseFloat(st.productOpacity) > 0.5) return `FAIL: Product is not dimmed (opacity ${st.productOpacity}) — nothing else should compete`;
  return 'PASS: Art Style is the first lit step after the photo, before track and product, everything else dimmed';
};

// ---- 7. It hands off to the tracks, and never traps anyone. ----
scenarios.styleHandsOffToTheTracks = async (page) => {
  // A dim is a guide, not a cage: the tracks below must stay clickable for
  // anyone who does not care about art style.
  const reachable = await page.evaluate(() => {
    const btn = document.querySelector('#postUploadForkRow button');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { pe: getComputedStyle(btn).pointerEvents, covered: !!(mid && !btn.contains(mid)) };
  });
  if (!reachable) return 'FAIL: track buttons missing';
  if (reachable.pe === 'none') return 'FAIL: the tracks are pointer-locked under the style dim — a dim is a guide, not a cage';

  await page.click('#styleContinueBtn');
  await T(page, 1200);
  const after = await page.evaluate(() => ({
    focus: Array.from(document.body.classList).filter(c => c.endsWith('-focus')),
    continueGone: getComputedStyle(document.getElementById('styleContinueBtn')).display === 'none',
    forkOpacity: getComputedStyle(document.getElementById('trackForkCard')).opacity,
  }));
  if (after.focus.join() !== 'track-focus') return `FAIL: after Continue the spotlight is ${JSON.stringify(after.focus)}, expected [track-focus]`;
  if (!after.continueGone) return 'FAIL: the Continue button is still showing after being used';
  if (parseFloat(after.forkOpacity) < 0.9) return `FAIL: the track fork is dimmed (${after.forkOpacity}) while holding the spotlight`;

  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 1200);
  const end = await page.evaluate(() => Array.from(document.body.classList).filter(c => c.endsWith('-focus')));
  if (end.join() !== 'product-focus') return `FAIL: picking a track left ${JSON.stringify(end)} — a stale style/track dim would grey out the product grid`;
  return 'PASS: style -> track -> product relays cleanly, tracks stayed reachable throughout';
};

// ---- 8. All six styles are on the panel. ----
scenarios.sixStylesOffered = async (page) => {
  const tiles = await styleTiles(page);
  const want = ['classic', 'photoreal', 'satire', 'comic', 'line art', 'silhouette'];
  const labels = tiles.map(t => t.label.toLowerCase());
  const missing = want.filter(w => !labels.some(l => l.includes(w.split(' ')[0])));
  if (missing.length) return `FAIL: missing style(s): ${missing.join(', ')} (found ${tiles.length})`;
  const empty = tiles.filter(t => !t.val || t.val.length < 20);
  if (empty.length) return `FAIL: ${empty.length} tile(s) carry no real directive`;
  return `PASS: all ${tiles.length} styles present, each with a real directive`;
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    const bodies = captureGenerateBodies(page);
    try {
      await openStudio(page);
      await uploadPhoto(page);
      await dismissAlerts(page);
      const result = await fn(page, log, bodies);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
      await page.screenshot({ path: `shot-style-fail-${name}.png` }).catch(() => {});
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL STYLE-PANEL VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
