// Alyx's report (with screenshot): after picking Suitcase, the size card sat
// fully lit alongside the Product grid and everything else -- no single lit
// point of engagement, which the guided rail exists to guarantee. Picking a
// product cleared product-focus and added NOTHING.
//
// Each option card now takes the spotlight when its product is picked, and
// hands it on when its choice is made: option card -> (tote: colour card ->)
// idea card -> Generate. Dim-only, so detours stay clickable.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

async function pick(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await page.waitForTimeout(1400);
}

const state = (page, litId) => page.evaluate((litId) => {
  const lit = document.getElementById(litId);
  const prod = document.getElementById('productCard');
  const litCs = lit ? getComputedStyle(lit) : null;
  const prodCs = getComputedStyle(prod);
  return {
    focus: [...document.body.classList].filter(c => c.endsWith('-focus')),
    litOpacity: litCs ? Number(litCs.opacity) : null,
    productOpacity: Number(prodCs.opacity),
    productClickable: prodCs.pointerEvents !== 'none',
  };
}, litId);

function judge(label, st, wantFocus) {
  if (!st.focus.includes(wantFocus)) return `FAIL: ${label}: body has ${JSON.stringify(st.focus)}, expected ${wantFocus}`;
  if (st.focus.length !== 1) return `FAIL: ${label}: ${st.focus.length} spotlights at once: ${JSON.stringify(st.focus)}`;
  if (st.litOpacity < 0.9) return `FAIL: ${label}: the lit card itself is dimmed (${st.litOpacity})`;
  if (st.productOpacity > 0.5) return `FAIL: ${label}: Product card still fully lit (${st.productOpacity}) — Alyx's screenshot exactly`;
  if (!st.productClickable) return `FAIL: ${label}: dim became a cage — detours must stay clickable`;
  return `PASS: ${label}: one spotlight (${wantFocus}), product dimmed to ${st.productOpacity}, still clickable`;
}

const scenarios = {

  // The exact reported case.
  async suitcaseSizeSpotlit(page) {
    await pick(page, 'suitcase');
    return judge('suitcase', await state(page, 'suitcaseSizeCard'), 'suitcase-size-focus');
  },

  async puzzleSizeSpotlit(page) {
    await pick(page, 'puzzle');
    return judge('puzzle', await state(page, 'puzzleSizeCard'), 'puzzle-size-focus');
  },

  async phoneModelSpotlit(page) {
    await pick(page, 'phone case');
    return judge('phone case', await state(page, 'phoneCaseModelCard'), 'phone-model-focus');
  },

  async posterOptionsSpotlit(page) {
    await pick(page, 'photo poster');
    return judge('poster', await state(page, 'photoPosterOptionsCard'), 'poster-options-focus');
  },

  // The full tote relay: size card -> colour card -> idea card.
  async toteSpotlightRelay(page) {
    await pick(page, 'tote bag');
    let r = judge('tote size', await state(page, 'toteSizeCard'), 'tote-size-focus');
    if (/^FAIL/.test(r)) return r;
    await page.click('#toteSizeGrid .btn-select[data-tote-size=\'16" x 16"\']');
    await page.waitForTimeout(900);
    r = judge('tote colour', await state(page, 'toteBagColorCard'), 'tote-color-focus');
    if (/^FAIL/.test(r)) return r;
    await page.click('#toteBagColorGridGen .color-btn[data-color="Black"]');
    await page.waitForTimeout(1200);
    r = judge('tote idea', await state(page, 'ideaCard'), 'ideafirst-focus');
    if (/^FAIL/.test(r)) return r;
    return 'PASS: tote relays the spotlight size -> colour -> idea, one lit card at every step';
  },

  // Choosing the option hands the spotlight to the idea card.
  async suitcaseHandsToIdea(page) {
    await pick(page, 'suitcase');
    await page.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]');
    await page.waitForTimeout(1200);
    return judge('suitcase -> idea', await state(page, 'ideaCard'), 'ideafirst-focus');
  },

  // Confirming the description releases the spotlight toward Generate.
  async ideaReleaseClears(page) {
    await pick(page, 'suitcase');
    await page.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Small"]');
    await page.waitForTimeout(900);
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    await dismissAlerts(page);
    await page.evaluate(() => confirmIdeaSatisfied());
    await page.waitForTimeout(1500);
    const focus = await page.evaluate(() => [...document.body.classList].filter(c => c.endsWith('-focus')));
    if (focus.length) return `FAIL: spotlight not released after confirming the description: ${JSON.stringify(focus)}`;
    return 'PASS: confirming the description releases the spotlight for Generate';
  },

  // Reset must sweep the new spotlights too -- it used to remove by name.
  async resetSweepsSpotlights(page) {
    await pick(page, 'puzzle');
    page.once('dialog', d => d.accept());
    await page.evaluate(() => resetEverythingFreshStart());
    await page.waitForTimeout(900);
    const focus = await page.evaluate(() => [...document.body.classList].filter(c => c.endsWith('-focus')));
    const stale = focus.filter(c => c !== 'product-focus' && c !== 'initial-upload-focus');
    if (stale.length) return `FAIL: reset left spotlights behind: ${JSON.stringify(stale)}`;
    return `PASS: reset sweeps the option spotlights (left: ${JSON.stringify(focus)})`;
  },
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
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL OPTION-SPOTLIGHT VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
