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

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1000);
}
async function mugToPrintStyle(page, size = '11oz', styleIndex = 0) {
  await pickProduct(page, 'mug');
  await page.evaluate((s) => pickPreGenMugSize(s), size);
  await T(page, 500);
  await page.evaluate((i) => pickPreGenMugStyle(Object.keys(GEN_MUG_STYLES)[i]), styleIndex);
  await T(page, 500);
  await page.evaluate(() => { const b = document.querySelector('#preGenMugColorGrid .color-btn'); if (b) b.click(); });
  await T(page, 500);
  await page.evaluate(() => finishPreGenMugColorPick());
  await T(page, 900);
  await dismissAlerts(page);
}
async function ideaBoxUsable(page) {
  return page.evaluate(() => {
    const t = document.getElementById('ideaDesc'); if (!t) return false;
    const r = t.getBoundingClientRect();
    return r.height > 0 && r.width > 0 && getComputedStyle(t).display !== 'none';
  });
}
async function describeAndGenerate(page, text) {
  if (!(await ideaBoxUsable(page))) {
    await page.evaluate(() => { window.confirm = () => false; });
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await T(page, 1400);
    await dismissAlerts(page);
    if (!(await ideaBoxUsable(page))) throw new Error('the empty-box guard did not land on a usable idea box');
  }
  await page.fill('#ideaDesc', text);
  await dismissAlerts(page);
  await T(page, 400);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
}
// The real "Yes -- All 3 Sides" button. Nothing reaches the mockup with
// artwork on it until the customer has answered "Are you satisfied?"; a
// test that skipped this step handed the mug three empty slots and called
// the resulting blank mug a defect. It was the test that was wrong.
async function approveAllThree(page) {
  await page.evaluate(() => approveDesign(true));
  await T(page, 1200);
  await dismissAlerts(page);
}
const waitLanded = (page, t = 120000) =>
  page.waitForFunction(() => {
    const shown = (id) => { const el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none'; };
    return shown('seamFixOverlay') || shown('accessorizeCard') || shown('frameFadeOverlay') || shown('approveRow');
  }, null, { timeout: t });

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

// A stage that has a mug with artwork on it screenshots MUCH larger than a
// flat, empty one. Crude, but it cannot be fooled by a blank canvas.
async function stageBytes(page, name) {
  const p = `shot-mug3d-${name}.png`;
  await page.locator('#mug3dStage').screenshot({ path: p });
  return fs.statSync(p).size;
}

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
  const bytes = await stageBytes(page, 'three-panel');
  if (bytes < 30000) return `FAIL: the stage screenshot is only ${bytes} bytes — looks like an empty stage`;

  // Printify still fires behind it, and its answer does not demote the mug.
  await opened;
  await T(page, 800);
  const fired = log.apiCalls.some((c) => c.path === '/api/start-mockup');
  if (!fired) return 'FAIL: the Printify mockup request no longer fires for a mug';
  const after = await stageState(page);
  if (!after.wrap || after.photo) return 'FAIL: Printify answering replaced the 3D mug with the flat photo';
  return `PASS: 3D mug up in ${ms}ms with artwork, action row and slider; Printify still fired behind it (${bytes} byte stage)`;
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
  const bytes = await stageBytes(page, 'wraparound');
  if (bytes < 30000) return `FAIL: stage looks empty (${bytes} bytes)`;
  return `PASS: wraparound mug wraps the uncut panorama (${bytes} byte stage)`;
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
  const bytes = await stageBytes(page, '15oz');
  if (bytes < 30000) return `FAIL: stage looks empty (${bytes} bytes)`;
  return `PASS: 15oz mug builds and carries artwork (${bytes} byte stage)`;
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

// ---- 6. No WebGL: the flat photo path runs, exactly as before. ----
// The harness's default Chromium has no GL in this sandbox, so this is the
// device-without-WebGL case for free.
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
  if (hasGL) return 'SKIP: this Chromium has WebGL, so the no-WebGL fallback cannot be exercised here';
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
    const errs = log.consoleErrors.filter((e) => !/ERR_TUNNEL|ERR_CONNECTION/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs.slice(0, 5))}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL MUG-3D VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
