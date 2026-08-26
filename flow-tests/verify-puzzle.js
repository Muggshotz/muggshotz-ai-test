// Photo Puzzle flow verification: product pick → mandatory piece-count
// choice → generate → approve → YES → Continue to Order → mockup request
// carries productKey 'photo-puzzle' + the chosen piece count → lightbox.
// Mirrors verify-phone-suitcase.js. All /api/* is stubbed by the harness.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const pickPuzzle = async (page) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="puzzle"]').click({ force: true });
  await page.waitForTimeout(1000);
};

const scenarios = {

  // 1. Card appears on pick, and Generate is blocked until a size is chosen.
  async puzzleGuard(page) {
    await pickPuzzle(page);
    if (!(await page.isVisible('#puzzleSizeCard'))) return 'FAIL: piece-count card not shown on puzzle pick';
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await page.waitForTimeout(1000);
    const modal = await page.evaluate(() => {
      const b = document.getElementById('bigAlertOverlay');
      return b && getComputedStyle(b).display !== 'none' ? document.getElementById('bigAlertMsg')?.textContent : null;
    });
    if (!modal || !/piece count/i.test(modal)) return `FAIL: no piece-count guard (modal=${JSON.stringify(modal)})`;
    return `PASS: card shown, guard fires: "${modal.slice(0, 55)}"`;
  },

  // 2. All four piece counts are present with prices matching the catalog,
  //    and the ladder never decreases as piece count rises.
  async puzzleLadder(page) {
    await pickPuzzle(page);
    const tiles = await page.$$eval('#puzzleSizeGrid .btn-select', els => els.map(e => ({
      size: e.dataset.puzzleSize,
      price: parseFloat((e.textContent.match(/\$([0-9.]+)/) || [])[1]),
    })));
    const want = [['96 pcs', 38.95], ['252 pcs', 40.95], ['500 pcs', 43.95], ['1000 pcs', 43.95]];
    if (tiles.length !== 4) return `FAIL: expected 4 tiles, got ${tiles.length}`;
    for (let i = 0; i < 4; i++) {
      if (tiles[i].size !== want[i][0] || tiles[i].price !== want[i][1])
        return `FAIL: tile ${i} = ${JSON.stringify(tiles[i])}, expected ${JSON.stringify(want[i])}`;
    }
    for (let i = 1; i < 4; i++) {
      if (tiles[i].price < tiles[i - 1].price)
        return `FAIL: price ladder decreases at ${tiles[i].size} ($${tiles[i - 1].price} -> $${tiles[i].price})`;
    }
    return `PASS: 4 tiles, prices match catalog, ladder non-decreasing (${tiles.map(t => t.price).join(' → ')})`;
  },

  // 3. Full rail: pick a size, generate, approve, and confirm the mockup
  //    request body carries the right catalog key + size label.
  async puzzleFull(page, log, mockupBodies) {
    await pickPuzzle(page);
    await page.click('#puzzleSizeGrid .btn-select[data-puzzle-size="500 pcs"]');
    await page.waitForTimeout(700);
    const note = await page.textContent('#puzzleSizeSelectedNote');
    if (!/500 pcs/.test(note)) return `FAIL: confirm note wrong: ${note}`;
    // Description is now REQUIRED on print-onto-object products, and comes
    // after the product is fully chosen. page.fill focuses the textarea, which
    // fires the once-per-session intro modal, so dismiss it like a customer.
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    await dismissAlerts(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Continue to Order")').first().click({ timeout: 8000 });
    await page.waitForTimeout(6000);
    const start = mockupBodies.find(b => b && b.action === 'start');
    if (!start) return `FAIL: no start-mockup request fired (bodies=${JSON.stringify(mockupBodies)})`;
    if (start.productKey !== 'photo-puzzle') return `FAIL: productKey=${start.productKey}, expected photo-puzzle`;
    if (start.sizeLabel !== '500 pcs') return `FAIL: sizeLabel=${start.sizeLabel}, expected "500 pcs"`;
    if (!start.image) return 'FAIL: no image url in mockup body';
    return `PASS: mockup body {productKey:${start.productKey}, sizeLabel:"${start.sizeLabel}", image:yes}`;
  },

  // 4. Reset clears the chosen size and the confirm note.
  async puzzleReset(page) {
    await pickPuzzle(page);
    await page.click('#puzzleSizeGrid .btn-select[data-puzzle-size="1000 pcs"]');
    await page.waitForTimeout(600);
    // resetEverythingFreshStart() opens a window.confirm() and bails on
    // dismiss; Playwright auto-dismisses dialogs, so accept it explicitly.
    page.once('dialog', d => d.accept());
    await page.evaluate(() => resetEverythingFreshStart());
    await page.waitForTimeout(800);
    const st = await page.evaluate(() => ({
      size: typeof selectedPuzzleSize === 'undefined' ? 'undefined' : selectedPuzzleSize,
      sel: document.querySelectorAll('#puzzleSizeGrid .btn-select.selected').length,
      note: document.getElementById('puzzleSizeSelectedNote')?.textContent || '',
      cardShown: document.getElementById('puzzleSizeCard')?.style.display,
    }));
    if (st.size !== null || st.sel !== 0 || st.note !== '')
      return `FAIL: not cleared: ${JSON.stringify(st)}`;
    return `PASS: reset clears size + note (card display after reset: ${st.cardShown})`;
  },
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    const mockupBodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/start-mockup')) {
        try { mockupBodies.push(r.postDataJSON()); } catch (e) {}
      }
    });
    try {
      await openStudio(page);
      await uploadPhoto(page);
      await dismissAlerts(page);
      const result = await fn(page, log, mockupBodies);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
      await page.screenshot({ path: `shot-puzzle-fail-${name}.png` }).catch(() => {});
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PUZZLE VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
