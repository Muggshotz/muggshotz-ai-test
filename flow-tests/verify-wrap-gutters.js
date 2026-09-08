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
scenarios.itReplacesTheFadeButNeverOverridesAChoice = async (page) => {
  const src = await page.evaluate(async () => (await fetch('/needles-studio.html')).text());
  // Anchor on the gutter's own call site, not on skipEdgeFade -- there are four
  // skipEdgeFade branches in this file and indexOf found the wrong one.
  const m = src.match(/\}\s*else if\(wrapWantsGutters\(\)\)\s*\{/);
  if (!m) {
    if (!/wrapWantsGutters\(\)/.test(src)) return 'FAIL: the gutter is not wired into the generation path at all';
    return 'FAIL: the gutter is not the else-branch of the fade — either both run, or the gutter runs first and a customer who asked for Fade Edges silently gets two hard strips';
  }
  const before = src.slice(Math.max(0, m.index - 400), m.index);
  if (!/skipEdgeFade/.test(before)) {
    return 'FAIL: the gutter is an else-branch of something other than skipEdgeFade';
  }
  return 'PASS: exclusive with the fade, and second — so an explicit fade choice is honoured ahead of the gutter';
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
    const errs = log.consoleErrors.filter((e) => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL WRAP-GUTTER VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
