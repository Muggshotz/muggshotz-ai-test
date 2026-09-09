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
// The panel now spins the real 3D cup, so every scenario that opens it needs a
// software GL in this headless sandbox -- the same one verify-mug-3d uses.
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];

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
    // Its 1:25 keeps it under WRAP_GUTTER_MAX_WIDTH at the wrap's full height,
    // so this measures ALIGNMENT rather than the ceiling -- the ceiling has a
    // scenario of its own.
    const A = document.createElement('canvas'); A.width = 100; A.height = 2500;
    const ax = A.getContext('2d');
    ax.fillStyle = '#DDDDDD'; ax.fillRect(0, 0, 100, 2500);
    ax.fillStyle = '#000000'; ax.fillRect(0, 750, 100, 100);
    ax.fillStyle = '#FF0000'; ax.fillRect(0, 1750, 25, 100);
    GUTTER_CATALOG.__probe = { asset: A.toDataURL('image/png') };
    const out = await paintWrapGutters(baseUrl, '#90C695', WRAP_GUTTER_WIDTH, '__probe');
    delete GUTTER_CATALOG.__probe;

    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = out; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
    const g = Math.round(im.naturalWidth * WRAP_GUTTER_WIDTH);
    const drawW = Math.round(H * (100 / 2500));
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
      drawW: Math.round(im.naturalHeight * (100 / 2500)),
      redNearLeftOuter:  px(2, redY),
      redNearRightOuter: px(im.naturalWidth - 3, redY),
      redNearRightInner: px(im.naturalWidth - Math.round(im.naturalHeight * 0.04) + 3, redY),
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
  // Aspect must be preserved, never squeezed to fit: a 1:25 asset on a
  // 2817-tall wrap occupies 113px, which is under the ceiling.
  const wantW = Math.round(r.height * 0.04);
  if (Math.abs(r.drawW - wantW) > 2) {
    return `FAIL: the design was drawn ${r.drawW}px wide, expected ${wantW} — it is being stretched to the gutter instead of keeping its proportions`;
  }
  const isRed = (v) => v[0] > 150 && v[1] < 90 && v[2] < 90;
  if (!isRed(r.redNearLeftOuter)) return `FAIL: the strip did not land as drawn at the left end (rgb(${r.redNearLeftOuter}))`;
  if (!isRed(r.redNearRightOuter)) {
    return `FAIL: the right end is not mirrored — the mark drawn at the strip's outer edge came back at rgb(${r.redNearRightOuter}), so the motif would not complete itself across the join`;
  }
  if (isRed(r.redNearRightInner)) return 'FAIL: the right end was stamped unmirrored';
  return `PASS: feature on rows ${r.leftBar.first}-${r.leftBar.last} at BOTH ends, right end a true mirror, and ${r.drawW}px wide — proportions kept`;
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

// ---- THE CUP WEARS IT THE MOMENT YOU TAP IT. ----
// Alyx: "why can't we apply the trimmings directly to the spinning mockup? By
// clicking on the trimming we want it gets applied directly to the mockup that
// we're watching in real time" -- and then the consequence: "you wouldn't even
// need as comprehensive an explanation, because all they do is click on a
// trimming and they immediately see what it does."
//
// So the explanation IS the interaction, and this pins the interaction:
//   * the real 3D cup is running inside the panel, not a picture of one;
//   * a tap repaints it, with the wrap that trimming actually makes;
//   * NO THANKS IS THE COMPARISON -- it puts the bare join back, so the
//     before-and-after is live and the customer works it themselves;
//   * the cup is let go of on the way out. MUG3D is a singleton, and leaving
//     it mounted here sends the mockup's own open() past its build and leaves
//     it rendering into a hidden div -- a blank mockup, from a panel that
//     looked like it worked.
scenarios.theCupWearsItTheMomentYouTapIt = async (page) => {
  await pickCup(page, VACUUM);
  await T(page, 300);
  await dismissAlerts(page);

  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 776;
    const x = c.getContext('2d');
    x.fillStyle = '#7a2b2b'; x.fillRect(0, 0, 1024, 776);
    x.fillStyle = '#e8c56a'; x.fillRect(400, 100, 224, 576);
    resultUrl = c.toDataURL('image/png'); finalImageUrl = null;
    trimmingsSettledFor = null; trimmingsBakedTo = null; trimmingsBakedFrom = null;

    // Watch what the cup is actually handed, rather than trusting that it was.
    const seen = [];
    const real = MUG3D.setArtwork;
    MUG3D.setArtwork = function (u) { seen.push(u); return real.call(MUG3D, u); };

    await openTrimmingsPanel();
    await new Promise((s) => setTimeout(s, 2500));

    const stage = document.getElementById('trimmings3DStage');
    const canvas = stage ? stage.querySelector('canvas') : null;
    const live = {
      mounted: MUG3D.mounted(),
      canvas: !!canvas && canvas.width > 4 && canvas.height > 4,
      onScreen: !!stage && getComputedStyle(stage).display !== 'none'
    };

    seen.length = 0;
    await pickTrimming('Rope');
    await new Promise((s) => setTimeout(s, 1500));
    const afterTrim = seen.slice();

    seen.length = 0;
    await pickTrimming(null);
    await new Promise((s) => setTimeout(s, 1500));
    const afterNone = seen.slice();

    // And the cup is handed back before the mockup asks for it.
    closeTrimmings3D();
    const releasedMounted = MUG3D.mounted();

    MUG3D.setArtwork = real;
    document.getElementById('trimmingsOverlay').style.display = 'none';
    document.body.classList.remove('step-locked');
    return {
      live, releasedMounted,
      trimPaints: afterTrim.length, nonePaints: afterNone.length,
      differ: afterTrim.length > 0 && afterNone.length > 0 && afterTrim[afterTrim.length - 1] !== afterNone[afterNone.length - 1],
      trimBytes: afterTrim.length ? afterTrim[afterTrim.length - 1].length : 0
    };
  });

  if (!r.live.onScreen) return 'FAIL: the 3D stage is not on screen in the panel — the cup never started, so there is nothing to try a trimming on';
  if (!r.live.mounted) return 'FAIL: MUG3D is not mounted inside the Trimmings panel';
  if (!r.live.canvas) return 'FAIL: the panel has a 3D stage but no rendered canvas in it';
  if (r.trimPaints < 1) return 'FAIL: tapping a trimming did not repaint the cup — the customer taps and nothing on the cup changes';
  if (r.nonePaints < 1) return 'FAIL: No Thanks did not repaint the cup, so the bare join never comes back and there is no comparison to make';
  if (!r.differ) return 'FAIL: the wrap handed to the cup was identical with and without a trimming — the cup shows the same thing either way';
  if (r.releasedMounted) return 'FAIL: the panel kept hold of MUG3D on the way out — the mockup would render into a hidden div and come up blank';

  return `PASS: the real cup runs inside the panel and is repainted on every tap (${r.trimBytes} bytes of wrap for Rope), No Thanks puts the bare join back so the comparison is live, and the cup is released on the way out`;
};

// ---- THE SAME THING AGAIN, THROUGH THE REAL BAKE, IN PIXELS. ----
// Alyx, seeing it happen on the live site: "I went to switch gutters, and it
// kept the old one there and put the new one on top of it. You have to make
// sure that it's a replacement when you click on a different option, not just a
// pile over."
//
// The scenario above proves the panel goes back to the right BASE. This one
// refuses to take that as proof of the outcome: it bakes for real, comes back
// the way a customer comes back, bakes again, and then LOOKS at the wrap. A
// wide trim followed by a narrow one is the giveaway -- if the second was
// painted over the first, the strip left of the narrow one is still the wide
// one's colour instead of the photograph.
//
// It needs an upload stub that hands back what it was given (echoUploads),
// because a stub that returns a fixed URL whatever you post cannot express
// this bug at all -- which is why the suite did not catch it the first time.
scenarios.aSecondChoiceIsNotPaintedOverTheFirst = async (page) => {
  await pickCup(page, VACUUM);
  await T(page, 300);
  await dismissAlerts(page);

  const r = await page.evaluate(async () => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    // Magenta stands for "the customer's photograph": anywhere it shows through
    // is somewhere no trimming is painted.
    const c = document.createElement('canvas'); c.width = 3710; c.height = 2817;
    const x = c.getContext('2d'); x.fillStyle = '#FF00FF'; x.fillRect(0, 0, 3710, 2817);
    resultUrl = c.toDataURL('image/jpeg', 0.95); finalImageUrl = null;
    trimmingsSettledFor = null; trimmingsBakedTo = null; trimmingsBakedFrom = null;
    // This scenario drives the bake directly rather than walking the whole
    // journey, so it has to stand the cup up itself: Continue hands on to the
    // mockup request, and that reads the SETTLED product key, which only the
    // full journey would have written.
    selectedTravelProductKey = 'travel-mug-40oz-vacuum';

    // A deliberately wide first choice and a deliberately narrow second, both
    // solid, so the region between them is unambiguous.
    const strip = (w, h, fill) => { const s = document.createElement('canvas'); s.width = w; s.height = h; const g = s.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, w, h); return s.toDataURL('image/png'); };
    GUTTER_CATALOG.__wide = { asset: strip(200, 2817, '#1133FF') };   // blue, at the ceiling
    GUTTER_CATALOG.__narrow = { asset: strip(40, 2817, '#FFCC00') };  // gold, well under it

    // First pass, exactly as a customer drives it.
    await openTrimmingsPanel();
    await new Promise((s) => setTimeout(s, 1500));
    await pickTrimming('__wide');
    await new Promise((s) => setTimeout(s, 800));
    await confirmTrimmingAndContinue();
    await new Promise((s) => setTimeout(s, 2500));
    const afterFirst = finalImageUrl;

    // ...and back again, the way Change Trimming brings them back.
    trimmingsSettledFor = null;
    await openTrimmingsPanel();
    await new Promise((s) => setTimeout(s, 1500));
    await pickTrimming('__narrow');
    await new Promise((s) => setTimeout(s, 800));
    await confirmTrimmingAndContinue();
    await new Promise((s) => setTimeout(s, 2500));
    const afterSecond = finalImageUrl;

    const im = await load(afterSecond);
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    const at = (px) => Array.from(g.getImageData(px < 0 ? im.naturalWidth + px : px, Math.round(im.naturalHeight / 2), 1, 1).data).slice(0, 3);
    const narrowW = Math.round(im.naturalHeight * (40 / 2817));
    const wideW = Math.min(Math.round(im.naturalHeight * (200 / 2817)), Math.round(im.naturalWidth * WRAP_GUTTER_MAX_WIDTH));

    delete GUTTER_CATALOG.__wide; delete GUTTER_CATALOG.__narrow;
    closeTrimmings3D();
    document.body.classList.remove('step-locked');
    return {
      baked: afterFirst !== afterSecond && !!afterSecond,
      narrowW, wideW,
      insideNarrow: at(Math.round(narrowW / 2)),
      betweenLeft: at(Math.round((narrowW + wideW) / 2)),
      betweenRight: at(-Math.round((narrowW + wideW) / 2)),
      deepInside: at(Math.round(im.naturalWidth / 2))
    };
  });

  if (!r.baked) return 'FAIL: the second bake produced nothing, or the same file as the first — the round trip never happened, so this measures nothing';
  const near = (v, want) => Math.abs(v[0] - want[0]) + Math.abs(v[1] - want[1]) + Math.abs(v[2] - want[2]) < 110;
  const GOLD = [255, 204, 0], BLUE = [17, 51, 255], ART = [255, 0, 255];
  if (!near(r.insideNarrow, GOLD)) return `FAIL: the second trimming is not on the seam — rgb(${r.insideNarrow}) at ${Math.round(r.narrowW / 2)}px in`;
  if (near(r.betweenLeft, BLUE) || near(r.betweenRight, BLUE)) {
    return `FAIL: the FIRST trimming is still there behind the second — left rgb(${r.betweenLeft}), right rgb(${r.betweenRight}) between ${r.narrowW}px and ${r.wideW}px. That is the pile-over: the new choice was painted on top of the old one instead of replacing it`;
  }
  if (!near(r.betweenLeft, ART) || !near(r.betweenRight, ART)) {
    return `FAIL: neither the old trimming nor the photograph is between ${r.narrowW}px and ${r.wideW}px — left rgb(${r.betweenLeft}), right rgb(${r.betweenRight})`;
  }
  if (!near(r.deepInside, ART)) return `FAIL: the middle of the picture is rgb(${r.deepInside}), not the artwork — something painted over the whole wrap`;

  return `PASS: baked a ${r.wideW}px trim, came back, baked a ${r.narrowW}px one, and the wrap that ships carries ONLY the second — the photograph is back at both ends where the first one used to be`;
};

// ---- CHANGING YOUR MIND REPLACES THE TRIMMING, IT DOES NOT ADD ONE. ----
// Baking a trimming replaces finalImageUrl with the trimmed upload, and the
// panel takes its base from finalImageUrl -- so Back from the mockup handed the
// painter a picture that already had a trimming on it and painted a second one
// over the first. Every single step looked right, which is why this needs a
// test rather than an eye: the fault is only visible after the round trip.
scenarios.changingYourMindReplacesTheTrimming = async (page) => {
  await pickCup(page, VACUUM);
  await T(page, 300);
  await dismissAlerts(page);

  const r = await page.evaluate(async () => {
    const paint = (fill) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 388;
      const x = c.getContext('2d'); x.fillStyle = fill; x.fillRect(0, 0, 512, 388);
      return c.toDataURL('image/png');
    };
    const original = paint('#FF0000');
    const baked = paint('#00FF00');   // stands in for the trimmed upload

    // The state the studio is in after a bake, then a Back from the mockup.
    trimmingsBakedFrom = original;
    trimmingsBakedTo = baked;
    trimmingsBakedChoice = 'Rope';
    trimmingsBakedColour = '#8a2e3b';
    finalImageUrl = baked; resultUrl = original;
    trimmingsSettledFor = null;

    await openTrimmingsPanel();
    await new Promise((s) => setTimeout(s, 1200));
    const state = {
      base: trimmingsBaseUrl === original ? 'original' : (trimmingsBaseUrl === baked ? 'baked' : 'other'),
      choice: selectedGutter,
      colour: selectedGutterColor
    };

    // And a genuinely new picture is treated as new: no restoration, no choice
    // carried over from somebody else's artwork.
    const fresh = paint('#0000FF');
    finalImageUrl = fresh; trimmingsSettledFor = null;
    document.getElementById('trimmingsOverlay').style.display = 'none';
    await openTrimmingsPanel();
    await new Promise((s) => setTimeout(s, 800));
    const onFresh = { base: trimmingsBaseUrl === fresh ? 'fresh' : 'wrong', choice: selectedGutter };
    closeTrimmings3D();
    document.getElementById('trimmingsOverlay').style.display = 'none';
    document.body.classList.remove('step-locked');
    return { state, onFresh };
  });

  if (r.state.base !== 'original') {
    return `FAIL: coming back to the panel took its base from the ${r.state.base} picture — a second trimming would be painted on top of the first`;
  }
  if (r.state.choice !== 'Rope') return `FAIL: the trimming already chosen came back as ${JSON.stringify(r.state.choice)} — the panel forgot what it was left on`;
  if (r.state.colour !== '#8a2e3b') return `FAIL: the colour came back as ${JSON.stringify(r.state.colour)} rather than the one that was baked`;
  if (r.onFresh.base !== 'fresh') return 'FAIL: a brand new picture was not used as its own base';
  if (r.onFresh.choice !== null) return `FAIL: a brand new picture arrived with ${JSON.stringify(r.onFresh.choice)} already chosen — a decision nobody made about artwork they have not seen`;

  return 'PASS: Back from the mockup re-opens on the UNTRIMMED original with the previous choice and colour intact, so a change of mind replaces the trimming; a new picture starts clean';
};

// ---- THE PICTURE AND THE TWELVE, TOGETHER. ----
// Alyx: "there's gotta be some way to recompose this so that you can look at
// all of the available trimmings, and the image it would go on to,
// simultaneously as you're applying different options. Just like everything
// before."
//
// Stacked, the preview sat above twelve tiles: reaching the tiles pushed the
// picture off the top, so the customer was choosing a trimming for something
// they could no longer see -- which is the one thing this panel exists to let
// them do. Two shapes keep the promise and this pins both, because a fix that
// only works on a desktop is not a fix for a shop most people reach on a phone:
//   * with room, two columns and nothing scrolls at all;
//   * without room, the picture sticks to the top and the tiles pass under it.
scenarios.theWholeChoiceIsOnScreenAtOnce = async (page) => {
  await pickCup(page, VACUUM);
  await T(page, 300);
  await dismissAlerts(page);

  const seed = async () => page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 776;
    const x = c.getContext('2d');
    x.fillStyle = '#7a2b2b'; x.fillRect(0, 0, 1024, 776);
    x.fillStyle = '#e8c56a'; x.fillRect(400, 100, 224, 576);
    resultUrl = c.toDataURL('image/png'); finalImageUrl = null;
    trimmingsSettledFor = null;
    trimmingsBakedTo = null; trimmingsBakedFrom = null;
    await openTrimmingsPanel();
    await new Promise((s) => setTimeout(s, 2500));
  });

  const measure = () => page.evaluate(() => {
    const card = document.getElementById('trimmingsCard');
    const tiles = document.querySelectorAll('#trimmingsGrid .btn-select');
    const onScreen = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top >= -2 && r.bottom <= window.innerHeight + 2;
    };
    return {
      tiles: tiles.length,
      overflow: card.scrollHeight - card.clientHeight,
      preview: onScreen(document.getElementById('trimmings3DStage')),
      lastTile: onScreen(tiles[tiles.length - 1]),
      continue: onScreen(document.getElementById('trimmingsContinueBtn')),
      twoCol: getComputedStyle(document.getElementById('trimmingsBody')).display === 'flex'
    };
  });

  // --- With room on the screen. ---
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed();
  const wide = await measure();
  if (wide.tiles < 12) return `FAIL: the grid drew ${wide.tiles} tiles — the twelve trimmings are not all installed, so this measures nothing`;
  if (!wide.twoCol) return 'FAIL: at 1280px the panel is still stacked in one column';
  if (wide.overflow > 4) return `FAIL: the panel still scrolls by ${wide.overflow}px at 1280x900 — something is off the bottom`;
  if (!wide.preview || !wide.lastTile || !wide.continue) {
    return `FAIL: at 1280x900 not everything is on screen together — cup ${wide.preview}, last tile ${wide.lastTile}, Continue ${wide.continue}`;
  }

  // --- On a phone, where two columns will not fit. ---
  await page.setViewportSize({ width: 390, height: 844 });
  await seed();
  await page.evaluate(() => { const c = document.getElementById('trimmingsCard'); c.scrollTop = c.scrollHeight; });
  await T(page, 500);
  const phone = await page.evaluate(() => {
    const card = document.getElementById('trimmingsCard');
    const img = document.getElementById('trimmings3DStage');
    const tiles = document.querySelectorAll('#trimmingsGrid .btn-select');
    const r = img.getBoundingClientRect();
    const last = tiles[tiles.length - 1].getBoundingClientRect();
    return {
      stacked: getComputedStyle(document.getElementById('trimmingsBody')).display !== 'flex',
      scrolled: card.scrollTop,
      previewVisible: r.height > 4 && r.bottom > 0 && r.top < window.innerHeight,
      lastTileVisible: last.height > 4 && last.bottom > 0 && last.top < window.innerHeight
    };
  });
  if (!phone.stacked) return 'FAIL: two columns were forced onto a 390px phone';
  if (phone.scrolled < 20) return `FAIL: the phone panel did not scroll (${phone.scrolled}px) — this measures nothing`;
  if (!phone.previewVisible) return 'FAIL: on a phone the cup left the screen as soon as the tiles were scrolled to — the customer chooses a trimming for something they cannot see';
  if (!phone.lastTileVisible) return 'FAIL: the last tile was not reachable on a phone';

  return `PASS: at 1280x900 the cup, all ${wide.tiles} trimmings and Continue are on screen together with nothing scrolling; on a 390px phone the cup sticks to the top and the tiles pass under it`;
};

// ---- THE PICTURE SHOWS THROUGH THE OPENWORK, AND THE JOIN STILL DOES NOT. ----
// Alyx, on a phone: "the problem with how they come together is the black
// background bleeds through, and that should be an alpha."
//
// The assets DO have alpha -- measured -- and transparent black cannot bleed,
// because canvas and GL both filter premultiplied. The black was the CUP, and
// the backing band was putting it there: the band ran the design's whole width,
// so every hole in an openwork trimming showed cup colour, and on a black cup
// that is a black-filled lace.
//
// The band exists for one reason: a hole falling over the SEAM would show the
// two mismatched ends of the picture through it. The seam is the extreme outer
// edge, so only the outermost sliver has to be solid. This holds both halves,
// because getting either wrong is worse than the fault it replaced:
//   * the outer sliver is still completely solid at BOTH ends, top to bottom --
//     the join stays hidden, which is the whole reason a gutter works;
//   * and beyond it the customer's own picture really does show through the
//     gaps, which is what an openwork trim does in life.
scenarios.theOpenworkShowsThePictureNotTheCup = async (page) => {
  await pickCup(page, VACUUM);
  const r = await page.evaluate(async () => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const W = 3710, H = 2817;
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const bx = base.getContext('2d'); bx.fillStyle = '#FF00FF'; bx.fillRect(0, 0, W, H);
    const baseUrl = base.toDataURL('image/jpeg', 0.95);
    const band = Math.round(W * WRAP_GUTTER_MIN_WIDTH);
    const out = {};
    // A BLACK cup, which is the one he was holding, and the three most open
    // designs in the catalogue.
    for (const name of ['Doily', 'Soft Country', 'Ivy Vine']) {
      const im = await load(await paintWrapGutters(baseUrl, '#000000', WRAP_GUTTER_WIDTH, name));
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const isArt = (x, y) => { const i = (y * c.width + x) * 4; return d[i] > 170 && d[i + 1] < 110 && d[i + 2] > 170; };

      let leaks = 0;
      for (let y = 0; y < c.height; y += 3) {
        for (let x = 0; x < band; x += 2) { if (isArt(x, y)) leaks++; if (isArt(c.width - 1 - x, y)) leaks++; }
      }
      const art = await load(GUTTER_CATALOG[name].asset);
      const span = Math.min(Math.round(c.height * (art.naturalWidth / art.naturalHeight)), Math.round(c.width * WRAP_GUTTER_MAX_WIDTH));
      let through = 0, looked = 0;
      for (let y = 0; y < c.height; y += 3) {
        for (let x = band + 4; x < span; x += 2) { looked++; if (isArt(x, y)) through++; }
      }
      out[name] = { band, span, leaks, through, looked, pct: looked ? +(100 * through / looked).toFixed(1) : 0 };
    }
    return out;
  });

  for (const [name, v] of Object.entries(r)) {
    if (v.leaks) return `FAIL: ${name} lets the picture through the outermost ${v.band}px at ${v.leaks} places — that sliver sits ON the join, and the two mismatched ends would show through it`;
    if (v.looked < 100) return `FAIL: ${name} has no openwork to measure between ${v.band}px and ${v.span}px`;
    if (v.pct < 3) return `FAIL: ${name} shows the picture through only ${v.pct}% of its openwork — the band is still filling the gaps with cup colour, which on a black cup is a black-filled lace`;
  }
  const say = Object.entries(r).map(([n, v]) => `${n} ${v.pct}%`).join(', ');
  return `PASS: on a BLACK cup the outermost ${r.Doily.band}px stays solid at both ends so the join is still hidden, and the picture shows through the openwork beyond it (${say})`;
};

// ---- THE FLAT WRAP EARNS ITS PLACE, OR IT IS NOT THERE. ----
// Alyx: "if you have the mockup in 3D rotating above, you don't need the image
// in the middle. It doesn't really add anything -- it just shows you how the
// divided trimmings fit on the panel. You don't really care to see that; what
// you care about is how they come together."
//
// Right, and the cup answers that better than the flat wrap ever did. It stays
// only for the one thing the cup cannot do: give an HONEST colour to sample.
// The cup is lit and tone-mapped, so a colour taken off it is a shaded colour,
// and painting a ribbon with it and rendering that through the same lighting
// would shift it twice.
scenarios.theFlatWrapIsOnlyThereToPickAColour = async (page) => {
  await pickCup(page, VACUUM);
  await T(page, 300);
  await dismissAlerts(page);
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 776;
    const x = c.getContext('2d'); x.fillStyle = '#7a2b2b'; x.fillRect(0, 0, 1024, 776);
    resultUrl = c.toDataURL('image/png'); finalImageUrl = null;
    trimmingsSettledFor = null; trimmingsBakedTo = null; trimmingsBakedFrom = null;
    await openTrimmingsPanel();
    await new Promise((s) => setTimeout(s, 2500));

    const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const snap = () => ({ strip: vis('trimmingsPreviewImg'), note: vis('trimmingsSeamNote'), palette: vis('trimmingsColourRow'), cup: vis('trimmings3DStage') });

    const none = snap();
    await pickTrimming('Film Reel');          // not colourable
    await new Promise((s) => setTimeout(s, 900));
    const plain = snap();
    await pickTrimming('Blue Satin Ribbon');  // colourable
    await new Promise((s) => setTimeout(s, 900));
    const colourable = snap();
    const stripSrc = (document.getElementById('trimmingsPreviewImg') || {}).src || '';
    await pickTrimming(null);
    await new Promise((s) => setTimeout(s, 900));
    const back = snap();

    closeTrimmings3D();
    document.getElementById('trimmingsOverlay').style.display = 'none';
    document.body.classList.remove('step-locked');
    return { none, plain, colourable, back, hasStripSrc: stripSrc.length > 100 };
  });

  if (r.none.strip || r.plain.strip) return `FAIL: the flat wrap is on screen with nothing to sample (none ${r.none.strip}, Film Reel ${r.plain.strip}) — it is back to being a second picture of what the cup already shows`;
  if (!r.colourable.strip) return 'FAIL: choosing a colourable trimming did not bring the strip up — there is nothing honest left to take a colour from';
  if (!r.colourable.palette || !r.colourable.note) return `FAIL: the strip came up without the rest of the picker (palette ${r.colourable.palette}, note ${r.colourable.note})`;
  if (!r.hasStripSrc) return 'FAIL: the strip is shown but carries no picture, so sampling it would return nothing';
  if (r.back.strip) return 'FAIL: the strip stayed up after the colourable trimming was dropped';
  if (!r.none.cup || !r.plain.cup || !r.colourable.cup) return 'FAIL: the cup is not on screen throughout — it is the preview now';

  return 'PASS: the cup is the preview throughout, and the flat wrap appears only alongside the palette, as the unlit surface a colour is taken from';
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

// ---- NO TRIM EXCEEDS THE CEILING, AND NONE OF THEM STOPS SHORT. ----
// Alyx, after seeing a Tasselled Ribbon take a third of his cup: "my original
// estimate was that none of them should actually exceed 10%. It's supposed to
// be a trim, not a panel."
//
// The two ends MEET, so 10% where they meet is 5% each -- and the old rule let
// the design's own proportions set the band, which put the lace at 19.1% per
// end and 38% of the way round the cup. What this holds:
//   * every installed trimming lands at or under the ceiling;
//   * a design narrower than the ceiling is left exactly as it was -- the cap
//     is a ceiling, not a target, and the film strip must not be widened to it;
//   * the band still follows the design, so a narrow trim is not sitting on a
//     mat of cup colour;
//   * and it still runs the whole height at both ends, which is the entire
//     reason a gutter works. Narrowing that stopped short would trade one
//     visible fault for a worse one.
scenarios.noTrimExceedsTheCeiling = async (page) => {
  await pickCup(page, VACUUM);
  const r = await page.evaluate(async () => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const src = document.createElement('canvas'); src.width = 3710; src.height = 2817;
    const x = src.getContext('2d'); x.fillStyle = '#FF00FF'; x.fillRect(0, 0, 3710, 2817);
    const base = src.toDataURL('image/jpeg', 0.95);
    const ceiling = Math.round(3710 * WRAP_GUTTER_MAX_WIDTH);
    const out = {};
    for (const name of Object.keys(GUTTER_CATALOG)) {
      const art = await load(GUTTER_CATALOG[name].asset);
      const natural = Math.round(2817 * (art.naturalWidth / art.naturalHeight));
      const want = Math.max(Math.min(natural, ceiling), Math.round(3710 * WRAP_GUTTER_MIN_WIDTH));
      const im = await load(await paintWrapGutters(base, '#90C695', WRAP_GUTTER_WIDTH, name));
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
      const isArt = (d, i) => d[i] > 200 && d[i + 1] < 90 && d[i + 2] > 200;
      // THE DESIGN'S OWN EXTENT, not the band's. The band is only as wide as the
      // join now, and the picture shows through the openwork beyond it -- so
      // walking in until the artwork appears stops at the first hole rather
      // than at the edge of the trimming. The outermost column that still
      // carries any trimming at all is the honest measure.
      const row = () => {
        let last = 0;
        const lim = Math.min(im.naturalWidth >> 1, Math.round(im.naturalWidth * 0.2));
        for (let x = 0; x < lim; x++) {
          const d = cx.getImageData(x, 0, 1, im.naturalHeight).data;
          let solid = false;
          for (let y = 0; y < im.naturalHeight; y += 5) { if (!isArt(d, y * 4)) { solid = true; break; } }
          if (solid) last = x + 1;
        }
        return last;
      };
      // The very first and very last rows of the wrap, at both ends: the trim
      // has to be there, not just in the middle.
      const covered = (y) => {
        const d = cx.getImageData(0, y, im.naturalWidth, 1).data;
        const l = !isArt(d, 0), rr = !isArt(d, (im.naturalWidth - 1) * 4);
        return l && rr;
      };
      out[name] = { natural, want, got: row(), top: covered(0), bottom: covered(im.naturalHeight - 1) };
    }
    return { ceiling, out };
  });

  const over = [], wrong = [], gaps = [];
  for (const [name, v] of Object.entries(r.out)) {
    if (v.got > r.ceiling + 6) over.push(`${name} ${v.got}px`);
    if (Math.abs(v.got - v.want) > 6) wrong.push(`${name} ${v.got}px where its design is ${v.want}px`);
    if (!v.top || !v.bottom) gaps.push(`${name}${v.top ? '' : ' top'}${v.bottom ? '' : ' bottom'}`);
  }
  if (over.length) return `FAIL: over the ${r.ceiling}px ceiling — ${over.join(', ')}. A trim that wide is a panel, and two of them meeting takes a third of the cup`;
  if (wrong.length) return `FAIL: the band no longer follows its design — ${wrong.join('; ')}`;
  if (gaps.length) return `FAIL: the trim does not reach the end of the seam on ${gaps.join(', ')} — narrowing must not shorten it`;

  const film = r.out['Film Reel'], lace = r.out['Soft Country'];
  if (film && film.got > film.natural + 6) return `FAIL: Film Reel was widened from ${film.natural}px to ${film.got}px — the cap is a ceiling, not a target`;
  return `PASS: all ${Object.keys(r.out).length} trims at or under the ${r.ceiling}px ceiling (10% where they meet), each band still its own design's width, every one reaching both ends of the seam${lace ? `; Soft Country came down from ${lace.natural}px` : ''}${film ? `, Film Reel left alone at ${film.got}px` : ''}`;
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch({ chromiumArgs: GL, echoUploads: true });
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
