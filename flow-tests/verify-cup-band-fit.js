// Every travel cup's wrap fills its band (Sep 2026).
//
// Generation hands back a SQUARE -- 1024x1024, measured, not assumed -- and a
// travel cup's print area is a wide band: 1.33 on the 20oz, 1.75 on the Gator,
// 1.32 on the vacuum 40oz. A square given to a wide band is letterboxed, so the
// artwork printed in a stripe with bare cup above and below it. On the Gator
// that is 43% off the shape it should be.
//
// The rule already existed for cups that pass through extendWrapToProductRatio
// -- "a picture wider than a band is centre-cropped to the band rather than
// handed back for the server to letterbox" -- but that runs only on the
// panorama path, and these sit below PANORAMA_MIN_WRAP_RATIO, so it reached
// none of them. It surfaced as a trimming stopping short of the seam on one
// cup; it was never only that cup, and never only trimmings.
//
// This walks the real journey per cup rather than calling the fitter directly,
// because the fault was never in the fitting -- it was in nothing calling it.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

async function driveToApproval(page, variant) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="water bottle"]').click({ force: true });
  await T(page, 1000);
  await page.evaluate((k) => pickPreGenTravelVariant(k), variant);
  await T(page, 900);
  await dismissAlerts(page);
  await page.evaluate(() => {
    const c = document.getElementById('mugPrintModeCard');
    if (c && c.style.display !== 'none') pickMugPrintMode('three-panel');
  });
  await T(page, 600);
  await dismissAlerts(page);
  await page.evaluate(() => { window.confirm = () => false; });
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await T(page, 1400);
  await dismissAlerts(page);
  await page.fill('#ideaDesc', 'a gilded theatre box at dusk');
  await T(page, 400);
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await T(page, 800);
}

const scenarios = {};

for (const variant of ['travel-mug-20oz', 'travel-mug-32oz-gator', 'travel-mug-40oz-vacuum']) {
  scenarios['fillsTheBand_' + variant.replace(/-/g, '_')] = async (page) => {
    await driveToApproval(page, variant);
    const r = await page.evaluate(async (v) => {
      const load = (x) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = x; });
      const im = await load(finalImageUrl || resultUrl);
      return {
        artwork: im.naturalWidth + 'x' + im.naturalHeight,
        got: +(im.naturalWidth / im.naturalHeight).toFixed(3),
        band: TRAVEL_WRAP_RATIO[v],
        panoramic: wrapIsPanoramic(),
      };
    }, variant);

    if (r.panoramic) return `PASS: ${variant} takes the panorama path, which crops to its own band`;
    const off = Math.abs(r.got / r.band - 1);
    if (off > 0.03) {
      return `FAIL: ${variant} finished at ${r.artwork} (ratio ${r.got}) against a band of ${r.band} — ${Math.round(off * 100)}% out. A square handed to a wide band is letterboxed, so it prints in a stripe with bare cup above and below it`;
    }
    return `PASS: ${variant} finished at ${r.artwork}, ratio ${r.got} against a band of ${r.band}`;
  };
}

// And the promise that must survive the fix: an exact transfer is the
// customer's own photo, unaltered. Cropping it to a band would be us deciding
// otherwise, so that lane is deliberately left alone.
scenarios.anExactTransferIsNotCropped = async (page) => {
  const src = await page.evaluate(async () => (await fetch('/needles-studio.html')).text());
  const i = src.indexOf('fitWrapToBand(resultUrl)');
  if (i < 0) return 'FAIL: nothing fits the wrap to its band any more';
  const guard = src.slice(Math.max(0, i - 400), i);
  if (!/!exactTransfer/.test(guard)) {
    return "FAIL: the band fit is not excluded on an exact transfer — a customer who asked for their photo exactly as it is would have it cropped";
  }
  if (!/!wrapIsPanoramic\(\)/.test(guard)) {
    return 'FAIL: the band fit is not excluded on the panorama path, which already crops to the band itself';
  }
  return 'PASS: the band fit stays off the exact-transfer lane and off the panorama path';
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
    const errs = log.consoleErrors.filter((e) => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL CUP-BAND-FIT VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
