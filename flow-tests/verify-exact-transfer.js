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
const { launch, openStudio, uploadPhoto, uploadPhotoAndChooseBYO, dismissAlerts, BASE } = require('./harness');

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

// ---- A non-default Art Style pick would silently never be applied on an
// exact transfer (style only means anything to the AI, which never runs
// here) -- Alyx's question, exactly. The confirm must say so, by name,
// rather than let the customer discover it on the finished product. ----
scenarios.confirmWarnsWhenAStyleWouldBeLost = async (page) => {
  await dismissAlerts(page);
  await page.locator('#styleSectionCard .btn-select', { hasText: 'Line Art' }).click({ force: true });
  await T(page, 300);
  await pickProduct(page, 'mouse pad');
  await armConfirm(page, false); // decline -- this scenario is about the message text, not the accept path
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await T(page, 500);
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (!calls.length) return 'FAIL: no confirm fired';
  if (!/Line Art/.test(calls[0])) return `FAIL: confirm never names the chosen style: ${calls[0]}`;
  if (!/will NOT use it/i.test(calls[0])) return `FAIL: confirm doesn't say the style is dropped: ${calls[0]}`;
  return 'PASS: exact-transfer confirm warns by name when a non-default style would be silently discarded';
};

// ---- The default style (never touched) needs no such warning -- nothing
// real is being lost, so the note would just be noise. ----
scenarios.confirmStaysQuietOnDefaultStyle = async (page) => {
  await pickProduct(page, 'mouse pad');
  await armConfirm(page, false);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await T(page, 500);
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (!calls.length) return 'FAIL: no confirm fired';
  if (/Note: you picked a style/.test(calls[0])) return `FAIL: warned about a style the customer never touched: ${calls[0]}`;
  return 'PASS: no style warning when the customer never left the house default';
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

// ---- The free lane must be ADVERTISED at the front door: the banner
// lives inside uploadPhotoCard so the initial-upload spotlight leaves it
// lit from the first second of a first visit. ----
scenarios.frontDoorAdvertisesTheFreeLane = async (page) => {
  const st = await page.evaluate(() => {
    const b = document.getElementById('byoArtBanner');
    if (!b) return { exists: false };
    const r = b.getBoundingClientRect();
    return { exists: true, text: b.textContent, visible: r.height > 0 && getComputedStyle(b).display !== 'none',
      insideUpload: !!b.closest('#uploadPhotoCard') };
  });
  if (!st.exists) return 'FAIL: no BYO banner on the page';
  if (!st.visible) return 'FAIL: the banner exists but is not visible';
  if (!st.insideUpload) return 'FAIL: the banner is outside uploadPhotoCard — the initial spotlight will dim it';
  if (!/FREE/i.test(st.text) || !/exactly as it is/i.test(st.text)) return `FAIL: banner copy doesn't sell the free as-is lane`;
  if (/token/i.test(st.text)) return 'FAIL: the banner mentions tokens — Alyx: "we don\'t have to say that"';
  return 'PASS: the front door advertises bring-your-own-art, free, without mentioning tokens';
};

// ---- The Prompt Kit hands out a prompt SHAPED to the picked product,
// and never leaks the house generation prompt (identity-preservation
// language is the tell). ----
scenarios.promptKitShapesToTheProduct = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => togglePromptKit());
  const tall = await page.evaluate(() => document.getElementById('promptKitText').value);
  if (!/tall vertical/i.test(tall)) return `FAIL: travel cup prompt isn't shaped tall: ${tall.slice(0, 80)}`;
  // The fork button is spent after the first pick — switch on the grid
  // itself (no paid work yet, so no tier-b confirm fires).
  await page.locator('#productCard .btn-select[data-val="coaster"]').click({ force: true });
  await T(page, 1000);
  await dismissAlerts(page);
  const round = await page.evaluate(() => { copyPromptKit(null); return document.getElementById('promptKitText').value; });
  if (!/circle/i.test(round)) return `FAIL: coaster prompt doesn't mention the circle trim`;
  for (const secret of [/identity preservation/i, /muggshotz caricature/i, /same hairline/i]) {
    if (secret.test(tall) || secret.test(round)) return `FAIL: the kit leaks house prompt language (${secret})`;
  }
  if (!/quotation marks/i.test(tall)) return 'FAIL: the kit prompt forgot the no-unrequested-text rule';
  return 'PASS: the Prompt Kit shapes to the product and leaks nothing of the house prompts';
};

// ================= THE INTENT GATE (Alyx, 2026-08-28) =================
// "One should be forced to indicate whether or not they will be supplying
// their own art or whether or not they will be using our generator...
// this panel should not be accessible to them." A hard choice, not a dim:
// Art Style and the Track fork are genuinely display:none for a declared
// BYO customer, not merely spotlighted away from. These scenarios drive
// their own setup (uploadPhotoAndChooseBYO / the raw gate), so they are
// marked BYO_SETUP and the runner below skips the default uploadPhoto.
const BYO_SETUP = new Set();

scenarios.gateBlocksEverythingUntilChosen = async (page) => {
  const input = page.locator('#fileInput');
  await input.setInputFiles(require('path').join(__dirname, 'test-photo.jpg'));
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => {
    const overlay = document.getElementById('intentGateOverlay');
    const styleCard = document.getElementById('styleSectionCard');
    const mid = (() => {
      const r = styleCard.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      return document.elementFromPoint(x, y);
    })();
    return {
      overlayShown: overlay && getComputedStyle(overlay).display !== 'none',
      styleCardCovered: !(mid === styleCard || styleCard.contains(mid)),
    };
  });
  if (!st.overlayShown) return 'FAIL: uploading a photo did not open the intent gate';
  if (!st.styleCardCovered) return 'FAIL: Art Style is still the actual hit-target behind the gate — not a real block';
  return 'PASS: the gate opens on upload and genuinely covers Art Style, not just dims it';
};
BYO_SETUP.add('gateBlocksEverythingUntilChosen');

scenarios.chooseAIKeepsThePriorRailIntact = async (page) => {
  const input = page.locator('#fileInput');
  await input.setInputFiles(require('path').join(__dirname, 'test-photo.jpg'));
  await page.waitForTimeout(700);
  await page.evaluate(() => chooseIntentAI());
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({
    gateGone: getComputedStyle(document.getElementById('intentGateOverlay')).display === 'none',
    styleShown: getComputedStyle(document.getElementById('styleSectionCard')).display !== 'none',
    forkShown: document.getElementById('postUploadForkRow').style.display === 'flex',
  }));
  if (!st.gateGone) return 'FAIL: gate still showing after choosing AI';
  if (!st.styleShown || !st.forkShown) return 'FAIL: Art Style / the Track fork did not appear for the AI choice';
  return 'PASS: choosing AI dismisses the gate and reveals Art Style + the Track fork exactly as before';
};
BYO_SETUP.add('chooseAIKeepsThePriorRailIntact');

scenarios.chooseBYOHidesStyleAndLandsOnProduct = async (page) => {
  await uploadPhotoAndChooseBYO(page);
  const st = await page.evaluate(() => ({
    gateGone: getComputedStyle(document.getElementById('intentGateOverlay')).display === 'none',
    styleHidden: getComputedStyle(document.getElementById('styleSectionCard')).display === 'none',
    forkHidden: getComputedStyle(document.getElementById('trackForkCard')).display === 'none',
    onProduct: document.body.classList.contains('product-focus'),
  }));
  if (!st.gateGone) return 'FAIL: gate still showing after choosing BYO';
  if (!st.styleHidden) return 'FAIL: Art Style is still reachable after declaring BYO — the whole point of the hard gate';
  if (!st.forkHidden) return 'FAIL: the Track fork is still reachable after declaring BYO';
  if (!st.onProduct) return 'FAIL: BYO did not land on product picking';
  return 'PASS: choosing BYO genuinely removes Art Style and the Track fork, lands straight on product picking';
};
BYO_SETUP.add('chooseBYOHidesStyleAndLandsOnProduct');

scenarios.byoDeclaredCustomerSkipsTheConfirm = async (page, log, mockupBodies) => {
  await uploadPhotoAndChooseBYO(page);
  await page.locator('#productCard .btn-select[data-val="mouse pad"]').click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  await armConfirm(page, false); // if this fires at all, the scenario should fail on the confirm-count check below
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await T(page, 500);
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (calls.length) return `FAIL: a declared-BYO customer was asked to confirm again (${JSON.stringify(calls)})`;
  await waitApprove(page);
  const gen = log.apiCalls.filter(c => c.path === '/api/generate');
  const nonUpload = gen.filter(c => c.action !== 'uploadComposite');
  if (nonUpload.length) return 'FAIL: the AI ran anyway for a declared-BYO customer';
  return 'PASS: a customer who already declared BYO at the gate skips the mid-flow confirm entirely';
};
BYO_SETUP.add('byoDeclaredCustomerSkipsTheConfirm');

scenarios.byoStillNeedsWordsForWraparound = async (page, log) => {
  // Same reliable pattern as wraparoundStillNeedsWords above: call
  // generate() directly against seeded state rather than clicking through
  // the mug rail's own UI (that full click-through belongs to
  // verify-wraparound.js). This scenario only owns one question: does a
  // BYO declaration change the wraparound guard's answer? It must not.
  await uploadPhotoAndChooseBYO(page);
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
  if (calls.length) return 'FAIL: wraparound skipped straight to a confirm — a photo cannot honestly become a panorama regardless of declared intent';
  const gen = log.apiCalls.filter(c => c.path === '/api/generate');
  if (gen.length) return 'FAIL: wraparound generated anyway for a declared-BYO customer';
  return 'PASS: declaring BYO does not bypass the wraparound guard — that one still needs a description';
};
BYO_SETUP.add('byoStillNeedsWordsForWraparound');

scenarios.resetRearmsTheGate = async (page) => {
  await uploadPhotoAndChooseBYO(page);
  await page.evaluate(() => {
    window.confirm = () => true; // the "reset everything" confirm
    resetEverythingFreshStart();
  });
  await T(page, 500);
  const st = await page.evaluate(() => ({
    styleDisplay: document.getElementById('styleSectionCard').style.display,
    trackDisplay: document.getElementById('trackForkCard').style.display,
    intent: typeof byoDeclaredIntent !== 'undefined' ? byoDeclaredIntent : 'MISSING',
  }));
  if (st.styleDisplay === 'none') return 'FAIL: Art Style is still hidden after a full reset — the next customer could be a different person';
  if (st.trackDisplay === 'none') return 'FAIL: the Track fork is still hidden after a full reset';
  if (st.intent !== null) return `FAIL: byoDeclaredIntent did not reset to null (got ${st.intent})`;
  return 'PASS: a full reset un-hides Art Style/the Track fork and clears the declared intent, so the gate re-arms for a fresh upload';
};
BYO_SETUP.add('resetRearmsTheGate');
// ================= END THE INTENT GATE =================

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
      if (!BYO_SETUP.has(name)) {
        await uploadPhoto(page);
        await dismissAlerts(page);
      }
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
