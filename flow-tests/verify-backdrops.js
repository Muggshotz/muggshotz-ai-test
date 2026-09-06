// Backdrops on Fit Your Picture (Sep 2026) and the two knocked-out frames.
const { launch, openStudio, uploadPhotoAndChooseBYO, dismissAlerts, BASE } = require('./harness');
const T = (page, ms) => page.waitForTimeout(ms);

async function reachPanels(page) {
  await uploadPhotoAndChooseBYO(page);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  await page.evaluate(() => { pickPreGenMugSize('15oz'); });
  await T(page, 500);
  await page.evaluate(() => { pickPreGenMugStyle('Trimmed'); });
  await T(page, 900);
  await page.evaluate(() => { const b = document.querySelector('#preGenMugColorGrid .color-btn'); if (b) b.click(); });
  await T(page, 900);
  await page.evaluate(() => finishPreGenMugColorPick());
  await page.waitForFunction(() => document.getElementById('coverMePanelCard').style.display === 'block', null, { timeout: 15000 });
  await T(page, 600);
}

const scenarios = {};

scenarios.backdropTilesFollowThePicture = async (page) => {
  await reachPanels(page);
  // The harness photo lands at Sharp; give it a soft edge so a backdrop has something to do.
  await page.evaluate(() => { const s = document.querySelector('[id^="coverMeFitFade_"]'); s.value = 30; s.dispatchEvent(new Event('input')); });
  await T(page, 200);
  const st0 = await page.evaluate(() => {
    const wrap = document.querySelector('[id^="coverMeBackdrop_"]');
    return { shown: wrap && getComputedStyle(wrap).display !== 'none', tiles: wrap ? wrap.querySelectorAll('.backdropTile').length : 0, fade: placementAdjust.left.fade };
  });
  if (!st0.shown) return `FAIL: backdrop row hidden with fade at ${st0.fade}`;
  if (st0.tiles !== 9) return `FAIL: expected None + 8 tiles, got ${st0.tiles}`;
  await page.click('.backdropTile[data-key="bubbles"]');
  await T(page, 1500); // preview image load + relayout
  const st1 = await page.evaluate(() => {
    const box = document.querySelector('[id^="coverMeFitBox_"]');
    const fade = box.querySelector('.fitFade');
    // Sample the fade canvas at its corner: with the bubbles backdrop drawn through the mask
    // the corner is opaque texture (alpha 255), never a flat wash of the surface colour.
    const ctx = fade.getContext('2d');
    const p = ctx.getImageData(1, 1, 1, 1).data;
    const mid = ctx.getImageData(Math.round(fade.width / 2), Math.round(fade.height / 2), 1, 1).data;
    return {
      left: placementAdjust.left.backdrop, right: placementAdjust.right.backdrop,
      bg: box.style.backgroundImage, selected: document.querySelector('.backdropTile.selected')?.dataset.key,
      cornerAlpha: p[3], midAlpha: mid[3], loaded: !!getBackdropImage('bubbles'),
    };
  });
  if (st1.left !== 'bubbles' || st1.right !== 'bubbles') return `FAIL: backdrop not on both panels: ${JSON.stringify(st1)}`;
  if (!/backdrop-preview-bubbles/.test(st1.bg)) return `FAIL: box background is ${st1.bg}`;
  if (st1.selected !== 'bubbles') return 'FAIL: tile not marked selected';
  if (!st1.loaded) return 'FAIL: preview image never loaded';
  if (st1.cornerAlpha < 250 || st1.midAlpha !== 0) return `FAIL: fade mask wrong (corner ${st1.cornerAlpha}, middle ${st1.midAlpha})`;
  // Center on inherits the backdrop
  await page.click('.panelSwitch[data-pos="front"]');
  await T(page, 400);
  const front = await page.evaluate(() => placementAdjust.front.backdrop);
  if (front !== 'bubbles') return `FAIL: Center did not inherit the backdrop (${front})`;
  // Sharp hides the row (nothing for a backdrop to do when the picture covers the box)
  await page.evaluate(() => { const s = document.querySelector('[id^="coverMeFitFade_"]'); s.value = 0; s.dispatchEvent(new Event('input')); });
  await T(page, 200);
  const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('[id^="coverMeBackdrop_"]')).display === 'none');
  if (!hidden) return 'FAIL: backdrop row still shown at Sharp with the picture covering the box';
  await page.evaluate(() => { const s = document.querySelector('[id^="coverMeFitFade_"]'); s.value = 40; s.dispatchEvent(new Event('input')); });
  // Edge screen preview carries it, and the mockup request carries it
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await T(page, 600);
  const edge = await page.evaluate(() => ({
    bg: document.getElementById('revealFitBox').style.backgroundImage,
    req: buildMockupRequestBody().placementAdjust,
  }));
  if (!/backdrop-preview-bubbles/.test(edge.bg)) return `FAIL: edge screen box background is ${edge.bg}`;
  if (edge.req.left.backdrop !== 'bubbles' || edge.req.front.backdrop !== 'bubbles' || edge.req.right.backdrop !== 'bubbles') return `FAIL: mockup request lacks the backdrop: ${JSON.stringify(edge.req)}`;
  return 'PASS: backdrop tiles apply to every panel, draw through the fade, hide at Sharp, and reach the edge screen and the mockup request';
};

scenarios.knockedOutFramesShowThePhoto = async (page) => {
  await openStudio(page);
  const res = await page.evaluate(async (base) => {
    const out = {};
    for (const name of ['Mirror Mirror', 'Astral']) {
      selectedFrame = name; windowSillChoice = null;
      const url = await compositeFrameOntoImageUrl(base + '/__fake/generated.jpg');
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
      out[name] = { size: [c.width, c.height], centre: px(c.width >> 1, c.height >> 1), corner: px(2, 2) };
    }
    // The stand-in photo's own centre colour, for comparison.
    const raw = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = base + '/__fake/generated.jpg'; });
    const c2 = document.createElement('canvas'); c2.width = raw.naturalWidth; c2.height = raw.naturalHeight; const x2 = c2.getContext('2d'); x2.drawImage(raw, 0, 0);
    out.photoCentre = Array.from(x2.getImageData(raw.naturalWidth >> 1, raw.naturalHeight >> 1, 1, 1).data).slice(0, 3);
    selectedFrame = null;
    return out;
  }, BASE);
  const close = (a, b, tol = 40) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  for (const name of ['Mirror Mirror', 'Astral']) {
    const r = res[name];
    if (!close(r.centre, res.photoCentre)) return `FAIL: ${name} still hides the photo at the centre (${r.centre} vs photo ${res.photoCentre})`;
    if (!close(r.corner, [255, 255, 255], 12)) return `FAIL: ${name} corner is ${r.corner}, expected the product's white surface`;
  }
  return 'PASS: Mirror Mirror and Astral show the photo through the opening, with the product colour outside the silhouette';
};

scenarios.frameGoesOnThePrintPanel = async (page, log) => {
  await reachPanels(page);
  // A shrunk, dragged picture with a soft edge on a backdrop: the case that used to leave white around the frame.
  await page.evaluate(() => { const id = placements.left; setDesignAdjust(id, { zoom: 0.7, offX: 0.4, offY: -0.3, fade: 40, border: true, backdrop: 'bubbles' }); });
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await page.evaluate(() => chooseFadeEdges());
  await page.click('#revealFadeContinueBtn');
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  const nudge0 = await page.evaluate(() => ({ nudge: getComputedStyle(document.getElementById('mockupLightboxNudge')).display, pulse: document.getElementById('mockupLightboxFrame').classList.contains('cta-flash') }));
  if (nudge0.nudge === 'none' || !nudge0.pulse) return `FAIL: unframed mockup should show the nudge and pulse the button: ${JSON.stringify(nudge0)}`;
  // A prop flow must never see the frame offer, whatever is on the panels.
  const propGate = await page.evaluate(() => { const keep = selectedDesignMethod; selectedDesignMethod = 'coverMe'; const r = frameOfferAvailable(); selectedDesignMethod = keep; refreshMockupLightboxFrameBtn(); return r; });
  if (propGate) return 'FAIL: the frame offer is available on a prop (magazine cover) flow';
  await page.click('#mockupLightboxFrame');
  await T(page, 800);
  const before = await page.evaluate(async () => {
    const id = placements.left; const box = getPanelPrintBox('left');
    const url = await renderPanelPrintDataUrl(id);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return { w: img.naturalWidth, h: img.naturalHeight, box, adjust: getDesignAdjust(id) };
  });
  if (before.w !== before.box.w || before.h !== before.box.h) return `FAIL: flattened panel is ${before.w}x${before.h}, print box is ${before.box.w}x${before.box.h}`;
  // Pick a frame with solid corners, apply, and check what the mug will get.
  await page.evaluate(() => { selectedFrame = 'Ornate Gold'; windowSillChoice = null; });
  await page.evaluate(() => updateAccessorizePreview());
  await T(page, 2500);
  const strip = await page.evaluate(async () => {
    const img = document.querySelector('#accessorizePreviewStrip img');
    if (!img) return null;
    await new Promise(r => { if (img.complete) r(); else img.onload = r; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data).slice(0, 3);
    // The frame's rails sit a few percent in from the panel edge (the extreme corner may be
    // ornament fringe showing the product colour, by design). The centre must be the picture.
    return { w: c.width, h: c.height, rail: px(Math.round(c.width * 0.05), c.height >> 1), top: px(c.width >> 1, Math.round(c.height * 0.05)), centre: px(c.width >> 1, c.height >> 1) };
  });
  if (!strip) return 'FAIL: no framed preview in the strip';
  if (strip.w !== before.box.w || strip.h !== before.box.h) return `FAIL: framed preview is ${strip.w}x${strip.h}, not the panel`;
  const white = p => p.every(v => v > 245);
  if (white(strip.rail) || white(strip.top)) return `FAIL: frame does not reach the panel edge (rail ${strip.rail}, top ${strip.top})`;
  if (white(strip.centre)) return `FAIL: the picture is missing from inside the frame (centre ${strip.centre})`;
  const calls0 = log.apiCalls.length;
  await page.click('#accessorizeSatisfiedBtn');
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 30000 });
  const after = await page.evaluate(() => ({ left: getDesignAdjust(placements.left), right: placementAdjust.right, applied: coverMeFrameApplied }));
  const a = after.left;
  if (!after.applied) return 'FAIL: frame not applied';
  if (a.zoom !== 1 || a.offX !== 0 || a.offY !== 0 || a.fade !== 0 || a.backdrop !== null) return `FAIL: framed panel not set to fill the print area: ${JSON.stringify(a)}`;
  const nudge1 = await page.evaluate(() => ({ nudge: getComputedStyle(document.getElementById('mockupLightboxNudge')).display, pulse: document.getElementById('mockupLightboxFrame').classList.contains('cta-flash') }));
  if (nudge1.nudge !== 'none' || nudge1.pulse) return `FAIL: framed mockup should settle the nudge and pulse: ${JSON.stringify(nudge1)}`;
  if (after.right.zoom !== 1 || after.right.fade !== 0) return `FAIL: the other panel carrying the picture kept old settings: ${JSON.stringify(after.right)}`;
  // Back undoes it, settings and all
  await page.click('#mockupLightboxBack');
  await T(page, 800);
  const undone = await page.evaluate(() => getDesignAdjust(placements.left));
  if (undone.zoom !== 0.7 || undone.fade !== 40 || undone.backdrop !== 'bubbles' || Math.abs(undone.offX - 0.4) > 0.01) return `FAIL: Back did not restore the placement: ${JSON.stringify(undone)}`;
  return 'PASS: the frame is laid over the print panel (size, position, fade and backdrop inside it), fills the panel edge to edge, and Back restores the placement';
};

(async () => {
  let failed = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch({ viewport: { width: 420, height: 800 } });
    let result;
    try { if (name !== 'knockedOutFramesShowThePhoto') await openStudio(page); result = await fn(page, log); }
    catch (e) { result = `FAIL (threw): ${e.message}`; }
    const errs = log.pageErrors.length ? ` | pageErrors: ${log.pageErrors.join(' ; ')}` : '';
    console.log(`${name}: ${result}${errs}`);
    if (!/^PASS/.test(result) || log.pageErrors.length) failed++;
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
