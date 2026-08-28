// GOING BACK HAS TO WORK, AND SO DOES GOING FORWARD AGAIN.
//
// Alyx: "all changes should be fully functional whenever we switch the back
// button we shouldn't switch the back button and have things freeze up on us.
// You should check all back buttons and make sure that going back allows you
// to actually go back and then go forward from there."
//
// The bug behind that: every rail spotlight carried pointer-events:none
// alongside its dimming, so reaching Print Style on a mug froze the PRODUCT
// card too. A customer who changed their mind could see the grid, click a
// different product, and have literally nothing happen -- reproduced with
// product staying "mug" and the coaster shape card never opening.
//
// This project already had the rule ("a dim is a guide, not a cage"); the
// spotlight CSS just never followed it. So the first scenario polices the CSS
// itself, and the rest walk the actual journeys: forward, back, forward again.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

async function toProduct(page) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
}

// Clicks a product tile and WAITS FOR THE CHANGE TO LAND, rather than sleeping
// a fixed time and hoping. Several product rails auto-scroll the page a beat
// after selection, which can slide the next tile out from under a click and
// produce a "product never changed" failure that is the test's fault, not the
// app's. Waiting on the real state variable removes that noise without hiding
// a genuine lock: if the click truly does nothing, this still times out and
// the caller still fails.
async function pickProduct(page, val, { expectChange = true } = {}) {
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  if (expectChange) {
    try {
      await page.waitForFunction((v) => product === v, val, { timeout: 6000 });
    } catch (e) {
      return false;
    }
  }
  await T(page, 900);
  await dismissAlerts(page);
  return true;
}

// Is this element genuinely operable -- has a box, and answers a click at its
// own centre? Checking display alone has produced false passes in this repo
// three separate times.
const operable = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return { missing: true };
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  if (!r.height || cs.display === 'none' || cs.visibility === 'hidden') {
    return { visible: false, pointerEvents: cs.pointerEvents };
  }
  const mid = document.elementFromPoint(
    Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1),
    Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
  return {
    visible: true,
    pointerEvents: cs.pointerEvents,
    topmost: !!mid && (el === mid || el.contains(mid) || mid.contains(el)),
    coveredBy: mid ? (mid.id ? '#' + mid.id : String(mid.className).split(' ')[0]) : null,
  };
}, sel);

const scenarios = {};

// ---- 1. No spotlight may lock the page. ----
scenarios.noSpotlightCagesTheCustomer = async (page) => {
  const caged = await page.evaluate(() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of rules || []) {
        if (!rule.selectorText || !/^body\.[a-z0-9-]*focus\b/.test(rule.selectorText)) continue;
        if (rule.style.pointerEvents !== 'none') continue;
        // opacity:0 is a different thing entirely: the card is INVISIBLE, not
        // dimmed, and an invisible clickable card is a trap the other way.
        if (parseFloat(rule.style.opacity) === 0) continue;
        out.push(rule.selectorText);
      }
    }
    return out;
  });
  if (caged.length)
    return `FAIL: ${caged.length} spotlight(s) lock every other card with pointer-events:none — a customer cannot go back from here: ${caged.join(', ')}`;
  return 'PASS: every dimming spotlight leaves the rest of the page clickable';
};

// ---- 2. The journey Alyx actually took. ----
// Deep into the mug flow, change your mind, pick a different product.
scenarios.canSwitchProductFromDeepInTheMugFlow = async (page) => {
  await toProduct(page);
  await pickProduct(page, 'mug');
  await page.evaluate(() => pickPreGenMugSize('11oz'));
  await T(page, 800);
  await page.locator('#preGenMugStyleGrid .btn-select[data-style="Trimmed"]').click();
  await T(page, 1000);
  await page.locator('#preGenMugColorGrid .color-btn').first().click();
  await T(page, 1200);
  await page.evaluate(() => finishPreGenMugColorPick());
  await T(page, 1200);
  await dismissAlerts(page);

  const tile = await operable(page, '#productCard .btn-select[data-val="coaster"]');
  if (tile.missing) return 'FAIL: no coaster tile';
  if (!tile.visible) return 'FAIL: the product grid is not even visible from inside the mug flow';
  if (tile.pointerEvents === 'none')
    return 'FAIL: the product grid is pointer-events:none — the customer can see it, click it, and nothing happens';

  await pickProduct(page, 'coaster');
  const after = await page.evaluate(() => ({
    product,
    shapeCard: getComputedStyle(document.getElementById('coasterShapeCard')).display,
    printMode: getComputedStyle(document.getElementById('mugPrintModeCard')).display,
  }));
  if (after.product !== 'coaster')
    return `FAIL: clicked Coasters but product is still "${after.product}" — the change never took`;
  if (after.shapeCard === 'none')
    return 'FAIL: product changed but the coaster shape card never opened — dead end';
  if (after.printMode !== 'none')
    return 'FAIL: the mug Print Style card is still showing after switching to coasters';
  return 'PASS: switched product from deep inside the mug flow, and the coaster rail took over';
};

// ---- 3. Every mug back button: back, then forward again. ----
scenarios.mugBackButtonsGoBackAndForward = async (page) => {
  await toProduct(page);
  await pickProduct(page, 'mug');

  // Size card -> Back -> lands on Product, and Product is usable.
  await page.evaluate(() => mugSizeLockBack());
  await T(page, 900);
  let s = await page.evaluate(() => ({
    product, sizeOv: getComputedStyle(document.getElementById('mugSizeLockOverlay')).display,
  }));
  if (s.sizeOv !== 'none') return 'FAIL: Size card still up after its own Back';
  const mugTile = await operable(page, '#productCard .btn-select[data-val="mug"]');
  if (!mugTile.visible || mugTile.pointerEvents === 'none')
    return `FAIL: after backing out of Size, the product grid is not usable (${JSON.stringify(mugTile)})`;

  // Forward again.
  await pickProduct(page, 'mug');
  await page.evaluate(() => pickPreGenMugSize('11oz'));
  await T(page, 900);
  s = await page.evaluate(() => getComputedStyle(document.getElementById('mugStyleLockOverlay')).display);
  if (s === 'none') return 'FAIL: could not get forward to Style after going back to Product';

  // Style card -> Back -> lands on Size, and the OTHER size still works.
  await page.evaluate(() => mugStyleLockBack());
  await T(page, 900);
  s = await page.evaluate(() => ({
    sizeOv: getComputedStyle(document.getElementById('mugSizeLockOverlay')).display,
    styleOv: getComputedStyle(document.getElementById('mugStyleLockOverlay')).display,
  }));
  if (s.sizeOv === 'none' || s.styleOv !== 'none')
    return `FAIL: Style's Back did not return to Size (${JSON.stringify(s)})`;
  const otherSize = await operable(page, '#preGenSize15Btn');
  if (!otherSize.visible || !otherSize.topmost)
    return `FAIL: back at Size, the 15oz button is not clickable (${JSON.stringify(otherSize)})`;

  await page.evaluate(() => pickPreGenMugSize('15oz'));
  await T(page, 900);
  const fwd = await page.evaluate(() => ({
    size: selectedGenSize,
    styleOv: getComputedStyle(document.getElementById('mugStyleLockOverlay')).display,
  }));
  if (fwd.size !== '15oz' || fwd.styleOv === 'none')
    return `FAIL: could not go forward with the other size after Back (${JSON.stringify(fwd)})`;
  return 'PASS: mug Size and Style backs both return, and both go forward again with a changed choice';
};

// ---- 4. Product switching works from every product's own rail. ----
// Not just the mug. Each of these lights its own spotlight, and each one used
// to lock the product grid behind it.
const FROM = ['coaster', 'tote bag', 'mouse pad', 'water bottle'];
for (const from of FROM) {
  scenarios['canLeave_' + from.replace(/\W/g, '_')] = async (page) => {
    await toProduct(page);
    await pickProduct(page, from);
    const tile = await operable(page, '#productCard .btn-select[data-val="puzzle"]');
    if (tile.missing) return 'FAIL: no puzzle tile';
    if (tile.pointerEvents === 'none')
      return `FAIL: from ${from}, the product grid is locked (pointer-events:none) — no way back out`;
    if (!tile.visible) return `FAIL: from ${from}, the product grid is not visible`;
    const took = await pickProduct(page, 'puzzle');
    const p = await page.evaluate(() => product);
    if (!took || p !== 'puzzle')
      return `FAIL: from ${from}, clicking Puzzle left product as "${p}" — no way back out of that rail`;
    return `PASS: can leave ${from} for another product`;
  };
}

// ---- 5. Two steps back must not leave an invalid choice behind. ----
// Alyx: "try going down in the flow process and then try to go back twice,
// two steps to try to repick something and see what happens."
//
// What happened: the colour survived. Size decides which colours exist --
// Color Pop offers Golden Yellow at 11oz and not at 15oz -- so a colour
// chosen before a size change can be one this size does not sell. Picking
// Golden Yellow at 11oz, going back twice and re-entering at 15oz left
// selectedGenColor as "Golden Yellow" against a list that no longer had it.
scenarios.twoStepsBackLeavesNoInvalidChoice = async (page) => {
  await toProduct(page);
  await pickProduct(page, 'mug');
  await page.evaluate(() => pickPreGenMugSize('11oz'));
  await T(page, 800);
  await page.locator('#preGenMugStyleGrid .btn-select[data-style="Color Pop"]').click();
  await T(page, 1000);

  // The 11oz-ONLY colour, found by name rather than position so a reordered
  // table cannot make this silently test the wrong swatch.
  const only11 = await page.evaluate(() => {
    const at = (sz) => (GEN_MUG_STYLES['Color Pop'].colors[sz] || []).map(c => c.name);
    const a = at('11oz'), b = at('15oz');
    const name = a.find(n => !b.includes(n));
    return { name, index: a.indexOf(name) };
  });
  if (!only11.name)
    return 'PASS (n/a): no colour is exclusive to one size any more, so this trap cannot happen';

  await page.locator('#preGenMugColorGrid .color-btn').nth(only11.index).click();
  await T(page, 1200);
  const picked = await page.evaluate(() => selectedGenColor);
  if (picked !== only11.name)
    return `FAIL: setup — meant to pick ${only11.name}, got ${picked}`;

  await page.evaluate(() => mugStyleLockBack());   // back 1
  await T(page, 800);
  await page.evaluate(() => mugSizeLockBack());    // back 2
  await T(page, 900);
  await pickProduct(page, 'mug');
  await page.evaluate(() => pickPreGenMugSize('15oz'));
  await T(page, 1000);

  const st = await page.evaluate(() => {
    const offered = (GEN_MUG_STYLES[selectedGenStyle]?.colors?.[selectedGenSize] || []).map(c => c.name);
    return {
      size: selectedGenSize, colour: selectedGenColor, offered,
      valid: selectedGenColor == null || offered.includes(selectedGenColor),
      chosen: mugColorChosenPreGen, finished: mugColorFinishedPreGen,
    };
  });
  if (!st.valid)
    return `FAIL: after two steps back, selectedGenColor is "${st.colour}" but ${st.size} only offers ${st.offered.join(', ')}`;
  if (st.chosen || st.finished)
    return `FAIL: after two steps back the rail still thinks a colour was chosen (chosen=${st.chosen} finished=${st.finished})`;

  // And forward again from here must still work.
  await page.locator('#preGenMugStyleGrid .btn-select[data-style="Trimmed"]').click();
  await T(page, 1100);
  const swatch = await operable(page, '#preGenMugColorGrid .color-btn');
  if (!swatch.visible || !swatch.topmost)
    return `FAIL: after two steps back, the colour swatches are not clickable (${JSON.stringify(swatch)})`;
  return `PASS: two steps back clears the ${only11.name} choice that 15oz cannot honour, and the rail goes forward again`;
};


// ---- 6. Tier b: switching away from PAID work asks once, names the cost. ----
// Alyx's off-rail ladder: a free deviation is accommodated silently (tier a,
// scenarios 2-5 above); a deviation that sets aside generated artwork gets
// exactly one question. Both branches tested: decline keeps everything
// exactly as it was; accept switches cleanly. And the free case must stay
// silent -- a dialog on an un-paid switch would be the cage coming back in
// polite clothing.
scenarios.costlySwitchAsksOnce = async (page) => {
  await toProduct(page);
  // Coaster, not mug, as the base on purpose: the mug flow keeps a step-lock
  // OVERLAY up until Size/Style/Colour are finished, and a force-click at a
  // product tile's coordinates lands on that overlay, not the tile -- pick()
  // never runs and the scenario tests nothing. (Cost of learning that: one
  // false FAIL.) Coaster, mouse pad and puzzle are overlay-free rails.
  await pickProduct(page, 'coaster');

  // The confirm is intercepted INSIDE the page rather than through
  // Playwright's dialog event -- the native-dialog plumbing proved flaky in
  // this sequence (the guard fired, the event never reached the listener),
  // and what this scenario exists to pin is the GUARD's logic: when it asks,
  // what it says, and that both answers are honored.
  await page.evaluate(() => {
    window.__confirmCalls = [];
    window.__confirmAnswer = true;
    window.confirm = (msg) => { window.__confirmCalls.push(msg); return window.__confirmAnswer; };
  });

  // No generated work yet: switching must be SILENT.
  await pickProduct(page, 'mouse pad');
  let calls = await page.evaluate(() => window.__confirmCalls.length);
  if (calls > 0)
    return 'FAIL: switching products with no generated art raised a confirm — free deviations must stay frictionless';

  // Simulate paid work the way generation leaves it, then decline the switch.
  await page.evaluate(() => { currentDesignId = 'fake-paid-design'; window.__confirmAnswer = false; });
  await pickProduct(page, 'puzzle', { expectChange: false });
  let st = await page.evaluate(() => ({ product, asked: window.__confirmCalls }));
  if (st.asked.length === 0)
    return 'FAIL: switching away from generated artwork asked nothing — paid work can be set aside by a stray tap';
  if (!/set(s)? .*aside|Recent Designs/i.test(st.asked[0]))
    return `FAIL: the confirm does not name the cost ("${st.asked[0]}")`;
  if (st.product !== 'mouse pad')
    return `FAIL: declining the confirm still switched the product (product=${st.product})`;

  // Accepting must switch cleanly, and ask exactly once per attempt.
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await pickProduct(page, 'puzzle');
  st = await page.evaluate(() => ({ product, n: window.__confirmCalls.length }));
  if (st.product !== 'puzzle')
    return `FAIL: accepting the confirm did not switch (product=${st.product})`;
  if (st.n !== 2)
    return `FAIL: expected exactly 2 asks across 2 paid attempts, saw ${st.n}`;
  return 'PASS: free switches stay silent; a paid switch asks once, names the cost, and honors both answers';
};


(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch({ viewport: { width: 430, height: 760 } });
    try {
      await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
      const result = await fn(page, log);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL BACK-NAVIGATION VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
