// EXACT TRANSFER (Alyx, 2026-08-28): "A mechanism to just transfer the exact
// image without any AI meddling." An EMPTY idea box now means "my photo,
// exactly as it is": one confirm, then the uploaded photo itself becomes the
// design -- no generative call, no token charge, no fade defaulted onto it.
// Fitting to the print area stays pure geometry downstream. Wraparound still
// requires words (a photo cannot honestly become a seam-to-seam panorama
// without generative extension), and the message must name the Classic
// alternative rather than just refusing.
//
// The declined path (Cancel = land back on the idea rail, nothing charged)
// is asserted product-by-product in verify-coaster-mousepad.js and
// verify-approve-handoff.js; this suite owns the accepted path.
const { launch, openStudio, uploadPhoto, dismissAlerts, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
}

// In-page confirm override -- the house lesson from the tier-b suite:
// Playwright's 'dialog' event can miss a confirm the page demonstrably
// fired, so the test polices window.confirm directly.
const armConfirm = (page, answer) => page.evaluate((ans) => {
  window.__confirmCalls = [];
  window.confirm = (msg) => { window.__confirmCalls.push(msg); return ans; };
}, answer);

const waitApprove = (page, t = 60000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const scenarios = {};

// ---- The whole accepted path on one product (mouse pad: overlay-free,
// no shape step, single variant). Photo in, confirm yes, and the photo
// itself must come out the other end: no generation call, a hosted URL
// via uploadComposite, the fade page opening at 0%, and the mockup body
// carrying the transferred image. ----
scenarios.acceptedTransferSkipsTheAI = async (page, log, mockupBodies) => {
  await pickProduct(page, 'mouse pad');
  await armConfirm(page, true);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await T(page, 500);
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (!calls.length) return 'FAIL: no confirm fired for the empty box';
  if (!/no image credits/i.test(calls[0])) return `FAIL: confirm doesn't say it costs nothing: ${calls[0]}`;
  await waitApprove(page);

  // THE core claim: nothing generative ever ran. Every /api/generate call
  // must be the uploadComposite hosting hop, never a prompt generation.
  const gen = log.apiCalls.filter(c => c.path === '/api/generate');
  const nonUpload = gen.filter(c => c.action !== 'uploadComposite');
  if (nonUpload.length) return `FAIL: the AI was called ${nonUpload.length} time(s) on an exact transfer`;
  if (!gen.length) return 'FAIL: the photo was never uploaded for a hosted URL (Stripe metadata cannot carry a raw data URL)';

  await page.locator('#approveRow button:has-text("Yes")').first().click();
  const fadeOpened = await page.waitForFunction(() => {
    const o = document.getElementById('frameFadeOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!fadeOpened) return 'FAIL: the fade page never opened after approving the transfer';
  const fadePct = await page.evaluate(() => document.getElementById('frameFadeAmountSlider')?.value);
  if (String(fadePct) !== '0') return `FAIL: fade page opened at ${fadePct}% on an exact transfer — the default fade is meddling`;
  await page.click('#frameFadeOverlay button:has-text("Continue")');
  await T(page, 8000);

  const start = mockupBodies.find(b => b && b.action === 'start');
  if (!start) return 'FAIL: no mockup fired after the transfer';
  if (start.productKey !== 'mouse-pad') return `FAIL: productKey=${start.productKey}`;
  if (!start.image || !String(start.image).includes('__fake/generated.jpg'))
    return `FAIL: mockup image is not the hosted transfer URL (got ${String(start.image).slice(0, 60)}...)`;
  return 'PASS: empty box + OK = photo straight to the mockup, zero AI calls, fade page opens at 0%';
};

// ---- Out of credits must NOT block a transfer: it costs nothing. ----
scenarios.outOfCreditsCanStillTransfer = async (page, log) => {
  await pickProduct(page, 'mouse pad');
  await page.evaluate(() => { currentTokenBalance = 0; });
  await armConfirm(page, true);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await T(page, 500);
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (!calls.length) return 'FAIL: a customer with 0 credits was blocked from the free transfer';
  await waitApprove(page);
  return 'PASS: zero credits still allows the free exact transfer';
};

// ---- Wraparound still needs words, and says why + the way out. Drives the
// real generate() against seeded wraparound state (the full pick rail for
// wraparound is verify-wraparound.js's job; this scenario only owns the
// guard's message). ----
scenarios.wraparoundStillNeedsWords = async (page, log) => {
  await armConfirm(page, true);
  await page.evaluate(() => {
    product = 'mug';
    mugPrintMode = 'wraparound';
    mugSizeChosenPreGen = true;
    mugColorFinishedPreGen = true;
    generate();
  });
  await T(page, 1200);
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (calls.length) return 'FAIL: wraparound + empty box offered the transfer (a photo cannot honestly become a panorama)';
  const gen = log.apiCalls.filter(c => c.path === '/api/generate');
  if (gen.length) return 'FAIL: wraparound + empty box still generated';
  const status = await page.evaluate(() => document.getElementById('statusMsg')?.textContent || document.body.textContent);
  if (!/Classic/.test(status)) return 'FAIL: the refusal never names the Classic way out';
  return 'PASS: wraparound + empty box refuses, names Classic as the way to an as-is photo';
};

// ---- Typing words must leave the AI path exactly as it was: no confirm,
// a real generation call. The transfer must never hijack a described idea. ----
scenarios.typedIdeaStillGenerates = async (page, log) => {
  await pickProduct(page, 'mouse pad');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await T(page, 600);
  await dismissAlerts(page);
  await armConfirm(page, true);
  await T(page, 300);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (calls.length) return 'FAIL: a typed idea still got the transfer confirm';
  const gen = log.apiCalls.filter(c => c.path === '/api/generate' && c.action !== 'uploadComposite');
  if (!gen.length) return 'FAIL: a typed idea never reached the AI';
  return 'PASS: typed idea generates exactly as before, no transfer offer';
};

// ---- The customer-facing words: the idea card itself must SAY that empty
// means as-is, or the whole mechanism is a secret nobody can use. ----
scenarios.theBoxExplainsItself = async (page) => {
  const note = await page.evaluate(() => document.getElementById('ideaDefaultNote')?.textContent || '');
  if (!/leave this box empty/i.test(note)) return `FAIL: the idea card never tells the customer that empty = as-is`;
  if (!/no image credits|free/i.test(note)) return 'FAIL: the note never says the transfer costs nothing';
  return 'PASS: the idea card tells the customer: empty box = your photo as-is, free';
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
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL|Failed to load resource/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL EXACT-TRANSFER VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
