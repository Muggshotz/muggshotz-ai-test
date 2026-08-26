// Alyx: after "Use this design" the new products showed the flat artwork again
// instead of the design ON the product. The mockup existed but sat behind the
// "Continue to Order" button -- continueToRealMockup() IS the mockup -- so
// nobody would guess a preview was there. Mugs and travel cups always fetched
// it automatically; these did not.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const PREP = {
  'suitcase': async (p) => { await p.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]'); },
  'puzzle':   async (p) => { await p.click('#puzzleSizeGrid .btn-select[data-puzzle-size="500 pcs"]'); },
  'tote bag': async (p) => {
    await p.click('#toteSizeGrid .btn-select[data-tote-size=\'16" x 16"\']');
    await p.waitForTimeout(900);
    await p.click('#toteBagColorGridGen .color-btn[data-color="Black"]');
  },
  'phone case': async (p) => {
    await p.fill('#phoneModelSearchInputGen', 'iPhone 15 Pro Max');
    await p.waitForTimeout(1200);
    const hit = p.locator('#phoneModelResultsGen >> text=iPhone 15 Pro Max').first();
    if (await hit.count()) { await hit.click(); await p.waitForTimeout(700); }
    const yes = p.locator('#phoneModelConfirmGen button:has-text("Yes")');
    if (await yes.count()) await yes.click();
  },
  'photo poster': async (p) => { await p.click('#posterUnframedBtn'); },
};

async function approveAndWatch(page, val, mockupCalls) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await page.waitForTimeout(1000);
  await PREP[val](page);
  await page.waitForTimeout(1400);
  const needsIdea = await page.evaluate((v) => PRODUCTS_NEEDING_IDEA.includes(v), val);
  if (needsIdea) {
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    await dismissAlerts(page);
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  mockupCalls.length = 0;               // only count what APPROVE triggers
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await page.waitForTimeout(9000);      // approve -> auto mockup -> poll
}

const scenarios = {};

for (const val of Object.keys(PREP)) {
  scenarios['autoMockup_' + val.replace(/[^a-z]/gi, '_')] = async (page, log, mockupCalls) => {
    await approveAndWatch(page, val, mockupCalls);
    const started = mockupCalls.filter(b => b && b.action === 'start');
    if (!started.length) return `FAIL: ${val} did NOT fetch a mockup on approve — customer sees flat art only`;
    if (started.length > 1) return `FAIL: ${val} fetched the mockup ${started.length}x (duplicate work)`;
    const b = started[0];
    if (!b.productKey) return `FAIL: ${val} mockup body has no productKey`;
    return `PASS: ${val} auto-fetches its mockup on approve {${b.productKey}, ${JSON.stringify(b.sizeLabel)}}`;
  };
}

// Travel cups already have their own preview panel; they must not double up.
scenarios.travelNotDoubled = async (page) => {
  const inList = await page.evaluate(() => PRODUCTS_AUTO_MOCKUP.includes('water bottle'));
  if (inList) return 'FAIL: water bottle is in PRODUCTS_AUTO_MOCKUP — it has its own preview and would fetch twice';
  const mugIn = await page.evaluate(() => PRODUCTS_AUTO_MOCKUP.includes('mug'));
  if (mugIn) return 'FAIL: mug is in PRODUCTS_AUTO_MOCKUP — it fetches inside the reveal flow already';
  return 'PASS: mug and travel cup excluded (they already auto-fetch by their own routes)';
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
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL AUTO-MOCKUP VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
