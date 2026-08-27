// Photo/Poster, rebuilt Aug 2026 onto Printed Simply (852/73).
//
// The previous provider, Prima Printing, had NO US shipping profile at all --
// US orders fell to REST_OF_THE_WORLD at $31.79 a poster against $6.99 for a
// mug, so a $12.95 poster cost $44.74 delivered and posters were effectively
// unsellable domestically. Printed Simply ships US for $6.79.
//
// Frames are gone: framing an 18x24 cost $57.87 on a print that costs a
// dollar, and retail $61.95 cleared about $2 after Stripe.
//
// Printed Simply is Matte-only, so there is no finish choice left either.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const pickPoster = async (page) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="photo poster"]').click({ force: true });
  await page.waitForTimeout(1200);
};

const scenarios = {

  // The size grid must offer exactly the four affordable sizes, at catalog prices.
  async posterSizes(page) {
    await pickPoster(page);
    const tiles = await page.$$eval('#posterSizeGrid .btn-select', els => els.map(e => e.textContent.trim()));
    if (tiles.length !== 7) return `FAIL: expected 7 sizes, got ${tiles.length}: ${JSON.stringify(tiles)}`;
    // Four affordable sizes, plus three large formats Alyx chose to offer at
    // thinner margins. Every one must clear its own wholesale cost.
    const want = {
      '9" x 11"': [11.95, 5.64], '11" x 17"': [13.95, 7.97],
      '12" x 18"': [14.95, 8.99], '11" x 14"': [14.95, 9.98],
      '16" x 20"': [19.95, 16.18], '18" x 24"': [24.95, 20.18],
      '24" x 36"': [34.95, 32.21],
    };
    for (const [label, [price, cost]] of Object.entries(want)) {
      const hit = tiles.find(t => t.startsWith(label));
      if (!hit) return `FAIL: size ${label} missing from the grid`;
      if (!hit.includes(price.toFixed(2))) return `FAIL: ${label} is not $${price.toFixed(2)} (got "${hit}")`;
      if (price <= cost) return `FAIL: ${label} sells at $${price} but costs $${cost} — losing money`;
    }
    const affordable = ['9" x 11"', '11" x 17"', '12" x 18"', '11" x 14"'];
    const broke15 = affordable.filter(l => want[l][0] >= 15);
    if (broke15.length) return `FAIL: the affordable line broke $15: ${broke15.join(', ')}`;
    return `PASS: 7 sizes, 4 under $15, all clear their wholesale cost`;
  },

  // Frames must be gone from the UI entirely.
  async framesGone(page) {
    await pickPoster(page);
    const st = await page.evaluate(() => ({
      framedBtn: !!document.getElementById('posterFramedBtn'),
      unframedBtn: !!document.getElementById('posterUnframedBtn'),
      frameColour: !!document.getElementById('posterFrameColorWrap'),
      glossy: !!document.getElementById('posterFinishGlossyBtn'),
      framedUpsell: PHOTO_POSTER_CATALOG.framedUpsell,
      posterFramed,
    }));
    if (st.framedBtn || st.unframedBtn) return 'FAIL: framed/unframed toggle still in the DOM';
    if (st.frameColour) return 'FAIL: frame-colour block still in the DOM';
    if (st.glossy) return 'FAIL: Glossy finish still offered — Printed Simply is Matte-only';
    if (st.framedUpsell !== null) return `FAIL: framedUpsell is not null: ${JSON.stringify(st.framedUpsell)}`;
    if (st.posterFramed !== false) return 'FAIL: posterFramed is not false';
    return 'PASS: frames and finish choice fully removed';
  },

  // Orientation still works, and the mockup body carries the right product.
  async posterFullRail(page, log, mockupCalls) {
    await pickPoster(page);
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('#posterSizeGrid .btn-select')].find(b => /12.*x.*18/.test(b.textContent));
      if (t) t.click();
    });
    await page.click('#posterOrientHorizontalBtn');
    await page.waitForTimeout(600);
    // Poster is idea-first now (Alyx: everything that is not a mug or travel
    // cup goes down the description path), so describe before generating.
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    await dismissAlerts(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    mockupCalls.length = 0;
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await page.waitForTimeout(9000);
    const start = mockupCalls.find(b => b && b.action === 'start');
    if (!start) return 'FAIL: no mockup fired on approve';
    if (start.productKey !== 'photo-poster') return `FAIL: productKey=${start.productKey}`;
    if (start.sizeLabel !== '12x18') return `FAIL: sizeLabel=${start.sizeLabel}, expected 12x18`;
    if (start.posterFramed !== false) return `FAIL: posterFramed=${start.posterFramed}, must always be false now`;
    if (start.posterOrientation !== 'Horizontal') return `FAIL: orientation=${start.posterOrientation}`;
    if (start.posterFinish !== 'Matte') return `FAIL: finish=${start.posterFinish}, Printed Simply is Matte-only`;
    return `PASS: full rail {12x18, Horizontal, Matte, unframed}`;
  },

  // Reset must not throw now that the elements it used to touch are gone.
  async resetSurvivesRemovedElements(page) {
    await pickPoster(page);
    page.once('dialog', d => d.accept());
    const err = await page.evaluate(() => {
      try { resetEverythingFreshStart(); return null; } catch (e) { return String(e); }
    });
    if (err) return `FAIL: reset threw after the frame/finish elements were removed: ${err}`;
    await page.waitForTimeout(600);
    const st = await page.evaluate(() => ({ framed: posterFramed, finish: posterFinish, size: posterSize }));
    if (st.framed !== false) return `FAIL: posterFramed=${st.framed} after reset`;
    if (st.finish !== 'Matte') return `FAIL: posterFinish=${st.finish} after reset`;
    return `PASS: reset clean (framed=false, finish=Matte, size=${st.size})`;
  },
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    const mockupCalls = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/start-mockup')) {
        try { mockupCalls.push(r.postDataJSON()); } catch (e) {}
      }
    });
    try {
      await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
      const result = await fn(page, log, mockupCalls);
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
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL POSTER VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
