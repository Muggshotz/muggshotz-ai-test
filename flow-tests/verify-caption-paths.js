// Caption path shapes (Sep 2026): letters never pile up on a curve; the
// fit card keeps the picture in view; Generate hides the older prompt.
const { launch, openStudio, uploadPhotoAndChooseBYO, dismissAlerts } = require('./harness');
const T = (page, ms) => page.waitForTimeout(ms);

async function reachPanels(page) {
  await uploadPhotoAndChooseBYO(page);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await T(page, 1200); await dismissAlerts(page);
  await page.evaluate(() => pickPreGenMugSize('15oz')); await T(page, 500);
  await page.evaluate(() => pickPreGenMugStyle('Trimmed')); await T(page, 900);
  await page.evaluate(() => document.querySelector('#preGenMugColorGrid .color-btn').click()); await T(page, 900);
  await page.evaluate(() => finishPreGenMugColorPick());
  await page.waitForFunction(() => document.getElementById('coverMePanelCard').style.display === 'block', null, { timeout: 15000 });
  await T(page, 600);
}

const scenarios = {};

scenarios.curvedLettersNeverOverlap = async (page) => {
  await openStudio(page);
  const res = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    const ctx = c.getContext('2d'); ctx.font = '700 60px Arial';
    const text = "If you ain't cruisin', you're losin'";
    const out = {};
    for (const [name, fn, arg] of [['smile20', 'arc', -20], ['smile60', 'arc', -60], ['arch100', 'arc', 100], ['wave70', 'wave', 70]]) {
      for (const pos of [{ x: 600, y: 700, align: 'center', baseline: 'bottom' }, { x: 40, y: 40, align: 'left', baseline: 'top' }]) {
        const pts = [];
        const spy = (ch) => { const m = ctx.getTransform(); pts.push({ ch, x: m.e, y: m.f, w: ctx.measureText(ch).width }); };
        if (fn === 'arc') drawTextOnArc(ctx, text, pos, c, arg, 0, 60, spy); else drawTextOnWave(ctx, text, pos, c, arg, 0, 60, spy);
        let minRatio = 9, offCanvas = 0;
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          const need = (pts[i].w + pts[i - 1].w) / 2;
          if (need > 2) minRatio = Math.min(minRatio, d / need);
        }
        for (const p of pts) if (p.x < -5 || p.y < -5 || p.x > c.width + 5 || p.y > c.height + 5) offCanvas++;
        out[name + '_' + pos.align] = { minRatio: +minRatio.toFixed(2), offCanvas, n: pts.length };
      }
    }
    return out;
  });
  for (const [k, v] of Object.entries(res)) {
    if (v.minRatio < 0.9) return `FAIL: letters overlap on ${k} (spacing ratio ${v.minRatio})`;
    if (v.offCanvas) return `FAIL: ${v.offCanvas} letters left the canvas on ${k}`;
  }
  return 'PASS: smile, arch and wave keep every letter its own width apart at every bend, and stay on the canvas';
};

scenarios.fitCardKeepsPictureInView = async (page) => {
  await openStudio(page);
  await reachPanels(page);
  await page.evaluate(() => document.querySelector('[id^="coverMeFitBox_"]').scrollIntoView());
  const wide = await page.evaluate(() => {
    const l = document.querySelector('.fitLeft').getBoundingClientRect(), r = document.querySelector('.fitRight').getBoundingClientRect();
    return { sideBySide: l.right <= r.left + 2, sticky: getComputedStyle(document.querySelector('.fitLeft')).position, tiles: document.querySelectorAll('#curveModeRow .curve-mode-btn').length };
  });
  if (!wide.sideBySide) return 'FAIL: fit card is not two columns at desktop width';
  if (wide.sticky !== 'sticky') return `FAIL: picture column is ${wide.sticky}, not pinned`;
  if (wide.tiles !== 5) return `FAIL: expected 5 path tiles, got ${wide.tiles}`;
  await page.setViewportSize({ width: 420, height: 800 });
  await T(page, 500);
  const narrow = await page.evaluate(() => {
    const l = document.querySelector('.fitLeft').getBoundingClientRect(), r = document.querySelector('.fitRight').getBoundingClientRect();
    const box = document.querySelector('[id^="coverMeFitBox_"]');
    // Stacked = one grid column: both columns share the same left edge and width.
    return { stacked: Math.abs(l.left - r.left) < 2 && Math.abs(l.width - r.width) < 2, sticky: getComputedStyle(document.querySelector('.fitLeft')).position, boxH: box.clientHeight, vh: innerHeight };
  });
  if (!narrow.stacked) return 'FAIL: fit card did not stack on a phone';
  if (narrow.sticky !== 'sticky') return 'FAIL: picture not pinned on a phone';
  if (narrow.boxH > narrow.vh * 0.36) return `FAIL: pinned picture too tall on a phone (${narrow.boxH}px of ${narrow.vh})`;
  // Smile tile shows the Bend slider; caption draws on the fit box
  await page.evaluate(() => { document.getElementById('captionText').value = 'Hello there'; document.getElementById('captionText').dispatchEvent(new Event('input', { bubbles: true })); });
  // On a phone the pinned picture sits over the top of the scrolled controls, so bring the tile to the middle first.
  await page.evaluate(() => document.querySelector('#curveModeRow .curve-mode-btn[data-mode="smile"]').scrollIntoView({ block: 'center' }));
  await T(page, 300);
  await page.click('#curveModeRow .curve-mode-btn[data-mode="smile"]');
  await T(page, 300);
  const st = await page.evaluate(() => ({ mode: curveMode, bendShown: getComputedStyle(document.getElementById('sliderModeBox')).display !== 'none', capShown: getComputedStyle(document.querySelector('[id^="coverMeFitBox_"] .fitCaption')).display !== 'none' }));
  if (st.mode !== 'smile' || !st.bendShown) return `FAIL: Smile tile state ${JSON.stringify(st)}`;
  if (!st.capShown) return 'FAIL: caption layer not shown on the fit box';
  return 'PASS: two columns with a pinned picture on desktop, stacked with a pinned picture on phone, five path tiles with a Bend slider';
};

scenarios.generateHidesTheOlderPrompt = async (page) => {
  await openStudio(page);
  const st = await page.evaluate(() => {
    product = 'mug'; mugGuidedChangesActive = true; updateIdeaCardNote();
    const on = { row: document.getElementById('mugIdeaActionRow').style.display, prompt: getComputedStyle(document.getElementById('ideaGuidancePrompt')).display };
    mugGuidedChangesActive = false; updateIdeaCardNote();
    const off = { row: document.getElementById('mugIdeaActionRow').style.display, prompt: document.getElementById('ideaGuidancePrompt').style.display };
    return { on, off };
  });
  if (st.on.row !== 'flex' || st.on.prompt !== 'none') return `FAIL: with Generate showing, prompt is ${st.on.prompt}`;
  if (st.off.row !== 'none' || st.off.prompt !== '') return `FAIL: prompt did not come back when Generate went away: ${JSON.stringify(st.off)}`;
  return 'PASS: the satisfied prompt hides while Generate is on screen and returns when it is not';
};

(async () => {
  let failed = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch({ viewport: { width: 1280, height: 900 } });
    let result;
    try { result = await fn(page, log); } catch (e) { result = `FAIL (threw): ${e.message}`; }
    const errs = log.pageErrors.length ? ` | pageErrors: ${log.pageErrors.join(' ; ')}` : '';
    console.log(`${name}: ${result}${errs}`);
    if (!/^PASS/.test(result) || log.pageErrors.length) failed++;
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
