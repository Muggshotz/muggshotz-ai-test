// THE SEAM NOBODY DROVE: the studio's own hand-off to the order page.
//
// verify-checkout-wiring.js proves the payment chain works -- but every one
// of its scenarios starts by WRITING muggshotz_pending_order itself:
//
//     await page.addInitScript(() => {
//       localStorage.setItem('muggshotz_pending_order', JSON.stringify({...}));
//     });
//
// So it pins what order.html does with a correct record. It cannot see a
// record the studio never wrote, wrote under a different key, or wrote with
// a field order.html does not read. That is the one joint in the whole shop
// where a customer's money and a customer's design change hands, and until
// this file it had never been driven once.
//
// This suite makes NO localStorage of its own. It starts at an empty studio,
// walks the real rail to the real Checkout button, lets the browser navigate
// to order.html on its own, and reads the body that would reach Stripe.
// Everything in between is the shipping code.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage, passCardInside, BASE } = require('./harness');
// The mug's click path is shared with the 3D suite so both drive the exact
// same sequence a customer does.
const { mugToPrintStyle, describeAndGenerate, approveAllThree, waitLanded } = require('./verify-mug-3d-helpers');

const T = (page, ms) => page.waitForTimeout(ms);

// The 3D mug needs a software GL in this headless sandbox; without it the
// studio falls back to the flat Printify mockup, which is a different path
// from the one a desktop customer walks.
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
const OPTS = {};

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

async function pickProduct(page, tile) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${tile}"]`).click({ force: true });
  await T(page, 1400);
  await dismissAlerts(page);
}

// Walks approve -> fade -> mockup -> What's Next, and presses the studio's
// one and only Checkout button. Returns nothing: the navigation IS the result.
async function reachCheckoutButton(page, insideChoice) {
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await passFadePage(page);
  await passCardInside(page, insideChoice);
  // The mockup takes a moment; the Return button is what opens What's Next.
  await page.waitForFunction(() => {
    const b = document.getElementById('mockupLightboxReturn');
    return !!(b && b.offsetParent !== null);
  }, null, { timeout: 60000 });
  await page.evaluate(() => returnFromFinalMockup());
  await page.waitForFunction(() => {
    const o = document.getElementById('finalChoiceOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 15000 });
  await page.click('#finalChoiceOverlay button:has-text("Checkout")');
}

// Fills the address the way a customer does and runs the page's own submit.
async function payFrom(page) {
  await page.waitForFunction(() => location.pathname.endsWith('/order.html'), null, { timeout: 20000 });
  await T(page, 1800);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Alyx Tester'); set('email', 'alyx@example.com');
    set('phone', '5555550100'); set('address1', '123 Test St');
    set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2500);
}

// The flat single-image products. Each one is a whole rail: photo in, paid
// order body out, with nothing seeded anywhere along the way.
const PRODUCTS = [
  // The poster is the one flat product with real choices of its own -- size
  // and orientation -- and they have to be settled before the description
  // box exists, exactly as a customer settles them.
  { tile: 'photo poster',   key: 'photo-poster',   sizeLabel: '12x18',
    settle: async (page) => {
      await page.evaluate(() => {
        const t = [...document.querySelectorAll('#posterSizeGrid .btn-select')].find(b => /12.*x.*18/.test(b.textContent));
        if (t) t.click();
      });
      await T(page, 600);
      await page.click('#posterOrientHorizontalBtn');
      await T(page, 800);
    } },
  { tile: 'coaster',        key: 'coaster-set',    sizeLabel: '4" x 4"',
    settle: async (page) => { await page.evaluate(() => pickCoasterShape('square')); await T(page, 900); } },
  { tile: 'mouse pad',      key: 'mouse-pad',      sizeLabel: '9" x 8"' },
  { tile: 'greeting card',  key: 'greeting-card',  sizeLabel: '8-Pack' },
  { tile: 'post-it note',   key: 'post-it-notes',  sizeLabel: '3" x 3"' },

  // ---- The rest of the flat products, each choosing a NON-default option on
  // purpose. order.html keeps hard defaults for some of these (puzzle "96 pcs",
  // suitcase "Small") and the studio's goToOrder() writes nothing for them --
  // so if the choice does not survive the hop, the customer pays for the
  // default and gets the default, silently. Picking the default in the test
  // would hide exactly that. ----
  { tile: 'coaster', slug: 'round_coaster', key: 'coaster-set-round', sizeLabel: 'Round 3.7"',
    settle: async (page) => { await page.evaluate(() => pickCoasterShape('round')); await T(page, 900); } },
  { tile: 'puzzle',         key: 'photo-puzzle',   sizeLabel: '252 pcs',
    settle: async (page) => { await page.click('#puzzleSizeGrid .btn-select[data-puzzle-size="252 pcs"]'); await T(page, 900); } },
  { tile: 'suitcase',       key: 'suitcase',       sizeLabel: 'Medium',
    settle: async (page) => { await page.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]'); await T(page, 900); } },
  { tile: 'tote bag',       key: 'tote-bag',
    sizeLabel: '16" x 16"',
    colour: (page) => page.evaluate(() => typeof selectedToteColorGen !== 'undefined' ? selectedToteColorGen : null),
    settle: async (page) => {
      await page.click('#toteSizeGrid .btn-select[data-tote-size=\'16" x 16"\']');
      await T(page, 600);
      await page.evaluate(() => { const b = document.querySelector('#toteBagColorGridGen .color-btn'); if (b) b.click(); });
      await T(page, 1000);
      await dismissAlerts(page);
    } },
  { tile: 'phone case',     key: 'phone-case-tough',
    // The model is whatever the studio settled on (the harness's compatibility
    // stub answers "iPhone 15 Pro"); what matters is that the SAME model
    // reaches payment, not which one it is.
    sizeLabel: (page) => page.evaluate(() => typeof selectedPhoneCaseModel !== 'undefined' ? selectedPhoneCaseModel : null),
    settle: async (page) => {
      await page.fill('#phoneModelSearchInputGen', 'iPhone 15 Pro Max');
      await page.press('#phoneModelSearchInputGen', 'Enter');
      await T(page, 900);
      await page.click('#phoneModelConfirmGen button:has-text("Yes")');
      await T(page, 900);
      await dismissAlerts(page);
    } },
];

const scenarios = {};

for (const P of PRODUCTS) {
  const slug = P.slug || P.tile.replace(/\W+/g, '_');

  scenarios['studioToPayment_' + slug] = async (page, log, bodies) => {
    await pickProduct(page, P.tile);
    if (P.settle) await P.settle(page);
    await page.fill('#ideaDesc', 'a lighthouse in a storm');
    await T(page, 600);
    await dismissAlerts(page);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await waitApprove(page);
    // What the studio believes, read before the hop -- some expectations are
    // the studio's own settled choice rather than a constant.
    const wantSize = typeof P.sizeLabel === 'function' ? await P.sizeLabel(page) : P.sizeLabel;
    const wantColour = P.colour ? await P.colour(page) : null;
    await reachCheckoutButton(page);
    await payFrom(page);

    const b = bodies[bodies.length - 1];
    if (!b) {
      // Distinguish "never got there" from "got there and was refused" --
      // the second one leaves a message on screen and is the interesting bug.
      const st = await page.evaluate(() => ({
        url: location.pathname,
        status: document.getElementById('status')?.textContent || '',
      }));
      return `FAIL: ${P.tile}: no payment body. at=${st.url} status="${st.status.trim()}"`;
    }
    const bad = [];
    if (b.productKey !== P.key) bad.push(`productKey=${b.productKey}, expected ${P.key}`);
    if (b.sizeLabel !== wantSize) bad.push(`sizeLabel=${JSON.stringify(b.sizeLabel)}, the studio had ${JSON.stringify(wantSize)} — the choice did not survive the hop`);
    if (wantColour && b.colorName !== wantColour) bad.push(`colorName=${JSON.stringify(b.colorName)}, the studio had ${JSON.stringify(wantColour)}`);
    if (!b.image) bad.push('no image — the design did not survive the hop');
    if (!b.shippingAddress || b.shippingAddress.zip !== '48185') bad.push('shipping address incomplete');
    if (bad.length) return `FAIL: ${P.tile}: ${bad.join('; ')}`;
    return `PASS: ${P.tile}: studio → order → payment carries {${b.productKey}, ${JSON.stringify(b.sizeLabel)}, image}`;
  };
}

// ---- The card's inside page, front to payment. ----
// Blank inside is the default and every card printed that way until Sep 2026,
// so both answers matter: choosing nothing must still reach payment with a
// null inside, and choosing the front's own picture must carry a real url all
// the way to the body Stripe is handed. Same-as-the-front is the free option
// (Alyx: only OUR generator costs a token), which is why it is the one driven
// here -- it proves the plumbing without spending anything.
scenarios.theCardsInsideReachesPayment = async (page, log, bodies) => {
  await pickProduct(page, 'greeting card');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await T(page, 600);
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);

  let sawPanel = false;
  await reachCheckoutButton(page, async (p) => {
    sawPanel = true;
    // Blank must be where it opens: a card that quietly starts out printed
    // inside is a charge for something nobody asked for.
    const startsBlank = await p.evaluate(() =>
      document.getElementById('cardInsideBlankBtn')?.classList.contains('selected') && cardInsideImage === null);
    if (!startsBlank) throw new Error('the inside panel did not open on Leave It Blank');
    await p.click('#cardInsideSameBtn');
    await T(p, 500);
  });
  if (!sawPanel) return 'FAIL: a greeting card reached the mockup without ever being offered an inside';
  await payFrom(page);

  const b = bodies[bodies.length - 1];
  if (!b) return 'FAIL: the card never reached payment after choosing an inside';
  if (b.productKey !== 'greeting-card') return `FAIL: productKey=${b.productKey}`;
  if (!b.insideImage) return 'FAIL: the inside was chosen in the studio and arrived at payment blank';
  if (b.insideImage !== b.image)
    return `FAIL: "same as the front" sent a different picture (front=${b.image}, inside=${b.insideImage})`;
  return 'PASS: the card\'s inside choice reaches payment intact';
};

// And the default costs nothing and prints nothing.
scenarios.aBlankInsideStaysBlankAllTheWayToPayment = async (page, log, bodies) => {
  await pickProduct(page, 'greeting card');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await T(page, 600);
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  await reachCheckoutButton(page);
  await payFrom(page);

  const b = bodies[bodies.length - 1];
  if (!b) return 'FAIL: a blank-inside card never reached payment';
  if (b.insideImage) return `FAIL: nobody asked for an inside and one was sent anyway (${b.insideImage})`;
  const gen = log.apiCalls.filter(c => c.path === '/api/generate' && !c.action);
  if (gen.length > 1) return `FAIL: leaving the inside blank spent ${gen.length} generations, not 1`;
  return 'PASS: blank inside stays blank, and costs exactly the one generation the front cost';
};

// ---- Back out of the inside panel, and forward again. ----
// Alyx's rule for every screen in this studio: "you should be able to go
// backwards and forwards, backwards and forwards, over and over ... they
// should always be in sequence." A greeting card's real order is approve ->
// Edge Fade -> inside -> mockup, so Back from the inside panel is the FADE
// PAGE. Landing on the approve decision instead would be skipping a screen
// backwards, which is how somebody ends up re-deciding a thing they never
// touched -- and the forward trip has to still work afterwards, which is the
// half that a "clear the flag" fix usually breaks.
scenarios.theInsidePanelGoesBackOneScreenAndForwardAgain = async (page) => {
  await pickProduct(page, 'greeting card');
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await T(page, 600);
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  await page.locator('#approveRow button:has-text("Yes")').first().click();

  const sawFade = await passFadePage(page);
  if (!sawFade) return 'FAIL: a greeting card never reached the Edge Fade page';
  const opened = await passCardInside(page, async (p) => {
    await p.click('#cardInsideOverlay button:has-text("Back")');
    await T(p, 1400);
  }).catch(() => false);
  // passCardInside clicked Back, so its own Continue click is the thing that
  // must NOT have happened -- check where Back actually landed instead.
  const afterBack = await page.evaluate(() => ({
    inside: getComputedStyle(document.getElementById('cardInsideOverlay')).display !== 'none',
    fade: getComputedStyle(document.getElementById('frameFadeOverlay')).display !== 'none',
    approving: document.getElementById('approveRow')?.style.display !== 'none',
  }));
  if (afterBack.inside) return 'FAIL: Back left the inside panel open';
  if (!afterBack.fade)
    return `FAIL: Back skipped the fade page it came from (approve row back on screen: ${afterBack.approving})`;

  // And forward again: the fade page's Continue must land on the inside panel
  // once more, not sail past it to the mockup.
  await page.click('#frameFadeOverlay button:has-text("Continue")');
  const backAgain = await page.waitForFunction(() => {
    const o = document.getElementById('cardInsideOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (!backAgain) return 'FAIL: going forward again sailed past the inside panel to the mockup';
  return 'PASS: Back lands on the fade page, and forward comes back to the inside panel';
};

// ---- The ceramic mug: the most-travelled rail in the shop, and the one the
// new suite had left out. ----
//
// Both halves of the mug's checkout were already tested -- verify-wraparound
// drives a real mug to goToOrder() and checks the record it writes, and
// verify-checkout-wiring drives order.html's submit from a SEEDED record. What
// had never been driven is the join: that the record the studio writes is the
// record order.html reads. That join is exactly where this suite found the
// order page's silent TypeError, so it is not a formality.
//
// The mug reaches its mockup through more screens than any flat product --
// approve, panel placement, the fade page, the frame offer, the edge question
// -- and which of them appear depends on print mode and on earlier choices.
// Rather than hard-code one sequence, this presses the obvious forward button
// of whatever screen is up, the way a customer does, and records the route.
// A stall then names the screen it stuck on instead of a bare timeout.
async function walkForwardToMockup(page, { maxSteps = 30, settleMs = 900 } = {}) {
  const route = [];
  for (let i = 0; i < maxSteps; i++) {
    const screen = await page.evaluate(() => {
      // Rendered, not merely styled: getComputedStyle(child).display does
      // NOT inherit a hidden ancestor's display:none, so a check on the
      // child alone saw the mockup's Satisfied? button as visible while its
      // action row was still hidden -- and walked to Checkout without ever
      // pressing Yes. getClientRects() is empty for anything not laid out.
      const vis = (id) => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0; };
      const shown = vis;
      if (vis('mockupLightboxReturn')) return 'mockup';
      if (vis('mockupLoadingOverlay')) return 'waiting';
      if (vis('frameFadeOverlay')) return 'fade';
      if (vis('revealOverlay')) return 'edge';
      if (vis('accessorizeCard') && vis('accessorizeChoicePanel')) return 'frameOffer';
      if (vis('trimmingsOverlay')) return 'trimmings';
      const done = document.getElementById('coverMePanelDoneBtn');
      if (shown('coverMePanelCard') && done && !done.disabled) return 'panels';
      if (shown('coverMePanelCard')) return 'panelsDisabled';
      if (shown('approveRow')) return 'approve';
      return 'other';
    });
    if (route[route.length - 1] !== screen) route.push(screen);
    if (screen === 'mockup') return { ok: true, route };
    switch (screen) {
      case 'approve':      await approveAllThree(page); break;
      case 'panels':       await page.click('#coverMePanelDoneBtn'); break;
      case 'fade':         await page.click('#frameFadeOverlay button:has-text("Continue")'); break;
      case 'frameOffer':   await page.click('#accessorizeCard button:has-text("No Thank You")'); break;
      case 'edge':         await page.click('#revealOverlay button:has-text("Hard Edges")'); break;
      case 'trimmings':    await page.click('#trimmingsOverlay button:has-text("No Thanks")').catch(() => {}); 
                           await page.click('#trimmingsOverlay button:has-text("Continue")').catch(() => {}); break;
      default: break; // waiting / panelsDisabled / other: let it settle
    }
    await dismissAlerts(page);
    await T(page, settleMs);
  }
  return { ok: false, route };
}

// What the studio believes at the moment of the hop -- captured right before
// Checkout, since the fade and frame screens can replace URLs on the way.
const studioMugState = (page) => page.evaluate(() => ({
  style: typeof selectedGenStyle !== 'undefined' ? selectedGenStyle : null,
  size: typeof selectedGenSize !== 'undefined' ? selectedGenSize : null,
  colour: typeof selectedGenColor !== 'undefined' ? selectedGenColor : null,
  printMode: typeof mugPrintMode !== 'undefined' ? mugPrintMode : null,
  panorama: typeof wraparoundPanoramaUrl !== 'undefined' ? wraparoundPanoramaUrl : null,
  placements: ['left', 'front', 'right'].map((p) => {
    const d = placements[p] ? findDesignById(placements[p]) : null;
    return d ? d.url : null;
  }),
}));

async function checkoutFromMockup(page) {
  await page.evaluate(() => returnFromFinalMockup());
  await page.waitForFunction(() => {
    const o = document.getElementById('finalChoiceOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 15000 });
  await page.click('#finalChoiceOverlay button:has-text("Checkout")');
}

async function driveMug(page, printMode) {
  await mugToPrintStyle(page, '11oz');
  await page.evaluate((m) => pickMugPrintMode(m), printMode);
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, printMode === 'wraparound' ? 'a wide desert canyon at sunrise' : 'a lighthouse in a storm');
  await waitLanded(page);
  await T(page, 1200);
  const walk = await walkForwardToMockup(page);
  if (!walk.ok) return { walk };
  await T(page, 1200);
  const before = await studioMugState(page);
  await checkoutFromMockup(page);
  await payFrom(page);
  return { walk, before };
}

OPTS.threePanelMugKeepsItsChoicesAcrossTheHop = { chromiumArgs: GL };
scenarios.threePanelMugKeepsItsChoicesAcrossTheHop = async (page, log, bodies) => {
  const { walk, before } = await driveMug(page, 'three-panel');
  if (!walk.ok) return `FAIL: three-panel mug never reached its mockup — stuck at "${walk.route[walk.route.length - 1]}" via ${walk.route.join(' → ')}`;
  const b = bodies[bodies.length - 1];
  if (!b) {
    const st = await page.evaluate(() => ({ url: location.pathname, status: document.getElementById('status')?.textContent || '' }));
    return `FAIL: three-panel mug: no payment body. at=${st.url} status="${st.status.trim()}" (route ${walk.route.join(' → ')})`;
  }
  const bad = [];
  if (b.type !== 'mug_order') bad.push(`type=${b.type}`);
  if (b.mugType !== before.style) bad.push(`style changed across the hop: studio ${before.style}, payment ${b.mugType}`);
  if (b.sizeLabel !== before.size) bad.push(`size changed: studio ${before.size}, payment ${b.sizeLabel}`);
  if (before.colour && b.color !== before.colour) bad.push(`colour changed: studio ${before.colour}, payment ${b.color}`);
  if (b.printMode !== 'standard') bad.push(`printMode=${b.printMode} on a three-panel mug`);
  if (b.isWraparoundSet) bad.push('isWraparoundSet on a three-panel mug — the $3 wrap surcharge would be charged');
  const sent = b.placements || {};
  if (!(sent.left || sent.front || sent.right)) bad.push('no placements reached payment');
  if (sent.left !== before.placements[0] || sent.right !== before.placements[2])
    bad.push('the left/right panels the studio held are not the ones that reached payment');
  if (!b.shippingAddress || b.shippingAddress.zip !== '48185') bad.push('shipping address incomplete');
  if (bad.length) return `FAIL: three-panel mug: ${bad.join('; ')}`;
  return `PASS: three-panel mug keeps {${b.mugType}, ${b.sizeLabel}, ${b.color}} across the hop via ${walk.route.join(' → ')}`;
};

OPTS.wraparoundMugCarriesTheStripAcrossTheHop = { chromiumArgs: GL };
scenarios.wraparoundMugCarriesTheStripAcrossTheHop = async (page, log, bodies) => {
  const { walk, before } = await driveMug(page, 'wraparound');
  if (!walk.ok) return `FAIL: wraparound mug never reached its mockup — stuck at "${walk.route[walk.route.length - 1]}" via ${walk.route.join(' → ')}`;
  const b = bodies[bodies.length - 1];
  if (!b) {
    const st = await page.evaluate(() => ({ url: location.pathname, status: document.getElementById('status')?.textContent || '' }));
    return `FAIL: wraparound mug: no payment body. at=${st.url} status="${st.status.trim()}" (route ${walk.route.join(' → ')})`;
  }
  const bad = [];
  if (b.type !== 'mug_order') bad.push(`type=${b.type}`);
  if (b.mugType !== before.style) bad.push(`style changed across the hop: studio ${before.style}, payment ${b.mugType}`);
  if (b.sizeLabel !== before.size) bad.push(`size changed: studio ${before.size}, payment ${b.sizeLabel}`);
  if (b.printMode !== 'fullBleed') bad.push(`printMode=${b.printMode} on a wraparound`);
  if (!b.isWraparoundSet) bad.push('isWraparoundSet lost — the wrap surcharge would not apply');
  if (!before.panorama) bad.push('the studio held no panorama at the hop (test precondition)');
  else if (b.panoramaImage !== before.panorama) bad.push(`the uncut strip changed across the hop: studio ${before.panorama}, payment ${b.panoramaImage}`);
  const sent = b.placements || {};
  if (!(sent.left && sent.front && sent.right)) bad.push('a wraparound needs all three thirds and not all three reached payment');
  if (!b.shippingAddress || b.shippingAddress.zip !== '48185') bad.push('shipping address incomplete');
  if (bad.length) return `FAIL: wraparound mug: ${bad.join('; ')}`;
  return `PASS: wraparound mug carries the uncut strip and all three thirds across the hop via ${walk.route.join(' → ')}`;
};

// ---- The travel cup, which is the one with an identity to lose. ----
// Art generated for the insulated 40oz's front/back split is not
// interchangeable with any other cup's, so the cup and its colour have to
// ride the hop. The wiring suite pins this from a seeded record; this pins
// it from the studio actually writing one.
scenarios.travelCupKeepsItsIdentityAcrossTheHop = async (page, log, bodies) => {
  await pickProduct(page, 'water bottle');
  // The 40oz insulated cup: front/back split art, so it is the one whose
  // identity is genuinely not interchangeable with another cup's.
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-40oz-insulated'));
  await T(page, 1200);
  await dismissAlerts(page);
  await page.evaluate(() => {
    const card = document.getElementById('mugPrintModeCard');
    if (card && card.style.display !== 'none') pickMugPrintMode('three-panel');
  });
  await T(page, 700);
  await dismissAlerts(page);
  // A NON-DEFAULT COLOUR, ON PURPOSE.
  //
  // This used to click querySelector('#travelMugColorGridGen .color-btn') --
  // the FIRST swatch, which is White. The colour assertion below is real, and
  // it could never fail: travelColorEntry() falls back to colors[0] when the
  // colour has been lost, and colors[0] is White, so "they chose White" and
  // "we dropped their choice" arrive at payment looking identical.
  //
  // That is not hypothetical. The studio shipped for months with the only
  // reachable palette writing to a variable nothing read after generation, and
  // with nothing persisting the cup across a refresh, so a customer who picked
  // Red got a White cup. Every travel scenario in this suite passed throughout,
  // all six of them reporting White.
  //
  // So: pick something that is not the fallback. Then a lost colour reads as
  // White, White is not Black, and the test says so.
  const wanted = await page.evaluate(() => {
    const card = document.getElementById('travelMugColorCard');
    if (!card || card.style.display === 'none') return null;
    const btns = Array.from(document.querySelectorAll('#travelMugColorGridGen .color-btn'));
    const first = btns[0] && btns[0].dataset.color;
    const pick = btns.find(b => b.dataset.color && b.dataset.color !== first);
    if (!pick) return null;          // a palette of one cannot carry this test
    pick.click();
    return pick.dataset.color;
  });
  await T(page, 800);
  await dismissAlerts(page);
  const chosen = await page.evaluate(() => ({
    key: (typeof selectedTravelProductKey !== 'undefined' && selectedTravelProductKey) || null,
    colour: (typeof selectedTravelColor !== 'undefined' && selectedTravelColor) || null,
  }));
  if (!chosen.key) return 'FAIL: picking a cup did not settle a cup';
  if (wanted && chosen.colour !== wanted)
    return `FAIL: tapped ${wanted} and the studio settled on ${chosen.colour} — the palette is not writing what the shop reads`;
  if (chosen.key !== 'travel-mug-40oz-insulated')
    return `FAIL: asked for the insulated 40oz, the studio settled on ${chosen.key}`;

  await page.evaluate(() => {
    const box = document.getElementById('ideaDesc');
    if (box) box.closest('.snap-section')?.classList.remove('snap-collapsed');
  });
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await T(page, 600);
  await dismissAlerts(page);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  await reachCheckoutButton(page);
  await payFrom(page);

  const b = bodies[bodies.length - 1];
  if (!b) {
    const st = await page.evaluate(() => ({
      url: location.pathname, status: document.getElementById('status')?.textContent || '' }));
    return `FAIL: travel cup: no payment body. at=${st.url} status="${st.status.trim()}"`;
  }
  if (b.productKey !== chosen.key)
    return `FAIL: the cup changed across the hop — studio had ${chosen.key}, payment says ${b.productKey}`;
  if (chosen.colour && b.colorName !== chosen.colour)
    return `FAIL: the colour changed across the hop — studio had ${chosen.colour}, payment says ${b.colorName}`;
  // The whole point of picking a non-default above: say out loud that what
  // reached payment is not merely the fallback wearing the right name.
  if (wanted && b.colorName !== wanted)
    return `FAIL: tapped ${wanted}, payment charges for ${b.colorName}`;
  if (!(b.image || b.frontImage || b.backImage))
    return 'FAIL: the design did not survive the hop to payment';
  return `PASS: travel cup keeps its identity across the hop (${b.productKey}, ${b.colorName}`
       + `${wanted ? ` — a non-default colour, so a lost one would read as White and fail` : ''})`;
};

// ---- The other five travel cups. ----
// Same hop as the 40oz insulated, but each cup has its own body shape, its own
// size label, and (for two of them) a colour to keep. The 40oz vacuum is also
// the one whose wrap closes, so it meets the Trimmings panel on the way to its
// mockup; the walk helper answers it the way a customer who wants none does.
const TRAVEL = [
  { key: 'travel-mug-20oz',        sizeLabel: '20oz' },
  { key: 'travel-mug-14oz-handle', sizeLabel: '14oz' },
  { key: 'travel-mug-32oz-gator',  sizeLabel: '32oz' },
  { key: 'travel-mug-30oz-tundra', sizeLabel: '30oz' },
  { key: 'travel-mug-40oz-vacuum', sizeLabel: '40oz' },
];
for (const C of TRAVEL) {
  const name = 'travelCup_' + C.key.replace(/^travel-mug-/, '').replace(/\W+/g, '_');
  OPTS[name] = { chromiumArgs: GL };
  scenarios[name] = async (page, log, bodies) => {
    await pickProduct(page, 'water bottle');
    await page.evaluate((k) => pickPreGenTravelVariant(k), C.key);
    await T(page, 1200);
    await dismissAlerts(page);
    await page.evaluate(() => {
      const card = document.getElementById('mugPrintModeCard');
      if (card && card.style.display !== 'none') pickMugPrintMode('three-panel');
    });
    await T(page, 700);
    await dismissAlerts(page);
    await page.evaluate(() => {
      const card = document.getElementById('travelMugColorCard');
      if (!card || card.style.display === 'none') return;
      const btn = document.querySelector('#travelMugColorGridGen .color-btn');
      if (btn) btn.click();
    });
    await T(page, 800);
    await dismissAlerts(page);
    const chosen = await page.evaluate(() => ({
      key: (typeof selectedTravelProductKey !== 'undefined' && selectedTravelProductKey)
        || (typeof selectedTravelProductKey !== 'undefined' && selectedTravelProductKey) || null,
      colour: (typeof selectedTravelColor !== 'undefined' && selectedTravelColor)
        || (typeof selectedTravelColor !== 'undefined' && selectedTravelColor) || null,
    }));
    if (chosen.key !== C.key) return `FAIL: asked for ${C.key}, the studio settled on ${chosen.key}`;

    await describeAndGenerate(page, 'a lighthouse in a storm');
    await waitLanded(page);
    await T(page, 1200);
    const walk = await walkForwardToMockup(page);
    if (!walk.ok) return `FAIL: ${C.key} never reached its mockup — stuck at "${walk.route[walk.route.length - 1]}" via ${walk.route.join(' → ')}`;
    await T(page, 1200);
    await checkoutFromMockup(page);
    await payFrom(page);

    const b = bodies[bodies.length - 1];
    if (!b) {
      const st = await page.evaluate(() => ({ url: location.pathname, status: document.getElementById('status')?.textContent || '' }));
      return `FAIL: ${C.key}: no payment body. at=${st.url} status="${st.status.trim()}" (route ${walk.route.join(' → ')})`;
    }
    const bad = [];
    if (b.productKey !== C.key) bad.push(`the cup changed across the hop: studio ${C.key}, payment ${b.productKey}`);
    if (b.sizeLabel !== C.sizeLabel) bad.push(`sizeLabel=${JSON.stringify(b.sizeLabel)}, expected ${JSON.stringify(C.sizeLabel)}`);
    if (chosen.colour && b.colorName !== chosen.colour) bad.push(`colour changed: studio ${chosen.colour}, payment ${b.colorName}`);
    if (!(b.image || b.frontImage || b.backImage)) bad.push('the design did not survive the hop');
    if (!b.shippingAddress || b.shippingAddress.zip !== '48185') bad.push('shipping address incomplete');
    if (bad.length) return `FAIL: ${C.key}: ${bad.join('; ')}`;
    return `PASS: ${C.key} keeps its identity across the hop (${b.sizeLabel}${b.colorName ? ', ' + b.colorName : ''}) via ${walk.route.join(' → ')}`;
  };
}

// ---- A record the studio never wrote must not be guessed at. ----
// order.html falls back to 'mug' when there is no pending order at all
// (selectedProductFamily = pendingOrder?.productIcon || 'mug'). That is fine
// as a default only if it cannot charge for something nobody designed.
scenarios.anEmptyOrderPageCannotCharge = async (page, log, bodies) => {
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 1500);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Alyx Tester'); set('email', 'alyx@example.com');
    set('address1', '123 Test St'); set('city', 'Westland');
    set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  if (bodies.length)
    return `FAIL: order.html charged for an order that was never designed (${JSON.stringify(bodies[0].productKey)})`;
  const status = await page.evaluate(() => document.getElementById('status')?.textContent || '');
  if (!status.trim())
    return 'FAIL: submit with no design silently did nothing — the customer is told nothing';
  return `PASS: no design means no charge, and it says so ("${status.trim()}")`;
};

(async () => {
  let fails = 0;
  // ONLY=regex runs a subset, for iterating on one scenario without paying
  // for the other dozen every time.
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only && !only.test(name)) continue;
    const { browser, page, log } = await launch(OPTS[name] || {});
    const bodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/create-checkout-session')) {
        try { bodies.push(r.postDataJSON()); } catch (e) {}
      }
    });
    try {
      await openStudio(page);
      if (name !== 'anEmptyOrderPageCannotCharge') {
        await uploadPhoto(page);
        await dismissAlerts(page);
      }
      const result = await fn(page, log, bodies);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL|Failed to load resource/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs.slice(0, 4))}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors.slice(0, 4))}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL STUDIO-TO-PAYMENT VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
