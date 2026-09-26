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

// The Premades card as it stands: which view, its title, Back, pictures
// (and how many loaded), steps, and whether it landed with its title on screen.
const pmState = (page) => page.evaluate(async () => {
  const card = document.getElementById('premadesCard'), r = card.getBoundingClientRect();
  const imgs = [...card.querySelectorAll('img')].filter((im) => im.offsetParent);
  await Promise.all(imgs.map((im) => im.complete ? null : new Promise((res) => { im.onload = im.onerror = res; })));
  return { shown: getComputedStyle(card).display !== 'none', view: premadesView, focus: [...document.body.classList].filter((c) => c.endsWith('-focus')).join(),
    title: card.querySelector('.card-title').innerText, back: [...card.querySelectorAll('button')].some((b) => b.offsetParent && /back/i.test(b.innerText)),
    text: card.innerText, imgs: imgs.length, loaded: imgs.filter((im) => im.naturalWidth > 0).length, steps: card.querySelectorAll('.pm-step').length,
    top: Math.round(r.top), landed: r.top > -2 && r.top < innerHeight * 0.3 };
});


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
  // The sets live in their own category now, not in the SURPRISE!!! panel.
  await toSurprise(page);
  if (await page.evaluate(() => !!document.querySelector('#surpriseTemplateGrid [data-surprise-set], #surpriseTemplateGrid [data-premade-set]'))) return 'FAIL: a set is still in the SURPRISE!!! panel';
  await page.evaluate(() => surpriseBack());
  await T(page, 900);
  // The tile: last on the grid, with its price.
  // Next to last: Pitch In ends the grid (Alyx's last row: Artwork Only, Gift
  // Certificate, Premades & Sets, Pitch In).
  const tile = await page.evaluate(() => { const t = document.getElementById('premadesTile'); return t && { text: t.innerText, last: t.nextElementSibling === document.getElementById('pitchInTile') && t.nextElementSibling === t.parentElement.lastElementChild }; });
  if (!tile || !tile.last || !/Premades & Sets/.test(tile.text) || !/\$19\.95/.test(tile.text)) return `FAIL: the Premades & Sets tile reads ${JSON.stringify(tile)}`;
  await tap(page, '#premadesTile');
  await T(page, 1900);
  // The list: quiet on purpose (no pictures), but named, priced, with Back,
  // lit, and landed with its title and first occasion on screen.
  const st0 = await pmState(page);
  if (!st0.shown || st0.focus !== 'premades-focus' || st0.view !== 'occasions') return `FAIL: the tile did not open the lit occasions list (${JSON.stringify(st0)})`;
  if (!/Premades/i.test(st0.title) || !st0.back || !/\$59\.95/.test(st0.text) || !/\$19\.95/.test(st0.text)) return `FAIL: the list lacks its name, Back or prices (${JSON.stringify(st0)})`;
  if (st0.imgs) return `FAIL: the quiet list shows ${st0.imgs} picture(s)`;
  if (!st0.landed) return `FAIL: the list did not land at its title (${JSON.stringify(st0)})`;
  // Thanksgiving: its flyer alone, the set, one button.
  await tap(page, '#premadesView .pm-row[data-occasion="thanksgiving"]'); await T(page, 1900);
  const st1 = await pmState(page);
  if (st1.view !== 'occasion' || st1.imgs !== 1 || st1.loaded !== 1 || !/\$59\.95/.test(st1.text) || !st1.landed) return `FAIL: Thanksgiving did not open on its flyer alone (${JSON.stringify(st1)})`;
  // How it works: seven steps, the hand, Order the set.
  await tap(page, '#premadesSetBtn'); await T(page, 1900);
  const st2 = await pmState(page);
  if (st2.view !== 'how' || st2.steps !== 7 || st2.imgs !== 5 || st2.loaded !== 5 || !st2.landed || !/How the magic mug works/i.test(st2.title)) return `FAIL: How it works shows ${JSON.stringify(st2)}`;
  // Back, one view at a time: How it works -> the flyer -> the list -> the grid.
  for (const want of ['occasion', 'occasions']) {
    await page.evaluate(() => premadesBack()); await T(page, 1500);
    const b = await pmState(page); if (b.view !== want || !b.landed) return `FAIL: Back went to ${b.view}, not ${want} (${JSON.stringify(b)})`;
  }
  await page.evaluate(() => premadesBack());
  await T(page, 1900);
  const bk = await page.evaluate(() => { const r = document.getElementById('productCard').getBoundingClientRect();
    return { card: getComputedStyle(document.getElementById('premadesCard')).display, focus: [...document.body.classList].filter((c) => c.endsWith('-focus')), top: Math.round(r.top) }; });
  if (bk.card !== 'none' || bk.focus.length || bk.top < -2 || bk.top > 200) return `FAIL: Back did not return to the product grid (${JSON.stringify(bk)})`;
  // And forward again, to the order page, left-handed.
  await tap(page, '#premadesTile'); await T(page, 1500);
  await tap(page, '#premadesView .pm-row[data-occasion="thanksgiving"]'); await T(page, 900);
  await tap(page, '#premadesSetBtn'); await T(page, 900);
  await tap(page, '#premadesHandGrid .btn-select[data-hand="left"]');
  await T(page, 500);
  log.apiCalls.length = 0;
  await Promise.all([page.waitForURL(/order\.html/, { timeout: 10000 }), tap(page, '#premadesContinueBtn')]);
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
  return 'PASS: the Premades & Sets tile ends the grid at from $19.95 and opens the quiet occasions list (named, priced, no pictures, lit, landed); Thanksgiving shows its flyer alone, then How the magic mug works in seven steps; Back steps one view at a time to the grid; and the order page shows the four, prices the set, asks for no mockup, and checks out smart-mug-set / Set of 4 / thanksgiving / left with no artwork of its own';
};

// The flyer's link: ?set=thanksgiving opens the set's How it works, the page
// the QR is for, no photo needed; Back goes to the flyer, then the list.
scenarios.theLink = async (page) => {
  await page.goto('http://127.0.0.1:8788/needles-studio.html?set=thanksgiving');
  await T(page, 4500); await dismissAlerts(page);
  const st = await pmState(page);
  if (!st.shown || st.view !== 'how' || st.focus !== 'premades-focus' || !st.landed || st.steps !== 7) return `FAIL: ?set=thanksgiving opened ${JSON.stringify(st)}`;
  await page.evaluate(() => premadesBack()); await T(page, 1500);
  const b = await pmState(page);
  if (b.view !== 'occasion') return `FAIL: Back from the link's page went to ${b.view}`;
  return 'PASS: ?set=thanksgiving opens the Thanksgiving Set\'s How the magic mug works, lit, landed at its title, no photo needed; Back goes to the flyer';
};

scenarios.theFrontDoor = async (page) => {
  await openStudio(page); await dismissAlerts(page);
  const b0 = await page.evaluate(() => {
    const b = document.getElementById('premadesFrontBtn'); if (!b) return null;
    const card = document.getElementById('uploadPhotoCard');
    return { inCard: card.contains(b), shown: !!b.offsetParent, text: b.innerText.replace(/\n/g, ' '),
      lit: getComputedStyle(card).opacity === '1', focus: [...document.body.classList].filter((c) => c.endsWith('-focus')).join(),
      photo: !!(typeof uploadedOriginalFile !== 'undefined' && uploadedOriginalFile) };
  });
  if (!b0 || !b0.inCard || !b0.shown || !b0.lit) return `FAIL: no lit Premades & Sets button on the opening card (${JSON.stringify(b0)})`;
  if (!/Premades & Sets/.test(b0.text) || !/No photo needed/.test(b0.text) || !/\$19\.95/.test(b0.text)) return `FAIL: the button reads "${b0.text}"`;
  if (b0.focus !== 'initial-upload-focus' || b0.photo) return `FAIL: not a fresh visit (${JSON.stringify(b0)})`;
  await tap(page, '#premadesFrontBtn'); await T(page, 1800);
  const st = await pmState(page);
  if (!st.shown || st.focus !== 'premades-focus' || st.view !== 'occasions' || !st.landed) return `FAIL: the button did not open the lit occasions list (${JSON.stringify(st)})`;
  await page.evaluate(() => [...document.getElementById('premadesCard').querySelectorAll('button')].find((b) => /back/i.test(b.innerText) && b.offsetParent).click());
  await T(page, 1800);
  const back = await page.evaluate(() => { const r = document.getElementById('premadesFrontBtn').getBoundingClientRect();
    return { card: getComputedStyle(document.getElementById('premadesCard')).display, focus: [...document.body.classList].filter((c) => c.endsWith('-focus')).join(),
      onScreen: r.top >= 0 && r.bottom <= innerHeight }; });
  if (back.card !== 'none' || back.focus !== 'initial-upload-focus' || !back.onScreen) return `FAIL: Back left ${JSON.stringify(back)}`;
  return 'PASS: a fresh visit, no photo: the opening card carries a lit Premades & Sets button (from $19.95, no photo needed); it opens the occasions list lit at its title, and Back returns to the opening card as it was';
};

// Everyday: the Unwelcome mats one at a time, next and back round the nine,
// and a mat orders as the doormat at its price with the mat's print file.
scenarios.theMats = async (page) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 13.69, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await dismissAlerts(page);
  await tap(page, '#premadesFrontBtn'); await T(page, 1500);
  await tap(page, '#premadesView .pm-row[data-occasion="everyday"]'); await T(page, 1900);
  const a = await pmState(page);
  if (a.view !== 'mats' || a.imgs !== 1 || a.loaded !== 1 || !/\$19\.95/.test(a.text) || !a.landed) return `FAIL: Everyday opened ${JSON.stringify(a)}`;
  const names = [];
  for (let i = 0; i < 10; i++) { names.push(await page.evaluate(() => document.getElementById('premadesMatName').textContent)); await page.evaluate(() => premadesMatStep(1)); }
  if (new Set(names).size !== 9 || names[9] !== names[0]) return `FAIL: next went round ${names.join(', ')}`;
  await page.evaluate(() => premadesMatStep(-2)); // back past the first, round to the last
  const files = await page.evaluate(async () => {
    const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(`${im.naturalWidth}x${im.naturalHeight}`); im.onerror = () => r(null); im.src = u; });
    const out = []; for (const m of PREMADE_MATS) out.push([m.key, await load(`art/unwelcome/print/${m.key}.jpg`), await load(`art/unwelcome/show/${m.key}.jpg`)]); return out; });
  const badFiles = files.filter(([, p, sh]) => p !== '4650x2850' || sh !== '900x552');
  if (badFiles.length) return `FAIL: mat files ${JSON.stringify(badFiles)}`;
  await Promise.all([page.waitForURL(/order\.html/, { timeout: 10000 }), tap(page, '#premadesMatOrderBtn')]);
  await T(page, 3500);
  const o = await page.evaluate(() => ({ base: document.getElementById('summaryBase').textContent, head: document.getElementById('orderHeadlineName').textContent }));
  if (o.base !== '$19.95') return `FAIL: the order page prices the mat at ${o.base} (${o.head})`;
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== 'doormat' || !/\/art\/unwelcome\/print\/dock-shallow\.jpg$/.test(b.image || '')) return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, image: b.image })}`;
  return `PASS: Everyday opens one mat at a time at $19.95, next goes round all nine and back; every mat has its 4650 x 2850 print and 900 x 552 picture; The Dock orders as the doormat at $19.95 with its own print file (${o.head})`;
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
