// Phone case + suitcase flow verification: product pick → mandatory
// pre-gen choice → generate → approve → YES → Continue to Order →
// mockup request carries the right productKey/sizeLabel → lightbox.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const scenarios = {

  async suitcaseGuard(page) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="suitcase"]').click({ force: true });
    await page.waitForTimeout(1000);
    const cardVis = await page.isVisible('#suitcaseSizeCard');
    if (!cardVis) return 'FAIL: size card not shown on suitcase pick';
    // Generate with NO size → guard modal
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await page.waitForTimeout(1000);
    const modal = await page.evaluate(() => {
      const b = document.getElementById('bigAlertOverlay');
      return b && getComputedStyle(b).display !== 'none' ? document.getElementById('bigAlertMsg')?.textContent : null;
    });
    if (!modal || !/suitcase size/i.test(modal)) return `FAIL: no size guard (modal=${JSON.stringify(modal)})`;
    return `PASS: size card shown, guard fires: "${modal.slice(0, 60)}"`;
  },

  async suitcaseFull(page, log, mockupBodies) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="suitcase"]').click({ force: true });
    await page.waitForTimeout(900);
    await page.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]');
    await page.waitForTimeout(700);
    const note = await page.textContent('#suitcaseSizeSelectedNote');
    if (!/Medium/.test(note)) return `FAIL: confirm note wrong: ${note}`;
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
    await page.locator('button:has-text("Continue to Order")').first().click({ timeout: 5000 });
    await page.waitForTimeout(6000);
    const start = mockupBodies.find(b => b.action === 'start');
    if (!start) return 'FAIL: no start-mockup call fired';
    if (start.productKey !== 'suitcase' || start.sizeLabel !== 'Medium' || !start.image)
      return `FAIL: bad mockup body: ${JSON.stringify({ k: start.productKey, s: start.sizeLabel, img: !!start.image })}`;
    const lightbox = await page.evaluate(() => {
      const ov = document.getElementById('mockupLightboxOverlay');
      return ov && getComputedStyle(ov).display !== 'none';
    });
    return `PASS: full path, mockup body {suitcase, Medium, image}, lightbox=${lightbox}`;
  },

  async phoneCaseFull(page, log, mockupBodies) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="phone case"]').click({ force: true });
    await page.waitForTimeout(900);
    await page.fill('#phoneModelSearchInputGen', 'iPhone 15 Pro Max');
    await page.press('#phoneModelSearchInputGen', 'Enter');
    await page.waitForTimeout(800);
    await page.click('#phoneModelConfirmGen button:has-text("Yes")');
    await page.waitForTimeout(800);
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
    await page.locator('button:has-text("Continue to Order")').first().click({ timeout: 5000 });
    await page.waitForTimeout(6000);
    const start = mockupBodies.find(b => b.action === 'start');
    if (!start) return 'FAIL: no start-mockup call fired';
    if (start.productKey !== 'phone-case-tough' || start.sizeLabel !== 'iPhone 15 Pro Max' || !start.image)
      return `FAIL: bad mockup body: ${JSON.stringify({ k: start.productKey, s: start.sizeLabel, img: !!start.image })}`;
    const lightbox = await page.evaluate(() => {
      const ov = document.getElementById('mockupLightboxOverlay');
      return ov && getComputedStyle(ov).display !== 'none';
    });
    return `PASS: full path, mockup body {phone-case-tough, iPhone 15 Pro Max, image}, lightbox=${lightbox}`;
  },

  // Reset must clear the suitcase size
  async suitcaseReset(page) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="suitcase"]').click({ force: true });
    await page.waitForTimeout(900);
    await page.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Large"]');
    await page.waitForTimeout(600);
    page.once('dialog', (d) => d.accept());
    await page.evaluate(() => resetEverythingFreshStart());
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({
      size: typeof selectedSuitcaseSize !== 'undefined' ? selectedSuitcaseSize : '?',
      sel: document.querySelectorAll('#suitcaseSizeGrid .selected').length,
      cardShown: document.getElementById('suitcaseSizeCard')?.style.display !== 'none',
    }));
    if (st.size !== null || st.sel !== 0) return `FAIL: not cleared: ${JSON.stringify(st)}`;
    return `PASS: reset clears size (card shown after reset: ${st.cardShown})`;
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
      await page.screenshot({ path: `shot-ps-fail-${name}.png` }).catch(() => {});
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PHONE/SUITCASE VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
