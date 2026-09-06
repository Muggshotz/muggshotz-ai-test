// Use Last Design Generated after a fresh load (Sep 2026): the page must
// not stay dimmed, the design must be registered, and approval must reach
// Fit Your Picture once a product is chosen.
const { launch, openStudio, dismissAlerts } = require('./harness');
const fs = require('fs'); const path = require('path');
const T = (page, ms) => page.waitForTimeout(ms);
(async () => {
  const { browser, page, log } = await launch({ viewport: { width: 1280, height: 900 } });
  const photo = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'test-photo.jpg')).toString('base64');
  await page.addInitScript((p) => { localStorage.setItem('muggshotz_workshop_prev', JSON.stringify({ working: p, previous: p, designId: 'design-recall-1', hosted: 'https://example.test/hosted-design.jpg' })); }, photo);
  let result = 'PASS: recall lifts the spotlight, registers the design, routes through product to approval, and approval opens Fit Your Picture';
  try {
    await openStudio(page);
    await T(page, 500);
    const btnShown = await page.evaluate(() => getComputedStyle(document.getElementById('recallGeneratedBtn')).display !== 'none' && getComputedStyle(document.getElementById('workshopRecallRow')).display !== 'none');
    if (!btnShown) throw new Error('Use Last Design Generated button not offered');
    await page.click('#recallGeneratedBtn');
    await T(page, 800);
    const st = await page.evaluate(() => ({
      dim: document.body.classList.contains('initial-upload-focus'),
      startOver: getComputedStyle(document.getElementById('startOverBtn')).display,
      design: !!findDesignById(currentDesignId), id: currentDesignId,
      productCard: getComputedStyle(document.getElementById('productCard')).opacity,
    }));
    if (st.dim) throw new Error('page still in the first-visit spotlight');
    if (st.startOver !== 'none') throw new Error('"please select" warning still showing');
    if (!st.design) throw new Error('recalled design not registered');
    const hostedUrl = await page.evaluate(() => findDesignById(currentDesignId).url);
    if (hostedUrl !== 'https://example.test/hosted-design.jpg') throw new Error('recall should register the hosted copy, got ' + hostedUrl.slice(0, 40));
    if (parseFloat(st.productCard) < 0.95) throw new Error('product card still dimmed (' + st.productCard + ')');
    await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
    await T(page, 1200); await dismissAlerts(page);
    await page.evaluate(() => pickPreGenMugSize('15oz')); await T(page, 500);
    await page.evaluate(() => pickPreGenMugStyle('Trimmed')); await T(page, 900);
    await page.evaluate(() => document.querySelector('#preGenMugColorGrid .color-btn').click()); await T(page, 900);
    await page.evaluate(() => finishPreGenMugColorPick());
    await T(page, 800);
    const ap = await page.evaluate(() => ({ row: document.getElementById('approveRow').style.display, id: currentDesignId, focus: [...document.body.classList].filter(c => c.endsWith('-focus')) }));
    if (ap.row !== 'block') throw new Error('approve row not shown after colour pick: ' + JSON.stringify(ap));
    if (ap.focus.length) throw new Error('a dimming mode is still on: ' + ap.focus.join(','));
    await page.evaluate(() => approveDesign(false));
    await page.waitForFunction(() => document.getElementById('coverMePanelCard').style.display === 'block', null, { timeout: 15000 });
    const fit = await page.evaluate(() => ({ boxes: document.querySelectorAll('#coverMeFitWrap [data-design-id]').length, left: placements.left, right: placements.right }));
    if (fit.boxes !== 1 || !fit.left || !fit.right) throw new Error('Fit Your Picture did not open with the recalled design: ' + JSON.stringify(fit));
  } catch (e) { result = 'FAIL: ' + e.message; }
  const errs = log.pageErrors.length ? ' | pageErrors: ' + log.pageErrors.join(' ; ') : '';
  console.log('recallLastDesignAfterReload: ' + result + errs);
  await browser.close();
  process.exit(/^PASS/.test(result) && !log.pageErrors.length ? 0 : 1);
})();
