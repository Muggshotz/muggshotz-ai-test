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

scenarios.unprovedTemplatesStayOutOfTheGrid = async (page) => {
  const r = await page.evaluate(() => {
    const C = window.FaceItCatalog;
    return {
      live: C.liveTemplates().map(t => t.id),
      all:  C.TEMPLATES.length,
      benchStillSeesThem: ['lineup.webp','mount_rushmore.webp'].every(f => !!C.get(f))
    };
  });
  for (const id of ['lineup.webp', 'mount_rushmore.webp'])
    if (r.live.indexOf(id) !== -1)
      return `FAIL: ${id} is in the customer grid but its prompt has never been run`;
  if (r.live.indexOf('procedural:mug-shot') === -1)
    return 'FAIL: the mug shot was gated too — it is the one that WAS proved';
  if (!r.benchStillSeesThem)
    return 'FAIL: the gated templates vanished from the catalogue entirely; the bench needs them';
  return `PASS: ${r.all - r.live.length} unproved templates held back, mug shot live, bench still sees all`;
};

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

/* The lineup plate shipped with one label missing and every number below it six
   inches low. relabelLineupChart moves the existing numbers onto the lines they
   belong to rather than drawing new ones -- four attempts at drawing new ones
   all left a visible patch, because the wall behind them is photographic. */

scenarios.chartConfigMatchesItsRules = async (page) => {
  const r = await page.evaluate(() => {
    const L = window.FaceItBuild.LINEUP_LABELS, C = window.FaceItGeom.CHARTS.human;
    const gaps = L.ruleY.slice(1).map((v, i) => v - L.ruleY[i]);
    return {
      rules: L.ruleY.length,
      minGap: Math.min(...gaps), maxGap: Math.max(...gaps),
      steps: (C.maxIn - C.minIn) / C.stepIn + 1,
      minIn: C.minIn, maxIn: C.maxIn,
      plate: window.FaceItCatalog.PLATE_DEFAULTS.lineup,
      topFrac: L.ruleY[0] / 1155,
      botFrac: L.ruleY[L.ruleY.length - 1] / 1155
    };
  });
  /* uniform pitch is the whole basis for saying a label is wrong rather than
     the spacing being irregular on purpose */
  if (r.maxGap - r.minGap > 8)
    return `FAIL: rule pitch is not uniform (${r.minGap}-${r.maxGap}px) — the relabel assumes it is`;
  if (r.steps !== r.rules)
    return `FAIL: chart declares ${r.steps} labelled heights but the plate has ${r.rules} rules`;
  if (r.minIn !== 42 || r.maxIn !== 90)
    return `FAIL: human chart is ${r.minIn}-${r.maxIn}", expected 42-90 after the relabel`;
  if (Math.abs(r.plate.chartTopPct - r.topFrac) > 0.002)
    return `FAIL: chartTopPct ${r.plate.chartTopPct} does not sit on the top rule (${r.topFrac.toFixed(4)})`;
  if (Math.abs(r.plate.chartBottomPct - r.botFrac) > 0.002)
    return `FAIL: chartBottomPct ${r.plate.chartBottomPct} does not sit on the bottom rule (${r.botFrac.toFixed(4)})`;
  return 'PASS: chart constants sit on the plate\'s own rules, pitch uniform, 9 rules for 9 heights';
};

scenarios.relabelTouchesOnlyTheNumbers = async (page) => {
  const r = await page.evaluate(async () => {
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = '/lineup.webp'; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const shot = (fix) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      if (fix) window.FaceItBuild.relabelLineupChart(x, W, H);
      return x.getImageData(0, 0, W, H).data;
    };
    const a = shot(false), b = shot(true);
    const L = window.FaceItBuild.LINEUP_LABELS;
    const cols = [L.leftRect, L.rightRect];
    let outside = 0, changed = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (Math.abs(a[o]-b[o]) > 8 || Math.abs(a[o+1]-b[o+1]) > 8 || Math.abs(a[o+2]-b[o+2]) > 8) {
        changed++;
        const inCol = cols.some(c => x >= c.x - 2 && x <= c.x + c.w + 2);
        const inRow = L.ruleY.some(ry => y >= ry - L.halfH - 2 && y <= ry + L.halfH + 2);
        if (!(inCol && inRow)) outside++;
      }
    }
    return { W, H, changed, outside };
  });
  if (!r.changed) return 'FAIL: the relabel changed nothing at all';
  if (r.outside)  return `FAIL: the relabel altered ${r.outside} pixels outside the label blocks — it must not touch the room`;
  return `PASS: ${r.changed} pixels changed, every one inside a label block`;
};

/* MAGENTA FRINGING, from a real generation rather than a synthetic case.
   fixture-cutout-fringed.png is the actual first live Mug Shot result, kept at
   512px. The server keys its magenta field with a binary threshold, which is
   right for the templates it was written for but leaves every half-covered fur
   pixel fully opaque and bright pink. Composited onto the wall the dog wore a
   pink halo round every hair, which is what despillMagenta exists to fix. */
scenarios.magentaFringeIsRemoved = async (page) => {
  const r = await page.evaluate(async () => {
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = '/flow-tests/fixture-cutout-fringed.png'; });
    const spill = (cv) => {
      const d = cv.getContext('2d', { willReadFrequently: true })
                  .getImageData(0, 0, cv.width, cv.height).data;
      let mild = 0, strong = 0;
      for (let i = 0; i < d.length; i += 4){
        if (d[i + 3] < 8) continue;
        const sp = Math.min(d[i], d[i + 2]) - d[i + 1];
        if (sp > 20) mild++;
        if (sp > 60) strong++;
      }
      return { mild, strong };
    };
    const opts = { surface: 'mug', chart: 'pet', texts: ['A', 'B', 'C'] };
    return {
      raw:   spill(window.FaceItBuild.buildMugshotStrip(img, Object.assign({ despill: false }, opts))),
      fixed: spill(window.FaceItBuild.buildMugshotStrip(img, opts))
    };
  });
  if (r.raw.strong < 200)
    return `FAIL: the fixture has almost no fringe (${r.raw.strong}px) — it cannot prove the fix does anything`;
  if (r.fixed.strong > r.raw.strong * 0.02)
    return `FAIL: strong magenta survives the despill (${r.raw.strong} -> ${r.fixed.strong})`;
  if (r.fixed.mild > r.raw.mild * 0.05)
    return `FAIL: mild magenta survives the despill (${r.raw.mild} -> ${r.fixed.mild})`;
  return `PASS: fringe removed — strong ${r.raw.strong}->${r.fixed.strong}, mild ${r.raw.mild}->${r.fixed.mild}`;
};

/* Warm subjects must come through untouched. The gate is min(R,B)-G, and for
   golden fur the minimum is the low blue, so an orange dog never trips it --
   but a bug that flipped the test to max() would quietly desaturate every
   ginger pet in the catalogue. */
scenarios.despillLeavesWarmToneAlone = async (page) => {
  const r = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = 'rgb(230,150,70)'; x.fillRect(0, 0, 8, 8);   // golden fur
    const out = window.FaceItComposite.despillMagenta(c, { erode: false });
    const d = out.getContext('2d').getImageData(4, 4, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  });
  if (r[0] !== 230 || r[1] !== 150 || r[2] !== 70 || r[3] !== 255)
    return `FAIL: despill altered a warm tone with no magenta in it: ${JSON.stringify(r)}`;
  return 'PASS: warm fur passes through the despill unchanged';
};

/* ---------------------------------------------------------------------------
   THE STUDIO WIRING
   These run against needles-studio.html rather than the bench, because the
   question they answer is whether the live flow picked the framework up -- the
   module can be perfect and the studio still be reading a stale literal.
   Note the bare assignments in page.evaluate: product and mugPrintMode are `let`
   bindings at script top level, which are NOT properties of window, so
   window.product = 'mug' silently does nothing and every gate reads as open.
   That cost a wrong PASS the first time through.
   --------------------------------------------------------------------------- */
const studio = {};

studio.wraparoundNarrowsRatherThanCloses = async (page) => {
  const r = await page.evaluate(() => {
    product = 'mug'; mugPrintMode = 'three-panel';
    renderFaceItGrid();
    const three = document.querySelectorAll('#faceItGrid .faceit-tile').length;
    mugPrintMode = 'wraparound';
    renderFaceItGrid();
    const ids = [...document.querySelectorAll('#faceItGrid .faceit-tile')].map(e => e.dataset.faceit);
    const shapes = ids.map(id => (FaceItCatalog.get(id) || {}).shape);
    chosenTrack = null; byoDeclaredIntent = null;
    showDesignMethodCard();
    return {
      three, ids, shapes,
      tiles: document.getElementById('designMethodTiles').style.display,
      coverMe: document.getElementById('designMethodCoverMeBtn').style.display,
      faceIt: document.getElementById('designMethodFaceItBtn').style.display
    };
  });
  if (r.three < 21) return `FAIL: three-panel grid lost templates (${r.three})`;
  /* Assert the RULE, not today's roster. Naming the one wrap-native template
     that happened to be live made this fail the moment a second one shipped,
     which is a test dating itself rather than a bug. */
  const notWrap = r.ids.filter((id, i) => r.shapes[i] !== 'wrap');
  if (notWrap.length)
    return `FAIL: a template that cannot wrap survived into Wraparound: ${notWrap.join(', ')}`;
  if (!r.ids.length) return 'FAIL: Wraparound offered no Face It template at all';
  if (r.tiles === 'none') return 'FAIL: the prop row closed on a Wraparound Face It can serve';
  if (r.coverMe !== 'none') return 'FAIL: Cover Me survived into Wraparound — it is one fixed picture';
  if (r.faceIt === 'none') return 'FAIL: the Face It tile was hidden on a wrap it can serve';
  return 'PASS: Wraparound keeps the wrap-native template and drops the ones that cannot wrap';
};

studio.perTemplateInputsAppearAndCleanUp = async (page) => {
  const r = await page.evaluate(() => {
    product = 'mug'; mugPrintMode = 'three-panel'; renderFaceItGrid();
    pickFaceItTemplate('procedural:mug-shot');
    const placards = [...document.querySelectorAll('#faceItMultiTextWrap .faceit-placard-input')].map(e => e.value);
    const kind = !!document.getElementById('faceItSubjectKindWrap');
    const heightOnMugshot = !!document.getElementById('faceItHeightWrap');
    pickFaceItTemplate('king.jpg');
    const leftovers = document.querySelectorAll('.faceit-placard-input').length;
    const wrapOnPlain = document.getElementById('faceItTextBoxWrap').style.display;
    pickFaceItTemplate('on_my_mind.jpg');
    return {
      placards, kind, heightOnMugshot, leftovers, wrapOnPlain,
      wrapOnText: document.getElementById('faceItTextBoxWrap').style.display,
      legacyBox: document.getElementById('faceItTextBox').style.display !== 'none'
    };
  });
  if (r.placards.length !== 3) return `FAIL: mug shot gave ${r.placards.length} placard inputs, wanted 3`;
  if (!r.placards[0]) return 'FAIL: placards came up blank instead of pre-filled';
  if (!r.kind) return 'FAIL: no person/pet choice — a dog would be measured on a human chart';
  if (r.heightOnMugshot) return 'FAIL: mug shot asked for a height it does not use';
  if (r.leftovers) return 'FAIL: placard inputs leaked onto a plain face-merge template';
  if (r.wrapOnPlain !== 'none') return 'FAIL: text box shown on a template that takes no text';
  if (r.wrapOnText !== 'block' || !r.legacyBox)
    return 'FAIL: the original single text box did not come back for a text template';
  return 'PASS: per-template inputs appear, pre-fill, and clean up behind themselves';
};

studio.missingModuleCannotBreakTheStudio = async (page) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.route('**/faceit-templates.js', r => r.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    /* functions declared late in the same script block: if the module's absence
       threw, the block aborts and none of these exist */
    const late = ['generate','approveFaceIt','startNeedlesStage','continueToRealMockup',
                  'saveMugState','resetEverythingFreshStart'];
    const missing = late.filter(n => typeof window[n] !== 'function');
    let door = null;
    try {
      product = 'mug'; mugPrintMode = 'three-panel';
      chosenTrack = null; byoDeclaredIntent = null;
      showDesignMethodCard();
      door = document.getElementById('designMethodCard').style.display;
    } catch (e) { door = 'THREW: ' + e.message; }
    return { ok: (typeof FACEIT_MODULE_OK !== 'undefined') ? FACEIT_MODULE_OK : 'undeclared',
             missing, door };
  });
  if (errs.length) return `FAIL: a missing module threw — ${errs[0]}`;
  if (r.ok !== false) return `FAIL: FACEIT_MODULE_OK is ${r.ok}, expected false with the file blocked`;
  if (r.missing.length) return `FAIL: the throw killed the rest of the script — ${r.missing.join(', ')} undefined`;
  if (r.door !== 'none') return `FAIL: props offered without the module (card display "${r.door}")`;
  return 'PASS: without the module the studio runs intact and quietly skips the props';
};

studio.mugshotSurfaceGate = async (page) => {
  const r = await page.evaluate(() => {
    const t = FaceItCatalog.get('procedural:mug-shot');
    product = 'water bottle'; selectedTravelProductKey = 'travel-mug-20oz';
    const narrow = FaceItCatalog.allowsProduct(t, faceItSurfaceKey());
    selectedTravelProductKey = 'travel-mug-30oz-tundra';
    const tundra = FaceItCatalog.allowsProduct(t, faceItSurfaceKey());
    selectedTravelProductKey = 'travel-mug-14oz-handle';
    const handle = FaceItCatalog.allowsProduct(t, faceItSurfaceKey());
    product = 'mug';
    const mug = FaceItCatalog.allowsProduct(t, faceItSurfaceKey());
    return { narrow, tundra, handle, mug };
  });
  if (r.narrow) return 'FAIL: mug shot offered on a 20oz — three booking views on a 1.33:1 band are slivers';
  if (r.tundra) return 'FAIL: mug shot offered on the Tundra, which mirrors its flanks and would duplicate a profile';
  if (!r.handle || !r.mug) return 'FAIL: mug shot blocked from a surface it belongs on';
  return 'PASS: mug shot reaches the mug and the 14oz only';
};

studio.legacyRosterReachesTheStudio = async (page) => {
  const r = await page.evaluate(() => ({
    catalog: FACE_IT_CATALOG.slice(),
    text: [...FACE_IT_TEXT_TEMPLATES]
  }));
  /* The invariant is that the original twenty survive, in their original order.
     New templates joining the roster is the point of the batch, so comparing the
     whole array to the old one asserted that nothing may ever be added. */
  const survivors = r.catalog.filter(f => LEGACY_20.indexOf(f) !== -1);
  if (JSON.stringify(survivors) !== JSON.stringify(LEGACY_20))
    return `FAIL: the original 20 drifted in content or order:\n  got  ${JSON.stringify(survivors)}`;
  if (JSON.stringify(r.text.slice().sort()) !== JSON.stringify(LEGACY_TEXT.slice().sort()))
    return `FAIL: text set drifted to ${JSON.stringify(r.text)}`;
  return 'PASS: the studio sees the original 20 in their original order';
};

async function stubApis(page){
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"balance":99}' }));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/images.printify.com/**', r => r.abort());
}

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
  for (const [name, fn] of Object.entries(studio)) {
    const { browser, page } = await launch();
    try {
      await stubApis(page);
      await page.goto('http://127.0.0.1:8788/needles-studio.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
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
