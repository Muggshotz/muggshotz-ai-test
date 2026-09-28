// THE SMART MUG'S HEAT REVEAL AND ITS (i) (Alyx, 28 Sep 2026).
//   - The 11oz Smart Mug button goes straight to the designs; the (i) on its
//     corner opens How the magic mug works instead, whose button goes on to
//     the designs and whose Back leaves the sizes as they were.
//   - The designs' panel says "Make a selection to see how it works", blinking,
//     and no longer repeats the price.
//   - Picking a design plays it on the 3D mug: cold black and still, the heat
//     words at 1s, turning from 2s with the picture rising, full by 5s, stopped
//     on the punchline (+90) at 7s, the cooling words at 9s and the fade back
//     to black, still by 12s. Picking another design plays that one; a click
//     on the mug replays; Continue is on screen under the mug throughout.
const { launch, openStudio, dismissAlerts } = require('./harness');
const T = (p, ms) => p.waitForTimeout(ms);
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let fails = 0;
const ok = (n, c, d = '') => { c ? console.log('  PASS  ' + n) : (fails++, console.log('  FAIL  ' + n + (d ? '  -> ' + d : ''))); };

async function run(viewport, tag) {
  const { browser, page, log } = await launch({ chromiumArgs: GL, viewport });
  console.log(`[${tag}]`);
  await openStudio(page); await dismissAlerts(page);

  // The (i).
  await page.evaluate(() => { product = 'mug'; document.getElementById('mugSizeLockOverlay').style.display = 'flex'; });
  await T(page, 400);
  await page.locator('#smartMugInfoBtn').click(); await T(page, 600);
  const how = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('smartHowOverlay')).display !== 'none',
    steps: document.querySelectorAll('#smartHowSteps .pm-step').length, product,
    surprise: getComputedStyle(document.getElementById('surpriseCard')).display }));
  ok('the (i) opens How the magic mug works, six steps, and does not pick the mug', how.open && how.steps === 6 && how.product === 'mug' && how.surprise === 'none', JSON.stringify(how));
  await page.evaluate(() => closeSmartMugHow()); await T(page, 300);
  ok('its Back closes it, the sizes still up', await page.evaluate(() => getComputedStyle(document.getElementById('smartHowOverlay')).display === 'none' && product === 'mug'));
  await page.locator('#smartMugInfoBtn').click(); await T(page, 400);
  await page.locator('#smartHowOnBtn').click(); await T(page, 1500);
  const on = await page.evaluate(() => ({ product, surprise: getComputedStyle(document.getElementById('surpriseCard')).display,
    line: document.getElementById('surpriseHowLine').innerText, blink: document.getElementById('surpriseHowLine').classList.contains('smart-blink') }));
  ok('its button goes on to the designs', on.product === 'smart mug' && on.surprise === 'block', JSON.stringify(on));
  ok('the designs\' line: make a selection to see how it works, blinking, no price', /Make a selection to see how it works/.test(on.line) && on.blink && !/\$/.test(on.line), JSON.stringify(on));

  // The reveal, timed inside the page.
  const tl = await page.evaluate(async () => {
    MUG3D.onSpin((d) => { window.__deg = d; });
    const log = [], t0 = performance.now();
    pickSurprise('proposal');
    await new Promise((r) => { const iv = setInterval(() => { const w = document.getElementById('surpriseRevealWords');
      log.push({ t: performance.now() - t0, deg: window.__deg, w: w.textContent, b: w.classList.contains('smart-blink'), run: surpriseRevealRun }); }, 200);
      setTimeout(() => { clearInterval(iv); r(); }, 19000); });
    return log;
  });
  // The clock starts once the mug has loaded: find it by the first words.
  const first = tl.find((r) => r.w);
  const start = first ? first.t - 1000 : 0;
  const at = (s) => tl.reduce((a, r) => (Math.abs(r.t - start - s * 1000) < Math.abs(a.t - start - s * 1000) ? r : a), tl[0]);
  // Before the mug has loaded there is no angle yet (undefined): that is still too.
  const s0 = tl.filter((r) => r.t < start + 900 && r.deg !== undefined), s3 = at(3.2), s6 = at(6), s8 = at(8), s10 = at(10), s13 = at(13.5), end = tl[tl.length - 1];
  ok('cold and still, no words, before 1s', s0.length > 0 && s0.every((r) => r.deg === -90 && !r.w), JSON.stringify(s0.slice(-1)));
  ok('the heat words blink while it turns', /absorbs the liquid's heat/.test(s3.w) && s3.b && s3.deg > -90 && s3.deg < 90, JSON.stringify(s3));
  ok('words gone, still turning, at 6s', !s6.w && s6.deg > -90 && s6.deg < 90, JSON.stringify(s6));
  ok('stopped on the punchline (+90) at 8s', s8.deg === 90 && !s8.w, JSON.stringify(s8));
  ok('the cooling words blink at 10s', /cools down again/.test(s10.w) && s10.b, JSON.stringify(s10));
  ok('still, the blinking stopped, at 13.5s and after', !s13.b && s13.deg === 90 && end.deg === 90 && !end.b, JSON.stringify([s13, end]));
  const land = await page.evaluate(() => { const r = document.getElementById('surpriseContinueBtn').getBoundingClientRect(), s = document.getElementById('surpriseReveal').getBoundingClientRect(); return { btn: [r.top, r.bottom], stage: [s.top, s.bottom], H: innerHeight }; });
  ok('the mug and Continue are both on screen', land.stage[0] >= -2 && land.btn[1] <= land.H + 2, JSON.stringify(land));

  // Another design plays that one; the hand does not replay.
  const r0 = await page.evaluate(() => surpriseRevealRun);
  await page.evaluate(() => pickSurpriseHand('left')); await T(page, 300);
  ok('changing the hand does not replay it', await page.evaluate((r) => surpriseRevealRun === r, r0));
  await page.evaluate(() => pickSurprise('apology')); await T(page, 300);
  ok('another design plays that one', await page.evaluate((r) => surpriseRevealRun > r && surpriseRevealFile === 'apology', r0));
  await page.evaluate(() => surpriseBack()); await T(page, 500);
  ok('Back lets the cup go', await page.evaluate(() => !MUG3D.mounted()));

  if (log.pageErrors.length) { fails++; console.log('  FAIL  page errors: ' + JSON.stringify(log.pageErrors.slice(0, 3))); }
  await browser.close();
}

(async () => {
  await run({ width: 1280, height: 770 }, 'laptop');
  await run({ width: 390, height: 844 }, 'phone');
  console.log('\n' + (fails ? `${fails} FAILURE(S)` : 'ALL HEAT-REVEAL VERIFICATIONS PASSED'));
  process.exit(fails ? 1 : 0);
})();
