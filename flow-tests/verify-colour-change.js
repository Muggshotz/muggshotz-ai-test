// THE ASSERTION THE EXISTING SUITE WAS MISSING.
//
// verify-back-navigation's travelResultBackReachesTheColourPanel passes on the
// BROKEN code, because it only checks the palette is reachable, spotlit and
// that the swatch lights up. It never checked whether the cup's colour
// followed. That is exactly the blind spot that let three earlier fixes look
// like successes while the customer saw nothing change.
//
// So this asserts EFFECT, not reachability: after a tap, the colour the cup is
// drawn from, the colour the edge fade would bake in, and the colour the
// Printify order would carry must all be the colour that was tapped.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');
const T = (p, ms) => p.waitForTimeout(ms);
const VACUUM = 'travel-mug-40oz-vacuum';
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let fails = 0;
const ok = (n, c, d = '') => { c ? console.log('  PASS  ' + n) : (fails++, console.log('  FAIL  ' + n + (d ? '  -> ' + d : ''))); };

// What the whole studio believes the cup's colour is, from every consumer.
const belief = (page) => page.evaluate(() => ({
  entry: travelColorEntry() ? travelColorEntry().name : null,
  hex: travelColorEntry() ? travelColorEntry().hex : null,
  cupBody: mug3DBodyOpts().colorHex,
  fadeBakes: getSelectedProductColorHex(),
  orderShips: selectedTravelColor || travelDefaultColorName() || null,
}));

const agree = (b, name, hex) => {
  const h = (hex || '').toLowerCase();
  return b.entry === name && (b.cupBody || '').toLowerCase() === h
      && (b.fadeBakes || '').toLowerCase() === h && b.orderShips === name;
};

(async () => {
  const { browser, page, log } = await launch({ chromiumArgs: GL });
  await openStudio(page); await uploadPhoto(page); await T(page, 600);
  await page.click('#postUploadForkRow button:has-text("Select Your Product")'); await T(page, 600);
  await page.locator('#productCard .btn-select[data-val="water bottle"]').click({ force: true }); await T(page, 900);
  await dismissAlerts(page);
  await page.evaluate(k => pickPreGenTravelVariant(k), VACUUM); await T(page, 1000); await dismissAlerts(page);
  await page.locator('#travelMugColorGridGen .color-btn[data-color="Red"]').first().click({ force: true }); await T(page, 1000);
  await dismissAlerts(page);
  await page.evaluate(() => pickMugPrintMode('wraparound')); await T(page, 900); await dismissAlerts(page);

  const red = await belief(page);
  ok('before generating, every consumer agrees on Red', agree(red, 'Red', red.hex), JSON.stringify(red));

  // Open the Trimmings panel the way the suite does: seed the finished artwork
  // and reset the gate, rather than paying for a real generation.
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 776;
    const x = c.getContext('2d'); x.fillStyle = '#7a2b2b'; x.fillRect(0, 0, 1024, 776);
    x.fillStyle = '#e8c56a'; x.fillRect(400, 100, 224, 576);
    resultUrl = c.toDataURL('image/png'); finalImageUrl = null;
    trimmingsSettledFor = null; trimmingsBakedTo = null; trimmingsBakedFrom = null;
    placements.front = addToRecentDesigns(resultUrl);
    await openTrimmingsPanel();
    await new Promise(s => setTimeout(s, 2600));
  });
  await dismissAlerts(page);

  const panel = await page.evaluate(() => {
    const row = document.getElementById('trimmingsCupColourRow');
    const card = document.getElementById('trimmingsCard');
    const btns = Array.from(document.querySelectorAll('#trimmingsCupColourGrid .color-btn'));
    const reachable = btns.filter(b => {
      const r = b.getBoundingClientRect();
      if (r.width < 4) return false;
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!t && (t === b || b.contains(t));
    }).length;
    return {
      // NOT offsetParent: .step-lock-overlay is position:fixed, and
      // offsetParent is null for a fixed element whether it is shown or not.
      // Measuring with it reported every overlay in this studio as closed.
      open: (() => { const o = document.getElementById('trimmingsOverlay'); if (!o) return false;
        const r = o.getBoundingClientRect();
        return getComputedStyle(o).display !== 'none' && r.width > 4 && r.height > 4; })(),
      rowVisible: !!row && row.offsetParent !== null,
      swatches: btns.length, reachable,
      lit: btns.filter(b => b.classList.contains('selected')).map(b => b.dataset.color),
      cardOverflow: card ? card.scrollHeight - card.clientHeight : -1,
      continueOnScreen: (() => { const c = document.getElementById('trimmingsContinueBtn'); if (!c) return false; const r = c.getBoundingClientRect(); return r.top >= -2 && r.bottom <= window.innerHeight + 2; })(),
    };
  });
  console.log('  panel: ' + JSON.stringify(panel));
  ok('the Trimmings panel opens', panel.open);
  ok('the cup-colour palette is on it, and reachable', panel.rowVisible && panel.swatches === 12 && panel.reachable === 12, JSON.stringify(panel));
  ok('it shows Red as current', panel.lit.join() === 'Red', JSON.stringify(panel.lit));
  ok('the panel still fits — no overflow, Continue on screen', panel.cardOverflow <= 2 && panel.continueOnScreen, `overflow=${panel.cardOverflow} continue=${panel.continueOnScreen}`);

  // THE POINT: tap Black on the panel and check every consumer follows.
  if (panel.reachable === 12) {
    await page.locator('#trimmingsCupColourGrid .color-btn[data-color="Black"]').first().click();
    await T(page, 2200);
    const black = await belief(page);
    console.log('  after tapping Black: ' + JSON.stringify(black));
    ok('the cup is DRAWN in Black', (black.cupBody || '').toLowerCase() === (black.hex || '').toLowerCase() && black.entry === 'Black', JSON.stringify(black));
    ok('the edge fade would BAKE in Black', (black.fadeBakes || '').toLowerCase() === (black.hex || '').toLowerCase(), black.fadeBakes);
    ok('the order would SHIP Black', black.orderShips === 'Black', String(black.orderShips));
    ok('every consumer agrees', agree(black, 'Black', black.hex), JSON.stringify(black));
  }

  console.log('\n' + (fails ? `${fails} FAILURE(S)` : 'ALL COLOUR-CHANGE VERIFICATIONS PASSED'));
  if (log.pageErrors.length) console.log('PAGE ERRORS: ' + JSON.stringify(log.pageErrors.slice(0, 4)));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
