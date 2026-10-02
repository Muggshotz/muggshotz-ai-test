// THE NEWEST VERSION, AND NO LONE GENERATE (Alyx, 2 Oct 2026).
//   node flow-tests/verify-fresh-version.js   (serve the repo on 127.0.0.1:8788)
// 1. The mug's describe route: Satisfied paints, with no Generate panel after it.
// 2. A page that comes back to the screen with nothing started reloads onto a
//    newer version (the page's ETag changed); mid-design it never reloads.
// 3. The Order Placed screen has Exit, which clears the order and loads the
//    opening page fresh.
const { launch, openStudio, uploadPhoto, dismissAlerts, BASE } = require('./harness');
const T = (page, ms) => page.waitForTimeout(ms);
const scenarios = {};

scenarios.mugDescribeSatisfiedPaints = async (page, log) => {
  await uploadPhoto(page); await dismissAlerts(page);
  await page.click('#postUploadForkRow button:has-text("Select Your Product")'); await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true }); await T(page, 1000);
  await page.evaluate(() => { pickPreGenMugSize('11oz'); pickPreGenMugStyle(Object.keys(GEN_MUG_STYLES)[0]); });
  await T(page, 500);
  await page.evaluate(() => { const b = document.querySelector('#preGenMugColorGrid .color-btn'); if (b) b.click(); finishPreGenMugColorPick(); });
  await T(page, 900); await dismissAlerts(page);
  await page.evaluate(() => pickMugPrintMode('wraparound')); await T(page, 1000); await dismissAlerts(page);
  // The props screen's "Tell Needles what you have in mind".
  await page.evaluate(() => { ideaReturnTarget = 'descriptionOnly'; handOffToIdeaAfterProductChoice(); }); await T(page, 900);
  await page.fill('#ideaDesc', 'as the President of the United States'); await T(page, 300);
  const label = await page.evaluate(() => { refreshIdeaPromptLabel(); return document.getElementById('ideaGuidancePrompt').textContent; });
  const before = log.apiCalls.filter((c) => c.path === '/api/generate').length;
  await page.evaluate(() => document.getElementById('ideaGuidancePrompt').click()); await T(page, 2500);
  const after = log.apiCalls.filter((c) => c.path === '/api/generate').length;
  const row = await page.evaluate(() => { const r = document.getElementById('mugIdeaActionRow'); return r && getComputedStyle(r).display; });
  if (!/Yes, I'm Satisfied — Generate My Image/.test(label)) return `FAIL: the mug's satisfied button reads "${label}"`;
  if (after <= before) return 'FAIL: Satisfied on the mug describe route did not paint';
  if (row && row !== 'none') return 'FAIL: the Return-to-photos / Generate panel still came up after Satisfied';
  return 'PASS: the mug describe route\'s "Satisfied — Generate" paints in one click, no Generate panel after it';
};

async function etagRouting(page, tagRef) {
  await page.route('**/needles-studio.html?etag=*', (route) => route.fulfill({ status: 200, headers: { etag: tagRef.tag }, body: '' }));
}
async function bringBack(page) {
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
}

scenarios.newerVersionLoadsWhenIdle = async (page) => {
  const tag = { tag: '"v1"' }; await etagRouting(page, tag);
  await openStudio(page); await T(page, 2500);   // load records v1
  if (await page.evaluate(() => pageEtagAtLoad) !== '"v1"') return 'FAIL: the page did not record its version on load';
  tag.tag = '"v2"';
  const nav = page.waitForNavigation({ timeout: 8000 }).then(() => true, () => false);
  await bringBack(page);
  if (!(await nav)) return 'FAIL: coming back to the screen with nothing started did not load the newer version';
  return 'PASS: back on screen with nothing started, a newer version loads by itself';
};

scenarios.noReloadMidDesign = async (page) => {
  const tag = { tag: '"v1"' }; await etagRouting(page, tag);
  await openStudio(page); await T(page, 2500);
  await uploadPhoto(page); await dismissAlerts(page);
  tag.tag = '"v2"';
  const nav = page.waitForNavigation({ timeout: 5000 }).then(() => true, () => false);
  await bringBack(page);
  if (await nav) return 'FAIL: the page reloaded mid-design and threw away the customer\'s photo';
  return 'PASS: mid-design, a newer version never reloads the page';
};

scenarios.exitAfterOrder = async (page) => {
  await page.goto(`${BASE}/order.html?checkout=success`); await T(page, 1500);
  await page.evaluate(() => localStorage.setItem('muggshotz_pending_order', '{"x":1}'));
  const btn = await page.evaluate(() => { const b = document.getElementById('exitAfterOrderBtn'); return b && b.offsetParent ? b.innerText : null; });
  if (!btn || !/Exit/.test(btn)) return `FAIL: the Order Placed screen has no Exit (${btn})`;
  await Promise.all([page.waitForNavigation({ timeout: 8000 }), page.click('#exitAfterOrderBtn')]);
  const st = await page.evaluate(() => ({ path: location.pathname, fresh: new URLSearchParams(location.search).has('fresh'), pending: localStorage.getItem('muggshotz_pending_order') }));
  if (!/needles-studio\.html$/.test(st.path) || !st.fresh || st.pending) return `FAIL: Exit went to ${JSON.stringify(st)}`;
  return 'PASS: Order Placed has Exit; it clears the order and loads the opening page fresh';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    try {
      if (name === 'mugDescribeSatisfiedPaints') await openStudio(page);
      const r = await fn(page, log);
      console.log(`[${name}] ${r}`); if (/^FAIL/.test(r)) fails++;
    } catch (e) { console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL FRESH-VERSION VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
