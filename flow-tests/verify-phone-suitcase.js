// Phone case + suitcase flow verification: product pick → mandatory
// pre-gen choice → generate → approve → YES → Continue to Order →
// mockup request carries the right productKey/sizeLabel → lightbox.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

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
    // THE FADE PAGE STANDS BETWEEN APPROVE AND THE MOCKUP NOW. Same stale-test
    // family as verify-tote/poster/puzzle, found in the same sweep: every
    // product in PRODUCTS_AUTO_MOCKUP pauses at maybeOpenFadeBeforeMockup()
    // on approve, and the mockup only fires once the customer confirms there.
    // This suite predates that page, so it waited for a start-mockup that was
    // deliberately parked behind a confirmation screen and reported the
    // product broken. Walk through it like a customer does.
    await passFadePage(page);
    // The mockup then fires automatically (PRODUCTS_AUTO_MOCKUP); clicking
    // Continue to Order is no longer how you reach it.
    await page.waitForTimeout(8000);
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
    await page.click('#phoneCaseStyleGrid .btn-select[data-phone-style="tough"]');
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
    // THE FADE PAGE STANDS BETWEEN APPROVE AND THE MOCKUP NOW. Same stale-test
    // family as verify-tote/poster/puzzle, found in the same sweep: every
    // product in PRODUCTS_AUTO_MOCKUP pauses at maybeOpenFadeBeforeMockup()
    // on approve, and the mockup only fires once the customer confirms there.
    // This suite predates that page, so it waited for a start-mockup that was
    // deliberately parked behind a confirmation screen and reported the
    // product broken. Walk through it like a customer does.
    await passFadePage(page);
    // The mockup then fires automatically (PRODUCTS_AUTO_MOCKUP); clicking
    // Continue to Order is no longer how you reach it.
    await page.waitForTimeout(8000);
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

  // THE CARD HOLDER (24 Sep 2026): case -> model -> finish, and the mockup
  // asks for the card-holder product with the finish as its colour. The
  // gift-boxed Matte is chosen on purpose: it is the dearer variant, so a
  // colour that fell off here would preview and bill the wrong case.
  async cardHolderFull(page, log, mockupBodies) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="phone case"]').click({ force: true });
    await page.waitForTimeout(900);
    await page.click('#phoneCaseStyleGrid .btn-select[data-phone-style="card-holder"]');
    await page.waitForTimeout(900);
    // The Tough case's models are not all the card holder's: the S26 must
    // not be offered here, and the 18 Pro must be.
    const offered = await page.evaluate(() => phoneCaseModelsFor());
    if (offered.includes('Samsung Galaxy S26') || !offered.includes('iPhone 18 Pro'))
      return `FAIL: card holder offers the Tough case's models (${offered.length} models)`;
    await page.fill('#phoneModelSearchInputGen', 'iPhone 15 Pro Max');
    await page.press('#phoneModelSearchInputGen', 'Enter');
    await page.waitForTimeout(800);
    await page.click('#phoneModelConfirmGen button:has-text("Yes")');
    await page.waitForTimeout(900);
    const finishShown = await page.evaluate(() => document.getElementById('phoneCaseFinishCard')?.style.display !== 'none'
      && document.querySelectorAll('#phoneCaseFinishGrid .btn-select').length);
    if (finishShown !== 4) return `FAIL: the finish card should offer 4 choices after the model, got ${finishShown}`;
    await page.click('#phoneCaseFinishGrid .btn-select[data-phone-finish="Matte, gift boxed"]');
    await page.waitForTimeout(800);
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    await dismissAlerts(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await page.waitForTimeout(1500);
    await passFadePage(page);
    await page.waitForTimeout(8000);
    const start = mockupBodies.find(b => b.action === 'start');
    if (!start) return 'FAIL: no start-mockup call fired';
    if (start.productKey !== 'phone-case-card-holder' || start.sizeLabel !== 'iPhone 15 Pro Max' || start.colorName !== 'Matte, gift boxed' || !start.image)
      return `FAIL: bad mockup body: ${JSON.stringify({ k: start.productKey, s: start.sizeLabel, c: start.colorName, img: !!start.image })}`;
    const pending = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'); } catch (e) { return null; } });
    return `PASS: card holder, mockup body {phone-case-card-holder, iPhone 15 Pro Max, Matte, gift boxed, image}${pending ? ', pending order saved' : ''}`;
  },

  // The 18 Pro has no gift box at Printify, so the two gift tiles must not
  // be offered for it.
  async cardHolderNoGiftBoxOn18Pro(page) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="phone case"]').click({ force: true });
    await page.waitForTimeout(900);
    await page.evaluate(() => pickPhoneCaseStyle('card-holder'));
    await page.waitForTimeout(900);
    await page.evaluate(() => { pendingPhoneCaseModel = 'iPhone 18 Pro'; confirmPhoneModelGen(true); });
    await page.waitForTimeout(900);
    const tiles = await page.evaluate(() => [...document.querySelectorAll('#phoneCaseFinishGrid .btn-select')].map(b => b.dataset.phoneFinish));
    if (tiles.length !== 2 || tiles.some(t => /gift/.test(t))) return `FAIL: iPhone 18 Pro offered ${JSON.stringify(tiles)}`;
    return `PASS: iPhone 18 Pro offers ${tiles.join(' / ')} only`;
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
