// SURPRISE!!! -- THE SMART MUG (Alyx, 23 Sep 2026). A fourth tile on Coffee
// Mug Size opens its own panel: the templates (finished prints, nothing
// painted), right- or left-handed, a preview, and on to the order page, where
// Printify's mockup of that print on the Color Morphing Mug is shown and the
// order is taken. What this pins:
//   * the tile sits with 11oz / 15oz / 20oz, with its picture and price;
//   * the panel passes the checklist: name, Back, pictures, prices, landing;
//   * Back goes to Coffee Mug Size and nowhere else;
//   * left-handed sends the swapped print; every print is 2475 x 1155;
//   * the order page prices it, asks Printify for the smart-mug mockup, and
//     checks out smart-mug / 11oz with the chosen print;
//   * Generate paints nothing for a template.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const BASE = 'http://127.0.0.1:8788';
const tap = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, sel);
const vis = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; }, id);

async function toMugSize(page) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await tap(page, '#productCard .btn-select[data-val="mug"]');
  await T(page, 1200);
  await dismissAlerts(page);
}

const scenarios = {};

scenarios.theTileAndThePanel = async (page, log) => {
  await toMugSize(page);
  if (!(await vis(page, 'mugSizeLockOverlay'))) return 'FAIL: Coffee Mug Size did not open';
  const tile = await page.evaluate(() => {
    const t = document.getElementById('preGenSizeSmartBtn');
    const img = t && t.querySelector('img');
    return t && { text: t.innerText, img: !!img && img.complete && img.naturalWidth > 0, price: /\$\d/.test(t.innerText),
      siblings: [...t.parentElement.querySelectorAll('.btn-select')].length };
  });
  if (!tile) return 'FAIL: no Smart Mug tile on Coffee Mug Size';
  if (tile.siblings !== 4) return `FAIL: Coffee Mug Size has ${tile.siblings} tiles, not 4`;
  if (!tile.img || !tile.price) return `FAIL: the Smart Mug tile lacks its picture or price (${JSON.stringify(tile)})`;
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1900);
  const st = await page.evaluate(() => {
    const card = document.getElementById('surpriseCard'); const r = card.getBoundingClientRect();
    const tiles = [...card.querySelectorAll('.btn-select')].filter((t) => !t.closest('[data-words]'));
    return {
      product, overlay: getComputedStyle(document.getElementById('mugSizeLockOverlay')).display,
      shown: getComputedStyle(card).display !== 'none', focus: [...document.body.classList].filter((c) => c.endsWith('-focus')),
      title: card.querySelector('.card-title')?.innerText, back: [...card.querySelectorAll('button')].some((b) => /back/i.test(b.innerText)),
      tiles: tiles.length, pics: tiles.filter((t) => t.querySelector('img')?.naturalWidth > 0).length, prices: tiles.filter((t) => /\$\d/.test(t.innerText)).length,
      inView: r.height <= innerHeight * 0.9 ? (r.top >= -2 && r.bottom <= innerHeight + 2) : (r.top >= -2 && r.top < innerHeight * 0.25),
    };
  });
  if (st.product !== 'smart mug' || !st.shown) return `FAIL: the tile did not open the SURPRISE!!! panel (${JSON.stringify(st)})`;
  if (st.overlay !== 'none') return 'FAIL: Coffee Mug Size stayed open over the panel';
  if (st.focus.join() !== 'surprise-focus') return `FAIL: the lit panel is ${st.focus.join()}`;
  if (!/SURPRISE/.test(st.title || '') || !st.back) return 'FAIL: the panel lacks its name or Back';
  if (st.tiles < 2 || st.pics !== st.tiles || st.prices !== st.tiles) return `FAIL: ${st.tiles} templates, ${st.pics} with pictures, ${st.prices} with prices`;
  if (!st.inView) return 'FAIL: the panel did not land on screen';
  // Generate paints nothing here.
  log.apiCalls.length = 0;
  await page.evaluate(() => generate());
  await T(page, 800);
  if (log.apiCalls.some((c) => c.path === '/api/generate')) return 'FAIL: Generate painted over a finished template';
  return `PASS: the Smart Mug tile sits fourth on Coffee Mug Size with its picture and price, and opens a lit SURPRISE!!! panel of ${st.tiles} templates, each with a picture and price; Generate paints nothing`;
};

scenarios.backIsCoffeeMugSize = async (page) => {
  await toMugSize(page);
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1500);
  await tap(page, '#surpriseCard button[onclick="surpriseBack()"]');
  await T(page, 1200);
  const st = await page.evaluate(() => ({ product, overlay: getComputedStyle(document.getElementById('mugSizeLockOverlay')).display,
    card: getComputedStyle(document.getElementById('surpriseCard')).display, focus: [...document.body.classList].filter((c) => c.endsWith('-focus')) }));
  if (st.card !== 'none') return 'FAIL: Back left the SURPRISE!!! panel up';
  if (st.product !== 'mug' || st.overlay !== 'flex') return `FAIL: Back did not return to Coffee Mug Size (${JSON.stringify(st)})`;
  if (st.focus.length) return `FAIL: Back left a spotlight on: ${st.focus}`;
  // And forward again works.
  await tap(page, '#preGenSize11Btn');
  await T(page, 900);
  const sized = await page.evaluate(() => ({ product, size: selectedGenSize }));
  if (sized.product !== 'mug' || sized.size !== '11oz') return 'FAIL: after Back, the ordinary 11oz could not be picked';
  return 'PASS: Back from SURPRISE!!! returns to Coffee Mug Size, where an ordinary mug can still be picked';
};

scenarios.leftHandedAndThePrints = async (page) => {
  await toMugSize(page);
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1500);
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise="valentine"]');
  await tap(page, '#surpriseHandGrid .btn-select[data-hand="left"]');
  await T(page, 1200);
  // Picking lands on the preview and its Continue button.
  const land = await page.evaluate(() => { const r = document.getElementById('surpriseContinueBtn').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), H: innerHeight }; });
  if (land.top < 0 || land.bottom > land.H + 2) return `FAIL: after picking, the Continue button is off screen (${JSON.stringify(land)})`;
  const src = await page.evaluate(() => document.getElementById('surprisePreview').src);
  if (!/\/art\/surprise\/valentine-print-left\.png$/.test(src)) return `FAIL: left-handed previews ${src}`;
  const sizes = await page.evaluate(async () => {
    const out = {};
    const files = Object.values(SURPRISE_TEMPLATES).flatMap((t) => t.variants ? Object.values(t.variants).map((v) => v.file) : [t.file]);
    for (const f of files) for (const h of ['', '-left']) {
      const u = '/art/surprise/' + f + '-print' + h + '.png';
      const im = await loadImageFromUrl(u); out[u] = im.naturalWidth + 'x' + im.naturalHeight;
    }
    return out;
  });
  const bad = Object.entries(sizes).filter(([, v]) => v !== '2475x1155');
  if (bad.length) return `FAIL: prints not at the mug's 2475 x 1155: ${JSON.stringify(bad)}`;
  // RIGHT-HANDED FACES THE OPENER TO THE HOLDER (Alyx, 24 Sep 2026): held by
  // the handle in the right hand, the side facing the drinker is the print's
  // right half, so that is where the opener goes and the punchline is on the
  // left. The template's tile shows its punchline: in every right-handed
  // print it must look like the LEFT half, not the right.
  const sides = await page.evaluate(async () => {
    const tiny = (im, sx, sy, sw, sh) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.drawImage(im, sx, sy, sw, sh, 0, 0, 32, 32); return g.getImageData(0, 0, 32, 32).data; };
    const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d; };
    const wrong = [];
    const files = Object.values(SURPRISE_TEMPLATES).flatMap((t) => t.variants ? Object.values(t.variants).map((v) => v.file) : [t.file]);
    for (const f of files) {
      const p = await loadImageFromUrl('/art/surprise/' + f + '-print.png'), t = await loadImageFromUrl('/art/options/surprise-' + f + '.jpg');
      const w = p.naturalWidth / 2, h = p.naturalHeight, tt = tiny(t, 0, 0, t.naturalWidth, t.naturalHeight);
      const L = diff(tiny(p, (w - h) / 2, 0, h, h), tt), R = diff(tiny(p, w + (w - h) / 2, 0, h, h), tt);
      if (!(L < R)) wrong.push(f);
    }
    return wrong;
  });
  if (sides.length) return `FAIL: these right-handed prints have the punchline on the right, facing the holder: ${sides.join(', ')}`;
  // Every template, and every choice of Ready?'s other side, shows its own
  // COLD -> HOT picture, and it loads.
  const coldhot = await page.evaluate(async () => {
    const bad = [], seen = [];
    const loaded = async () => { const im = document.getElementById('surpriseColdHot'); if (getComputedStyle(im).display === 'none') return null; await (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })); return im.naturalWidth ? im.getAttribute('src') : null; };
    for (const [k, t] of Object.entries(SURPRISE_TEMPLATES)) {
      if (t.hidden) continue;
      pickSurprise(k);
      for (const v of (t.variants ? Object.keys(t.variants) : [null])) {
        if (v) pickSurpriseVariant(v);
        const want = 'art/surprise/' + (v ? t.variants[v].file : t.file) + '-coldhot.jpg';
        const got = await loaded(); seen.push(want);
        if (got !== want) bad.push(`${k}${v ? '/' + v : ''} shows ${got}`);
      }
    }
    return { bad, n: seen.length };
  });
  if (coldhot.bad.length) return `FAIL: COLD -> HOT pictures wrong or missing: ${coldhot.bad.join('; ')}`;
  return `PASS: left-handed swaps to the -left print; all ${Object.keys(sizes).length} prints are 2475 x 1155; every right-handed print faces its opener to the holder; all ${coldhot.n} COLD -> HOT pictures show and load`;
};

// "Ready?" is one opener; the customer picks its other side, and nothing is
// previewed or ordered until they have.
scenarios.readyAndItsOtherSide = async (page) => {
  await toMugSize(page);
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1500);
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise="ready"]');
  await T(page, 1200);
  if (!(await vis(page, 'surpriseVariantWrap'))) return 'FAIL: picking Ready? offers no choice of the other side';
  if (await vis(page, 'surprisePreviewWrap')) return 'FAIL: Ready? previews before its other side is chosen';
  const tiles = await page.evaluate(() => [...document.querySelectorAll('#surpriseVariantGrid .btn-select')].map((b) => ({ k: b.dataset.variant, img: !!b.querySelector('img')?.naturalWidth, price: /\$\d/.test(b.innerText) })));
  if (tiles.map((t) => t.k).join() !== 'boy,girl,twins,twin-boys,twin-girls,expecting') return `FAIL: the other side offers ${tiles.map((t) => t.k).join()}`;
  if (tiles.some((t) => !t.img || !t.price)) return `FAIL: a variant tile is missing its picture or price: ${JSON.stringify(tiles)}`;
  const land = await page.evaluate(() => { const r = document.getElementById('surpriseVariantGrid').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), H: innerHeight }; });
  if (land.top < 0 || land.bottom > land.H + 2) return `FAIL: picking Ready? does not land on the choice of other side (${JSON.stringify(land)})`;
  const want = { boy: 'reveal-boy', girl: 'reveal-girl', twins: 'reveal-twins', 'twin-boys': 'reveal-twin-boys', 'twin-girls': 'reveal-twin-girls', expecting: 'ready-expecting' };
  for (const [k, f] of Object.entries(want)) {
    await tap(page, `#surpriseVariantGrid .btn-select[data-variant="${k}"]`);
    await T(page, 1200);
    const src = await page.evaluate(() => document.getElementById('surprisePreview').src);
    if (!src.endsWith(`/art/surprise/${f}-print.png`)) return `FAIL: Ready? / ${k} previews ${src}`;
    const c = await page.evaluate(() => { const r = document.getElementById('surpriseContinueBtn').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), H: innerHeight }; });
    if (c.top < 0 || c.bottom > c.H + 2) return `FAIL: after picking ${k}, Continue is off screen (${JSON.stringify(c)})`;
  }
  // Another template drops the choice; coming back to Ready? asks again.
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise="apology"]');
  await T(page, 900);
  if (await vis(page, 'surpriseVariantWrap')) return 'FAIL: the other-side choice stays up for The Apology';
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise="ready"]');
  await T(page, 900);
  if (await vis(page, 'surprisePreviewWrap')) return 'FAIL: returning to Ready? previews a side nobody picked';
  await tap(page, '#surpriseVariantGrid .btn-select[data-variant="expecting"]');
  await tap(page, '#surpriseHandGrid .btn-select[data-hand="left"]');
  await T(page, 900);
  await Promise.all([page.waitForURL(/order\.html/, { timeout: 10000 }), tap(page, '#surpriseContinueBtn')]);
  await T(page, 3000);
  const st = await page.evaluate(() => ({
    pending: JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'),
    note: document.getElementById('smartMugChoiceNote').textContent,
  }));
  if (!st.pending.placements.left.endsWith('/art/surprise/ready-expecting-print-left.png')) return `FAIL: the hand-off print is ${st.pending.placements.left}`;
  if (!/Ready\? \/ Any preference\?/.test(st.note) || !/left-handed/.test(st.note)) return `FAIL: the order card says "${st.note}"`;
  return 'PASS: Ready? asks for its other side (boy, girl, three twins, Any preference?; pictured and priced), previews each, and orders "Ready? / Any preference?" left-handed';
};

// Alyx's own mug is hidden: not in the panel, unless the link names it,
// and then it orders like any other.
scenarios.hiddenTemplate = async (page) => {
  await toMugSize(page);
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1500);
  if (await page.evaluate(() => !!document.querySelector('#surpriseTemplateGrid .btn-select[data-surprise="i-know"]'))) return 'FAIL: the hidden mug shows in the panel without its link';
  await page.goto(page.url().split('?')[0] + '?surprise=i-know', { waitUntil: 'domcontentloaded' });
  await T(page, 800);
  await uploadPhoto(page); await dismissAlerts(page);
  await toMugSize(page);
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1500);
  const tile = await page.evaluate(() => { const t = document.querySelector('#surpriseTemplateGrid .btn-select[data-surprise="i-know"]'); return t && { img: !!t.querySelector('img')?.naturalWidth, price: /\$\d/.test(t.innerText) }; });
  if (!tile) return 'FAIL: the link ?surprise=i-know does not show the hidden mug';
  if (!tile.img || !tile.price) return `FAIL: the hidden mug's tile is missing its picture or price ${JSON.stringify(tile)}`;
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise="i-know"]');
  await T(page, 1200);
  await Promise.all([page.waitForURL(/order\.html/, { timeout: 10000 }), tap(page, '#surpriseContinueBtn')]);
  await T(page, 3000);
  const st = await page.evaluate(() => ({ left: JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null')?.placements?.left, note: document.getElementById('smartMugChoiceNote').textContent }));
  if (!st.left || !st.left.endsWith('/art/surprise/i-know-print.png')) return `FAIL: the hand-off print is ${st.left}`;
  if (!/I Don't Know, But I Know/.test(st.note)) return `FAIL: the order card says "${st.note}"`;
  return 'PASS: the hidden mug is not in the panel; its link shows it, pictured and priced, and it orders as "I Don\'t Know, But I Know"';
};

scenarios.theOrderPage = async (page, log) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 6.9, shippingSeparate: true, source: 'live' } }));
  await toMugSize(page);
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1500);
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise="congratulations"]');
  await T(page, 900);
  const price = await page.evaluate(() => SMART_MUG_PRICE);
  await Promise.all([page.waitForURL(/order\.html/, { timeout: 10000 }), tap(page, '#surpriseContinueBtn')]);
  await T(page, 3500);
  const st = await page.evaluate(() => ({
    pending: JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'),
    card: getComputedStyle(document.getElementById('smartMugCard')).display,
    note: document.getElementById('smartMugChoiceNote').textContent,
    base: document.getElementById('summaryBase').textContent,
  }));
  if (!st.pending || st.pending.productIcon !== 'smart mug') return `FAIL: the hand-off carried ${JSON.stringify(st.pending)}`;
  if (!/\/art\/surprise\/congratulations-print\.png$/.test(st.pending.placements.left)) return `FAIL: the hand-off print is ${st.pending.placements.left}`;
  if (st.card === 'none') return 'FAIL: the order page shows no SURPRISE!!! card';
  if (!/Congratulations/.test(st.note) || !/right-handed/.test(st.note)) return `FAIL: the card says "${st.note}"`;
  const oc = await page.evaluate(async () => { const im = document.getElementById('smartMugColdHot'); if (getComputedStyle(im).display === 'none') return null; await (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })); return im.naturalWidth ? im.getAttribute('src') : 'broken'; });
  if (!oc || !oc.endsWith('art/surprise/congratulations-coldhot.jpg')) return `FAIL: the order page's COLD -> HOT picture is ${oc}`;
  const head = await page.evaluate(() => document.getElementById('orderHeadlineName').textContent);
  if (head !== 'SURPRISE!!! Smart Mug') return `FAIL: the order is headed "${head}"`;
  if (st.base !== '$' + price.toFixed(2)) return `FAIL: the order page prices it at ${st.base}, not $${price.toFixed(2)}`;
  const start = log.apiCalls.find((c) => c.path === '/api/start-mockup' && c.action === 'start');
  if (!start) return 'FAIL: the order page asked Printify for no mockup';
  if (start.body.productKey !== 'smart-mug' || start.body.sizeLabel !== '11oz' || start.body.image !== st.pending.placements.left)
    return `FAIL: the mockup asked for ${start.body.productKey} / ${start.body.sizeLabel} / ${start.body.image}`;
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== 'smart-mug' || b.sizeLabel !== '11oz' || b.image !== st.pending.placements.left)
    return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, i: b.image })}`;
  return `PASS: Continue hands the Congratulations print to the order page, which shows it for a right-handed recipient at ${st.base}, fetches the smart-mug mockup, and checks out smart-mug / 11oz`;
};

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } })) {
    for (const [name, fn] of Object.entries(scenarios)) {
      const { browser, page, log } = await launch({ viewport });
      let result;
      try { await openStudio(page); await uploadPhoto(page); await dismissAlerts(page); result = await fn(page, log); }
      catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
      console.log(`[${screen}] [${name}] ${result}`);
      if (!/^PASS/.test(result)) fails++;
      if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
      await browser.close();
    }
  }
  console.log(fails === 0 ? '\nALL SMART-MUG VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
