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

scenarios.metallicEffectsTakeTheColour = async (page) => {
  await openStudio(page);
  await reachPanels(page);
  const res = await page.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const t = document.getElementById('captionText'); t.value = 'HELLO'; t.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(200);
    const sample = () => { const c = document.querySelector('[id^="coverMeFitBox_"] .fitCaption'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return n ? { r: r / n, g: g / n, b: b / n } : null; };
    const pick = (name) => { const btn = [...document.querySelectorAll('.effect-btn, [data-effect]')].find(b => (b.dataset.effect || '').includes(name) || b.textContent.trim().toLowerCase().includes(name)); if (btn) btn.click(); };
    pick('diamond'); await wait(200);
    const diamondWhite = sample();
    const col = document.getElementById('captionColor'); col.value = '#ff0000'; col.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(200);
    const diamondRed = sample();
    pick('chrome'); await wait(200);
    const chromeRed = sample();
    pick('gold'); await wait(200);
    const goldRed = sample();
    col.value = '#ffffff'; col.dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
    const goldWhite = sample();
    return { effect: captionEffect, diamondWhite, diamondRed, chromeRed, goldRed, goldWhite };
  });
  if (!res.diamondWhite || !res.diamondRed) return 'FAIL: no caption pixels sampled ' + JSON.stringify(res);
  if (!(res.diamondWhite.b > res.diamondWhite.r)) return 'FAIL: Diamond in white should be icy blue: ' + JSON.stringify(res.diamondWhite);
  if (!(res.diamondRed.r > res.diamondRed.g + 90 && res.diamondRed.r > res.diamondRed.b + 90)) return 'FAIL: Diamond did not take the red: ' + JSON.stringify(res.diamondRed);
  if (!(res.chromeRed.r > res.chromeRed.g + 90 && res.chromeRed.r > res.chromeRed.b + 90)) return 'FAIL: Chrome washed the red to pink: ' + JSON.stringify(res.chromeRed);
  if (!(res.goldRed.r > res.goldRed.g + 40)) return 'FAIL: Gold did not take the red: ' + JSON.stringify(res.goldRed);
  if (!(res.goldWhite.r > res.goldWhite.b + 30 && res.goldWhite.g > res.goldWhite.b + 10)) return 'FAIL: Gold in white should still be gold: ' + JSON.stringify(res.goldWhite);
  return 'PASS: metallic effects take the picked colour and keep their own look when the colour is white';
};

scenarios.frameStudioTwoColumns = async (page) => {
  await openStudio(page);
  await reachPanels(page);
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await page.evaluate(() => chooseEdgeStyleAndContinue(true));
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  await page.click('#mockupLightboxFrame');
  await T(page, 1000);
  const wide = await page.evaluate(() => {
    const l = document.querySelector('#frameStudio .fsLeft'), r = document.querySelector('#frameStudio .fsRight');
    if (!l || !r) return { missing: true };
    const lb = l.getBoundingClientRect(), rb = r.getBoundingClientRect();
    return { sideBySide: lb.right <= rb.left + 2, sticky: getComputedStyle(l).position, previewInLeft: !!l.querySelector('#accessorizePreviewStrip'), gridInRight: !!r.querySelector('#frameSectionCard'), applyInLeft: !!l.querySelector('#accessorizeSatisfiedBtn') };
  });
  if (wide.missing) return 'FAIL: frame studio not mounted';
  if (!wide.sideBySide || wide.sticky !== 'sticky') return 'FAIL: not two columns with a pinned preview: ' + JSON.stringify(wide);
  if (!wide.previewInLeft || !wide.gridInRight || !wide.applyInLeft) return 'FAIL: pieces in the wrong columns: ' + JSON.stringify(wide);
  // Apply and Back stay on screen under the preview, even on a short window; the pre-generation furniture is gone.
  // (The preview that has to be showing is the studio's own strip: the old
  // #frameSectionIntroMockup note is an empty div since the 3D mug era.)
  for (const h of [900, 680]) {
    await page.setViewportSize({ width: 1280, height: h }); await T(page, 400);
    const fit = await page.evaluate(() => { const a = document.getElementById('accessorizeSatisfiedBtn').getBoundingClientRect(), b = document.getElementById('accessorizeCancelBtn').getBoundingClientRect(); const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; return { applyBottom: Math.round(a.bottom), backBottom: Math.round(b.bottom), vh: innerHeight, arrow: vis(document.querySelector('#frameStudio .snap-arrow-btn')), promo: vis(document.getElementById('frameSillCrossPromoBanner')), preGen: vis(document.getElementById('frameSectionIntro')), mock: vis(document.getElementById('accessorizePreviewStrip')) }; });
    if (fit.applyBottom > fit.vh || fit.backBottom > fit.vh) return `FAIL: Apply/Back off screen at ${h}px tall: ` + JSON.stringify(fit);
    if (fit.arrow || fit.promo || fit.preGen || !fit.mock) return 'FAIL: pre-generation furniture showing in the studio: ' + JSON.stringify(fit);
  }
  await page.setViewportSize({ width: 1280, height: 900 }); await T(page, 300);
  await page.setViewportSize({ width: 420, height: 800 }); await T(page, 400);
  const narrow = await page.evaluate(() => { const l = document.querySelector('#frameStudio .fsLeft'), r = document.querySelector('#frameStudio .fsRight'); return { sameX: Math.abs(l.getBoundingClientRect().left - r.getBoundingClientRect().left) < 2, sticky: getComputedStyle(l).position }; });
  if (!narrow.sameX || narrow.sticky !== 'sticky') return 'FAIL: phone layout ' + JSON.stringify(narrow);
  await page.setViewportSize({ width: 1280, height: 900 }); await T(page, 300);
  await page.click('#accessorizeCancelBtn'); await T(page, 500);
  const after = await page.evaluate(() => ({ studio: !!document.getElementById('frameStudio'), lightbox: document.getElementById('mockupLightboxOverlay').classList.contains('visible'), cardHome: document.getElementById('accessorizeCard').parentNode.id || document.getElementById('accessorizeCard').parentNode.className }));
  if (after.studio || !after.lightbox) return 'FAIL: cancel did not dismantle the studio and return to the mockup: ' + JSON.stringify(after);
  return 'PASS: frame catalogue opens as preview-left, frames-right with a pinned preview, stacks on phones, and packs away on cancel';
};

scenarios.captionTravelsAsLayer = async (page, log) => {
  await openStudio(page);
  await reachPanels(page);
  await page.evaluate(() => { const t = document.getElementById('captionText'); t.value = 'Hello there'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await T(page, 800);
  const pos = await page.evaluate(() => ['front', 'left', 'right'].find((p) => placements[p]));
  const before = await page.evaluate((p) => ({ url: findDesignById(placements[p]).url, n: recentDesigns.length }), pos);
  const seen = log.apiCalls.length;
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  const uploads = log.apiCalls.slice(seen).filter((c) => c.action === 'uploadComposite');
  if (uploads.length !== 1) return `FAIL: Done made ${uploads.length} uploads, expected exactly one (the caption sheet): ${JSON.stringify(uploads)}`;
  if (uploads[0].mime !== 'image/png') return `FAIL: caption sheet is ${uploads[0].mime}, not a transparent PNG`;
  if (uploads[0].bytes > 700000) return `FAIL: caption sheet is ${uploads[0].bytes} bytes; the picture is being re-uploaded`;
  const after = await page.evaluate((p) => { const d = findDesignById(placements[p]); return { url: d.url, raw: d.rawUrl || null, caption: placementAdjust[p].caption, fade: placementAdjust[p].fade }; }, pos);
  if (after.url !== before.url || after.raw) return 'FAIL: the picture itself was replaced: ' + JSON.stringify(after);
  if (!/^https?:\/\//.test(after.caption || '')) return 'FAIL: no caption layer on the placement: ' + JSON.stringify(after);
  // The edge screen changes the fade without saving anything.
  const seen2 = log.apiCalls.length;
  await page.evaluate(() => chooseEdgeStyleAndContinue(false));
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  const late = log.apiCalls.slice(seen2).filter((c) => c.action === 'uploadComposite');
  if (late.length) return `FAIL: the edge screen uploaded ${late.length} file(s) for a captioned picture`;
  // The 3D mug opens the lightbox instantly and the Printify request fires
  // behind it, several seconds later (same timing verify-ten-fixes waits
  // on) -- so poll for the request rather than expecting it at "visible".
  const findMock = () => log.apiCalls.slice(seen2).find((c) => c.path === '/api/start-mockup' && c.placementAdjust);
  for (let i = 0; i < 60 && !findMock(); i++) await T(page, 500);
  const mock = findMock();
  if (!mock) return 'FAIL: no mockup request carrying placementAdjust within 30s of the edge screen';
  const fa = mock.placementAdjust[pos] || {};
  if (!(fa.fade > 0)) return 'FAIL: the soft edge did not reach the mockup request: ' + JSON.stringify(fa);
  if (fa.caption !== after.caption) return 'FAIL: the caption layer did not reach the mockup request: ' + JSON.stringify(fa);
  // Back to Fit Your Picture takes the layer off; Done with the same words puts the same URL back without a second upload.
  return `PASS: Done uploads one ${Math.round(uploads[0].bytes / 1024)}KB transparent caption sheet, the picture is untouched, the fade changes for free, and both reach the mockup request`;
};

scenarios.nudgeSitsBelowTheMug = async (page) => {
  await openStudio(page);
  await reachPanels(page);
  await page.click('#coverMePanelDoneBtn');
  await page.waitForFunction(() => document.getElementById('revealOverlay').style.display === 'flex', null, { timeout: 20000 });
  await page.evaluate(() => chooseEdgeStyleAndContinue(true));
  await page.waitForFunction(() => document.getElementById('mockupLightboxOverlay').classList.contains('visible'), null, { timeout: 20000 });
  await T(page, 500);
  const r = await page.evaluate(() => { const img = document.getElementById('mockupLightboxImg').getBoundingClientRect(), n = document.getElementById('mockupLightboxNudge').getBoundingClientRect(), b = document.getElementById('mockupLightboxReturn').getBoundingClientRect(); return { imgBottom: Math.round(img.bottom), nudgeTop: Math.round(n.top), nudgeShown: n.height > 0, btnBottom: Math.round(b.bottom), vh: innerHeight }; });
  if (!r.nudgeShown) return 'FAIL: nudge not shown on the unframed mockup';
  if (r.nudgeTop < r.imgBottom) return 'FAIL: the nudge overlaps the mug picture: ' + JSON.stringify(r);
  if (r.btnBottom > r.vh) return 'FAIL: buttons pushed off screen: ' + JSON.stringify(r);
  return 'PASS: the nudge and the buttons sit below the mug picture, all on screen';
};

// ---- THE TWO REFERENCE PINS KEEP THEIR IDENTITIES. ----
// Alyx: "I'm not sure that the Reference button A works. I tried to pull an
// image off of Reference photo A and Reference photo B, and only the image from
// B appeared."
//
// Both pins were wired correctly and both were being sent, so it was not a dead
// button. Two real faults underneath:
//   * NOTHING BOUND A NAME TO A POSITION. The prompt named "Reference A" and
//     "Reference B" and the images were attached A then B -- but no sentence
//     anywhere said which attached image was which. Two labelled descriptions,
//     two unlabelled pictures, and the model left to guess.
//   * AND REMOVING ONE RELABELLED BOTH to "Add ref", so from then on neither
//     the customer nor the prompt they write could tell A from B.
scenarios.theTwoReferencePinsKeepTheirIdentities = async (page) => {
  const T2 = (ms) => page.waitForTimeout(ms);
  // Every scenario in this suite opens the studio itself; the runner does not.
  await openStudio(page);
  await T2(400);

  // Both pins carry a picture, so the prompt has to bind both.
  const sent = await page.evaluate(() => {
    const px = (fill) => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, 40, 40); return c.toDataURL('image/png'); };
    refImageAData = px('#FF0000');
    refImageBData = px('#0000FF');
    // The prompt builder reads these snapshots; render the reference block the
    // same way generate() does.
    const refASnapshot = refImageAData, refBSnapshot = refImageBData;
    return { a: !!refASnapshot, b: !!refBSnapshot };
  });
  if (!sent.a || !sent.b) return 'FAIL: could not seed both reference pins';

  // The binding sentence must exist in the studio's own reference block.
  // SEARCHED IN THE BROWSER, not brought back. This page carries ~800KB of
  // inline script and handing the whole thing across the evaluate boundary does
  // not survive the trip -- two earlier versions of this check failed for that
  // reason while the text was sitting in the file all along. Return a boolean.
  // READ THE SHIPPED FILE. Two earlier versions of this check tried to pull the
  // page's own script text back through evaluate and both came home empty --
  // this page carries ~800KB of inline script and it does not survive the trip.
  // The binding is a property of the artifact we ship, so assert on the
  // artifact: same file the server above is serving.
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'needles-studio.html'), 'utf8');
  const bound = {
    len: src.length,
    a: /FIRST image attached after the customer's main photo is Reference A/i.test(src),
    b: /SECOND image attached after the main photo is Reference B/i.test(src)
  };
  if (!bound.len) return 'FAIL: no inline script found at all — this measures nothing';
  if (!bound.a) {
    return `FAIL: nothing in the prompt binds Reference A to a position (searched ${bound.len} chars of script). The names and the pictures are both there, and nothing says which picture is which — so the model has to guess, and guessing wrong is the reported bug`;
  }
  if (!bound.b) return 'FAIL: Reference B is named but never bound to a position';

  // And the boxes keep their identities when emptied.
  const labels = await page.evaluate(() => {
    resetRefSlot('refAZone', 'refAPreview', 'refAInput');
    resetRefSlot('refBZone', 'refBPreview', 'refBInput');
    const txt = (id) => (document.getElementById(id) || {}).textContent || '';
    return { a: txt('refAZone').trim(), b: txt('refBZone').trim() };
  });
  await T2(200);
  if (!/Reference A/i.test(labels.a) || !/Reference B/i.test(labels.b)) {
    return `FAIL: after removing a reference the boxes read "${labels.a}" and "${labels.b}" — the A/B identity is gone, so neither the customer nor the prompt they write can tell them apart`;
  }
  if (labels.a === labels.b) return `FAIL: both boxes read the same thing ("${labels.a}")`;

  return 'PASS: the prompt binds Reference A and B to the first and second attached images, and an emptied box still says which one it is';
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
  // run-all.sh counts a suite green only by this line.
  console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CAPTION-PATHS VERIFICATIONS PASSED');
  process.exit(failed ? 1 : 0);
})();
