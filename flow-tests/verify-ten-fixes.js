// Walks the Bring Your Own Art mug flow through the Sep 2026 rebuild:
// one picture + three switches on the panels screen, Center inheriting
// the picture's settings, a one-picture edge screen that uploads nothing,
// the frame offer on the mockup, and the wait message.
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
  await page.evaluate(() => {
    const btn = document.querySelector('#preGenMugColorGrid .color-btn');
    if (btn) btn.click();
  });
  await T(page, 900);
  await page.evaluate(() => finishPreGenMugColorPick());
  await page.waitForFunction(() => document.getElementById('coverMePanelCard').style.display === 'block', null, { timeout: 15000 });
  await T(page, 600);
}

const scenarios = {};

scenarios.panelsScreenShowsOnePictureAndSwitches = async (page) => {
  await reachPanels(page);
  const st = await page.evaluate(() => ({
    fitBoxes: document.querySelectorAll('#coverMeFitWrap [data-design-id]').length,
    imgs: document.querySelectorAll('#coverMePanelRows img').length,
    switches: document.querySelectorAll('#coverMePanelRows .panelSwitch').length,
    left: document.getElementById('coverMeSwitch_left').checked,
    front: document.getElementById('coverMeSwitch_front').checked,
    right: document.getElementById('coverMeSwitch_right').checked,
    links: document.querySelectorAll('#coverMePanelLinks *').length,
    back: getComputedStyle(document.getElementById('coverMePanelBackBtn')).display,
    done: document.getElementById('coverMePanelDoneBtn').disabled,
  }));
  if (st.fitBoxes !== 1) return `FAIL: expected one Fit box, got ${st.fitBoxes}`;
  if (st.imgs !== 0) return `FAIL: the panels area still shows ${st.imgs} picture(s)`;
  if (st.switches !== 3) return `FAIL: expected 3 switches, got ${st.switches}`;
  if (!st.left || st.front || !st.right) return `FAIL: switch defaults wrong L=${st.left} C=${st.front} R=${st.right}`;
  if (st.links !== 0) return 'FAIL: "different image" links offered on a bring-your-own-art flow';
  if (st.back === 'none') return 'FAIL: no Back button on the panels screen';
  if (st.done) return 'FAIL: Done disabled with two panels on';
  return 'PASS: one picture, three switches, Left+Right on, Center off, no token links, Back present';
};

scenarios.centerSwitchInheritsSettings = async (page) => {
  await reachPanels(page);
  await page.evaluate(() => {
    const id = placements.left;
    setDesignAdjust(id, { zoom: 1.37, offX: 0.25, offY: -0.5, fade: 55, border: false });
  });
  await page.click('.panelSwitch[data-pos="front"]');
  await T(page, 400);
  const st = await page.evaluate(() => ({
    front: placements.front, left: placements.left,
    adj: placementAdjust.front, fitBoxes: document.querySelectorAll('#coverMeFitWrap [data-design-id]').length,
    checked: document.getElementById('coverMeSwitch_front').checked,
  }));
  if (st.front !== st.left) return 'FAIL: Center did not get the same picture';
  const a = st.adj || {};
  if (Math.abs(a.zoom - 1.37) > 0.01 || Math.abs(a.offX - 0.25) > 0.01 || Math.abs(a.offY + 0.5) > 0.01 || a.fade !== 55 || a.border !== false)
    return `FAIL: Center did not inherit the settings: ${JSON.stringify(a)}`;
  if (st.fitBoxes !== 1) return `FAIL: still ${st.fitBoxes} fit boxes after Center on`;
  if (!st.checked) return 'FAIL: Center switch not shown as on';
  // Off again, then on again: still the same settings.
  await page.click('.panelSwitch[data-pos="left"]');
  await T(page, 300);
  const off = await page.evaluate(() => ({ left: placements.left, done: document.getElementById('coverMePanelDoneBtn').disabled }));
  if (off.left) return 'FAIL: switching Left off did not remove it';
  await page.click('.panelSwitch[data-pos="left"]');
  await T(page, 300);
  const on = await page.evaluate(() => ({ left: placements.left, fade: placementAdjust.left.fade }));
  if (!on.left || on.fade !== 55) return `FAIL: Left back on lost its settings (${JSON.stringify(on)})`;
  return 'PASS: Center (and a re-enabled Left) carry the picture with its size, position, fade and frame choice';
};

scenarios.edgeScreenOnePictureNoUpload = async (page, log) => {
  await reachPanels(page);
  await page.evaluate(() => { const id = placements.left; const a = getDesignAdjust(id); a.fade = 30; setDesignAdjust(id, a); });
  const before = log.apiCalls.length;
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await T(page, 800);
  const st = await page.evaluate(() => ({
    accessorize: document.getElementById('accessorizeCard').style.display,
    fitBox: !!document.getElementById('revealFitBox'),
    imgs: document.querySelectorAll('#revealOverlay img').length,
    visibleImgs: [...document.querySelectorAll('#revealOverlay img')].filter(i => i.getBoundingClientRect().width > 0).length,
    fadeCanvas: (() => { const c = document.querySelector('#revealFitBox .fitFade'); return c ? getComputedStyle(c).display : 'missing'; })(),
    note: document.getElementById('revealFitNote').textContent,
    buttons: document.getElementById('revealEdgeButtonsRow').style.display,
    back: !!document.getElementById('revealEdgeBackBtn'),
  }));
  if (st.accessorize === 'block') return 'FAIL: the frame offer still opens before the edge question';
  if (!st.fitBox) return 'FAIL: no fitted print box on the edge screen';
  if (st.visibleImgs !== 1) return `FAIL: ${st.visibleImgs} pictures visible on the edge screen`;
  if (st.fadeCanvas !== 'block') return `FAIL: fade not drawn on the edge preview (${st.fadeCanvas})`;
  if (!/Left and Right/.test(st.note)) return `FAIL: applies-to note wrong: "${st.note}"`;
  // Fade slider path
  await page.evaluate(() => chooseFadeEdges());
  await T(page, 200);
  const slider = await page.evaluate(() => document.getElementById('revealFadeAmountSlider').value);
  if (slider !== '30') return `FAIL: slider did not start at the placement fade (got ${slider})`;
  await page.evaluate(() => { const s = document.getElementById('revealFadeAmountSlider'); s.value = 62; s.dispatchEvent(new Event('input')); });
  await T(page, 200);
  const calls0 = log.apiCalls.length;
  await page.click('#revealFadeContinueBtn');
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  const uploads = log.apiCalls.slice(calls0).filter(c => c.path === '/api/generate');
  const fades = await page.evaluate(() => [placementAdjust.left.fade, placementAdjust.right.fade]);
  if (uploads.length) return `FAIL: Continue uploaded ${uploads.length} picture(s) — it should only set the placement fade`;
  if (fades[0] !== 62 || fades[1] !== 62) return `FAIL: fade not written to both panels: ${fades}`;
  const wait = await page.evaluate(() => document.getElementById('mockupLoadingOverlay').textContent.trim());
  if (!/Please be patient, this may take a moment/.test(wait)) return `FAIL: wait text is "${wait}"`;
  // Hard edges via Back then Hard
  await page.click('#mockupLightboxBack');
  await T(page, 400);
  const backTo = await page.evaluate(() => document.getElementById('revealOverlay').style.display);
  if (backTo !== 'flex') return 'FAIL: Back from the mockup did not return to the edge screen';
  const calls1 = log.apiCalls.length;
  await page.evaluate(() => chooseEdgeStyleAndContinue(true));
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  const uploads1 = log.apiCalls.slice(calls1).filter(c => c.path === '/api/generate');
  const hard = await page.evaluate(() => [placementAdjust.left.fade, placementAdjust.right.fade, hardEdgesEnabled]);
  if (uploads1.length) return 'FAIL: Hard Edges uploaded a picture';
  if (hard[0] !== 0 || hard[1] !== 0 || !hard[2]) return `FAIL: Hard Edges did not zero the fade: ${hard}`;
  return 'PASS: edge screen shows one fitted picture; Fade and Hard set the placement fade with no upload; wait text updated';
};

scenarios.edgeBackReturnsToPanels = async (page) => {
  await reachPanels(page);
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await page.click('#revealEdgeBackBtn');
  await T(page, 500);
  const st = await page.evaluate(() => ({
    panels: document.getElementById('coverMePanelCard').style.display,
    overlay: document.getElementById('revealOverlay').style.display,
    left: !!placements.left, right: !!placements.right, front: !!placements.front,
  }));
  if (st.panels !== 'block' || st.overlay === 'flex') return `FAIL: Back from the edge screen landed on ${JSON.stringify(st)}`;
  if (!st.left || !st.right || st.front) return `FAIL: panels changed on the way back: ${JSON.stringify(st)}`;
  return 'PASS: Back on the edge screen returns to the panels screen with the panels as they were';
};

scenarios.frameOfferOnTheMockup = async (page, log) => {
  await reachPanels(page);
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await page.evaluate(() => chooseEdgeStyleAndContinue(false));
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  await T(page, 300);
  const st = await page.evaluate(() => ({
    frameBtn: getComputedStyle(document.getElementById('mockupLightboxFrame')).display,
    label: document.getElementById('mockupLightboxFrame').textContent.trim(),
    backBtn: getComputedStyle(document.getElementById('mockupLightboxBack')).display,
    looksGood: getComputedStyle(document.getElementById('mockupLightboxReturn')).display,
  }));
  if (st.frameBtn === 'none') return 'FAIL: no Add a Frame button on the mockup';
  if (!/Add a Frame/.test(st.label)) return `FAIL: frame button reads "${st.label}"`;
  if (st.backBtn === 'none' || st.looksGood === 'none') return 'FAIL: Back / Looks Good missing from the mockup';
  const beforeUrls = await page.evaluate(() => ({ left: findDesignById(placements.left).url, fade: placementAdjust.left.fade }));
  await page.click('#mockupLightboxFrame');
  await T(page, 1200);
  const cat = await page.evaluate(() => ({
    lightbox: document.getElementById('mockupLightboxOverlay').classList.contains('visible'),
    card: document.getElementById('accessorizeCard').style.display,
    choice: document.getElementById('accessorizeChoicePanel').style.display,
    committed: document.getElementById('accessorizeCommittedContent').style.display,
    frameCard: getComputedStyle(document.getElementById('frameSectionCard')).display,
    sill: getComputedStyle(document.getElementById('windowSillSectionCard')).display,
    cancel: document.getElementById('accessorizeCancelBtn').textContent.trim(),
    stripImgs: document.querySelectorAll('#accessorizePreviewStrip img').length,
  }));
  if (cat.lightbox) return 'FAIL: lightbox still up over the frame catalogue';
  if (cat.card !== 'block' || cat.committed !== 'block' || cat.choice === 'block') return `FAIL: catalogue state ${JSON.stringify(cat)}`;
  if (cat.frameCard === 'none') return 'FAIL: frame catalogue not shown';
  if (cat.sill !== 'none') return 'FAIL: window sills offered on the mug photo flow';
  if (!/Back to the Mockup/.test(cat.cancel)) return `FAIL: cancel reads "${cat.cancel}"`;
  if (cat.stripImgs !== 1) return `FAIL: preview strip shows ${cat.stripImgs} pictures`;
  // Cancel → back to the same mockup, nothing changed
  await page.click('#accessorizeCancelBtn');
  await T(page, 500);
  const back = await page.evaluate(() => ({
    lightbox: document.getElementById('mockupLightboxOverlay').classList.contains('visible'),
    card: document.getElementById('accessorizeCard').style.display,
    url: findDesignById(placements.left).url, fade: placementAdjust.left.fade,
  }));
  if (!back.lightbox || back.card === 'block') return `FAIL: Cancel did not return to the mockup ${JSON.stringify(back)}`;
  if (back.url !== beforeUrls.left || back.fade !== beforeUrls.fade) return 'FAIL: Cancel changed the pictures';
  // Add a frame for real: pick the first frame, apply, mockup rebuilt
  await page.click('#mockupLightboxFrame');
  await T(page, 800);
  const picked = await page.evaluate(() => {
    const tile = document.querySelector('#frameSectionCard .frame-option, #frameSectionCard [data-frame], #frameGrid > *');
    if (tile) { tile.click(); return tile.className || tile.tagName; }
    return null;
  });
  await T(page, 1500);
  const sel = await page.evaluate(() => selectedFrame);
  if (!sel) return `FAIL: could not select a frame from the catalogue (clicked ${picked})`;
  const calls0 = log.apiCalls.length;
  await page.click('#accessorizeSatisfiedBtn');
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 30000 });
  await T(page, 300);
  const after = await page.evaluate(() => ({
    label: document.getElementById('mockupLightboxFrame').textContent.trim(),
    url: findDesignById(placements.left).url, fade: placementAdjust.left.fade,
    mockups: log => null,
  }));
  const mockupStarts = log.apiCalls.slice(calls0).filter(c => c.path === '/api/start-mockup' && c.action === 'start').length;
  if (mockupStarts !== 1) return `FAIL: expected one rebuilt mockup, got ${mockupStarts}`;
  const framedUploads = log.apiCalls.slice(calls0).filter(c => c.path === '/api/generate').length;
  const applied = await page.evaluate(() => coverMeFrameApplied && !!unframedDesignSnapshot);
  if (!applied) return 'FAIL: the frame was not baked into the picture';
  if (framedUploads !== 1) return `FAIL: one picture on two panels was saved ${framedUploads} times`;
  if (after.fade !== 0) return 'FAIL: fade not removed under the frame';
  if (!/Change Frame/.test(after.label)) return `FAIL: after framing the button reads "${after.label}"`;
  // Back from the framed mockup → catalogue with plain pictures; cancel → unframed mockup
  await page.click('#mockupLightboxBack');
  await T(page, 800);
  const undone = await page.evaluate(() => ({ card: document.getElementById('accessorizeCard').style.display, url: findDesignById(placements.left).url, fade: placementAdjust.left.fade }));
  if (undone.card !== 'block') return 'FAIL: Back from the framed mockup did not reopen the catalogue';
  const undoneFlag = await page.evaluate(() => coverMeFrameApplied);
  if (undoneFlag || undone.fade !== beforeUrls.fade) return `FAIL: Back did not restore the plain picture ${JSON.stringify(undone)}`;
  await page.click('#accessorizeCancelBtn');
  await T(page, 500);
  const fin = await page.evaluate(() => ({ lightbox: document.getElementById('mockupLightboxOverlay').classList.contains('visible'), label: document.getElementById('mockupLightboxFrame').textContent.trim() }));
  if (!fin.lightbox || !/Add a Frame/.test(fin.label)) return `FAIL: after undoing the frame ${JSON.stringify(fin)}`;
  return 'PASS: Add a Frame opens the catalogue from the mockup, Cancel returns, Apply rebuilds the mockup, Back undoes the frame';
};

scenarios.looksGoodReachesCheckout = async (page) => {
  await reachPanels(page);
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await page.evaluate(() => chooseEdgeStyleAndContinue(true));
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  await page.click('#mockupLightboxReturn');
  await T(page, 400);
  const st = await page.evaluate(() => document.getElementById('finalChoiceOverlay').style.display);
  if (st !== 'flex') return 'FAIL: Looks Good did not open What\'s Next';
  return 'PASS: Looks Good opens What\'s Next';
};

(async () => {
  let failed = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch({ viewport: { width: 420, height: 800 } });
    let result;
    try {
      await openStudio(page);
      result = await fn(page, log);
    } catch (e) { result = `FAIL (threw): ${e.message}`; }
    const errs = log.pageErrors.length ? ` | pageErrors: ${log.pageErrors.join(' ; ')}` : '';
    console.log(`${name}: ${result}${errs}`);
    if (!/^PASS/.test(result) || log.pageErrors.length) failed++;
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
