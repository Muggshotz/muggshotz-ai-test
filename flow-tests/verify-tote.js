// Tote Bag flow verification. Tote had a colour card but no size card and
// no mockup bridge. Both size AND colour are mandatory: resolveVariant()
// throws when a size entry carries colors and no colorName is sent, which
// tote's do -- so the guards here are what keep that off the server.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const pickTote = async (page) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="tote bag"]').click({ force: true });
  await page.waitForTimeout(1000);
};

const modalText = (page) => page.evaluate(() => {
  const b = document.getElementById('bigAlertOverlay');
  return b && getComputedStyle(b).display !== 'none' ? document.getElementById('bigAlertMsg')?.textContent : null;
});

const scenarios = {

  async toteSizeGuard(page) {
    await pickTote(page);
    if (!(await page.isVisible('#toteSizeCard'))) return 'FAIL: size card not shown on tote pick';
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await page.waitForTimeout(1000);
    const m = await modalText(page);
    if (!m || !/tote size/i.test(m)) return `FAIL: no size guard (modal=${JSON.stringify(m)})`;
    return `PASS: size card shown, size guard fires`;
  },

  // Size chosen but no colour -> must still be blocked, or the server throws.
  async toteColorGuard(page) {
    await pickTote(page);
    await page.click('#toteSizeGrid .btn-select[data-tote-size=\'16" x 16"\']');
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await page.waitForTimeout(1000);
    const m = await modalText(page);
    if (!m || !/tote color/i.test(m)) return `FAIL: colourless tote was not blocked (modal=${JSON.stringify(m)})`;
    return `PASS: colour guard fires when size chosen but colour is not`;
  },

  async toteFull(page, log, mockupBodies) {
    await pickTote(page);
    await page.click('#toteSizeGrid .btn-select[data-tote-size=\'18" x 18"\']');
    await page.waitForTimeout(500);
    const note = await page.textContent('#toteSizeSelectedNote');
    if (!/18/.test(note)) return `FAIL: confirm note wrong: ${note}`;
    await page.click('#toteBagColorGridGen .color-btn[data-color="Black"]');
    await page.waitForTimeout(500);
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
    // THE FADE PAGE STANDS BETWEEN APPROVE AND THE MOCKUP NOW. Every product
    // in PRODUCTS_AUTO_MOCKUP routes through maybeOpenFadeBeforeMockup() on
    // approve, and beginFinalMockupFetch() only runs once the customer
    // confirms there. This suite predates that page, so it sat waiting for a
    // start-mockup that was never coming and reported "no start-mockup fired"
    // as if the product were broken. It is a feature, added on Alyx's request
    // after reaching a coaster mockup without ever being offered a fade.
    // verify-coaster-mousepad and verify-auto-mockup already do this, which is
    // why they were the only auto-mockup suites still passing.
    await passFadePage(page);
    // The mockup then fires automatically (PRODUCTS_AUTO_MOCKUP); clicking
    // Continue to Order is no longer how you reach it.
    await page.waitForTimeout(8000);
    const start = mockupBodies.find(b => b && b.action === 'start');
    if (!start) return `FAIL: no start-mockup fired (bodies=${JSON.stringify(mockupBodies)})`;
    if (start.productKey !== 'tote-bag') return `FAIL: productKey=${start.productKey}`;
    if (start.sizeLabel !== '18" x 18"') return `FAIL: sizeLabel=${JSON.stringify(start.sizeLabel)}`;
    if (start.colorName !== 'Black') return `FAIL: colorName=${start.colorName}`;
    if (!start.image) return 'FAIL: no image url';
    return `PASS: mockup body {tote-bag, ${JSON.stringify(start.sizeLabel)}, Black}`;
  },

  async toteReset(page) {
    await pickTote(page);
    await page.click('#toteSizeGrid .btn-select[data-tote-size=\'13" x 13"\']');
    await page.waitForTimeout(500);
    page.once('dialog', d => d.accept());
    await page.evaluate(() => resetEverythingFreshStart());
    await page.waitForTimeout(800);
    const st = await page.evaluate(() => ({
      size: typeof selectedToteSize === 'undefined' ? 'undefined' : selectedToteSize,
      sel: document.querySelectorAll('#toteSizeGrid .btn-select.selected').length,
      note: document.getElementById('toteSizeSelectedNote')?.textContent || '',
    }));
    if (st.size !== null || st.sel !== 0 || st.note !== '') return `FAIL: not cleared: ${JSON.stringify(st)}`;
    return 'PASS: reset clears tote size + note';
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
      await page.screenshot({ path: `shot-tote-fail-${name}.png` }).catch(() => {});
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL TOTE VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
