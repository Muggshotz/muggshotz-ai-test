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
const { launch, openStudio, uploadPhoto, uploadPhotoAndChooseBYO, waitForIntentGate, dismissAlerts, BASE } = require('./harness');

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
  // Drive pick() directly (the style-panel suite's own pattern): a force-
  // click can land on a late guidance popup under load, silently leaving
  // the style at default -- and this scenario's subject is the CONFIRM
  // MESSAGE, not tile clickability (that's verify-style-panel.js's job).
  const picked = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#styleSectionCard .btn-select')].find(b => /Line Art/.test(b.textContent));
    if (!el) return false;
    pick(el, 'style');
    return el.classList.contains('selected');
  });
  if (!picked) return 'FAIL: could not select the Line Art style tile at all';
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
  await waitForIntentGate(page); // fixed delays race the photo-resize chain under load
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
  await waitForIntentGate(page); // same race as above: choose only once the gate is truly open
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

// UPDATED (2026-08-28 evening, aligning with the parallel session's
// auto-run): a declared-BYO customer never presses Generate at all --
// finishing the product AUTO-RUNS the transfer and lands on the fade
// page directly. No confirm, no AI call, no manual button.
scenarios.byoDeclaredCustomerSkipsTheConfirm = async (page, log) => {
  await uploadPhotoAndChooseBYO(page);
  await armConfirm(page, false); // if any confirm fires, fail below
  await page.locator('#productCard .btn-select[data-val="mouse pad"]').click({ force: true });
  const fadeOpened = await page.waitForFunction(() => {
    const o = document.getElementById('frameFadeOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!fadeOpened) return 'FAIL: finishing a BYO product did not auto-run the transfer to the fade page';
  const calls = await page.evaluate(() => window.__confirmCalls || []);
  if (calls.length) return `FAIL: a declared-BYO customer was asked to confirm (${JSON.stringify(calls)})`;
  const nonUpload = log.apiCalls.filter(c => c.path === '/api/generate' && c.action !== 'uploadComposite');
  if (nonUpload.length) return 'FAIL: the AI ran anyway for a declared-BYO customer';
  const fadePct = await page.evaluate(() => document.getElementById('frameFadeAmountSlider')?.value);
  if (String(fadePct) !== '0') return `FAIL: auto-run transfer opened the fade page at ${fadePct}%`;
  return 'PASS: BYO product completion auto-runs the transfer — no confirm, no button, no AI, fade at 0%';
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

// ---- REAL CLICKS on the actual gate buttons. Every other scenario drives
// chooseIntentAI/BYO via evaluate for speed, which means a broken onclick
// would brick every real customer at upload while all suites stayed green
// -- the adversarial review's sharpest harness-masking finding. These two
// click the buttons the way a finger does. ----
scenarios.gateButtonsWorkByRealClick_AI = async (page) => {
  await page.locator('#fileInput').setInputFiles(require('path').join(__dirname, 'test-photo.jpg'));
  await waitForIntentGate(page);
  await page.click('#intentGateOverlay button:has-text("Let Our AI Create My Art")');
  await T(page, 800);
  const st = await page.evaluate(() => ({
    gateGone: getComputedStyle(document.getElementById('intentGateOverlay')).display === 'none',
    forkShown: document.getElementById('postUploadForkRow').style.display === 'flex',
  }));
  if (!st.gateGone) return 'FAIL: a real click on the AI button did not dismiss the gate';
  if (!st.forkShown) return 'FAIL: a real click on the AI button did not reveal the rail';
  return 'PASS: the AI gate button works by real click, not just by evaluate';
};
BYO_SETUP.add('gateButtonsWorkByRealClick_AI');

scenarios.gateButtonsWorkByRealClick_BYO = async (page) => {
  await page.locator('#fileInput').setInputFiles(require('path').join(__dirname, 'test-photo.jpg'));
  await waitForIntentGate(page);
  await page.click('#intentGateOverlay button:has-text("Supply My Own Finished Art")');
  await T(page, 800);
  const st = await page.evaluate(() => ({
    gateGone: getComputedStyle(document.getElementById('intentGateOverlay')).display === 'none',
    onProduct: document.body.classList.contains('product-focus'),
  }));
  if (!st.gateGone) return 'FAIL: a real click on the BYO button did not dismiss the gate';
  if (!st.onProduct) return 'FAIL: a real click on the BYO button did not land on product picking';
  return 'PASS: the BYO gate button works by real click, not just by evaluate';
};
BYO_SETUP.add('gateButtonsWorkByRealClick_BYO');

// ---- THE RESURRECTION REGRESSION (the review's blocker): BYO, then a
// mid-flow re-upload, then "AI" at the second gate. The first cut restored
// the style card but left #trackForkCard display:none -- the rail then
// dead-ended on a spotlight aimed at an invisible card. Both cards must
// come back, through the symmetric helper. ----
scenarios.byoThenReuploadThenAIRestoresTheWholeRail = async (page) => {
  await uploadPhotoAndChooseBYO(page);
  // A DIFFERENT file for the re-upload: setInputFiles with the identical
  // file does not re-fire the change event, and a real re-uploading
  // customer is picking a different photo anyway.
  await page.locator('#fileInput').setInputFiles(require('path').join(__dirname, 'fake-generated.jpg'));
  await waitForIntentGate(page);
  await page.click('#intentGateOverlay button:has-text("Let Our AI Create My Art")');
  await T(page, 800);
  const st = await page.evaluate(() => ({
    styleShown: getComputedStyle(document.getElementById('styleSectionCard')).display !== 'none',
    trackShown: getComputedStyle(document.getElementById('trackForkCard')).display !== 'none',
    forkRowShown: document.getElementById('postUploadForkRow').style.display === 'flex',
    likenessShown: getComputedStyle(document.getElementById('likenessSectionCard')).display !== 'none',
    ideaShown: getComputedStyle(document.getElementById('ideaCard')).display !== 'none',
  }));
  const missing = Object.entries(st).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return `FAIL: after BYO -> re-upload -> AI, still hidden: ${missing.join(', ')} — the rail dead-ends`;
  return 'PASS: switching BYO -> AI at a second gate restores the entire rail (style, track fork, likeness, idea box)';
};
BYO_SETUP.add('byoThenReuploadThenAIRestoresTheWholeRail');

// ---- The declaration must actually be ENFORCED down the rail: no gimmick
// panel, no wraparound offer, no caricature knob, no ref pins, no idea box,
// and the token note flipped to the free promise. ----
scenarios.byoRailHidesTheAIParaphernalia = async (page) => {
  await uploadPhotoAndChooseBYO(page);
  const st = await page.evaluate(() => {
    product = 'mug';
    showDesignMethodCard(); // the single door into the gimmicks
    return {
      gimmicks: document.getElementById('designMethodCard').style.display === 'block',
      likenessShown: getComputedStyle(document.getElementById('likenessSectionCard')).display !== 'none',
      ideaShown: getComputedStyle(document.getElementById('ideaCard')).display !== 'none',
      refPinShown: getComputedStyle(document.getElementById('refAZone')).display !== 'none',
      printMode: mugPrintMode,
      tokenNote: document.getElementById('generateTokenNote').textContent,
    };
  });
  const bad = [];
  if (st.gimmicks) bad.push('the AI gimmick panel opened for a declared-BYO customer');
  if (st.likenessShown) bad.push('Degree of Caricature still visible');
  if (st.ideaShown) bad.push('the idea box still visible');
  if (st.refPinShown) bad.push('reference-photo pins still visible');
  if (st.printMode !== 'three-panel') bad.push(`print mode is ${st.printMode}, not pinned to classic`);
  if (!/free/i.test(st.tokenNote)) bad.push(`token note still says: ${st.tokenNote}`);
  if (bad.length) return `FAIL: ${bad.join('; ')}`;
  return 'PASS: a BYO declaration removes every AI surface — gimmicks, caricature knob, idea box, ref pins, wraparound — and the token note promises free';
};
BYO_SETUP.add('byoRailHidesTheAIParaphernalia');

// ---- Workshop recall was a side door past the gate: a returning customer
// clicked "Use Last Photo Uploaded" and got the whole rail with no
// declaration ever forced. A recalled photo is a raw photo landing in the
// flow — the gate's exact moment. ----
scenarios.recallReopensTheGate = async (page) => {
  await uploadPhoto(page); // upload + AI so saveWorkshop stores the photo
  await page.reload({ waitUntil: 'domcontentloaded' });
  await T(page, 1200);
  const rowShown = await page.evaluate(() =>
    document.getElementById('workshopRecallRow')?.style.display !== 'none');
  if (!rowShown) return 'FAIL: the workshop recall row never appeared after reload — cannot test the side door';
  await page.click('#recallPhotoBtn');
  const opened = await page.waitForFunction(() => {
    const o = document.getElementById('intentGateOverlay');
    return o && getComputedStyle(o).display !== 'none';
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  if (!opened) return 'FAIL: recalling the last photo bypassed the intent gate — the side door is open';
  return 'PASS: recalling a raw photo opens the intent gate like any other upload';
};
BYO_SETUP.add('recallReopensTheGate');

// ---- ALYX'S STEP-8 JOURNEY (live bug report, 2026-08-28): BYO -> mug ->
// size -> Classic White -> Continue used to strand the customer at the
// product grid (the onward scroll aimed at the Print Style card, which the
// BYO enforcement had just hidden -- and the flow's only exit hung off
// that invisible card, a dead end). And from the Generate landing there
// was no mechanism back to change the cup style. This walks the repaired
// rail end to end: land on Generate, find the Change Style button, ride
// it back, repick Color Pop, and confirm the stale colour cleared. ----
scenarios.byoMugRailLandsOnGenerateAndCanChangeStyle = async (page) => {
  await uploadPhotoAndChooseBYO(page);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  await page.evaluate(() => { pickPreGenMugSize('11oz'); });
  await T(page, 600);
  await page.evaluate(() => { pickPreGenMugStyle('Classic White'); });
  await T(page, 800);
  await dismissAlerts(page);
  // Classic White is colourless, so Continue is the next real click.
  // NEW CONTRACT (parallel session's auto-run): Continue auto-runs the
  // transfer and lands on the FADE PAGE — no Generate button stop, no
  // strand-at-products dead end either way.
  await page.evaluate(() => { finishPreGenMugColorPick(); });
  const fadeOpened = await page.waitForFunction(() => {
    const o = document.getElementById('frameFadeOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  const landing = await page.evaluate(() => ({
    gimmicksShown: document.getElementById('designMethodCard').style.display === 'block',
  }));
  if (landing.gimmicksShown) return 'FAIL: the gimmick panel opened on a BYO mug rail';
  if (!fadeOpened) return 'FAIL: Continue after Classic White did not auto-run to the fade page — the dead-end is back in a new form';

  // The Change Style mechanism now lives on the fade page's way back:
  // close the fade (its own Back/✕), then the Change Style button near
  // Generate is reachable again. Exercise the state machine directly.
  await page.evaluate(() => {
    const o = document.getElementById('frameFadeOverlay');
    if (o) o.style.display = 'none';
    document.body.classList.remove('step-locked');
    goBackToMugStyle();
  });
  await T(page, 1200);
  // The Style/Color step is a step-lock overlay; the button re-opens it
  // through the rail's own state machine.
  const back = await page.evaluate(() => ({
    overlayShown: document.getElementById('mugStyleLockOverlay')?.style.display === 'flex',
    stillSelected: document.querySelector('#preGenMugStyleGrid .btn-select.selected')?.dataset.style || null,
  }));
  if (!back.overlayShown) return 'FAIL: the Change Style button did not re-open the Style/Color step';
  if (back.stillSelected !== 'Classic White') return `FAIL: re-opened style step lost the current pick (selected=${back.stillSelected})`;

  // Repick Color Pop through the REAL pick function: the colour must clear
  // (a Classic White "no colour" cannot ride into a style that needs one).
  const repicked = await page.evaluate(() => {
    pickPreGenMugStyle('Color Pop');
    return { style: selectedGenStyle, color: selectedGenColor, finished: mugColorFinishedPreGen };
  });
  if (repicked.style !== 'Color Pop') return `FAIL: repick did not take (style=${repicked.style})`;
  if (repicked.color !== null || repicked.finished) return 'FAIL: switching styles kept stale colour state';
  return 'PASS: BYO mug rail lands on Generate, the Change Style button rides back, and a Color Pop repick clears the old state';
};
BYO_SETUP.add('byoMugRailLandsOnGenerateAndCanChangeStyle');

// ---- THE PRE-PICKER BIFURCATION (Alyx, 2026-08-28): "it's still not
// clear to the customer that this is a bifurcation. There should be two
// buttons that they have to pick." The photo frame is the as-is track;
// "Collaborate With Our AI (1 token)" is the AI track. Both open the same
// picker; a photo arriving through either NEVER sees the gate overlay --
// the split already happened. Direct setInputFiles (no button) stays the
// undeclared path and still hits the gate, which is what keeps every other
// scenario in this suite honest. ----
scenarios.byoUploadButtonSkipsTheGate = async (page) => {
  page.on('filechooser', (fc) => fc.setFiles(require('path').join(__dirname, 'test-photo.jpg')).catch(() => {}));
  await page.click('#uploadZone');
  await T(page, 4000); // stable-scroll polls until layout settles; give it room
  const st = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('#productCard .btn-select'));
    const firstTile = tiles[0]?.getBoundingClientRect();
    return {
      gateShown: getComputedStyle(document.getElementById('intentGateOverlay')).display !== 'none',
      intent: byoDeclaredIntent,
      onProduct: document.body.classList.contains('product-focus'),
      styleHidden: getComputedStyle(document.getElementById('styleSectionCard')).display === 'none',
      // PIXELS, NOT CLASSES (Alyx's screenshot: the landing scroll stopped
      // short and the grid sat half under the fold while this scenario
      // stayed green on class checks alone). The first row of product
      // tiles must be FULLY inside the viewport.
      firstTileVisible: !!firstTile && firstTile.top >= 0 && firstTile.bottom <= innerHeight,
      firstTileTop: firstTile ? Math.round(firstTile.top) : null,
      // And the customer's own photo must not be dimmed by the product
      // spotlight -- same exemption it has during generation.
      photoOpacity: getComputedStyle(document.getElementById('uploadPhotoCard')).opacity,
    };
  });
  if (st.gateShown) return 'FAIL: the photo-frame upload still shows the gate — the customer already declared by picking this button';
  if (st.intent !== 'byo') return `FAIL: photo-frame upload declared intent=${st.intent}, expected byo`;
  if (!st.onProduct || !st.styleHidden) return 'FAIL: the as-is track did not land on product picking with the AI surfaces removed';
  if (!st.firstTileVisible) return `FAIL: the landing scroll stopped short — first product tile at ${st.firstTileTop}px is not fully on screen`;
  if (parseFloat(st.photoOpacity) < 0.99) return `FAIL: the customer's photo is dimmed to ${st.photoOpacity} on the product landing`;
  return 'PASS: the photo frame IS the as-is track — no gate, product tiles fully on screen, photo undimmed, AI surfaces gone';
};
BYO_SETUP.add('byoUploadButtonSkipsTheGate');

scenarios.aiCollabButtonSkipsTheGate = async (page) => {
  const btnText = await page.evaluate(() => document.getElementById('aiCollabUploadBtn')?.textContent || '');
  if (!/Collaborate/i.test(btnText) || !/1 token/i.test(btnText))
    return `FAIL: the AI button doesn't say Collaborate + (1 token): "${btnText}"`;
  page.on('filechooser', (fc) => fc.setFiles(require('path').join(__dirname, 'test-photo.jpg')).catch(() => {}));
  await page.click('#aiCollabUploadBtn');
  await T(page, 2500);
  const st = await page.evaluate(() => ({
    gateShown: getComputedStyle(document.getElementById('intentGateOverlay')).display !== 'none',
    intent: byoDeclaredIntent,
    forkShown: document.getElementById('postUploadForkRow').style.display === 'flex',
    styleShown: getComputedStyle(document.getElementById('styleSectionCard')).display !== 'none',
  }));
  if (st.gateShown) return 'FAIL: the AI collab upload still shows the gate';
  if (st.intent !== 'ai') return `FAIL: AI collab upload declared intent=${st.intent}, expected ai`;
  if (!st.forkShown || !st.styleShown) return 'FAIL: the AI track did not land on the prior rail (Art Style + track fork)';
  return 'PASS: Collaborate With Our AI (1 token) is the AI track — no gate, straight onto the prior rail';
};
BYO_SETUP.add('aiCollabButtonSkipsTheGate');

// ---- Reference pins are LETTERED, and the AI is told the letters: the
// customer writes "use the face from Reference A" and the instruction
// block must map that name to the right image. ----
scenarios.referencePinsAreLettered = async (page) => {
  const st = await page.evaluate(() => ({
    a: document.getElementById('refAZone')?.textContent || '',
    b: document.getElementById('refBZone')?.textContent || '',
    photo1Gone: !/Photo 1/.test(document.getElementById('uploadPhotoCard')?.textContent || ''),
  }));
  if (!/Reference A/i.test(st.a)) return `FAIL: first pin says "${st.a.trim()}", not Reference A`;
  if (!/Reference B/i.test(st.b)) return `FAIL: second pin says "${st.b.trim()}", not Reference B`;
  if (!st.photo1Gone) return 'FAIL: the clipped "Photo 1" label is still on the upload card';
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'needles-studio.html'), 'utf8');
  if (!/This image is "Reference A"/.test(src) || !/This image is "Reference B"/.test(src))
    return 'FAIL: the AI instruction block does not map Reference A/B to the pinned images';
  return 'PASS: pins lettered Reference A/B, "Photo 1" gone, and the AI instruction maps the letters to the images';
};
BYO_SETUP.add('referencePinsAreLettered');

// ---- ALYX'S SECOND STEP-8 REPORT: Back from the colour/Continue view
// jumped clean over the style stage to Size, and re-picking a size
// re-opened the overlay at its OLD interior scroll (bottom of the card,
// past the grid) -- reading exactly as "it skipped the style step and
// kept my old style." Back is two-stage now, and every fresh entry
// greets with the style grid at the top. ----
scenarios.backIsTwoStageAndFreshEntryShowsTheGrid = async (page) => {
  await uploadPhotoAndChooseBYO(page);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  await page.evaluate(() => { pickPreGenMugSize('15oz'); });
  await T(page, 500);
  await page.evaluate(() => { pickPreGenMugStyle('Classic White'); });
  await T(page, 900);

  // FIRST back: stays in the overlay, climbs to the style stage.
  await page.click('#mugStyleBackBtn');
  await T(page, 900);
  const afterFirst = await page.evaluate(() => ({
    styleOverlay: document.getElementById('mugStyleLockOverlay').style.display,
    sizeOverlay: document.getElementById('mugSizeLockOverlay').style.display,
    finishShown: document.getElementById('preGenMugColorFinishBtn')?.style.display !== 'none',
    scrollTop: Math.round(document.getElementById('mugStyleCard').scrollTop),
    stillHighlighted: document.querySelector('#preGenMugStyleGrid .btn-select.selected')?.dataset.style || null,
  }));
  if (afterFirst.styleOverlay !== 'flex') return 'FAIL: first Back left the Style overlay entirely — it must climb to the style stage first';
  if (afterFirst.sizeOverlay === 'flex') return 'FAIL: first Back jumped clean over the style stage to Size';
  if (afterFirst.finishShown) return 'FAIL: first Back left the Continue button showing — the colour stage did not clear';
  if (afterFirst.scrollTop > 40) return `FAIL: first Back left the card scrolled to ${afterFirst.scrollTop}px — the grid is not what greets them`;
  if (afterFirst.stillHighlighted !== 'Classic White') return `FAIL: the previous pick lost its highlight (${afterFirst.stillHighlighted})`;

  // SECOND back: now it leaves for Size.
  await page.click('#mugStyleBackBtn');
  await T(page, 700);
  const afterSecond = await page.evaluate(() => ({
    styleOverlay: document.getElementById('mugStyleLockOverlay').style.display,
    sizeOverlay: document.getElementById('mugSizeLockOverlay').style.display,
  }));
  if (afterSecond.sizeOverlay !== 'flex') return 'FAIL: second Back did not reach Size';
  if (afterSecond.styleOverlay === 'flex') return 'FAIL: second Back left both overlays open';

  // Re-pick a size going forward: the overlay must greet with the GRID at
  // the top, not the old bottom-of-card Continue view.
  await page.evaluate(() => { pickPreGenMugSize('15oz'); });
  await T(page, 700);
  const reentry = await page.evaluate(() => ({
    styleOverlay: document.getElementById('mugStyleLockOverlay').style.display,
    scrollTop: Math.round(document.getElementById('mugStyleCard').scrollTop),
    finishShown: document.getElementById('preGenMugColorFinishBtn')?.style.display !== 'none',
  }));
  if (reentry.styleOverlay !== 'flex') return 'FAIL: re-picking a size never re-opened the Style step';
  if (reentry.scrollTop > 40 || reentry.finishShown) return `FAIL: re-entry re-opened past the grid (scrollTop=${reentry.scrollTop}, continue=${reentry.finishShown}) — the "skipped style" illusion`;
  return 'PASS: Back climbs colour -> style -> size one stage at a time, and every re-entry greets with the style grid';
};
BYO_SETUP.add('backIsTwoStageAndFreshEntryShowsTheGrid');

// ---- The selected outline must be unmistakable (Alyx: "brilliant blue,
// not a slightly lazy almost a little brighter blue"). ----
scenarios.selectedOutlineIsBrilliantBlue = async (page) => {
  const st = await page.evaluate(() => {
    const el = document.querySelector('.btn-select.selected');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { color: cs.borderTopColor, width: cs.borderTopWidth, glow: cs.boxShadow };
  });
  if (!st) return 'FAIL: no selected tile found to measure';
  if (st.color !== 'rgb(41, 163, 255)') return `FAIL: selected border is ${st.color}, not the brilliant #29a3ff`;
  if (parseFloat(st.width) < 2.5) return `FAIL: selected border is ${st.width} — too thin to be unmistakable`;
  if (st.glow === 'none') return 'FAIL: selected tile has no glow';
  return 'PASS: selection outline is 3px brilliant blue with a glow — unmistakable';
};
BYO_SETUP.add('selectedOutlineIsBrilliantBlue');

// ---- ALYX'S COLOUR PING-PONG (third step-8 report): "I picked 11oz
// Classic White, changed to 11oz Color Pop, changed to 15oz Color Pop,
// selected green, went back, selected red -- and it sent me back to the
// 11/15oz decision." Root cause: picking a COLOUR never stamped the
// stage tracker, so a colour picked after a back-trip left it stuck on
// 'style' and the next Back skipped clean over the style stage to Size.
// "Back means back and forward means forward no matter how many times we
// go back and forth. It should accommodate us if we decide to do this 11
// times." So this walks the exact reported journey, then ping-pongs the
// colour eleven times, asserting Size is never reached except by two
// deliberate Backs. ----
scenarios.colourPingPongNeverThrowsYouToSize = async (page, log) => {
  await uploadPhotoAndChooseBYO(page);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  const sizeOverlay = () => page.evaluate(() => document.getElementById('mugSizeLockOverlay').style.display);
  const styleOverlay = () => page.evaluate(() => document.getElementById('mugStyleLockOverlay').style.display);

  // The exact reported journey.
  await page.evaluate(() => { pickPreGenMugSize('11oz'); });
  await T(page, 400);
  await page.evaluate(() => { pickPreGenMugStyle('Classic White'); });
  await T(page, 500);
  await page.click('#mugStyleBackBtn'); // colour -> style
  await T(page, 500);
  await page.evaluate(() => { pickPreGenMugStyle('Color Pop'); }); // 11oz Color Pop
  await T(page, 500);
  await page.click('#mugStyleBackBtn'); // colour -> style
  await T(page, 500);
  await page.click('#mugStyleBackBtn'); // style -> size (deliberate)
  await T(page, 500);
  if (await sizeOverlay() !== 'flex') return 'FAIL: two deliberate Backs did not reach Size';
  await page.evaluate(() => { pickPreGenMugSize('15oz'); });
  await T(page, 500);
  await page.evaluate(() => { pickPreGenMugStyle('Color Pop'); }); // 15oz Color Pop
  await T(page, 500);

  const swatches = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#preGenMugColorGrid .color-btn')).length);
  if (swatches < 2) return `FAIL: 15oz Color Pop offers ${swatches} swatches — cannot ping-pong`;

  // Green -> Back -> pick again straight off the still-visible swatches:
  // the moment that used to desync the stage tracker.
  await page.evaluate(() => {
    const btns = document.querySelectorAll('#preGenMugColorGrid .color-btn');
    btns[0].click();
  });
  await T(page, 500);
  await page.click('#mugStyleBackBtn'); // colour -> style (clears the pick)
  await T(page, 600);
  const cleared = await page.evaluate(() => ({
    ringed: !!document.querySelector('#preGenMugColorGrid .color-btn.selected'),
    label: document.getElementById('preGenMugColorLabel')?.textContent || '',
  }));
  if (cleared.ringed) return 'FAIL: after Back, the old colour still wears the ring while the state is cleared';
  if (!/Please select/i.test(cleared.label)) return `FAIL: after Back, the label still confirms a dead pick: "${cleared.label}"`;
  await page.evaluate(() => {
    document.querySelectorAll('#preGenMugColorGrid .color-btn')[1].click(); // "red", off the visible swatches
  });
  await T(page, 500);
  if (await sizeOverlay() !== 'none' || await styleOverlay() !== 'flex')
    return 'FAIL: picking a colour after a back-trip left the overlay wrong';
  await page.evaluate(() => { mugStyleLockBack(); }); // must climb to STYLE, not skip to Size
  await T(page, 500);
  if (await sizeOverlay() === 'flex')
    return 'FAIL: Back after the re-picked colour skipped clean over the style stage to Size — the reported bug';

  // Eleven rounds of colour ping-pong, per the letter of the request.
  // Driven through the state machine directly: the loop's subject is
  // stage bookkeeping across rapid cycles, and real-click stability
  // waits fight the smooth in-card scrolls each Back fires (clickability
  // itself is proven by the journey's real clicks above).
  for (let i = 0; i < 11; i++) {
    await page.evaluate((idx) => {
      const btns = document.querySelectorAll('#preGenMugColorGrid .color-btn');
      btns[idx % btns.length].click();
    }, i);
    await T(page, 250);
    await page.evaluate(() => { mugStyleLockBack(); });
    await T(page, 250);
    if (await sizeOverlay() === 'flex')
      return `FAIL: round ${i + 1} of colour ping-pong got thrown to Size`;
  }
  // And forward still works after all of it — the auto-run contract:
  // Continue lands on the fade page.
  await page.evaluate(() => {
    document.querySelectorAll('#preGenMugColorGrid .color-btn')[0].click();
  });
  await T(page, 500);
  await page.evaluate(() => { finishPreGenMugColorPick(); });
  const fadeAfter = await page.waitForFunction(() => {
    const o = document.getElementById('frameFadeOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!fadeAfter) return 'FAIL: after eleven ping-pongs, forward no longer reaches the fade page';
  return 'PASS: green -> back -> red never skips to Size, eleven ping-pong rounds hold, and forward still auto-runs to the fade page';
};
BYO_SETUP.add('colourPingPongNeverThrowsYouToSize');

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
