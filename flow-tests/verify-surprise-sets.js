// THE SURPRISE!!! HOLIDAY SETS (Alyx, 26 Sep 2026: "a set of four different
// themes. Each one is a different scene but they're all a part of the same
// set"; $59.95). What this pins:
//   * the studio's copy of the sets, and the order page's, match the server's
//     (lib/surprise-sets.js), and both prices match the catalog's set price;
//   * every design has both prints at the mug's 2475 x 1155, its COLD -> HOT
//     picture and its tile, and every set has its tile; each right-handed
//     print's LEFT half is its tile (the punchline, as for the singles);
//   * the set sits in the SURPRISE!!! panel with its picture and price;
//     picking it shows its four mugs cold then hot, and hands the set and the
//     hand to the order page, which shows the four, prices the set, asks
//     Printify for no mockup, and checks out smart-mug-set / Set of 4 with
//     the set and the hand -- and no artwork of its own.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const ROOT = path.join(__dirname, '..');
const T = (page, ms) => page.waitForTimeout(ms);
const tap = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, sel);

async function toSurprise(page) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await tap(page, '#productCard .btn-select[data-val="mug"]');
  await T(page, 1200);
  await dismissAlerts(page);
  await tap(page, '#preGenSizeSmartBtn');
  await T(page, 1500);
}

// Every const NAME = {...} or number, read out of a page's source.
function pageConst(src, name) {
  const m = new RegExp('const ' + name + '\\s*=\\s*').exec(src);
  if (!m) throw new Error(`no const ${name}`);
  let i = m.index + m[0].length;
  if (/[\d.]/.test(src[i])) return parseFloat(src.slice(i));
  let depth = 0; const start = i;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return Function('return (' + src.slice(start, i + 1) + ')')();
}

const scenarios = {};

scenarios.theThreeListsAndTheFiles = async (page) => {
  const { SURPRISE_SETS } = await import(pathToFileURL(path.join(ROOT, 'lib', 'surprise-sets.js')).href);
  const { PRODUCTS_CATALOG } = await import(pathToFileURL(path.join(ROOT, 'lib', 'products-catalog.js')).href);
  const studio = fs.readFileSync(path.join(ROOT, 'needles-studio.html'), 'utf8');
  const order = fs.readFileSync(path.join(ROOT, 'order.html'), 'utf8');
  const price = PRODUCTS_CATALOG['smart-mug-set'].sizes['Set of 4'].price;
  const bad = [];
  if (pageConst(studio, 'SMART_MUG_SET_PRICE') !== price) bad.push(`the studio's set price is not the catalog's $${price}`);
  if (pageConst(order, 'SMART_MUG_SET_PRICE') !== price) bad.push(`the order page's set price is not the catalog's $${price}`);
  const live = Object.entries(SURPRISE_SETS).filter(([, s]) => s.live);
  const studioSets = pageConst(studio, 'SURPRISE_SETS'), orderLabels = pageConst(order, 'SURPRISE_SET_LABELS');
  if (JSON.stringify(Object.keys(studioSets).sort()) !== JSON.stringify(live.map(([k]) => k).sort())) bad.push(`the studio offers ${Object.keys(studioSets)}, the server sells ${live.map(([k]) => k)}`);
  for (const [k, s] of live) {
    if (orderLabels[k] !== s.label) bad.push(`${k}: the order page calls it ${orderLabels[k]}`);
    const mine = (studioSets[k] || {}).designs || [];
    if (JSON.stringify(mine.map((d) => [d.label, d.file])) !== JSON.stringify(s.designs.map((d) => [d.label, d.file]))) bad.push(`${k}: the studio's designs differ from the server's`);
    if (s.designs.length !== 4) bad.push(`${k} has ${s.designs.length} designs, not 4`);
    if (!fs.existsSync(path.join(ROOT, 'art', 'options', `surprise-set-${k}.jpg`))) bad.push(`${k} has no set tile`);
  }
  // The files, measured in the page (the browser reads the PNGs).
  await page.goto('http://127.0.0.1:8788/needles-studio.html');
  const files = live.flatMap(([, s]) => s.designs.map((d) => d.file));
  const measured = await page.evaluate(async (files) => {
    const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = u; });
    const tiny = (im, sx, sy, sw, sh) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.drawImage(im, sx, sy, sw, sh, 0, 0, 32, 32); return g.getImageData(0, 0, 32, 32).data; };
    const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d; };
    const out = [];
    for (const f of files) {
      const p = await load(`/art/surprise/${f}-print.png`), l = await load(`/art/surprise/${f}-print-left.png`);
      const c = await load(`/art/surprise/${f}-coldhot.jpg`), t = await load(`/art/options/surprise-${f}.jpg`);
      const row = { f, print: p && `${p.naturalWidth}x${p.naturalHeight}`, left: l && `${l.naturalWidth}x${l.naturalHeight}`, coldhot: !!c, tile: !!t };
      if (p && t) { const w = p.naturalWidth / 2, h = p.naturalHeight, tt = tiny(t, 0, 0, t.naturalWidth, t.naturalHeight);
        row.punchlineLeft = diff(tiny(p, (w - h) / 2, 0, h, h), tt) < diff(tiny(p, w + (w - h) / 2, 0, h, h), tt); }
      out.push(row);
    }
    return out;
  }, files);
  for (const r of measured) {
    if (r.print !== '2475x1155' || r.left !== '2475x1155') bad.push(`${r.f}: prints ${r.print} / ${r.left}`);
    if (!r.coldhot || !r.tile) bad.push(`${r.f}: COLD -> HOT ${r.coldhot}, tile ${r.tile}`);
    if (!r.punchlineLeft) bad.push(`${r.f}: the right-handed print's punchline is not on its left half`);
  }
  return bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: ${live.length} set(s) of four, the same on the server, the studio and the order page at $${price}; ${files.length} designs each with both prints at 2475 x 1155, COLD -> HOT and tile, punchline on the left`;
};

scenarios.thePanelAndTheOrder = async (page, log) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 16.14, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
  await toSurprise(page);
  const tile = await page.evaluate(() => {
    const t = document.querySelector('#surpriseTemplateGrid .btn-select[data-surprise-set="thanksgiving"]');
    const im = t && t.querySelector('img');
    return t && { text: t.innerText, pic: !!im && im.naturalWidth > 0, first: t === t.parentElement.firstElementChild };
  });
  if (!tile) return 'FAIL: no Thanksgiving set in the SURPRISE!!! panel';
  if (!tile.pic || !/\$59\.95/.test(tile.text) || !/Thanksgiving Set/.test(tile.text)) return `FAIL: the set tile reads ${JSON.stringify(tile)}`;
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise-set="thanksgiving"]');
  await tap(page, '#surpriseHandGrid .btn-select[data-hand="left"]');
  await T(page, 1500);
  const pv = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('#surpriseSetPreview img')];
    await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
    const b = document.getElementById('surpriseContinueBtn').getBoundingClientRect();
    return { n: imgs.length, ok: imgs.filter((im) => im.naturalWidth > 0).length, flat: getComputedStyle(document.getElementById('surprisePreview')).display,
      single: getComputedStyle(document.getElementById('surpriseColdHot')).display, selected: document.querySelectorAll('#surpriseTemplateGrid .btn-select.selected').length,
      btnOnScreen: b.top >= 0 && b.bottom <= innerHeight + 2 };
  });
  if (pv.n !== 4 || pv.ok !== 4) return `FAIL: the set shows ${pv.ok} of ${pv.n} COLD -> HOT pictures`;
  if (pv.flat !== 'none' || pv.single !== 'none') return 'FAIL: the single print or its picture still shows beside the set';
  if (pv.selected !== 1) return `FAIL: ${pv.selected} tiles are lit`;
  if (!pv.btnOnScreen) return 'FAIL: after picking, the Continue button is off screen';
  // A single template clears the set, and back again.
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise="proposal"]');
  await T(page, 600);
  const back = await page.evaluate(() => ({ set: selectedSurpriseSet, setBox: getComputedStyle(document.getElementById('surpriseSetPreview')).display, flat: getComputedStyle(document.getElementById('surprisePreview')).display }));
  if (back.set !== null || back.setBox !== 'none' || back.flat === 'none') return `FAIL: picking a single mug left the set up (${JSON.stringify(back)})`;
  await tap(page, '#surpriseTemplateGrid .btn-select[data-surprise-set="thanksgiving"]');
  await T(page, 900);
  log.apiCalls.length = 0;
  await Promise.all([page.waitForURL(/order\.html/, { timeout: 10000 }), tap(page, '#surpriseContinueBtn')]);
  await T(page, 3500);
  const st = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('#smartMugSetPictures img')];
    await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
    return {
      pending: JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'),
      card: getComputedStyle(document.getElementById('smartMugCard')).display,
      title: document.getElementById('smartMugCardTitle').textContent,
      note: document.getElementById('smartMugChoiceNote').textContent,
      pics: imgs.filter((im) => im.naturalWidth > 0).length,
      base: document.getElementById('summaryBase').textContent,
      head: document.getElementById('orderHeadlineName').textContent,
    };
  });
  if (!st.pending || st.pending.surpriseSet !== 'thanksgiving' || st.pending.preselectedSurpriseHand !== 'left') return `FAIL: the hand-off carried ${JSON.stringify(st.pending)}`;
  if (st.card === 'none' || !/Thanksgiving Set/.test(st.title)) return `FAIL: the order page's card is "${st.title}" (${st.card})`;
  if (!/left-handed/.test(st.note) || !/\$59\.95/.test(st.note)) return `FAIL: the card says "${st.note}"`;
  if (st.pics !== 4) return `FAIL: the order page shows ${st.pics} of the four mugs`;
  if (st.base !== '$59.95') return `FAIL: the order page prices the set at ${st.base}`;
  if (st.head !== 'SURPRISE!!! Thanksgiving Set') return `FAIL: the order is headed "${st.head}"`;
  if (log.apiCalls.some((c) => c.path === '/api/start-mockup')) return 'FAIL: the order page asked Printify for a mockup of a set';
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== 'smart-mug-set' || b.sizeLabel !== 'Set of 4' || b.setKey !== 'thanksgiving' || b.hand !== 'left' || b.image)
    return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, set: b.setKey, hand: b.hand, image: b.image })}`;
  return 'PASS: the Thanksgiving set leads the SURPRISE!!! panel with its picture and $59.95; picked left-handed it shows its four mugs cold then hot, a single mug clears it, and the order page shows the four, prices the set, asks for no mockup, and checks out smart-mug-set / Set of 4 / thanksgiving / left with no artwork of its own';
};

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } })) {
    for (const [name, fn] of Object.entries(scenarios)) {
      if (name === 'theThreeListsAndTheFiles' && screen === 'phone') continue; // files, not layout
      const { browser, page, log } = await launch({ viewport });
      let result;
      try { result = await fn(page, log); }
      catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
      console.log(`[${screen}] [${name}] ${result}`);
      if (!/^PASS/.test(result)) fails++;
      if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
      await browser.close();
    }
  }
  console.log(fails === 0 ? '\nALL HOLIDAY-SET VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
