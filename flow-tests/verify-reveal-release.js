// THE FREEZE AT THE REVEAL (Alyx, Sep 2026, reproduced twice in a row):
// "at 28.4 seconds the screen suddenly goes dark... if I try to scroll up or
// down the generate image button will highlight again, but I am bound to this
// area, to this panel. Can't scroll down, can only scroll up about 1 inch."
//
// Two things stayed switched on after the picture was finished, both of which
// only belong there WHILE Needles paints:
//   * body.generation-active held every other card at opacity .28 AND
//     pointer-events:none -- genuinely unclickable, not merely faint;
//   * scrollPinTargets() clamped the window to the band from the picture down
//     to the approve row, and scrollPinOnScroll() yanked the page back inside
//     it on every scroll event. Measured before the fix: scrollTo(0, 8116)
//     came back to 1260 within 50ms, every attempt.
// Yes / No are the only way out of that screen, so a customer whose screen put
// them below the fold had no way out at all.
//
// These checks pin the release: the page scrolls freely, nothing is
// click-locked, Yes is genuinely reachable, and the release is handed back
// when the customer moves on.
const { launch, openStudio, uploadPhoto } = require('./harness');

const clearAlerts = async page => {
  for (let i = 0; i < 8; i++) {
    const n = await page.evaluate(() => {
      let n = 0;
      document.querySelectorAll('.big-alert-overlay.visible').forEach(o => {
        o.classList.remove('visible'); o.style.display = 'none'; n++;
      });
      return n;
    });
    if (!n) break;
    await page.waitForTimeout(200);
  }
};

// Alyx's exact route: the AI track, a style chosen before the product, then a
// 15oz Color Pop mug in blue on three panels.
async function runToReveal(page) {
  await openStudio(page);
  await uploadPhoto(page);
  await page.click('#postUploadForkRow button:has-text("Create Your Design")');
  await page.waitForTimeout(900); await clearAlerts(page);
  await page.locator('#styleSectionCard .btn-select', { hasText: 'Caricature Assassination' }).click({ force: true });
  await page.waitForTimeout(400);
  await page.click('#styleContinueBtn');
  await page.waitForTimeout(900); await clearAlerts(page);
  await page.fill('#ideaDesc', 'smug CEO of mug shots');
  await page.waitForTimeout(600); await clearAlerts(page);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await page.waitForTimeout(900); await clearAlerts(page);
  await page.locator('#mugSizeCard .btn-select', { hasText: '15oz' }).click({ force: true });
  await page.waitForTimeout(1200); await clearAlerts(page);
  await page.locator('#preGenMugStyleGrid .btn-select', { hasText: 'Color Pop' }).first().click({ force: true });
  await page.waitForTimeout(1200); await clearAlerts(page);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#preGenMugColorGrid .color-btn')]
      .find(e => e.textContent.trim() === 'Blue') || document.querySelector('#preGenMugColorGrid .color-btn');
    pickPreGenMugColor(b, 'Blue');
  });
  await page.waitForTimeout(2000); await clearAlerts(page);
  await page.evaluate(() => finishPreGenMugColorPick());
  await page.waitForTimeout(1500); await clearAlerts(page);
  await page.evaluate(() => pickMugPrintMode('three-panel'));
  await page.waitForTimeout(1200); await clearAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn').click());
  await page.waitForFunction(
    () => document.getElementById('approveRow')?.style.display !== 'none',
    null, { timeout: 120000 }
  );
  await page.waitForTimeout(5000); // the reveal tail and its landing scroll
}

const results = [];
const check = (ok, msg) => { results.push((ok ? 'PASS: ' : 'FAIL: ') + msg); return ok; };

(async () => {
  const { browser, page } = await launch({ width: 430, height: 880 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await runToReveal(page);

    // 1. THE PAGE SCROLLS. The whole failure in one number.
    const scroll = await page.evaluate(async () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, max);
      await new Promise(r => setTimeout(r, 900));
      return { reached: Math.round(scrollY), max: Math.round(max) };
    });
    check(scroll.reached >= scroll.max - 40,
      `page scrolls to the bottom at the reveal (reached ${scroll.reached} of ${scroll.max})`);

    // 2. NO PIN AT ALL while the finished picture is up.
    const pin = await page.evaluate(() =>
      (typeof scrollPinTargets === 'function' ? (scrollPinTargets() || []).map(e => e.id || e.tagName) : ['NO-FN']));
    check(pin.length === 0, `no scroll pin at the reveal (got ${JSON.stringify(pin)})`);

    // 3. A DIM IS A GUIDE, NOT A CAGE. Dimmed is fine; dead is not.
    const cards = await page.evaluate(() => {
      const out = {};
      ['frameSectionCard', 'productCard', 'likenessSectionCard', 'mugPrintModeCard'].forEach(id => {
        const e = document.getElementById(id); if (!e) return;
        out[id] = getComputedStyle(e).pointerEvents;
      });
      return out;
    });
    const locked = Object.entries(cards).filter(([, pe]) => pe === 'none').map(([id]) => id);
    check(locked.length === 0, `no card is click-locked at the reveal (locked: ${JSON.stringify(locked)})`);

    // 4. THE WAY OUT IS ACTUALLY THERE. Not just displayed -- hit-testable.
    await page.evaluate(() => document.querySelector('#approveRow button')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);
    const yes = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#approveRow button')].find(x => x.textContent.includes('Yes'));
      if (!b) return { missing: true };
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { inView: r.top >= 0 && r.bottom <= innerHeight, reachable: b.contains(top) || b === top };
    });
    check(!yes.missing && yes.inView && yes.reachable,
      `the Yes button is reachable at the reveal (${JSON.stringify(yes)})`);

    // 5. Save and Copy too -- Alyx: "they have paid for this image".
    const saveBar = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Save Image'));
      if (!b) return { missing: true };
      return { shown: b.offsetParent !== null, pe: getComputedStyle(b).pointerEvents };
    });
    check(!saveBar.missing && saveBar.shown && saveBar.pe !== 'none',
      `Save Image is live at the reveal (${JSON.stringify(saveBar)})`);

    // 6. THE RELEASE IS HANDED BACK. Moving on must clear the reveal state,
    //    or the next screen opens dimmed with nothing to explain it.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#approveRow button')].find(x => x.textContent.includes('Yes'));
      b.click();
    });
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => document.body.className);
    check(!after.includes('design-revealed') && !after.includes('generation-active'),
      `the reveal state is cleared once the design is approved (body="${after}")`);

    check(errors.length === 0, `no page errors (${JSON.stringify(errors.slice(0, 3))})`);
  } catch (err) {
    results.push('FAIL: suite threw: ' + err.message);
  }
  await browser.close();
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL'));
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL REVEAL-RELEASE VERIFICATIONS PASSED');
  process.exit(failed.length ? 1 : 0);
})();
