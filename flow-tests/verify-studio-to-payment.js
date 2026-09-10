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
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

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
// The greeting card's inside page (Sep 2026) stands between the fade page and
// the mockup. Blank is the default and the ordinary card, so passing straight
// through it is what most customers do -- but it is a real screen and every
// walk to a card mockup has to go through it. Silent on products that do not
// have one.
async function passCardInside(page, choose) {
  const opened = await page.waitForFunction(() => {
    const o = document.getElementById('cardInsideOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  if (!opened) return false;
  if (choose) await choose(page);
  await page.click('#cardInsideOverlay button:has-text("Continue")');
  await T(page, 1200);
  return true;
}

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
];

const scenarios = {};

for (const P of PRODUCTS) {
  const slug = P.tile.replace(/\W+/g, '_');

  scenarios['studioToPayment_' + slug] = async (page, log, bodies) => {
    await pickProduct(page, P.tile);
    if (P.settle) await P.settle(page);
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
    if (b.sizeLabel !== P.sizeLabel) bad.push(`sizeLabel=${JSON.stringify(b.sizeLabel)}, expected ${JSON.stringify(P.sizeLabel)}`);
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
  await page.evaluate(() => {
    const card = document.getElementById('travelMugColorCard');
    if (!card || card.style.display === 'none') return;
    const btn = document.querySelector('#travelMugColorGridGen .color-btn');
    if (btn) btn.click();
  });
  await T(page, 800);
  await dismissAlerts(page);
  // Read it the way goToOrder() reads it. Before a generation the choice
  // lives in preGenTravelVariant; selectedTravelProductKey is the post-gen
  // one, and the studio's own hand-off falls back from the first to the
  // second. Asserting on only one of them tests the test, not the shop.
  const chosen = await page.evaluate(() => ({
    key: (typeof selectedTravelProductKey !== 'undefined' && selectedTravelProductKey)
      || (typeof preGenTravelVariant !== 'undefined' && preGenTravelVariant) || null,
    colour: (typeof selectedTravelColor !== 'undefined' && selectedTravelColor)
      || (typeof preGenTravelColor !== 'undefined' && preGenTravelColor) || null,
  }));
  if (!chosen.key) return 'FAIL: picking a cup did not settle a cup';
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
  if (!(b.image || b.frontImage || b.backImage))
    return 'FAIL: the design did not survive the hop to payment';
  return `PASS: travel cup keeps its identity across the hop (${b.productKey}, ${b.colorName})`;
};

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
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
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
