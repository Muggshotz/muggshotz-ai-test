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


// ---- 6. Travel mug: Back from the palette is a door, not a teleporter. ----
//
// Alyx, Sep 2026, on the 40oz: "I clicked the back button. And got this as you
// can see it didn't take me back to where I was before it jumped me right back
// to the beginning ... it never allowed me to go back and change my color."
//
// Two bugs. travelVariantBack() reset the whole product decision even from
// the colour step (one tap from the palette landed on the product grid with
// nothing kept). And the "change colour" button next to Generate was gated to
// product==='mug', so a travel-mug customer who had generated had no route
// back to the palette at all. This walks both: back, forward again, and the
// post-generate control.
scenarios.travelMugPaletteBackIsADoor = async (page) => {
  await toProduct(page);
  await pickProduct(page, 'water bottle');

  // Any cup that actually carries a palette.
  const key = await page.evaluate(() => (Object.entries(TRAVEL_MUG_CATALOG).find(([, v]) => v.colors) || [])[0]);
  if (!key) return 'FAIL: no travel variant in the catalog carries a colour palette';
  await page.evaluate((k) => pickPreGenTravelVariant(k), key);
  await T(page, 1200);
  await dismissAlerts(page);
  let s = await page.evaluate(() => ({
    palette: getComputedStyle(document.getElementById('travelMugColorCard')).display,
    changeCup: !!document.getElementById('travelChangeCupBtn'),
  }));
  if (s.palette === 'none') return `FAIL: picked ${key} but the colour palette never showed`;

  // TWO CONTROLS, TWO JOBS. "Change cup" is SIDEWAYS -- it un-chooses the cup
  // and brings the six back without leaving the panel.
  if (!s.changeCup) return 'FAIL: no Change cup control once a cup is chosen';
  await page.click('#travelChangeCupBtn');
  await T(page, 900);
  s = await page.evaluate(() => ({
    product, variant: preGenTravelVariant,
    variantCard: getComputedStyle(document.getElementById('travelMugVariantCard')).display,
    tiles: document.querySelectorAll('#travelMugVariantGrid .theme-btn').length,
  }));
  if (s.variant !== null) return `FAIL: Change cup did not un-choose the cup (still ${s.variant})`;
  if (s.variantCard === 'none') return 'FAIL: Change cup left the panel';
  if (s.tiles < 2) return `FAIL: Change cup should bring the six back, saw ${s.tiles} tile(s)`;

  // ... and Back is UP A LEVEL: the product grid, undimmed and usable.
  // An earlier pass today made Back a second copy of Change cup, which broke
  // the complaint this handler exists for ("once you get here you're
  // trapped") -- verify-travel's theCupPickerIsNotATrap caught it. Back and
  // Change cup are checked together here so they can never collapse into
  // each other again without one of these two assertions going red.
  await page.evaluate((k) => pickPreGenTravelVariant(k), key);
  await T(page, 1000);
  await page.evaluate(() => travelVariantBack());
  await T(page, 1200);
  s = await page.evaluate(() => {
    const pc = document.getElementById('productCard');
    return {
      product, variant: preGenTravelVariant,
      variantCard: getComputedStyle(document.getElementById('travelMugVariantCard')).display,
      productCard: getComputedStyle(pc).display,
      productOpacity: +parseFloat(getComputedStyle(pc).opacity).toFixed(2),
      spotlit: Array.from(document.body.classList).filter((c) => /-focus$/.test(c)),
      picked: !!document.querySelector('#productCard .btn-select.selected'),
    };
  });
  if (s.variantCard !== 'none') return 'FAIL: Back left the cup picker on screen — the trap is back';
  if (s.productCard === 'none') return 'FAIL: Back hid the cup picker without putting the product grid back';
  if (s.productOpacity < 0.9)
    return `FAIL: Back landed on the product grid dimmed to ${s.productOpacity} behind ${s.spotlit.join(', ') || 'nothing'} — indistinguishable from the button not working`;
  if (s.picked) return 'FAIL: Back left a product still selected, so the choice cannot be remade';

  // Forward again, and the palette returns.
  await pickProduct(page, 'water bottle');
  await page.evaluate((k) => pickPreGenTravelVariant(k), key);
  await T(page, 1200);
  const pal = await page.evaluate(() => getComputedStyle(document.getElementById('travelMugColorCard')).display);
  if (pal === 'none') return 'FAIL: could not get forward to the palette again after Back';

  // The change-colour control beside Generate must exist for travel mugs ...
  const btn = await page.evaluate(() => {
    refreshChangeMugStyleBtn();
    const b = document.getElementById('changeMugStyleBtn');
    return { display: getComputedStyle(b).display, label: b.textContent.trim() };
  });
  if (btn.display === 'none')
    return 'FAIL: the change-colour button is hidden for travel mugs — no way back to the palette after generating';
  if (!/Cup/.test(btn.label)) return `FAIL: change-colour button is labelled for mugs, not cups ("${btn.label}")`;

  // ... and it must route to the travel palette, not the mug overlay.
  await page.evaluate(() => goBackToMugStyle());
  await T(page, 900);
  const routed = await page.evaluate(() => ({
    focus: document.body.classList.contains('travel-color-focus'),
    mugOverlay: getComputedStyle(document.getElementById('mugStyleLockOverlay')).display,
  }));
  if (!routed.focus) return 'FAIL: change-colour for a travel mug did not spotlight the palette';
  if (routed.mugOverlay !== 'none') return 'FAIL: change-colour for a travel mug opened the MUG style overlay';
  return 'PASS: Change cup goes sideways, Back goes up a level to an undimmed product grid, and colour is reachable again from Generate';
};


// ---- THE BACK HE WAS ACTUALLY PRESSING ----
//
// Alyx, Sep 2026, chronologged across five screenshots: file, product, cup,
// "I chose red. But then I decided that I wanted black. And so I hit the back
// button. And it was supposed to take me back to the color panel... But it
// takes me instead all the way back to the beginning. But then if I click on
// yes use this image It jumps me all the way back past the color panel again."
//
// Three earlier fixes aimed at three other Back buttons (travelVariantBack,
// trimmingsBack, the change-colour control beside Generate) and all three
// passed their tests while he kept hitting the same wall, because the button
// under his thumb was approveBackBtn -- the Back directly beneath the finished
// picture, which is exactly where a customer stands when they decide the
// colour was wrong. It scrolled to the idea box and Yes ran past the palette:
// a closed loop with the one panel he wanted sitting between the two exits.
//
// So this scenario presses the REAL button, by click, from the real generated
// state -- no calling the handler by name, which is how the earlier tests
// managed to be green about the wrong thing.
scenarios.travelResultBackReachesTheColourPanel = async (page) => {
  await toProduct(page);
  if (!await pickProduct(page, 'water bottle')) return 'FAIL: could not choose a travel cup';

  const key = await page.evaluate(() => (Object.entries(TRAVEL_MUG_CATALOG).find(([, v]) => v.colors) || [])[0]);
  if (!key) return 'FAIL: no travel variant in the catalog carries a colour palette';
  await page.evaluate((k) => pickPreGenTravelVariant(k), key);
  await T(page, 1000);
  await dismissAlerts(page);

  // Pick a colour, the way he did -- then we will come back to change it.
  const firstColour = await page.evaluate(() => {
    const b = document.querySelector('#travelMugColorGridGen .color-btn');
    if (!b) return null;
    b.click();
    return preGenTravelColor || selectedTravelColor || 'picked';
  });
  if (!firstColour) return 'FAIL: the travel palette rendered no swatches to pick';
  await T(page, 700);
  await dismissAlerts(page);

  // Forward to Generate along the rail's own path, then generate.
  await page.evaluate(() => { window.confirm = () => false; });
  await page.evaluate(() => handOffToIdeaAfterProductChoice());
  await T(page, 800);
  await page.fill('#ideaDesc', 'surfing a giant wave at sunset');
  await T(page, 400);
  await dismissAlerts(page);
  await page.evaluate(() => confirmIdeaSatisfied());
  await T(page, 1200);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none',
    null, { timeout: 90000 });
  await T(page, 800);
  await dismissAlerts(page);

  // THE PRESS. Real click on the real button, exactly as he did it.
  const back = await operable(page, '#approveBackBtn');
  if (!back.visible) return 'FAIL: the result screen has no operable Back button';
  await page.click('#approveBackBtn');
  await T(page, 1200);

  const after = await page.evaluate(() => {
    const card = document.getElementById('travelMugVariantCard');
    const r = card ? card.getBoundingClientRect() : null;
    return {
      product, variant: preGenTravelVariant,
      cardDisplay: card ? getComputedStyle(card).display : 'missing',
      // Is the panel actually ON SCREEN, not merely display:block somewhere
      // below the fold? "Visible in the DOM" is what made the last three
      // fixes look done.
      onScreen: !!r && r.bottom > 0 && r.top < innerHeight,
      spotlight: document.body.classList.contains('travel-color-focus'),
      swatches: document.querySelectorAll('#travelMugColorGridGen .color-btn').length,
      changeCup: !!document.getElementById('travelChangeCupBtn'),
    };
  });

  if (after.product !== 'water bottle')
    return `FAIL: Back from the result threw away the product (product=${after.product})`;
  if (after.variant !== key)
    return `FAIL: Back from the result threw away the chosen cup (variant=${after.variant})`;
  if (after.cardDisplay === 'none' || after.cardDisplay === 'missing')
    return 'FAIL: Back from the result did not bring the cup/colour panel back';
  if (!after.onScreen)
    return 'FAIL: Back from the result left the colour panel off screen — the teleport to the idea box';
  if (!after.spotlight)
    return 'FAIL: Back from the result did not spotlight the colour panel';
  if (after.swatches < 2)
    return `FAIL: landed on the colour panel but only ${after.swatches} swatch(es) to change to`;
  if (!after.changeCup)
    return 'FAIL: landed on the colour panel with no Change cup control — cup type still unreachable';

  // And the swatch must actually take a second colour, so this is a door and
  // not just a nicer-looking dead end.
  const changed = await page.evaluate(() => {
    const b = document.querySelectorAll('#travelMugColorGridGen .color-btn');
    if (b.length < 2) return null;
    const before = preGenTravelColor || selectedTravelColor;
    b[1].click();
    return { before, after: preGenTravelColor || selectedTravelColor };
  });
  await T(page, 600);
  if (!changed) return 'FAIL: not enough swatches to change colour';
  if (changed.after === changed.before)
    return `FAIL: the second swatch did not take (still ${changed.after}) — the panel is reachable but frozen`;

  return `PASS: Back from the result lands on the cup/colour panel, spotlit and live (${changed.before} -> ${changed.after}), with Change cup in reach`;
};


(async () => {
  let fails = 0;
  // Run one scenario by name: SCENARIO=travelResultBackReachesTheColourPanel node ...
  const only = process.env.SCENARIO;
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only && name !== only) continue;
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
