// Post-fix verification: each audit fix re-proven through real
// interaction. PASS/FAIL per scenario; zero tolerated console errors
// (Vanity 404 must be GONE; watchdog error only in the injected-stall
// scenario where it is the expected rescue).
const { launch, openStudio, uploadPhoto, dismissAlerts, bodyFocusClasses, passFadePage } = require('./harness');

const waitApprove = (page, id = 'approveRow', t = 90000) =>
  page.waitForFunction((i) => document.getElementById(i)?.style.display !== 'none', id, { timeout: t });

async function mugLadder(page) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await page.waitForTimeout(500);
  await page.click('#preGenSize11Btn');
  await page.waitForTimeout(600);
  // Explicitly Trimmed, not .first(). Classic White was restored to this grid
  // and listed FIRST so the price ladder reads bottom-up -- and it is the one
  // style with no colours, so .first() now picks a mug whose colour grid never
  // renders and the colour click below times out. This suite is about
  // spotlights, the watchdog and the props, so it wants a style that HAS
  // colours; verify-mug-styles.js covers the colourless path.
  await page.locator('#preGenMugStyleGrid .btn-select[data-style="Trimmed"]').click();
  await page.waitForTimeout(800);
  await page.locator('#preGenMugColorGrid .color-btn').first().click();
  await page.waitForTimeout(1000);
  await page.click('#preGenMugColorFinishBtn');
  await page.waitForTimeout(800);
  // UPDATED (Aug 2026): Wraparound is unshelved, so the mug rail now stops
  // at Print Style between Colour and Design Method -- the prop tiles these
  // scenarios click do not exist until a print format is chosen, which is
  // what five page.click timeouts in this file were actually reporting.
  // Not a weakened assertion: this suite is about spotlights, the watchdog
  // and the props, so it takes the default (Three Panels) explicitly and
  // leaves Wraparound's own behaviour to verify-wraparound.js.
  await dismissAlerts(page);
  await page.evaluate(() => {
    const card = document.getElementById('mugPrintModeCard');
    if (card && card.style.display !== 'none') pickMugPrintMode('three-panel');
  });
  await page.waitForTimeout(900);
  await dismissAlerts(page);
}

const scenarios = {

  // I-1 (rail version): spotlight HELD at reveal (approve + caption detour
  // live, rest locked), then handed off at YES so placement is usable.
  async fix1_greetingCardRail(page) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="greeting card"]').click({ force: true });
    await page.waitForTimeout(900);
    await dismissAlerts(page);
    // Exact-transfer era (2026-08-28): an empty idea box now offers the
    // photo as-is instead of silently generating — this scenario is about
    // the AI rail's spotlight, so it types an idea like an AI customer.
    await page.fill('#ideaDesc', 'a joyful birthday parade');
    await page.waitForTimeout(500);
    await dismissAlerts(page);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    const atReveal = await page.evaluate(() => ({
      genActive: document.body.classList.contains('generation-active'),
      banners: document.querySelectorAll('.generation-reminder-banner').length,
      captionPE: getComputedStyle(document.getElementById('captionCard')).pointerEvents,
      productPE: getComputedStyle(document.getElementById('productCard')).pointerEvents,
    }));
    if (!atReveal.genActive) return 'FAIL: spotlight dropped at reveal (genActive off)';
    if (atReveal.banners) return `FAIL: ${atReveal.banners} patience banners left behind`;
    if (atReveal.captionPE === 'none') return 'FAIL: caption detour locked at reveal';
    if (atReveal.productPE !== 'none') return 'FAIL: product grid not dimmed at reveal (spotlight leaking)';
    // Caption detour genuinely usable
    await page.locator('#captionText').fill('Happy Birthday!', { timeout: 4000 });
    // YES → spotlight handoff → placement + Continue to Order live.
    // UPDATED (2026-08-28): greeting cards graduated to real orderable
    // products and joined the auto-mockup rail, so the fade page and the
    // real mockup now stand between YES and Continue to Order — pass
    // through them the way a customer does.
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await page.waitForTimeout(1500);
    const afterYes = await page.evaluate(() => document.body.classList.contains('generation-active'));
    if (afterYes) return 'FAIL: spotlight not handed off after YES';
    await passFadePage(page);
    // The auto-mockup opens in the lightbox; the way onward is its Return
    // button (What's Next appears behind it), same as a customer taps.
    await page.waitForFunction(() => {
      const b = document.getElementById('mockupLightboxReturn');
      return b && getComputedStyle(b).display !== 'none';
    }, null, { timeout: 30000 });
    await page.click('#mockupLightboxReturn');
    await page.waitForTimeout(1500);
    // Post-mockup the onward button is What's Next's "✅ Checkout"
    // (goToOrder) — "Continue to Order" is the PRE-mockup button on the
    // mug/travel rail and never appears on this path.
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Checkout/.test(x.textContent)); b?.scrollIntoView({ block: 'center' }); });
    await page.locator('button:has-text("Checkout")').first().click({ timeout: 15000 });
    return 'PASS: spotlight held at reveal (caption detour live), handed off at YES, fade+mockup+lightbox passed, order path clickable';
  },

  // I-1b: "No — Let's Try Another" must release the spotlight onto the idea box.
  async fix1b_keepTweakingRelease(page) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="greeting card"]').click({ force: true });
    await page.waitForTimeout(900);
    await dismissAlerts(page);
    // Same exact-transfer note as fix1 above: the AI rail needs words now.
    await page.fill('#ideaDesc', 'a joyful birthday parade');
    await page.waitForTimeout(500);
    await dismissAlerts(page);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    await page.locator('#approveRow button:has-text("No")').first().click();
    await page.waitForTimeout(1600);
    await dismissAlerts(page); // idea-box intro "Got It" popup — normal first-visit behavior
    await page.waitForTimeout(300);
    const genActive = await page.evaluate(() => document.body.classList.contains('generation-active'));
    if (genActive) return 'FAIL: dim still on after Try Another';
    await page.click('#ideaDesc', { timeout: 4000 }); // real click: box must be expanded AND unlocked
    await page.fill('#ideaDesc', 'make the hat bigger');
    return 'PASS: Try Another releases the spotlight; idea box expanded and genuinely editable';
  },

  // I-2: Track 2 guard bounce must land on a usable product grid.
  async fix2_track2GuardBounce(page) {
    await page.click('#postUploadForkRow button:has-text("Create Your Design")');
    await page.waitForTimeout(1500);
    await dismissAlerts(page);
    await page.fill('#ideaDesc', 'corgi commander');
    await page.click('#generateBtn');
    await page.waitForTimeout(1000);
    await dismissAlerts(page);
    const focus = (await bodyFocusClasses(page)).join(',');
    // REAL click, no force — must succeed now
    await page.click('#productCard .btn-select[data-val="tote bag"]', { timeout: 5000 });
    const product = await page.evaluate(() => product);
    if (product !== 'tote bag') return `FAIL: product=${product}`;
    // UPDATED (Aug 2026): tote bag now has MANDATORY pre-generation choices
    // (size + colour), joining mug / phone case / suitcase / puzzle. Colour is
    // mandatory because resolveVariant() throws when a size entry carries
    // colors and none is sent, and tote's do. This test is about the Track 2
    // guard BOUNCE, not about tote specifically, so complete tote's required
    // picks here and leave the actual subject of the test unchanged.
    await page.click('#toteSizeGrid .btn-select[data-tote-size=\'16" x 16"\']');
    await page.waitForTimeout(500);
    await page.click('#toteBagColorGridGen .color-btn[data-color="Black"]');
    await page.waitForTimeout(400);
    // and generation must proceed end-to-end
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    return `PASS: focus after bounce=[${focus}], real tile click worked, generated to approve`;
  },

  // I-3: fast Cover Me run must complete WITHOUT the forced-finish error.
  async fix3_noHealthyTruncation(page, log) {
    await mugLadder(page);
    await page.click('#designMethodCoverMeBtn');
    await page.waitForTimeout(900);
    await page.locator('#coverMeGrid .magazine-tile').first().click();
    await page.waitForTimeout(700);
    await page.click('#coverMeGenerateBtn');
    await waitApprove(page, 'coverMeEaselApproveRow');
    const forced = log.consoleErrors.filter(e => /forcing it to finish|stalled with the approve/.test(e));
    if (forced.length) return `FAIL: watchdog fired on a healthy run: ${forced[0]}`;
    return 'PASS: healthy finale completed naturally, watchdog silent';
  },

  // I-4: inject a force-stop mid-finale — watchdog must rescue within ~12s.
  async fix4_orphanRescue(page, log) {
    await mugLadder(page);
    await page.click('#designMethodFaceItBtn');
    await page.waitForTimeout(900);
    await page.locator('#faceItGrid .faceit-tile').first().click();
    await page.waitForTimeout(700);
    await page.click('#faceItGenerateBtn');
    // wait for finale (art revealed), then sabotage
    await page.waitForFunction(() => typeof needlesPhase !== 'undefined' && needlesPhase === 'finale', null, { timeout: 60000 });
    await page.evaluate(() => stopNeedlesStage()); // orphans the pending done callback
    const t0 = Date.now();
    await waitApprove(page, 'faceItEaselApproveRow', 20000);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const rescued = log.consoleErrors.some(e => /stalled with the approve step still owed/.test(e));
    return `PASS: approve appeared ${secs}s after injected force-stop (watchdog fired: ${rescued})`;
  },

  // I-5: Vanity Fair tile must load — zero 404s in the Cover Me grid.
  async fix5_vanityFair(page, log) {
    await mugLadder(page);
    await page.click('#designMethodCoverMeBtn');
    await page.waitForTimeout(2500);
    const bad = log.notFound.filter(u => /Vanity/i.test(u));
    if (bad.length) return `FAIL: still 404s: ${bad[0]}`;
    const tileImgOk = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('#coverMeGrid img'));
      const vf = imgs.find(i => /Vanity/i.test(i.src));
      return vf ? (vf.complete && vf.naturalWidth > 0) : 'tile-missing';
    });
    return tileImgOk === true ? 'PASS: Vanity Fair tile loads' : `FAIL: ${tileImgOk}`;
  },

  // Regression: GM full flow still clean after all edits.
  async regression_goodMorning(page, log) {
    await mugLadder(page);
    await page.click('#designMethodHomeBtn');
    await page.waitForTimeout(1000);
    await page.locator('#goodMorningGrid .goodmorning-tile').first().click();
    await page.waitForTimeout(700);
    await page.click('#goodMorningGenerateBtn');
    await waitApprove(page, 'goodMorningEaselApproveRow');
    await page.click('#goodMorningEaselApproveRow .generate-btn');
    await page.waitForTimeout(1800);
    const panel = await page.isVisible('#coverMePanelCard');
    return panel ? 'PASS: GM → approve → panel screen' : 'FAIL: panel screen missing';
  },

  // Regression: decline-props description-only path still works.
  async regression_descriptionOnly(page) {
    await mugLadder(page);
    await page.click('#declinePropsBtn');
    await page.waitForTimeout(500);
    await page.click('#designByDescriptionContinueBtn');
    await page.waitForTimeout(1400);
    await dismissAlerts(page);
    await page.waitForTimeout(300);
    await page.fill('#ideaDesc', 'superhero over the city');
    await page.click('#ideaGuidancePrompt');
    await page.waitForTimeout(1600);
    const genBtn = page.locator('#mugIdeaActionRow button:has-text("Generate")');
    if (!(await genBtn.isVisible())) return 'FAIL: guided Generate missing';
    await genBtn.click();
    await waitApprove(page);
    // Rail: spotlight held at approve; YES hands off to the panel screen,
    // which clears every focus mode (parallel-session convergence).
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    // The parallel session reordered the mug flow: Edge Fade now runs
    // BEFORE panel placement, so the fade page stands between YES and the
    // panel screen this scenario asserts.
    await passFadePage(page);
    // Wait ON the handoff, not a fixed nap: the stability-polled scrolls
    // and the panel screen's 3s hold-then-snap both stretch the callback
    // chain past any fixed number under load. The assertion is the
    // OUTCOME (spotlight released, panel screen up), not the timeline.
    const handedOff = await page.waitForFunction(() =>
      !document.body.classList.contains('generation-active'), null, { timeout: 15000 }
    ).then(() => true).catch(() => false);
    const st = await page.evaluate(() => ({
      panel: document.getElementById('coverMePanelCard')?.style.display !== 'none',
    }));
    if (!handedOff) return 'FAIL: spotlight not handed off after YES (mug guided path)';
    if (!st.panel) return 'FAIL: mug guided path did not converge on panel screen';
    return 'PASS: guided path through approve, YES converges on panel screen with clean handoff';
  },
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    try {
      await openStudio(page);
      await uploadPhoto(page);
      const result = await fn(page, log);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
      await page.screenshot({ path: `shot-verify-fail-${name}.png` }).catch(() => {});
    }
    const unexpected = log.consoleErrors.filter(e =>
      !/ERR_TUNNEL/.test(e) && !(name === 'fix4_orphanRescue' && /stalled with the approve/.test(e)));
    if (unexpected.length) { console.log(`  UNEXPECTED CONSOLE: ${JSON.stringify(unexpected)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
