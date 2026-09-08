// The mug that turns (Sep 2026). A ceramic coffee mug's mockup is a real 3D
// mug drawn locally, not Printify's photo set. What this suite pins:
//   * the real entry point (beginFinalMockupFetch) opens the 3D stage for a
//     mug, instantly, with no "please be patient" overlay;
//   * the artwork actually lands on it -- three panels joined, or the uncut
//     panorama on a wraparound -- and 15oz builds as well as 11oz;
//   * Printify's request still fires behind it, and when it answers the 3D
//     mug is NOT replaced by the flat photo;
//   * the Add-a-Frame round trip comes back to the 3D mug, not the photo;
//   * every exit tears the renderer down;
//   * and with no WebGL at all, the old photo path runs untouched.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');
const fs = require('fs');

const T = (page, ms) => page.waitForTimeout(ms);
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];

// The click-path helpers live in verify-mug-3d-helpers.js so ad-hoc
// drives (a real-chain reproduction, say) use the exact same sequence.
const { pickProduct, mugToPrintStyle, describeAndGenerate, approveAllThree, waitLanded } = require('./verify-mug-3d-helpers');

// Record what the 3D module is handed, without touching how it behaves.
async function spyOnMug3D(page) {
  await page.evaluate(() => {
    window.__mug3dOpens = [];
    const real = MUG3D.open.bind(MUG3D);
    MUG3D.open = (host, opts) => { window.__mug3dOpens.push(JSON.parse(JSON.stringify(opts))); return real(host, opts); };
  });
}

const stageState = (page) => page.evaluate(() => {
  const vis = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
  const stage = document.getElementById('mug3dStage');
  return {
    wrap: vis('mug3dWrap'),
    canvas: !!(stage && stage.querySelector('canvas')),
    photo: vis('mockupLightboxImg'),
    overlayVisible: vis('mockupLightboxOverlay'),
    waitOverlay: vis('mockupLoadingOverlay'),
    actions: vis('mockupLightboxActions'),
    returnBtn: vis('mockupLightboxReturn'),
    slider: vis('mug3dAngle'),
    failed: typeof mug3dFailed !== 'undefined' ? mug3dFailed : null,
    spinning: MUG3D.spinning(),
  };
});

// Is there artwork on the mug? Count coloured pixels in a screenshot of the
// stage: the mug is white, the ground is grey, the shadow is grey, so any
// saturated pixel is the artwork. The first cut of this check compared PNG
// byte sizes, and a longer lens (smaller mug, more plain background) made an
// honest render fail it -- a size is not a picture.
async function artworkFraction(page, name) {
  const p = `shot-mug3d-${name}.png`;
  await page.locator('#mug3dStage').screenshot({ path: p });
  const b64 = fs.readFileSync(p).toString('base64');
  return page.evaluate(async (b64) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let colourful = 0, total = 0;
    for (let i = 0; i < d.length; i += 16) { // every 4th pixel is plenty
      total++;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (Math.max(r, gg, b) - Math.min(r, gg, b) > 40) colourful++;
    }
    return colourful / total;
  }, b64);
}
const MIN_ARTWORK = 0.03;   // 3% of the stage coloured = a picture is on the mug

const scenarios = {};
const OPTS = {};

// ---- 1. Three panels, 11oz: the entry point opens the 3D mug, instantly. ----
OPTS.threePanelOpensThe3DMug = { chromiumArgs: GL };
scenarios.threePanelOpensThe3DMug = async (page, log) => {
  await mugToPrintStyle(page, '11oz');
  await page.evaluate(() => pickMugPrintMode('three-panel'));
  await T(page, 1000);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a lighthouse in a storm');
  await waitLanded(page);
  await T(page, 800);
  await approveAllThree(page);
  await spyOnMug3D(page);

  const t0 = Date.now();
  // Caught immediately: a dangling rejection after the browser closes
  // would take the whole runner down with it.
  const opened = page.evaluate(() => beginFinalMockupFetch()).catch(() => {});
  // The 3D stage must be up long before Printify would have answered.
  await page.waitForFunction(() => {
    const w = document.getElementById('mug3dWrap');
    return w && getComputedStyle(w).display !== 'none' && document.querySelector('#mug3dStage canvas');
  }, null, { timeout: 15000 });
  const ms = Date.now() - t0;
  await T(page, 1200);
  const s = await stageState(page);
  if (!s.wrap || !s.canvas) return 'FAIL: 3D stage not showing';
  if (s.photo) return 'FAIL: the flat photo is showing alongside the 3D mug';
  if (s.waitOverlay) return 'FAIL: the "please be patient" overlay is up over a 3D mug';
  if (!s.actions || !s.returnBtn) return 'FAIL: the action row (Back / Looks Good) is missing from the 3D mockup';
  if (!s.slider) return 'FAIL: the turn slider is missing';
  if (!s.spinning) return 'FAIL: the mug is not spinning on open';
  const opens = await page.evaluate(() => window.__mug3dOpens);
  if (!opens.length) return 'FAIL: MUG3D.open was never called';
  const o = opens[0];
  if (o.sizeLabel !== '11oz') return `FAIL: opened as ${o.sizeLabel}`;
  if (o.panoramaUrl) return 'FAIL: a three-panel mug was handed a panorama';
  if (!(o.panelUrls || []).filter(Boolean).length) return 'FAIL: no panel artwork reached the 3D mug';
  const art = await artworkFraction(page, 'three-panel');
  if (art < MIN_ARTWORK) return `FAIL: only ${(art*100).toFixed(1)}% of the stage is coloured — no artwork on the mug`;

  // Printify still fires behind it, and its answer does not demote the mug.
  await opened;
  await T(page, 800);
  const fired = log.apiCalls.some((c) => c.path === '/api/start-mockup');
  if (!fired) return 'FAIL: the Printify mockup request no longer fires for a mug';
  const after = await stageState(page);
  if (!after.wrap || after.photo) return 'FAIL: Printify answering replaced the 3D mug with the flat photo';
  return `PASS: 3D mug up in ${ms}ms with artwork (${(art*100).toFixed(0)}% of the stage), action row and slider; Printify still fired behind it`;
};

// ---- 2. Wraparound: the uncut panorama is what wraps the mug. ----
OPTS.wraparoundWrapsThePanorama = { chromiumArgs: GL };
scenarios.wraparoundWrapsThePanorama = async (page) => {
  await mugToPrintStyle(page, '11oz');
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitLanded(page);
  await T(page, 1500);
  await spyOnMug3D(page);
  page.evaluate(() => beginFinalMockupFetch());
  await page.waitForFunction(() => document.querySelector('#mug3dStage canvas'), null, { timeout: 15000 });
  await T(page, 1200);
  const opens = await page.evaluate(() => window.__mug3dOpens);
  if (!opens.length) return 'FAIL: MUG3D.open was never called';
  if (!opens[0].panoramaUrl) return 'FAIL: the wraparound mug was not handed the uncut panorama';
  const art = await artworkFraction(page, 'wraparound');
  if (art < MIN_ARTWORK) return `FAIL: only ${(art*100).toFixed(1)}% of the stage is coloured — no artwork on the mug`;
  return `PASS: wraparound mug wraps the uncut panorama (${(art*100).toFixed(0)}% of the stage is artwork)`;
};

// ---- THE TUMBLERS TURN (Alyx, Sep 2026: "now I want to implement that new
// mockup process we designed"). A Tundra wraparound opens the 3D engine with
// the Tundra body, not a mug, and wears the wrap. ----
OPTS.tundraOpensThe3DTumbler = { chromiumArgs: GL };
scenarios.tundraOpensThe3DTumbler = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-30oz-tundra'));
  await T(page, 1000);
  await dismissAlerts(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1000);
  await dismissAlerts(page);
  // Black, so the cup's colour is checked all the way through to the engine.
  await page.evaluate(() => { const b = document.querySelector('#travelMugColorGridGen .color-btn[data-color="Black"]'); if (b) b.click(); });
  await T(page, 500);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitLanded(page);
  await T(page, 1200);
  await spyOnMug3D(page);
  // v101: the real Yes button, and nothing else. Yes opens the cup.
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await page.waitForFunction(() => document.querySelector('#mug3dStage canvas'), null, { timeout: 15000 });
  await T(page, 1500);
  const opens = await page.evaluate(() => window.__mug3dOpens);
  if (!opens.length) return 'FAIL: MUG3D.open was never called for the Tundra';
  if (opens[0].tumblerKey !== 'travel-mug-30oz-tundra') return `FAIL: opened as ${JSON.stringify(opens[0])}, not the Tundra body`;
  if (!opens[0].panoramaUrl) return 'FAIL: the Tundra was not handed its wrap';
  if (opens[0].colorHex !== '#111214') return `FAIL: Black was picked but the cup opened in ${opens[0].colorHex}`;
  const placement = await page.evaluate(() => { const c = document.getElementById('positionHolderCard'); return c && c.style.display !== 'none'; });
  if (placement) return 'FAIL: the placement panel is still showing behind the cup — Yes was supposed to skip it';
  // v103: a square stage, and the hint names a cup.
  const stage = await page.evaluate(() => { const r = document.getElementById('mug3dStage').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), hint: document.querySelector('#mug3dWrap .mug3d-hint').textContent }; });
  if (Math.abs(stage.w - stage.h) > 4) return `FAIL: the cup's stage is ${stage.w}x${stage.h}, not square`;
  if (!/Drag the cup/.test(stage.hint)) return `FAIL: the hint still says "${stage.hint}"`;
  const art = await artworkFraction(page, 'tundra');
  // The band is a smaller share of the stage than a mug's whole wrap, and
  // the fake strip is pale: 2% coloured is a picture on the cup here.
  if (art < 0.02) return `FAIL: only ${(art*100).toFixed(1)}% of the stage is coloured — no artwork on the tumbler`;
  return `PASS: Yes opens the Tundra as a black 3D tumbler wearing its wrap on a ${stage.w}px square stage, placement panel skipped (${(art*100).toFixed(0)}% of the stage is artwork)`;
};

// ---- The travel picker draws its own tumblers: the three the engine knows
// become renders, the two handled cups keep their photos for now. ----
OPTS.theTravelPickerDrawsItsOwnTumblers = { chromiumArgs: GL };
scenarios.theTravelPickerDrawsItsOwnTumblers = async (page) => {
  await pickProduct(page, 'water bottle');
  const drawn = ['Tundra Tumbler, 30oz', 'Gator Tumbler, 32oz', 'Travel Mug, 20oz'];
  const kept = ['Travel Mug with Handle, 14oz', 'Insulated Travel Mug, 40oz'];
  await page.waitForFunction((names) => names.every((n) => {
    const im = document.querySelector(`#travelMugVariantGrid img[alt="${n}"]`);
    return im && im.src.startsWith('data:');
  }), drawn, { timeout: 25000 }).catch(() => {});
  const r = await page.evaluate(({ drawn, kept }) => {
    const src = (n) => (document.querySelector(`#travelMugVariantGrid img[alt="${n}"]`) || {}).src || '';
    return { drawn: drawn.map((n) => [n, src(n).slice(0, 5)]), kept: kept.map((n) => [n, src(n).slice(0, 5)]) };
  }, { drawn, kept });
  const cold = r.drawn.filter(([, s]) => s !== 'data:');
  if (cold.length) return `FAIL: still a catalogue photo: ${cold.map(([n]) => n).join(', ')}`;
  const swapped = r.kept.filter(([, s]) => s === 'data:');
  if (swapped.length) return `FAIL: a handled cup got a render it has no body for: ${swapped.map(([n]) => n).join(', ')}`;
  return 'PASS: Tundra, Gator and 20oz tiles are drawn by the engine; the 14oz and 40oz keep their photos';
};

// ---- 3. 15oz builds too. ----
OPTS.fifteenOunceBuilds = { chromiumArgs: GL };
scenarios.fifteenOunceBuilds = async (page) => {
  await mugToPrintStyle(page, '15oz');
  await page.evaluate(() => pickMugPrintMode('three-panel'));
  await T(page, 1000);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a lighthouse in a storm');
  await waitLanded(page);
  await T(page, 800);
  await approveAllThree(page);
  await spyOnMug3D(page);
  page.evaluate(() => beginFinalMockupFetch());
  await page.waitForFunction(() => document.querySelector('#mug3dStage canvas'), null, { timeout: 15000 });
  await T(page, 1200);
  const opens = await page.evaluate(() => window.__mug3dOpens);
  if (opens[0]?.sizeLabel !== '15oz') return `FAIL: opened as ${opens[0]?.sizeLabel}`;
  const art = await artworkFraction(page, '15oz');
  if (art < MIN_ARTWORK) return `FAIL: only ${(art*100).toFixed(1)}% of the stage is coloured — no artwork on the mug`;
  return `PASS: 15oz mug builds and carries artwork (${(art*100).toFixed(0)}% of the stage)`;
};

// ---- 4. Add a Frame and come back: it is the 3D mug that returns. ----
OPTS.frameRoundTripReturnsTo3D = { chromiumArgs: GL };
scenarios.frameRoundTripReturnsTo3D = async (page) => {
  await mugToPrintStyle(page, '11oz');
  await page.evaluate(() => pickMugPrintMode('three-panel'));
  await T(page, 1000);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a lighthouse in a storm');
  await waitLanded(page);
  await T(page, 800);
  await approveAllThree(page);
  await page.evaluate(() => beginFinalMockupFetch());
  await page.waitForFunction(() => document.querySelector('#mug3dStage canvas'), null, { timeout: 15000 });
  await T(page, 800);
  // Out to the frame offer...
  await page.evaluate(() => offerFrameFromMockup());
  await T(page, 800);
  const gone = await stageState(page);
  if (gone.canvas) return 'FAIL: leaving for the frame offer did not tear the 3D mug down';
  // ...and straight back, as a customer who changed their mind would.
  await page.evaluate(() => reopenMockupLightboxFromFrameOffer());
  await page.waitForFunction(() => document.querySelector('#mug3dStage canvas'), null, { timeout: 15000 });
  await T(page, 1000);
  const back = await stageState(page);
  if (!back.wrap || !back.canvas) return 'FAIL: coming back from the frame offer did not reopen the 3D mug';
  if (back.photo) return 'FAIL: coming back from the frame offer showed the flat photo instead of the 3D mug';
  if (!back.actions || !back.returnBtn) return 'FAIL: the action row did not come back with the mug';
  return 'PASS: the frame round trip returns to the 3D mug with its action row';
};

// ---- 5. Every exit tears the renderer down. ----
OPTS.exitsTearDown = { chromiumArgs: GL };
scenarios.exitsTearDown = async (page) => {
  await mugToPrintStyle(page, '11oz');
  await page.evaluate(() => pickMugPrintMode('three-panel'));
  await T(page, 1000);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a lighthouse in a storm');
  await waitLanded(page);
  await T(page, 800);
  await approveAllThree(page);
  for (const exit of ['closeMockupLightbox', 'goBackFromFinalMockup', 'returnFromFinalMockup']) {
    await page.evaluate(() => beginFinalMockupFetch());
    await page.waitForFunction(() => document.querySelector('#mug3dStage canvas'), null, { timeout: 15000 });
    await T(page, 600);
    await page.evaluate((fn) => window[fn](), exit);
    await T(page, 500);
    const s = await stageState(page);
    if (s.canvas || s.wrap) return `FAIL: ${exit} left the 3D mug mounted`;
    // put the flow back where the next exit expects it
    await page.evaluate(() => { const o = document.getElementById('finalChoiceOverlay'); if (o) o.style.display = 'none'; document.body.classList.remove('step-locked'); });
    await dismissAlerts(page);
  }
  return 'PASS: close, Back and Looks Good all tear the 3D mug down';
};

// ---- 7. The picker draws its own mugs. ----
// Alyx: "take a stock, standard image of one of each and use those exact same
// images to generate all the different colour variants, in real time". The
// four style tiles and the big confirmation mug are 3D stills now; the photos
// are only what shows until each still lands. Cambridge Blue is back, on
// exactly the five combinations the catalogue carries a variant ID for.
OPTS.thePickerDrawsItsOwnMugs = { chromiumArgs: GL };
scenarios.thePickerDrawsItsOwnMugs = async (page) => {
  await pickProduct(page, 'mug');
  await page.evaluate(() => pickPreGenMugSize('11oz'));
  // the four tiles turn into stills
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#preGenMugStyleGrid img')];
    return imgs.length === 4 && imgs.every(i => i.src.startsWith('data:image/png'));
  }, null, { timeout: 20000 });
  const tiles = await page.evaluate(() => [...document.querySelectorAll('#preGenMugStyleGrid img')].map(i => i.alt));
  // Trimmed, Cambridge Blue: a colour that never had a photo
  await page.evaluate(() => pickPreGenMugStyle('Trimmed'));
  await T(page, 400);
  const hasCB = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#preGenMugColorGrid .color-btn')].find(x => /cambridge/i.test(x.title));
    if (!b) return false; b.click(); return true;
  });
  if (!hasCB) return 'FAIL: no Cambridge Blue swatch on Trimmed 11oz';
  await page.waitForFunction(() => {
    const i = document.getElementById('preGenMugMockupImg');
    return i && i.style.display !== 'none' && i.src.startsWith('data:image/png');
  }, null, { timeout: 20000 });
  // and the still really is sage, not Printify's vivid blue
  const sage = await page.evaluate(async () => {
    const i = document.getElementById('preGenMugMockupImg');
    const im = new Image(); im.src = i.src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    // Count only CHROMATIC pixels: the white body, its shading and the floor
    // shadow are all greys and say nothing about the accent. Of what has a
    // hue at all, nearly everything on a Cambridge Blue mug should lean sage.
    let n = 0, sageish = 0;
    for (let k = 0; k < d.length; k += 16) {
      const r = d[k], gg = d[k + 1], b = d[k + 2];
      const chroma = Math.max(r, gg, b) - Math.min(r, gg, b);
      if (chroma < 12) continue;
      n++;
      if (gg >= r + 6 && gg >= b - 6) sageish++;
    }
    return { coloured: n, sageish, filter: i.style.filter };
  });
  if (sage.coloured < 500) return `FAIL: the still has almost no coloured pixels (${sage.coloured})`;
  if (sage.sageish / sage.coloured < 0.8) return `FAIL: the Cambridge Blue still is not sage (${sage.sageish}/${sage.coloured} chromatic pixels lean sage)`;
  if (sage.filter && sage.filter !== 'none') return `FAIL: the photo punch-up filter (${sage.filter}) is still applied to a drawn mug`;
  // exactly the five catalogue combinations
  const combos = await page.evaluate(() => {
    const out = [];
    for (const [style, def] of Object.entries(GEN_MUG_STYLES)) for (const [size, list] of Object.entries(def.colors))
      if (Array.isArray(list) && list.some(c => c.name === 'Cambridge Blue')) out.push(style + ' ' + size);
    return out.sort();
  });
  const want = ['Accented 11oz', 'Color Pop 11oz', 'Color Pop 15oz', 'Trimmed 11oz', 'Trimmed 15oz'];
  if (JSON.stringify(combos) !== JSON.stringify(want)) return `FAIL: Cambridge Blue is offered on ${JSON.stringify(combos)}, catalogue says ${JSON.stringify(want)}`;
  await page.locator('#mugStyleCard').screenshot({ path: 'shot-mug3d-picker.png' }).catch(() => {});
  return `PASS: four style tiles (${tiles.join(', ')}) and the confirmation mug are 3D stills; Cambridge Blue renders sage (${sage.sageish}/${sage.coloured}) on exactly ${want.length} combinations`;
};

// ---- 8. No WebGL: the picker keeps its photos. ----
OPTS.noWebGLPickerKeepsPhotos = { noWebGL: true };
scenarios.noWebGLPickerKeepsPhotos = async (page) => {
  await pickProduct(page, 'mug');
  await page.evaluate(() => pickPreGenMugSize('11oz'));
  await T(page, 2500);
  const srcs = await page.evaluate(() => [...document.querySelectorAll('#preGenMugStyleGrid img')].map(i => i.src));
  if (srcs.length !== 4) return `FAIL: ${srcs.length} tiles`;
  if (srcs.some(u => u.startsWith('data:'))) return 'FAIL: a tile became a still with no WebGL';
  return 'PASS: without WebGL the four tiles keep their photos';
};

// ---- 6. No WebGL: the flat photo path runs, exactly as before. ----
OPTS.noWebGLFallsBackToThePhoto = { noWebGL: true };
scenarios.noWebGLFallsBackToThePhoto = async (page, log) => {
  await mugToPrintStyle(page, '11oz');
  await page.evaluate(() => pickMugPrintMode('three-panel'));
  await T(page, 1000);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a lighthouse in a storm');
  await waitLanded(page);
  await T(page, 800);
  await approveAllThree(page);
  const hasGL = await page.evaluate(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } });
  if (hasGL) return 'FAIL: WebGL was supposed to be switched off for this scenario and is not';
  await page.evaluate(() => beginFinalMockupFetch());
  await page.waitForFunction(() => {
    const i = document.getElementById('mockupLightboxImg');
    return i && getComputedStyle(i).display !== 'none' && i.src;
  }, null, { timeout: 20000 });
  const s = await stageState(page);
  if (s.wrap || s.canvas) return 'FAIL: without WebGL the 3D stage is still up';
  if (!s.photo) return 'FAIL: without WebGL the flat photo did not appear';
  if (s.failed !== true) return 'FAIL: mug3dFailed was not set, so the next mug would try WebGL again';
  return 'PASS: without WebGL the flat Printify photo path runs as before';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch(OPTS[name] || {});
    // A device without WebGL, simulated honestly: the canvas refuses a GL
    // context, exactly as an old phone or a locked-down browser does.
    if (OPTS[name]?.noWebGL) {
      await page.addInitScript(() => {
        const real = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          if (/webgl/i.test(String(type))) return null;
          return real.call(this, type, ...rest);
        };
      });
    }
    try {
      await openStudio(page);
      await uploadPhoto(page);
      await dismissAlerts(page);
      const result = await fn(page, log);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
      await page.screenshot({ path: `shot-mug3d-fail-${name}.png` }).catch(() => {});
    }
    // The no-WebGL scenario provokes exactly two console errors -- three.js
    // reporting no context, and the studio saying it is falling back. That
    // noise IS the expected outcome, keyed off the same option that causes
    // it, so the exemption cannot drift from the scenario.
    const expectedNoise = !!OPTS[name]?.noWebGL;
    const errs = log.consoleErrors.filter((e) => !/ERR_TUNNEL|ERR_CONNECTION/.test(e));
    if (errs.length && !expectedNoise) { console.log(`  CONSOLE: ${JSON.stringify(errs.slice(0, 5))}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL MUG-3D VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
