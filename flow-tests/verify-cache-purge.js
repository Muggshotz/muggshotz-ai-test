// Alyx lost a finished piece to this (2026-08-27): built a superhero-in-an-
// airport image, went to mock it up, and the mockup came back carrying a
// DIFFERENT, older picture from a previous session -- never offered, never
// chosen, invisible on screen.
//
// Mechanism: restoreMugLibrary() ran on every page load and rehydrated
// `placements` out of muggshotz_mug_state. buildMockupRequestBody() reads
// `placements` directly. A stale left/centre/right slot therefore sat live
// and invisible, and any flow that did not overwrite that exact slot shipped
// the old image to Printify.
//
// This suite plants stale state the way a previous session would have left
// it, then proves it cannot reach a print slot. The FIRST scenario is the
// regression itself and is written to fail against the old build.
const { launch, openStudio, uploadPhoto, dismissAlerts, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const STALE = 'https://example.invalid/STALE-DESIGN-FROM-A-PREVIOUS-SESSION.png';

// Seed localStorage before any of the page's own script runs.
async function plantStaleSession(page) {
  await page.addInitScript((stale) => {
    localStorage.setItem('muggshotz_mug_state', JSON.stringify({
      designs: [{ id: 'stale-1', url: stale }],
      placements: { left: 'stale-1', front: 'stale-1', right: 'stale-1' },
    }));
    localStorage.setItem('muggshotz_workshop', JSON.stringify({
      working: stale, previous: null, designId: 'stale-1',
    }));
  }, STALE);
}

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1000);
}

const scenarios = {};

// ---- 1. THE BUG. Stale slots must not survive a page load. ----
scenarios.staleSlotsAreGoneOnEntry = async (page) => {
  const st = await page.evaluate(() => ({
    placements, designs: recentDesigns.length, currentDesignId,
    mugState: localStorage.getItem('muggshotz_mug_state'),
  }));
  const filled = ['left', 'front', 'right'].filter(k => st.placements[k]);
  if (filled.length)
    return `FAIL: ${filled.join('/')} still carry a design from a previous session — this is exactly what shipped an old image to Printify`;
  if (st.designs !== 0) return `FAIL: ${st.designs} stale design(s) still in the library`;
  if (st.currentDesignId) return `FAIL: currentDesignId survived as ${st.currentDesignId}`;
  if (st.mugState) return 'FAIL: muggshotz_mug_state was not purged — the next load rehydrates it again';
  return 'PASS: stale slots, library and mug_state all cleared before anything could read them';
};

// ---- 2. And the mockup a real flow builds must carry only new work. ----
scenarios.mockupNeverCarriesStaleArt = async (page, log, bodies) => {
  await pickProduct(page, 'coaster');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await dismissAlerts(page);
  await T(page, 400);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await T(page, 6000);

  const start = bodies.find(b => b && b.action === 'start');
  if (!start) return 'FAIL: no start-mockup fired';
  const blob = JSON.stringify(start);
  if (blob.includes('STALE-DESIGN')) return 'FAIL: the mockup request carries the stale image — the exact loss Alyx hit';
  if (!start.image) return 'FAIL: mockup body has no image at all';
  return 'PASS: mockup carries only the freshly generated art';
};

// ---- 3. Recall survives the purge, but only by explicit click. ----
scenarios.recallStillWorksButNeverAutomatically = async (page) => {
  const archived = await page.evaluate(() => !!localStorage.getItem('muggshotz_workshop_prev'));
  if (!archived) return 'FAIL: the workshop snapshot was destroyed rather than archived — Recall is dead';
  // Checked before any upload -- see INSPECTS_ENTRY_STATE below. A later
  // upload rewrites this key legitimately, which is not a purge failure.
  const live = await page.evaluate(() => !!localStorage.getItem('muggshotz_workshop'));
  if (live) return 'FAIL: the live workshop key survived the purge';
  const snap = await page.evaluate(() => readWorkshopSnapshot());
  if (!snap || !snap.working) return 'FAIL: readWorkshopSnapshot() cannot see the archive';
  // Archived, readable, and still not in any print slot until someone clicks.
  const p = await page.evaluate(() => placements);
  if (p.left || p.front || p.right) return 'FAIL: the archive leaked into a print slot';
  return 'PASS: snapshot archived and readable for Recall, with nothing auto-restored';
};

// ---- 4. Coming back from the order page is a continuation, not staleness. ----
scenarios.returningFromOrderKeepsItsWork = async (page) => {
  const st = await page.evaluate(() => ({
    placements, mugState: !!localStorage.getItem('muggshotz_mug_state'),
  }));
  if (!st.mugState) return 'FAIL: purged an in-flight order edit — order.html sends the customer back here mid-flow';
  if (!st.placements.front) return 'FAIL: the in-flight design was dropped on the way back from the order page';
  return 'PASS: returning from the order page keeps its work (purge stands down)';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    const bodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/start-mockup')) { try { bodies.push(r.postDataJSON()); } catch (e) {} }
    });
    try {
      await plantStaleSession(page);
      if (name === 'returningFromOrderKeepsItsWork') {
        await page.addInitScript(() => localStorage.setItem('muggshotz_return_to_idea', '1'));
      }
      await openStudio(page);
      // These three inspect the state the ENTRY purge leaves behind, so they
      // must not upload first: uploading calls saveWorkshop(), which
      // legitimately rewrites muggshotz_workshop and would look like the
      // purge had failed.
      const INSPECTS_ENTRY_STATE = [
        'staleSlotsAreGoneOnEntry',
        'returningFromOrderKeepsItsWork',
        'recallStillWorksButNeverAutomatically',
      ];
      if (!INSPECTS_ENTRY_STATE.includes(name)) {
        await uploadPhoto(page);
      }
      await dismissAlerts(page);
      const result = await fn(page, log, bodies);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL|example\.invalid|ERR_NAME_NOT_RESOLVED/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL CACHE-PURGE VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
