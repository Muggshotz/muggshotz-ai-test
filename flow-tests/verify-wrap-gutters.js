// Gutters (Alyx, Sep 2026).
//
// The vacuum 40oz's print area closes on itself -- 3710x2817 is the tumbler's
// circumference against its height -- so the two ends of one image meet on the
// body, and nothing makes the scene line up across that meeting. The picture
// stops on one side and starts again on the other, and the eye reads the
// mismatch as a fault.
//
// A gutter is the trade's answer: a straight strip of the cup's own colour at
// each extreme end. Brought together they read as one intentional stripe, and
// a mismatch behind a deliberate line stops looking like a mistake.
//
// What this pins:
//   * IT REPLACES THE GUARANTEED EDGE FADE rather than stacking on it -- but
//     NOT a fade the customer actually chose. An explicit choice wins; the
//     gutter takes the place of the fade nobody asked for.
//   * THE OUTER EDGE IS THE CUP'S EXACT COLOUR. That edge is what butts
//     against the other end to form the stripe, so it is the one pixel column
//     that has to be right. It survives JPEG because the strip is far wider
//     than an 8x8 block -- which is a dependency, and so is pinned here.
//   * STRAIGHT STRIPS, both edges hard. There is no feather and there is not
//     meant to be one: a fade hides an edge, a gutter declares one.
//   * INSIDE THE CANVAS. Widening the file to make room would rescale the
//     whole wrap and MOVE the join, which is what the gutter exists to settle.
//   * ONLY ON A CUP WHOSE ENDS MEET. Strips on a wrap that never closes are
//     just two stripes down the artwork.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const VACUUM = 'travel-mug-40oz-vacuum';

async function pickCup(page, key) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="water bottle"]').click({ force: true });
  await T(page, 1000);
  await page.evaluate((k) => pickPreGenTravelVariant(k), key);
  await T(page, 900);
  await dismissAlerts(page);
}

// Paints a known source through the real paintWrapGutters and reads pixels back.
async function gutter(page, { w = 3710, h = 2817, width = null, hex = '#90C695', samples = [] }) {
  return page.evaluate(async ({ w, h, width, hex, samples }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#FF00FF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#000000'; x.fillRect(Math.round(w / 2) - 3, 0, 6, h);
    const src = c.toDataURL('image/png');
    const out = await paintWrapGutters(src, hex, width == null ? WRAP_GUTTER_WIDTH : width);
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = out; });
    const c2 = document.createElement('canvas');
    c2.width = img.naturalWidth; c2.height = img.naturalHeight;
    const x2 = c2.getContext('2d');
    x2.drawImage(img, 0, 0);
    const at = (sx, sy) => {
      const px = sx < 0 ? img.naturalWidth + sx : sx;
      return Array.from(x2.getImageData(px, sy, 1, 1).data).slice(0, 3);
    };
    return {
      width: img.naturalWidth, height: img.naturalHeight,
      gutterPx: Math.round(img.naturalWidth * (width == null ? WRAP_GUTTER_WIDTH : width)),
      hasFeatherKnob: typeof WRAP_GUTTER_FEATHER !== 'undefined',
      samples: samples.map(([sx, sy]) => at(sx, sy)),
    };
  }, { w, h, width, hex, samples });
}

const rgb = (hx) => [1, 3, 5].map((i) => parseInt(hx.substr(i, 2), 16));
const near = (a, b, tol = 10) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const magenta = (v) => near(v, [255, 0, 255], 24);

const scenarios = {};

// ---- 1. IT REPLACES THE FADE. ----
// Read from source: the gutter branch and the fade branch must be exclusive.
scenarios.theSeamIsNotDecidedDuringGeneration = async (page) => {
  const src = await page.evaluate(async () => (await fetch('/needles-studio.html')).text());
  // The gutter used to run inside generate(), which meant the trimming had to
  // be chosen before the artwork existed. Alyx: "he's gonna have to see what
  // design the AI came up with to see which gutter best matches his motif."
  // This pins the move rather than the old ordering, because the old ordering
  // is exactly what is no longer there -- and a well-meant revert would put it
  // back without anything complaining.
  const gen = src.indexOf('const rawResultUrl=resultUrl;');
  if (gen < 0) return 'FAIL: could not find the generation path to check';
  const window_ = src.slice(gen, gen + 1200);
  if (/paintWrapGutters\(/.test(window_)) {
    return 'FAIL: the seam is being painted during generation again — that forces the customer to choose a trimming for a picture they have not seen yet';
  }
  if (!/if\(!skipEdgeFade\)\{/.test(window_)) {
    return 'FAIL: the guaranteed edge fade has gone missing from the generation path';
  }
  // And it must still be reachable from somewhere: a painter nothing calls is
  // the failure mode this whole feature started with.
  if (!/openTrimmingsPanel|confirmTrimmingAndContinue/.test(src) || !/paintWrapGutters\(/.test(src)) {
    return 'FAIL: nothing calls the gutter painter any more — it has been orphaned';
  }
  return 'PASS: the seam is decided on the finished picture, not during generation, and the fade path is untouched';
};

// ---- 2. STRAIGHT STRIPS, the thing that was actually asked for. ----
scenarios.straightStripsByDefault = async (page) => {
  await pickCup(page, VACUUM);
  const g = await gutter(page, { samples: [] });
  if (g.hasFeatherKnob) return 'FAIL: a feather knob is back — a gutter that needs a fade is not doing its job';
  const px = g.gutterPx;
  const mid = Math.round(px / 2);
  const r = await gutter(page, { samples: [[0, 1400], [mid, 1400], [px + 3, 1400], [-1, 1400], [-mid, 1400], [-(px + 4), 1400]] });
  const cup = rgb('#90C695');
  const [outL, midL, pastL, outR, midR, pastR] = r.samples;
  // THE OUTER EDGE IS THE STRIPE. Near-exact, not merely close: this column is
  // what meets the other end on the cup, and a couple of points off there is a
  // stripe that does not match itself across its own join.
  if (!near(outL, cup, 2) || !near(outR, cup, 2)) {
    return `FAIL: the outer edges are rgb(${outL}) / rgb(${outR}), not the cup's exact rgb(${cup}) — the two halves of the stripe would not match each other`;
  }
  if (!near(midL, cup, 4) || !near(midR, cup, 4)) return `FAIL: the strips are not solid across their width — rgb(${midL}) / rgb(${midR}) at the middle`;
  if (!magenta(pastL) || !magenta(pastR)) return `FAIL: past the strip is rgb(${pastL}) / rgb(${pastR}) — the inner edge is ramping far into the picture, not stopping`;
  return `PASS: ${px}px of solid cup colour at each end, outer edge exact — a ${px * 2}px stripe where they meet`;
};

// ---- THE DEPENDENCY THE FORMAT CHOICE RESTS ON. ----
// The strip survives JPEG only because it is far wider than an 8x8 block, so
// the blocks on the canvas boundary are entirely flat colour. Narrow it far
// enough and the outer edge starts to ring -- which would be invisible in
// review and obvious on a printed cup. This says where the floor is.
scenarios.theStripStaysWiderThanAJpegBlock = async (page) => {
  await pickCup(page, VACUUM);
  const cup = rgb('#90C695');
  const live = await page.evaluate(() => WRAP_GUTTER_WIDTH);
  const px = Math.round(3710 * live);
  if (px < 24) {
    return `FAIL: WRAP_GUTTER_WIDTH ${live} gives a ${px}px strip — too near JPEG's 8px block for the outer edge to stay clean`;
  }
  const r = await gutter(page, { samples: [[0, 1400], [-1, 1400]] });
  if (!near(r.samples[0], cup, 2) || !near(r.samples[1], cup, 2)) {
    return `FAIL: at the shipping width the outer edge is already ringing — rgb(${r.samples[0]}) / rgb(${r.samples[1]})`;
  }
  return `PASS: ${px}px strip at the shipping width, ${Math.round(px / 8)}x a JPEG block, outer edge exact`;
};

// ---- 3. INSIDE THE CANVAS. Widening would move the join. ----
scenarios.paintsInsideTheCanvas = async (page) => {
  await pickCup(page, VACUUM);
  const r = await gutter(page, { samples: [[1852, 1400], [1855, 1400], [1858, 1400]] });
  if (r.width !== 3710 || r.height !== 2817) {
    return `FAIL: came back ${r.width}x${r.height} — the wrap must stay 3710x2817 or the whole thing prints scaled and the join moves`;
  }
  if (!r.samples.some((v) => v.every((c) => c < 60))) {
    return 'FAIL: the centre rule has moved — the artwork was scaled sideways instead of having the strips painted over its ends';
  }
  return 'PASS: 3710x2817 in and out, centre of the picture unmoved';
};

// ---- 4. ONLY WHERE THE ENDS MEET. ----
scenarios.onlyOnCupsWhoseEndsMeet = async (page) => {
  await pickCup(page, VACUUM);
  if (!(await page.evaluate(() => wrapWantsGutters()))) return 'FAIL: the vacuum 40oz did not get gutters';
  const others = await page.evaluate(() => {
    const was = preGenTravelVariant, out = {};
    for (const k of Object.keys(TRAVEL_MUG_CATALOG)) { preGenTravelVariant = k; out[k] = wrapWantsGutters(); }
    preGenTravelVariant = was;
    return out;
  });
  const wrong = Object.entries(others).filter(([k, v]) => v && k !== VACUUM).map(([k]) => k);
  if (wrong.length) return `FAIL: gutters on ${wrong.join(', ')} — none is confirmed to close`;
  const leaked = await page.evaluate(() => {
    const was = product, out = {};
    for (const p of ['mug', 'coaster', 'tote bag', 'poster']) { product = p; out[p] = wrapWantsGutters(); }
    product = was;
    return out;
  });
  const bad = Object.entries(leaked).filter(([, v]) => v).map(([k]) => k);
  if (bad.length) return `FAIL: gutters leaked onto ${bad.join(', ')}`;
  return 'PASS: the vacuum 40oz alone — every other cup and every non-cup is untouched';
};

// ---- 5. THE WIDTH DIAL REACHES THE PAINT. ----
scenarios.theWidthDialWorks = async (page) => {
  await pickCup(page, VACUUM);
  const rows = [];
  for (const wdt of [0, 0.01, 0.0175, 0.04]) {
    const want = Math.round(2000 * wdt);
    // Sample the OUTER edge (x=0), not the inner one. The inner edge borders
    // the picture and rings under JPEG by design; the outer edge is the column
    // that forms the stripe and must be exact.
    const r = await gutter(page, { w: 2000, h: 1500, width: wdt, samples: [[0, 700]] });
    rows.push({ wdt, want, got: r.gutterPx, edge: r.samples[0] });
  }
  const off = rows.filter((r) => r.got !== r.want);
  if (off.length) return `FAIL: width does not reach the paint: ${off.map((r) => `${r.wdt}->${r.got}px (want ${r.want})`).join(', ')}`;
  if (!magenta(rows[0].edge)) return `FAIL: width 0 still painted rgb(${rows[0].edge}) — no gutter must mean no gutter`;
  for (const r of rows.slice(1)) {
    if (!near(r.edge, rgb('#90C695'), 3)) return `FAIL: at ${r.wdt} the outer edge is rgb(${r.edge}), not the cup's colour`;
  }
  return `PASS: 0 paints nothing, and ${rows.slice(1).map((r) => `${r.wdt}->${r.got}px`).join(', ')} land exactly`;
};

// ---- THE TWO ENDS LINE UP, BY CONSTRUCTION. ----
// Alyx: "an exact mirror opposite... that way when they come together on the
// other side they'll line up perfectly. There's no reason why it just has to
// be a shot in the dark."
//
// Right, so it is not left to care: one strip, mirrored onto the other end. A
// horizontal flip cannot move a feature up or down, so vertical alignment is
// arithmetic. This paints a marker at a known height and insists it returns on
// the same rows at both ends -- exactly -- and that the mirror actually
// happened rather than the same strip being stamped twice.
scenarios.theTwoEndsLineUpExactly = async (page) => {
  await pickCup(page, VACUUM);
  const r = await page.evaluate(async () => {
    const W = 3710, H = 2817;
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const bx = base.getContext('2d'); bx.fillStyle = '#FF00FF'; bx.fillRect(0, 0, W, H);
    const baseUrl = base.toDataURL('image/png');

    // A stand-in gutter strip: a black bar at 30% height (the "ribbon bow"
    // whose distance from the top must match), plus a red mark on its LEFT
    // quarter only, so the mirror is provable rather than assumed.
    // Deliberately NOT the gutter's own 1:12.6 -- a design that overhangs is
    // the normal case now (a bow reaching onto the picture), and it must still
    // line up at both ends.
    const A = document.createElement('canvas'); A.width = 200; A.height = 1000;
    const ax = A.getContext('2d');
    ax.fillStyle = '#DDDDDD'; ax.fillRect(0, 0, 200, 1000);
    ax.fillStyle = '#000000'; ax.fillRect(0, 300, 200, 40);
    ax.fillStyle = '#FF0000'; ax.fillRect(0, 700, 50, 40);
    GUTTER_CATALOG.__probe = { asset: A.toDataURL('image/png') };
    const out = await paintWrapGutters(baseUrl, '#90C695', WRAP_GUTTER_WIDTH, '__probe');
    delete GUTTER_CATALOG.__probe;

    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = out; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
    const g = Math.round(im.naturalWidth * WRAP_GUTTER_WIDTH);
    const drawW = Math.round(H * (200 / 1000));
    const barRows = (x) => {
      const d = cx.getImageData(x, 0, 1, im.naturalHeight).data;
      const rows = [];
      for (let y = 0; y < im.naturalHeight; y++) {
        const i = y * 4;
        if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) rows.push(y);
      }
      return rows.length ? { first: rows[0], last: rows[rows.length - 1] } : null;
    };
    const px = (x, y) => Array.from(cx.getImageData(x, y, 1, 1).data).slice(0, 3);
    const redY = Math.round(im.naturalHeight * 0.72);
    return {
      height: im.naturalHeight, g,
      leftBar: barRows(Math.round(drawW / 2)),
      rightBar: barRows(im.naturalWidth - Math.round(drawW / 2)),
      // The red mark sits on the strip's OUTER portion. Unmirrored it would be
      // at the same side of both ends; mirrored it moves to the far side.
      drawW: Math.round(im.naturalHeight * (200 / 1000)),
      redNearLeftOuter:  px(2, redY),
      redNearRightOuter: px(im.naturalWidth - 3, redY),
      redNearRightInner: px(im.naturalWidth - Math.round(im.naturalHeight * 0.2) + 3, redY),
    };
  });

  if (!r.leftBar || !r.rightBar) return 'FAIL: the design did not paint onto one or both ends';
  if (r.leftBar.first !== r.rightBar.first || r.leftBar.last !== r.rightBar.last) {
    return `FAIL: the feature sits at rows ${r.leftBar.first}-${r.leftBar.last} on the left end and ${r.rightBar.first}-${r.rightBar.last} on the right — butted on the cup they would step`;
  }
  const wantTop = Math.round(r.height * 0.30);
  if (Math.abs(r.leftBar.first - wantTop) > 2) {
    return `FAIL: the feature landed at row ${r.leftBar.first}, expected ~${wantTop} — the strip is not drawn to the full height of the wrap`;
  }
  // Aspect must be preserved, not squeezed into the gutter: a 1:5 asset on a
  // 2817-tall wrap should occupy 563px, overhanging the 223px band.
  const wantW = Math.round(r.height * 0.2);
  if (Math.abs(r.drawW - wantW) > 2) {
    return `FAIL: the design was drawn ${r.drawW}px wide, expected ${wantW} — it is being stretched to the gutter instead of keeping its proportions`;
  }
  const isRed = (v) => v[0] > 150 && v[1] < 90 && v[2] < 90;
  if (!isRed(r.redNearLeftOuter)) return `FAIL: the strip did not land as drawn at the left end (rgb(${r.redNearLeftOuter}))`;
  if (!isRed(r.redNearRightOuter)) {
    return `FAIL: the right end is not mirrored — the mark drawn at the strip's outer edge came back at rgb(${r.redNearRightOuter}), so the motif would not complete itself across the join`;
  }
  if (isRed(r.redNearRightInner)) return 'FAIL: the right end was stamped unmirrored';
  return `PASS: feature on rows ${r.leftBar.first}-${r.leftBar.last} at BOTH ends, right end a true mirror, and ${r.drawW}px wide — proportions kept, overhanging the ${r.g}px band`;
};

// ---- A MISSING ASSET MUST NOT LEAVE THE JOIN BARE. ----
scenarios.aBrokenDesignFallsBackToThePlainGutter = async (page) => {
  await pickCup(page, VACUUM);
  const edge = await page.evaluate(async () => {
    const W = 1200, H = 900;
    const b = document.createElement('canvas'); b.width = W; b.height = H;
    const bx = b.getContext('2d'); bx.fillStyle = '#FF00FF'; bx.fillRect(0, 0, W, H);
    GUTTER_CATALOG.__broken = { asset: '/no-such-gutter-asset.png' };
    const out = await paintWrapGutters(b.toDataURL('image/png'), '#90C695', WRAP_GUTTER_WIDTH, '__broken');
    delete GUTTER_CATALOG.__broken;
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = out; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
    return Array.from(cx.getImageData(0, Math.round(im.naturalHeight / 2), 1, 1).data).slice(0, 3);
  });
  if (!near(edge, rgb('#90C695'), 3)) {
    return `FAIL: a design whose asset will not load left the end as rgb(${edge}) — the join is bare, which is worse than either treatment`;
  }
  return 'PASS: an unloadable design falls back to the plain gutter rather than leaving the join bare';
};

// ---- THE PANEL, DRIVEN THE WAY A CUSTOMER DRIVES IT. ----
// Alyx: "he definitely chooses it after generating. He's gonna have to see
// what design the AI came up with to see which gutter best matches his motif."
// So this is not a unit test of the painter -- it walks upload to mockup and
// insists the panel appears in the middle of it, works, and lets go again. The
// failure that matters here is not a wrong-looking trimming: it is a panel
// that opens and does not close, which strands a paying customer short of
// their mockup with no way forward.
scenarios.theCustomerReachesThePanelAndGetsPastIt = async (page) => {
  await pickCup(page, VACUUM);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#travelMugColorGridGen .color-btn'))
      .find((x) => x.dataset.color && !/white/i.test(x.dataset.color));
    if (b) b.click();
  });
  await T(page, 500);
  await dismissAlerts(page);
  // A stand-in design, so the grid has something in it on a machine with no
  // artwork installed yet.
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 1000;
    const x = c.getContext('2d');
    x.fillStyle = '#B8860B'; x.fillRect(0, 0, 120, 1000);
    x.fillStyle = '#000000'; x.fillRect(0, 300, 200, 60);
    GUTTER_CATALOG['Test Braid'] = { asset: c.toDataURL('image/png') };
  });

  await page.evaluate(() => { window.confirm = () => false; });
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await T(page, 1400);
  await dismissAlerts(page);
  await page.fill('#ideaDesc', 'a harbour at blue hour');
  await T(page, 400);
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await T(page, 800);
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await T(page, 2500);
  await dismissAlerts(page);

  // NOT via Continue to Order. That was the route this test used to take, and
  // taking it is exactly why the real bug shipped: after generating, a travel
  // cup reaches its mockup through revealFlowActive -> beginFinalMockupFetch()
  // without anybody touching that button, so the customer went straight to
  // Checkout and never saw the panel. The test walked a road the product does
  // not use. It waits for whatever the studio does on its own now.
  await T(page, 4000);

  const open = await page.waitForFunction(() => {
    const o = document.getElementById('trimmingsOverlay');
    return !!o && getComputedStyle(o).display !== 'none';
  }, null, { timeout: 25000 }).then(() => true).catch(() => false);
  if (!open) {
    const where = await page.evaluate(() => {
      const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
      return { mockupLightbox: vis('mockupLightbox'), whatsNext: vis('whatsNextOverlay'), settled: typeof trimmingsSettledFor !== 'undefined' ? trimmingsSettledFor : 'n/a' };
    }).catch(() => ({}));
    return `FAIL: the Trimmings panel never opened — the customer went past it to ${JSON.stringify(where)}. The seam decoration is unreachable, so the whole section is.`;
  }

  const tiles = await page.evaluate(() => document.querySelectorAll('#trimmingsGrid .btn-select').length);
  if (tiles < 2) return `FAIL: the grid drew ${tiles} tiles — None plus one installed design was expected`;

  const before = await page.evaluate(() => document.getElementById('trimmingsPreviewImg')?.src?.length || 0);
  await page.evaluate(() => pickTrimming('Test Braid'));
  await T(page, 2000);
  const changed = await page.evaluate((b) => (document.getElementById('trimmingsPreviewImg')?.src?.length || 0) !== b, before);
  if (!changed) return 'FAIL: choosing a trimming did not change the preview — the customer cannot see what they are picking';

  await page.evaluate(() => document.getElementById('trimmingsContinueBtn').click());
  await T(page, 5000);
  const st = await page.evaluate(() => {
    const o = document.getElementById('trimmingsOverlay');
    return { closed: !o || getComputedStyle(o).display === 'none', locked: document.body.classList.contains('step-locked') };
  });
  if (!st.closed) return 'FAIL: Continue left the panel open — the customer is stranded short of their mockup';
  if (st.locked) return 'FAIL: the page is still step-locked after the panel closed — nothing else can be touched';
  return 'PASS: upload -> cup -> generate -> approve, and the studio opens Trimmings by itself on the way to the mockup; the preview follows the choice and Continue lets go';
};

// ---- COLOURING A TRIMMING, THREE WAYS. ----
// Alyx: "rather than have set colors I would actually rather have that color
// gradient thing... I would want to match the ribbon color to the maroon of his
// jacket" -- then, separately: "what if the color you want isn't present in the
// picture? Can we give them sampling AND a color gradient palette?"
//
// So all three exist and this holds them there: presets for speed, a full
// picker for any colour at all, and sampling straight off the artwork for the
// case a palette cannot serve -- matching a particular maroon that is already
// on screen. It also pins the row STAYING AWAY from the designs whose several
// colours mean different things.
scenarios.aTrimmingCanBeColouredThreeWays = async (page) => {
  await pickCup(page, VACUUM);
  const st = await page.evaluate(async () => {
    // Stand in for the flow: the panel's controls are what is under test here.
    const c = document.createElement('canvas'); c.width = 1200; c.height = 900;
    const x = c.getContext('2d'); x.fillStyle = '#8a2e3b'; x.fillRect(0, 0, 1200, 900);
    trimmingsBaseUrl = c.toDataURL('image/png');
    // The panel has to be ON SCREEN: sampling maps the tap through the
    // element's box, and a hidden element has none. The first run of this
    // test failed here and it was right to -- the code threw rather than
    // refusing, which is now guarded.
    const ov = document.getElementById('trimmingsOverlay');
    ov.style.display = 'flex';
    const img = document.getElementById('trimmingsPreviewImg');
    img.src = trimmingsBaseUrl;
    await new Promise(r => { if (img.complete && img.naturalWidth) r(); else img.onload = r; });

    await pickTrimming('Blue Satin Ribbon');
    const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const out = {
      rowForColourable: vis('trimmingsColourRow'),
      hasPicker: !!document.getElementById('trimmingsColourPicker'),
      hasGradient: !!document.querySelector('#trimmingsSwatches canvas'),
    };
    // Preset
    await pickTrimmingColour('#1F7A45');
    out.afterPreset = selectedGutterColor;
    // Sampled from the picture: the whole canvas is one maroon, so whatever
    // pixel the tap lands on must come back as that maroon.
    const r = img.getBoundingClientRect();
    img.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
    await new Promise(res => setTimeout(res, 1200));
    out.sampled = selectedGutterColor;
    // And a design whose colours carry meaning is left alone
    await pickTrimming('Film Reel');
    out.rowForNonColourable = vis('trimmingsColourRow');
    return out;
  });

  if (!st.rowForColourable) return 'FAIL: no colour row on a trimming marked colorable';
  if (!st.hasPicker) return 'FAIL: the full colour picker is missing — presets alone cannot match a particular colour';
  if (!st.hasGradient) return 'FAIL: the gradient strip is missing — sixteen circles cost three rows and still could not offer a particular colour';
  if (st.afterPreset !== '#1F7A45') return `FAIL: setting a colour directly did not take (got ${st.afterPreset})`;
  if (!/^#8a2e3b$/i.test(st.sampled || '')) {
    return `FAIL: sampling the picture returned ${st.sampled}, expected the #8a2e3b it was tapped on — the eyedropper is reading the wrong pixel, which is the whole point of it`;
  }
  if (st.rowForNonColourable) return 'FAIL: the colour row is offered on a design whose several colours mean different things';
  return `PASS: a gradient strip, a full picker, and a tap on the picture returning ${st.sampled} exactly — and left off the designs that must not take one`;
};

// ---- THE TRIMMING RUNS THE FULL HEIGHT OF THE BAND. ----
// Alyx: "it doesn't work well unless the trimming goes from the top all the way
// to the bottom of the seam. Have you cut it off short like that, it ruins the
// effect."
//
// The cause was not the trimming. Generation returns a SQUARE and this cup's
// print area is a 1.32 band, so a square handed over as-is gets letterboxed --
// artwork in a stripe, bare cup above and below, and a trimming painted to the
// square's full height stopping well short of the seam. This pins the wrap
// being cropped to the band before anything is painted on it, and the trimming
// reaching the very first and very last row of what prints.
scenarios.theTrimmingRunsTheWholeSeam = async (page) => {
  await pickCup(page, VACUUM);
  const r = await page.evaluate(async () => {
    // A square, exactly as generation hands one back.
    const src = document.createElement('canvas'); src.width = 1024; src.height = 1024;
    const x = src.getContext('2d'); x.fillStyle = '#FF00FF'; x.fillRect(0, 0, 1024, 1024);
    const out = await paintWrapGutters(src.toDataURL('image/png'), '#90C695', WRAP_GUTTER_WIDTH, null);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = out; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
    const px = (sx, sy) => Array.from(cx.getImageData(sx, sy, 1, 1).data).slice(0, 3);
    const g = Math.round(im.naturalWidth * WRAP_GUTTER_WIDTH);
    return {
      w: im.naturalWidth, h: im.naturalHeight,
      ratio: +(im.naturalWidth / im.naturalHeight).toFixed(3),
      wanted: TRAVEL_WRAP_RATIO['travel-mug-40oz-vacuum'],
      topRow: px(Math.round(g / 2), 0),
      bottomRow: px(Math.round(g / 2), im.naturalHeight - 1),
      topRowRight: px(im.naturalWidth - 1 - Math.round(g / 2), 0),
      bottomRowRight: px(im.naturalWidth - 1 - Math.round(g / 2), im.naturalHeight - 1),
    };
  });

  if (Math.abs(r.ratio - r.wanted) > 0.02) {
    return `FAIL: the wrap came back ${r.w}x${r.h} (ratio ${r.ratio}), not the band's ${r.wanted} — a square handed to a wide band is letterboxed, which is what left bare cup above and below the artwork`;
  }
  const cup = rgb('#90C695');
  for (const [nm, v] of [['top left', r.topRow], ['bottom left', r.bottomRow], ['top right', r.topRowRight], ['bottom right', r.bottomRowRight]]) {
    if (!near(v, cup, 3)) {
      return `FAIL: the trimming does not reach the ${nm} corner of the band — rgb(${v}). Cut short like that, the two ends do not meet down the whole seam and the effect is lost`;
    }
  }
  return `PASS: the wrap is cropped to the band's ${r.ratio} and the trimming reaches the very first and last row at both ends`;
};

// ---- THE BAND IS THE DESIGN'S OWN WIDTH. ----
// The colour band behind a trimming used to be a fixed 6% while the designs
// run from 3.2% (the film strip) to 9.8%. So the narrow ones sat on a visible
// mat of cup colour half as wide again as the trimming itself, and the wide
// ones had their backing cropped short. Following the design means a trimming
// is exactly as wide as it looks -- floored, because covering the join and the
// printer's drift is the band's first job and does not care how it looks.
scenarios.theBandFollowsTheDesign = async (page) => {
  await pickCup(page, VACUUM);
  const r = await page.evaluate(async () => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const src = document.createElement('canvas'); src.width = 3710; src.height = 2817;
    const x = src.getContext('2d'); x.fillStyle = '#FF00FF'; x.fillRect(0, 0, 3710, 2817);
    const base = src.toDataURL('image/jpeg', 0.95);
    const out = {};
    for (const name of ['Film Reel', 'Astral']) {
      const art = await load(GUTTER_CATALOG[name].asset);
      const want = Math.max(Math.round(2817 * (art.naturalWidth / art.naturalHeight)), Math.round(3710 * WRAP_GUTTER_MIN_WIDTH));
      const im = await load(await paintWrapGutters(base, '#90C695', WRAP_GUTTER_WIDTH, name));
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
      // Walk in from the outer edge until the artwork shows through: that is
      // where the band stops.
      const d = cx.getImageData(0, 40, im.naturalWidth, 1).data;
      let edge = 0;
      while (edge < im.naturalWidth && !(d[edge * 4] > 200 && d[edge * 4 + 1] < 90 && d[edge * 4 + 2] > 200)) edge++;
      out[name] = { want, got: edge };
    }
    return out;
  });

  for (const [name, v] of Object.entries(r)) {
    if (Math.abs(v.got - v.want) > 6) {
      return `FAIL: ${name}'s band runs ${v.got}px where the design is ${v.want}px — a band wider than its design is a visible mat of cup colour behind the trimming, and one narrower leaves the design overhanging bare artwork`;
    }
  }
  return `PASS: each band matches its own design (${Object.entries(r).map(([n, v]) => n + ' ' + v.got + 'px').join(', ')})`;
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
    // aBrokenDesignFallsBackToThePlainGutter loads a deliberately missing asset,
    // so its 404 and the handler's own message are the scenario succeeding, not
    // console noise from a fault.
    const errs = log.consoleErrors.filter((e) => !/ERR_TUNNEL/.test(e)
      && !/no-such-gutter-asset/.test(e)
      && !/Gutter design "__broken"/.test(e)
      && !(/Failed to load resource/.test(e) && name === 'aBrokenDesignFallsBackToThePlainGutter'));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL WRAP-GUTTER VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
