// Photo/Poster flow verification. The poster UI already existed; what was
// missing was the buildMockupRequestBody bridge, so the mockup never fired.
// These checks pin the request body for BOTH trees (unframed base vs the
// framed upsell, which is a different blueprint/provider server-side) and
// pin the framed/unframed card toggling.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const pickPoster = async (page) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="photo poster"]').click({ force: true });
  await page.waitForTimeout(1000);
};

const runToMockup = async (page, mockupBodies) => {
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Continue to Order")').first().click({ timeout: 8000 });
  await page.waitForTimeout(6000);
  return mockupBodies.find(b => b && b.action === 'start');
};

const scenarios = {

  // Card appears, and framed/unframed swaps which sub-options are offered.
  async posterCardToggle(page) {
    await pickPoster(page);
    if (!(await page.isVisible('#photoPosterOptionsCard'))) return 'FAIL: poster options card not shown';
    const unframed = await page.evaluate(() => ({
      orient: getComputedStyle(document.getElementById('posterOrientationFinishWrap')).display,
      frame: getComputedStyle(document.getElementById('posterFrameColorWrap')).display,
      size: posterSize,
    }));
    if (unframed.orient === 'none') return 'FAIL: orientation/finish hidden while unframed';
    if (unframed.frame !== 'none') return 'FAIL: frame-colour shown while unframed';
    await page.click('#posterFramedBtn');
    await page.waitForTimeout(500);
    const framed = await page.evaluate(() => ({
      orient: getComputedStyle(document.getElementById('posterOrientationFinishWrap')).display,
      frame: getComputedStyle(document.getElementById('posterFrameColorWrap')).display,
      size: posterSize,
    }));
    if (framed.orient !== 'none') return 'FAIL: orientation/finish still shown while framed';
    if (framed.frame === 'none') return 'FAIL: frame-colour hidden while framed';
    if (framed.size === unframed.size) return `FAIL: size did not re-base across trees (both ${framed.size})`;
    return `PASS: toggle swaps options + re-bases size (${unframed.size} → ${framed.size})`;
  },

  // Unframed: orientation + finish must reach the server; frame colour must NOT.
  async posterUnframed(page, log, mockupBodies) {
    await pickPoster(page);
    await page.click('#posterUnframedBtn');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('#posterSizeGrid .btn-select')].find(b => /20.*x.*30/.test(b.textContent));
      if (t) t.click();
    });
    await page.click('#posterOrientHorizontalBtn');
    await page.click('#posterFinishMatteBtn');
    await page.waitForTimeout(500);
    const start = await runToMockup(page, mockupBodies);
    if (!start) return `FAIL: no start-mockup fired (bodies=${JSON.stringify(mockupBodies)})`;
    if (start.productKey !== 'photo-poster') return `FAIL: productKey=${start.productKey}`;
    if (start.sizeLabel !== '20x30') return `FAIL: sizeLabel=${start.sizeLabel}, expected 20x30`;
    if (start.posterFramed !== false) return `FAIL: posterFramed=${start.posterFramed}, expected false`;
    if (start.posterOrientation !== 'Horizontal') return `FAIL: orientation=${start.posterOrientation}`;
    if (start.posterFinish !== 'Matte') return `FAIL: finish=${start.posterFinish}`;
    if (start.colorName !== null) return `FAIL: colorName=${JSON.stringify(start.colorName)}, must be null when unframed`;
    if (!start.image) return 'FAIL: no image url';
    return `PASS: unframed {20x30, Horizontal, Matte, colorName:null}`;
  },

  // Framed: frame colour must travel as colorName.
  async posterFramed(page, log, mockupBodies) {
    await pickPoster(page);
    await page.click('#posterFramedBtn');
    await page.waitForTimeout(500);
    await page.click('#posterFrameWhiteBtn');
    await page.waitForTimeout(300);
    const chosenSize = await page.evaluate(() => posterSize);
    const start = await runToMockup(page, mockupBodies);
    if (!start) return `FAIL: no start-mockup fired`;
    if (start.productKey !== 'photo-poster') return `FAIL: productKey=${start.productKey}`;
    if (start.posterFramed !== true) return `FAIL: posterFramed=${start.posterFramed}, expected true`;
    if (start.colorName !== 'White') return `FAIL: colorName=${start.colorName}, expected White`;
    if (start.sizeLabel !== chosenSize) return `FAIL: sizeLabel=${start.sizeLabel}, expected ${chosenSize}`;
    return `PASS: framed {${start.sizeLabel}, frame White via colorName}`;
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
      await page.screenshot({ path: `shot-poster-fail-${name}.png` }).catch(() => {});
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL POSTER VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
