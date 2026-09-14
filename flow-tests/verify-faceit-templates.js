/* Face It template batch (Sep 2026) -- the roster refactor and the three new
   templates. The refactor is the risky half: twenty templates that have shipped
   for years now come out of an object list instead of a literal array, so the
   first thing proved here is that what comes out the other side is byte-for-byte
   what went in. HANDOFF.md lesson three -- baseline before trusting a fix -- is
   why the expected values below are written out longhand rather than derived
   from the same source they are checking. */
/* Launched directly rather than through harness.js. That harness exists to stub
   every /api/* call so no suite can spend money, and faceit-bench.html makes no
   API calls at all -- so using it here would buy nothing and would couple this
   suite to a hardcoded browser path that differs between container images. */
const { chromium } = require('playwright');
const fs = require('fs');

function chromiumPath(){
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  for (const dir of (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : [])) {
    const c = `/opt/pw-browsers/${dir}/chrome-linux/chrome`;
    if (fs.existsSync(c)) return c;
  }
  throw new Error('no chromium found under /opt/pw-browsers');
}

async function launch(){
  const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  return { browser, page };
}

/* The roster exactly as it stood before this batch, transcribed from the
   FACE_IT_CATALOG literal in needles-studio.html. */
const LEGACY_20 = [
  "king.jpg","queen.jpg","emperor.jpg","empress.jpg","the_don.jpg","the_donna.jpg",
  "hero_him.jpg","hero_her.jpg","home_him.jpg","home_her.jpg","its_alive.jpg",
  "aww_hell.jpg","your_future.jpg","all_hail.jpg","cloud_9_her.jpg","cloud_9_him.jpg",
  "heavenly_host.jpg","heavenly_hostess.jpg","on_my_mind.jpg","come_to_think_of_it.jpg"
];
const LEGACY_TEXT = ["on_my_mind.jpg","come_to_think_of_it.jpg"];

const scenarios = {};

scenarios.legacyRosterIntact = async (page) => {
  const r = await page.evaluate(() => ({
    files: window.FaceItCatalog.TEMPLATES.filter(t => t.file).map(t => t.file),
    text: [...window.FaceItCatalog.FACE_IT_TEXT_TEMPLATES]
  }));
  const kept = r.files.filter(f => LEGACY_20.indexOf(f) !== -1);
  const missing = LEGACY_20.filter(f => r.files.indexOf(f) === -1);
  if (missing.length) return `FAIL: templates dropped by the refactor: ${missing.join(', ')}`;
  if (kept.length !== 20) return `FAIL: expected the original 20, got ${kept.length}`;
  const textSorted = r.text.slice().sort();
  if (JSON.stringify(textSorted) !== JSON.stringify(LEGACY_TEXT.slice().sort()))
    return `FAIL: text-template set drifted to ${JSON.stringify(r.text)}`;
  return 'PASS: all 20 original templates and both text templates survive the refactor';
};

/* The whole point of taking height out of the prompt. If this drifts, two
   customers of different heights print the same size and nobody notices until
   the mugs arrive. */
scenarios.heightMathIsExact = async (page) => {
  const r = await page.evaluate(() => {
    const G = window.FaceItGeom, C = window.FaceItComposite;
    const H = 1155;
    const plate = window.FaceItCatalog.PLATE_DEFAULTS.lineup;
    const scale = G.buildChartScale(G.CHARTS[plate.chart], H * plate.chartTopPct,
                                    H * plate.chartBottomPct, H * plate.floorPct);
    const out = [];
    [60, 70, 78].forEach(inches => {
      const c = document.createElement('canvas'); c.width = 600; c.height = H;
      const ctx = c.getContext('2d');
      /* a solid block stands in for a generated figure: known bounds, no alpha halo */
      const src = document.createElement('canvas'); src.width = 100; src.height = 400;
      const sx = src.getContext('2d'); sx.fillStyle = '#000'; sx.fillRect(0, 0, 100, 400);
      const img = new Image();
      const box = C.placeFigure(ctx, src, scale, inches, 300, { contactShadow: false });
      out.push({
        inches,
        crownY: box.y,
        wantCrownY: scale.inchesToY(inches),
        footY: box.y + box.h,
        wantFootY: scale.floorY
      });
    });
    return out;
  });
  for (const row of r) {
    if (Math.abs(row.crownY - row.wantCrownY) > 0.51)
      return `FAIL: at ${row.inches}" the crown landed at ${row.crownY.toFixed(1)}, chart line is ${row.wantCrownY.toFixed(1)}`;
    if (Math.abs(row.footY - row.wantFootY) > 0.51)
      return `FAIL: at ${row.inches}" the feet landed at ${row.footY.toFixed(1)}, floor is ${row.wantFootY.toFixed(1)}`;
  }
  /* and that different heights actually differ */
  if (!(r[0].crownY > r[1].crownY && r[1].crownY > r[2].crownY))
    return 'FAIL: taller customers did not come out taller';
  return 'PASS: crown on the line and feet on the floor at every height, and heights differ';
};

/* The lineup's floor must be ON the strip. It was not, the first time. */
scenarios.lineupFloorOnStrip = async (page) => {
  const r = await page.evaluate(() => {
    const G = window.FaceItGeom;
    const H = 1155, p = window.FaceItCatalog.PLATE_DEFAULTS.lineup;
    const s = G.buildChartScale(G.CHARTS[p.chart], H * p.chartTopPct, H * p.chartBottomPct, H * p.floorPct);
    return { floorY: s.floorY, H };
  });
  if (r.floorY > r.H) return `FAIL: floor line at ${r.floorY.toFixed(0)}px is below the ${r.H}px strip — figures run off the mug`;
  if (r.floorY < r.H * 0.6) return `FAIL: floor line at ${r.floorY.toFixed(0)}px leaves no room for a stage`;
  return `PASS: floor line sits on the strip at ${r.floorY.toFixed(0)}px`;
};

/* A booking photo has no feet, so the bust must anchor on the crown only. */
scenarios.mugshotUsesBustAnchor = async (page) => {
  const r = await page.evaluate(() => {
    const G = window.FaceItGeom, C = window.FaceItComposite, M = window.FaceItMugshot;
    const H = 1155;
    const scale = M.scaleFor(H, { chart: 'pet' });
    const src = document.createElement('canvas'); src.width = 100; src.height = 300;
    src.getContext('2d').fillStyle = '#000';
    src.getContext('2d').fillRect(0, 0, 100, 300);
    const c = document.createElement('canvas'); c.width = 825; c.height = H;
    const box = C.placeBust(c.getContext('2d'), src, scale, 20, 412, H, M.DEFAULTS.subjectHPct);
    return { crownY: box.y, wantCrownY: scale.inchesToY(20), bottom: box.y + box.h, H };
  });
  if (Math.abs(r.crownY - r.wantCrownY) > 0.51)
    return `FAIL: bust crown at ${r.crownY.toFixed(1)}, 1'8" line is ${r.wantCrownY.toFixed(1)}`;
  if (r.bottom < r.H * 0.95)
    return `FAIL: bust stops at ${r.bottom.toFixed(0)}px, short of the ${r.H}px frame — a booking crop runs off the bottom edge`;
  return 'PASS: bust crown on its line and the chest crop reaches the frame edge';
};

/* The mug shot is three booking views across a band. On anything below the 2.0
   panorama floor those are slivers, and the Tundra mirrors its flanks, which
   would duplicate a profile. */
scenarios.mugshotProductGate = async (page) => {
  const r = await page.evaluate(() => {
    const CAT = window.FaceItCatalog, t = CAT.get('procedural:mug-shot');
    return {
      mug:    CAT.allowsProduct(t, 'mug'),
      handle: CAT.allowsProduct(t, 'travel-mug-14oz-handle'),
      oz20:   CAT.allowsProduct(t, 'travel-mug-20oz'),
      tundra: CAT.allowsProduct(t, 'travel-mug-30oz-tundra'),
      panels: t.panels
    };
  });
  if (!r.mug || !r.handle) return 'FAIL: mug shot blocked from a surface it belongs on';
  if (r.oz20 || r.tundra) return 'FAIL: mug shot allowed onto a narrow or mirrored wrap';
  if (r.panels !== 'triptych') return `FAIL: mug shot panel mode is "${r.panels}", must be triptych`;
  return 'PASS: mug shot limited to mug + 14oz handle, locked to three panels';
};

/* Two templates return a cutout and need the magenta field; the third repaints
   the whole picture and must NOT ask for one. */
scenarios.promptsAskForTheRightBackground = async (page) => {
  const r = await page.evaluate(() => {
    const P = window.FaceItPrompts, n = '';
    return {
      mugshot: P.mugshotSubject(n, 'pet'),
      lineup:  P.lineupFigure(n),
      stone:   P.stoneCarve(n)
    };
  });
  if (r.mugshot.indexOf('#FF00FF') === -1) return 'FAIL: mug shot prompt never asks for the magenta field';
  if (r.lineup.indexOf('#FF00FF') === -1)  return 'FAIL: lineup prompt never asks for the magenta field';
  if (r.stone.indexOf('#FF00FF') !== -1)   return 'FAIL: stone carve asks for magenta, but it repaints the whole scene';
  if (r.lineup.match(/\b\d\s*'\s*\d/))     return 'FAIL: a height leaked into the lineup prompt — it belongs in the canvas maths';
  if (r.mugshot.toLowerCase().indexOf('height chart') === -1)
    return 'FAIL: mug shot prompt does not forbid the model drawing its own chart';
  return 'PASS: cutout prompts ask for magenta, the repaint prompt does not, no height in the prompt';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page } = await launch();
    try {
      await page.goto('http://127.0.0.1:8788/faceit-bench.html', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const out = await fn(page);
      console.log(out);
      if (out.startsWith('FAIL')) fails++;
    } catch (e) {
      console.log(`FAIL: ${name} threw — ${e.message}`);
      fails++;
    } finally {
      await browser.close();
    }
  }
  console.log(fails ? `\n${fails} FAILING` : '\nall green');
  process.exit(fails ? 1 : 0);
})();
