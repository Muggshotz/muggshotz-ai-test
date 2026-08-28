// THE PAYMENT CHAIN, END TO END. Alyx: "When I said we were gonna do check
// out I meant the complete wiring start to finish -- we're gonna get this
// thing ready to go online."
//
// The inventory found the pipeline coded end to end -- order.html builds the
// body, create-checkout-session prices it and opens Stripe, the webhook
// verifies the signature and hands the paid order to placeProductOrder, which
// submits to Printify with the Stripe session id as external_id (Printify
// rejects duplicates, so a webhook retry cannot double-print a mug). The
// deployment runs Stripe TEST keys, and the webhook explicitly discards
// test-mode completions -- that pair is the kill-switch, and going live is a
// key swap in Vercel plus a live webhook endpoint in Stripe, not a code
// change.
//
// What the inventory also found, and this suite now pins:
//   * order.html did NOTHING with ?checkout=success -- a customer who had
//     just PAID landed back on the order form, told nothing. The single most
//     important screen in the shop was missing.
//   * the $1 gift message was charged and then dropped -- the text never
//     entered the payment metadata, so it could never reach the parcel.
//   * the uncut wraparound panorama didn't survive the payment hop, so a
//     paid mug wrap fell back to reassembling thirds.
const { launch, openStudio } = require('./harness');
const fs = require('fs');
const path = require('path');

const T = (page, ms) => page.waitForTimeout(ms);
const ROOT = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:8788';

const scenarios = {};

// ---- 1. The chain itself, read from source. ----
// These are wiring facts: if any of them drifts, money moves but the order
// degrades silently. Source-level on purpose -- there is no way to run
// Stripe's webhook locally without keys, but the chain is plain to read.
scenarios.paymentChainCarriesEverything = async () => {
  const session = fs.readFileSync(path.join(ROOT, 'api', 'create-checkout-session.js'), 'utf8');
  const webhook = fs.readFileSync(path.join(ROOT, 'api', 'stripe-webhook.js'), 'utf8');
  const printify = fs.readFileSync(path.join(ROOT, 'api', 'create-printify-order.js'), 'utf8');
  const order = fs.readFileSync(path.join(ROOT, 'order.html'), 'utf8');
  const bad = [];

  // The customer pays for the gift message; the text must enter the record.
  if (!/gift_message:\s*giftMessageText/.test(session))
    bad.push('the $1 gift message is charged but its text never enters the Stripe metadata');
  // The uncut panorama must survive the payment hop end to end.
  if (!/image_url_d:\s*imageUrlD/.test(session))
    bad.push('the panorama strip is not stored in the payment metadata');
  if (!/panoramaImage\s*=\s*m\.image_url_d/.test(webhook))
    bad.push('the webhook never hands the panorama to the Printify order');
  if (!/panoramaImage\s*=\s*null/.test(printify) || !/buildSeamlessWrapFromPanorama/.test(printify))
    bad.push('placeProductOrder cannot receive or use the panorama');
  if (!/panoramaImage:\s*pendingOrder\.panoramaImage/.test(order))
    bad.push('order.html does not send the panorama with the payment body');

  // The safety pair: test-mode events are discarded, and Printify orders are
  // keyed by the Stripe session id so retries cannot double-print.
  if (!/if\s*\(!event\.livemode\)/.test(webhook))
    bad.push('the test-mode guard is gone — test payments would place REAL Printify orders');
  if (!/external_id:\s*externalOrderId/.test(printify))
    bad.push('Printify orders no longer carry external_id — a webhook retry could double-print');

  // And the return screens exist at all.
  if (!/checkout=success/.test(session) || !/handleCheckoutReturn/.test(order))
    bad.push('the return-from-payment handling is missing from order.html');

  if (bad.length) return `FAIL: ${bad.join('; ')}`;
  return 'PASS: gift text, panorama, test-mode guard, external_id idempotency and the return screens are all wired';
};

// ---- 2. The thank-you screen, as the customer meets it. ----
scenarios.successScreenThanksAndClears = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('muggshotz_pending_order', JSON.stringify({
      placements: { left: null, front: 'https://example.com/a.png', right: null },
      deviceId: 'test-dev', productIcon: 'mug', mugPrintMode: 'three-panel'
    }));
  });
  await page.goto(`${BASE}/order.html?checkout=success`, { waitUntil: 'domcontentloaded' });
  await T(page, 1200);
  const st = await page.evaluate(() => ({
    bodyText: document.querySelector('.main')?.textContent || '',
    pending: localStorage.getItem('muggshotz_pending_order'),
    makeAnother: !!document.querySelector('a[href="needles-studio.html"]'),
  }));
  if (!/Order Placed/i.test(st.bodyText))
    return 'FAIL: a customer who just PAID sees no confirmation — the order form is still staring at them';
  if (st.pending !== null)
    return 'FAIL: the pending order survived a successful payment — one more click orders the same design twice';
  if (!st.makeAnother)
    return 'FAIL: no way back to the studio from the thank-you screen';
  return 'PASS: payment success thanks the customer, clears the finished order, and offers the way back';
};

// ---- 3. A cancelled payment must cost nothing — including the work. ----
scenarios.cancelledKeepsEverything = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('muggshotz_pending_order', JSON.stringify({
      placements: { left: null, front: 'https://example.com/a.png', right: null },
      deviceId: 'test-dev', productIcon: 'mug', mugPrintMode: 'three-panel'
    }));
  });
  await page.goto(`${BASE}/order.html?checkout=cancelled`, { waitUntil: 'domcontentloaded' });
  await T(page, 1200);
  const st = await page.evaluate(() => ({
    status: document.getElementById('status')?.textContent || '',
    statusShown: document.getElementById('status')?.classList.contains('visible'),
    pending: !!localStorage.getItem('muggshotz_pending_order'),
    submitDisabled: document.getElementById('submitBtn')?.disabled,
  }));
  if (!st.pending)
    return 'FAIL: cancelling the payment threw away the design — the customer has to start over';
  if (!/cancelled|canceled/i.test(st.status) || !st.statusShown)
    return `FAIL: no cancellation message shown (status="${st.status}")`;
  if (st.submitDisabled)
    return 'FAIL: submit is locked after a cancel — they cannot simply try again';
  return 'PASS: a cancelled payment keeps the design, says so, and leaves the button ready';
};

// ---- 4. The full submit, wire-tapped. ----
// Drives order.html's real submitOrder() for a wraparound mug and reads the
// exact body that would reach create-checkout-session. The harness stubs the
// endpoint, so no session is created and nothing can be charged.
scenarios.submitSendsTheWholeOrder = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('muggshotz_pending_order', JSON.stringify({
      placements: { left: 'https://example.com/l.png', front: 'https://example.com/f.png', right: 'https://example.com/r.png' },
      panoramaImage: 'https://example.com/whole-strip.png',
      deviceId: 'test-dev', productIcon: 'mug', mugPrintMode: 'wraparound',
      isWraparoundSet: true,
      preselectedMugStyle: 'Trimmed', preselectedMugSize: '11oz', preselectedMugColor: 'Black'
    }));
  });
  const bodies = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/create-checkout-session')) {
      try { bodies.push(r.postDataJSON()); } catch (e) {}
    }
  });
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 1500);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com');
    set('phone', '5555550100'); set('address1', '123 Test St');
    set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    const toggle = document.getElementById('giftMessageToggle');
    if (toggle) { toggle.checked = true; toggle.dispatchEvent(new Event('change')); }
    const gm = document.getElementById('giftMessageText');
    if (gm) gm.value = 'Happy birthday, from the test suite';
    giftMessageEnabled = true;
    submitOrder();
  });
  await T(page, 2500);

  const b = bodies[bodies.length - 1];
  if (!b) return 'FAIL: submitOrder never called /api/create-checkout-session';
  const bad = [];
  if (b.type !== 'mug_order') bad.push(`type=${b.type}`);
  if (b.printMode !== 'fullBleed') bad.push(`printMode=${b.printMode} for a wraparound`);
  if (b.panoramaImage !== 'https://example.com/whole-strip.png') bad.push('panoramaImage missing from the paid order');
  if (!b.isWraparoundSet) bad.push('isWraparoundSet lost — the $3 wrap surcharge would not apply');
  if (b.giftMessage !== 'Happy birthday, from the test suite') bad.push('gift message text not in the body');
  if (!b.shippingAddress || b.shippingAddress.zip !== '48185') bad.push('shipping address incomplete');
  if (bad.length) return `FAIL: the payment body is missing pieces — ${bad.join('; ')}`;
  return 'PASS: the real submit carries design, panorama, wrap surcharge, gift text and address intact';
};

// ---- 5. The insulated 40oz — Alyx's first live order — arrives whole. ----
// Front/back split art, preselected cup and colour. The studio now sends the
// cup's identity across the hop and the order page honours it through the
// same pick functions a tap uses -- so this scenario makes NO manual picks:
// if the preselection fails, submit blocks with "Please pick which travel
// mug" and this fails with it.
scenarios.insulated40ozArrivesPreselected = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('muggshotz_pending_order', JSON.stringify({
      placements: { left: 'https://example.com/front-half.png', front: null, right: 'https://example.com/back-half.png' },
      deviceId: 'test-dev', productIcon: 'water bottle',
      preselectedTravelKey: 'travel-mug-40oz-insulated',
      preselectedTravelColor: 'Black'
    }));
  });
  const bodies = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/create-checkout-session')) {
      try { bodies.push(r.postDataJSON()); } catch (e) {}
    }
  });
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 1800);
  const pre = await page.evaluate(() => ({
    key: selectedTravelProductKey, colour: selectedTravelColor,
  }));
  if (pre.key !== 'travel-mug-40oz-insulated')
    return `FAIL: the studio's cup choice did not survive the hop (selected=${pre.key}) — the customer must re-pick, and can pick wrong`;
  if (pre.colour !== 'Black')
    return `FAIL: the colour did not survive (${pre.colour})`;

  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Alyx Tester'); set('email', 'alyx@example.com');
    set('address1', '123 Test St'); set('city', 'Westland');
    set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2500);
  const b = bodies[bodies.length - 1];
  if (!b) return 'FAIL: submit never reached create-checkout-session';
  const bad = [];
  if (b.productKey !== 'travel-mug-40oz-insulated') bad.push(`productKey=${b.productKey}`);
  if (b.colorName !== 'Black') bad.push(`colorName=${b.colorName}`);
  if (b.frontImage !== 'https://example.com/front-half.png') bad.push('frontImage wrong or missing');
  if (b.backImage !== 'https://example.com/back-half.png') bad.push('backImage wrong or missing');
  if (b.sizeLabel !== '40oz') bad.push(`sizeLabel=${b.sizeLabel}`);
  if (bad.length) return `FAIL: the 40oz order body is wrong — ${bad.join('; ')}`;
  return 'PASS: the insulated 40oz arrives preselected, and its front/back halves reach the payment intact';
};


(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    if (fn.length === 0) {
      const result = await fn();
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
      continue;
    }
    const { browser, page, log } = await launch();
    try {
      const result = await fn(page, log);
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
  console.log(fails === 0 ? '\nALL CHECKOUT-WIRING VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
