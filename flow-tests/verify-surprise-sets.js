// THE SURPRISE!!! HOLIDAY MUGS (Alyx, 26-27 Sep 2026: mix and match, "you
// decide the participants"; any four $59.95, more with a set $17.95 each, one
// alone $19.95). What this pins:
//   * the studio's copy of the holiday's mugs, and the order page's, match the
//     server's (lib/surprise-sets.js), and the prices match the catalog's;
//   * every mug has both prints at the mug's 2475 x 1155, its COLD -> HOT
//     picture, its shelf picture and its tile; each right-handed print's LEFT
//     half is its tile (the punchline, as for the singles);
//   * Pre-mades opens the holiday on its shelf: every mug, one at a time or
//     all at once, each added to "your mugs" (repeats and all) or bought
//     alone; How it works is a button away and ends on the prices; Back is
//     always the view before;
//   * the order page shows the mugs chosen, prices them by the rule, asks
//     Printify for no mockup, and checks out the holiday, the hand and the
//     mugs by key -- and no artwork of its own;
//   * the flyer's link opens How it works, which goes on to the shelf.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { followToOrder, launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const ROOT = path.join(__dirname, '..');
const T = (page, ms) => page.waitForTimeout(ms);
const tap = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, sel);

async function toSurprise(page) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await tap(page, '#productCard .btn-select[data-val="mug"]');
  await T(page, 1200);
  await dismissAlerts(page);
  await tap(page, '#preGenSizeSmartBtn'); await T(page, 300); await tap(page, '#smartDemoSkipBtn');
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
    top: Math.round(r.top), landed: r.top > -2 && r.top < innerHeight * 0.3,
    // Nothing is painted here: the studio's Generate (a token) must not show.
    generate: ['generateBtn', 'generateTokenNote', 'generateBackBtn'].filter((id) => { const el = document.getElementById(id); return el && el.offsetParent && getComputedStyle(el).opacity !== '0'; }) };
});


scenarios.theThreeListsAndTheFiles = async (page) => {
  const { SURPRISE_SETS } = await import(pathToFileURL(path.join(ROOT, 'lib', 'surprise-sets.js')).href);
  const { PRODUCTS_CATALOG } = await import(pathToFileURL(path.join(ROOT, 'lib', 'products-catalog.js')).href);
  // The studio's Magic Mug prices and holiday sets live in magic-mug.js (shared with occasion.html).
  const studio = fs.readFileSync(path.join(ROOT, 'magic-mug.js'), 'utf8');
  const order = fs.readFileSync(path.join(ROOT, 'order.html'), 'utf8');
  const price = PRODUCTS_CATALOG['smart-mug-set'].sizes['Set of 4'].price;
  const bad = [];
  if (pageConst(studio, 'SMART_MUG_SET_PRICE') !== price) bad.push(`the studio's set price is not the catalog's $${price}`);
  if (pageConst(order, 'SMART_MUG_SET_PRICE') !== price) bad.push(`the order page's set price is not the catalog's $${price}`);
  const extra = PRODUCTS_CATALOG['smart-mug-set'].extraPrice, single = PRODUCTS_CATALOG['smart-mug'].sizes['11oz'].price;
  for (const [name, src] of [['studio', studio], ['order page', order]]) {
    if (pageConst(src, 'SMART_MUG_EXTRA_PRICE') !== extra) bad.push(`the ${name}'s extra-mug price is not the catalog's $${extra}`);
    if (pageConst(src, 'SMART_MUG_PRICE') !== single) bad.push(`the ${name}'s single price is not the catalog's $${single}`);
  }
  const live = Object.entries(SURPRISE_SETS).filter(([, s]) => s.live);
  const studioSets = pageConst(studio, 'SURPRISE_SETS'), orderLabels = pageConst(order, 'SURPRISE_SET_LABELS');
  if (JSON.stringify(Object.keys(studioSets).sort()) !== JSON.stringify(live.map(([k]) => k).sort())) bad.push(`the studio offers ${Object.keys(studioSets)}, the server sells ${live.map(([k]) => k)}`);
  for (const [k, s] of live) {
    if (orderLabels[k] !== s.label) bad.push(`${k}: the order page calls it ${orderLabels[k]}`);
    const mine = (studioSets[k] || {}).designs || [];
    if (JSON.stringify(mine.map((d) => [d.key, d.label, d.file, !!d.frames])) !== JSON.stringify(s.designs.map((d) => [d.key, d.label, d.file, !!d.frames]))) bad.push(`${k}: the studio's mugs differ from the server's`);
    // One design is a shelf: a set may be the same mug four times over.
    if (s.designs.length < 1) bad.push(`${k} has no mugs`);
    if (new Set(s.designs.map((d) => d.key)).size !== s.designs.length) bad.push(`${k}: two mugs share a key`);
  }
  // The files, measured in the page (the browser reads the PNGs).
  await page.goto('http://127.0.0.1:8788/needles-studio.html');
  // A framed mug (frames: true) has its two framed prints too, each hand.
  const framed = live.flatMap(([, s]) => s.designs.filter((d) => d.frames).flatMap((d) => ['one', 'two'].flatMap((f) => [`${d.file}-${f}-print.png`, `${d.file}-${f}-print-left.png`])));
  const missing = await page.evaluate(async (fs) => { const out = [];
    for (const f of fs) { const ok = await new Promise((r) => { const im = new Image(); im.onload = () => r(im.naturalWidth === 2475 && im.naturalHeight === 1155); im.onerror = () => r(false); im.src = '/art/surprise/' + f; }); if (!ok) out.push(f); }
    return out; }, framed);
  if (missing.length) bad.push(`framed prints missing or not 2475 x 1155: ${missing.join(', ')}`);
  const files = live.flatMap(([, s]) => s.designs.map((d) => d.file));
  const measured = await page.evaluate(async (files) => {
    const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = u; });
    const tiny = (im, sx, sy, sw, sh) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.drawImage(im, sx, sy, sw, sh, 0, 0, 32, 32); return g.getImageData(0, 0, 32, 32).data; };
    const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d; };
    const out = [];
    for (const f of files) {
      const p = await load(`/art/surprise/${f}-print.png`), l = await load(`/art/surprise/${f}-print-left.png`);
      const c = await load(`/art/surprise/${f}-coldhot.jpg`), t = await load(`/art/options/surprise-${f}.jpg`), sh = await load(`/art/surprise/show/${f}.jpg`);
      const row = { f, print: p && `${p.naturalWidth}x${p.naturalHeight}`, left: l && `${l.naturalWidth}x${l.naturalHeight}`, coldhot: !!c, tile: !!t, show: sh && `${sh.naturalWidth}x${sh.naturalHeight}` };
      // Each half compared by its picture, wherever in the half it sits (the
      // decal mugs hug the handle ends): cropped to what is not white.
      const box = (im, x0, y0, bw, bh) => { const c = document.createElement('canvas'); c.width = bw; c.height = bh; const g = c.getContext('2d'); g.drawImage(im, x0, y0, bw, bh, 0, 0, bw, bh);
        const d = g.getImageData(0, 0, bw, bh).data; let a = bw, b = bh, e = 0, f = 0;
        for (let y = 0; y < bh; y += 3) for (let x = 0; x < bw; x += 3) { const i = (y * bw + x) * 4; if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) { if (x < a) a = x; if (x > e) e = x; if (y < b) b = y; if (y > f) f = y; } }
        return e > a && f > b ? [x0 + a, y0 + b, e - a, f - b] : [x0, y0, bw, bh]; };
      if (p && t) { const w = p.naturalWidth / 2, h = p.naturalHeight, tt = tiny(t, ...box(t, 0, 0, t.naturalWidth, t.naturalHeight));
        row.punchlineLeft = diff(tiny(p, ...box(p, 0, 0, w, h)), tt) < diff(tiny(p, ...box(p, w, 0, w, h)), tt); }
      out.push(row);
    }
    return out;
  }, files);
  for (const r of measured) {
    if (r.print !== '2475x1155' || r.left !== '2475x1155') bad.push(`${r.f}: prints ${r.print} / ${r.left}`);
    if (!r.coldhot || !r.tile || r.show !== '1050x490') bad.push(`${r.f}: COLD -> HOT ${r.coldhot}, tile ${r.tile}, shelf picture ${r.show}`);
    if (!r.punchlineLeft) bad.push(`${r.f}: the right-handed print's punchline is not on its left half`);
  }
  return bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: ${live.length} holiday(s), the same mugs on the server, the studio and the order page, priced as the catalog ($${single} one, $${price} four, $${extra} each more); ${files.length} mugs each with both prints at 2475 x 1155, COLD -> HOT, shelf picture and tile, punchline on the left`;
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
  if (!tile || !tile.last || !/Pre-mades & Sets/.test(tile.text) || !/from \$11\.95/.test(tile.text)) return `FAIL: the Premades & Sets tile reads ${JSON.stringify(tile)}`;
  await tap(page, '#premadesTile');
  await T(page, 1900);
  // The list of products (Alyx, 27 Sep 2026: product first): each pictured,
  // counted and priced, with Back, lit, and landed with its title on screen.
  const st0 = await pmState(page);
  if (!st0.shown || st0.focus !== 'premades-focus' || st0.view !== 'products') return `FAIL: the tile did not open the lit products list (${JSON.stringify(st0)})`;
  if (!/Pre-mades/i.test(st0.title) || !st0.back || !/\$59\.95/.test(st0.text) || !/from \$11\.95/.test(st0.text)) return `FAIL: the list lacks its name, Back or prices (${JSON.stringify(st0)})`;
  const rows = await page.evaluate(() => [...document.querySelectorAll('#premadesProducts .pm-prod')].map((r) => ({ key: r.dataset.product, pic: r.querySelector('img')?.naturalWidth > 0, text: r.innerText.replace(/\n/g, ' ') })));
  if (JSON.stringify(rows.map((r) => r.key)) !== JSON.stringify(['mugs', 'welcome-mats', 'placemats', 'suitcases']) || rows.some((r) => !r.pic || !/\d+ designs · (from )?\$\d+\.\d\d/.test(r.text)))
    return `FAIL: the products list reads ${JSON.stringify(rows)}`;
  if (st0.generate.length) return `FAIL: with a photo uploaded, Pre-mades still shows ${st0.generate.join(', ')}`;
  if (!st0.landed) return `FAIL: the list did not land at its title (${JSON.stringify(st0)})`;
  // Magic Mugs opens on its shelf, the holidays as tabs (Thanksgiving lit, the
  // rest to come): one mug at a time, priced, How it works a button away.
  await tap(page, '#premadesView .pm-prod[data-product="mugs"]'); await T(page, 1900);
  const st1 = await pmState(page);
  if (st1.view !== 'shelf' || st1.imgs !== 1 || st1.loaded !== 1 || !/\$19\.95/.test(st1.text) || !/\$59\.95/.test(st1.text) || !st1.landed || !/Magic Mugs/i.test(st1.title))
    return `FAIL: Thanksgiving did not open on its shelf (${JSON.stringify(st1)})`;
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#premadesHolidayTabs .pm-tab')].map((t) => t.className.replace('pm-tab', '').trim() + ':' + t.dataset.holiday));
  // Thanksgiving lit; every other holiday live if it has mugs, "soon" if not.
  const want = await page.evaluate(() => PREMADE_OCCASIONS.map((o, i) => (i === 0 ? 'on' : (o.set && SURPRISE_SETS[o.set] ? '' : 'soon')) + ':' + o.key));
  if (tabs[0] !== 'on:thanksgiving' || JSON.stringify(tabs) !== JSON.stringify(want)) return `FAIL: the holiday tabs read ${JSON.stringify(tabs)}, not ${JSON.stringify(want)}`;
  if (!/Add to my mugs/.test(st1.text) || !/Just this one/.test(st1.text)) return `FAIL: the shelf's mug cannot be added or bought alone (${st1.text.slice(0, 300)})`;
  // How it works: seven steps, ending on the prices, then on to the shelf.
  await tap(page, '#premadesHowBtn'); await T(page, 1900);
  const st2 = await pmState(page);
  if (st2.view !== 'how' || st2.steps !== 7 || st2.imgs !== 5 || st2.loaded !== 5 || !st2.landed || !/How the magic mug works/i.test(st2.title)) return `FAIL: How it works shows ${JSON.stringify(st2)}`;
  if (!/\$59\.95/.test(st2.text) || !/\$17\.95/.test(st2.text) || !/\$19\.95/.test(st2.text) || !/See all the mugs and build your set/.test(st2.text)) return 'FAIL: How it works does not end on the prices and the way to the shelf';
  // Back, one view at a time: How it works -> the shelf -> the list -> the grid.
  for (const want of ['shelf', 'products']) {
    await page.evaluate(() => premadesBack()); await T(page, 1500);
    const b = await pmState(page); if (b.view !== want || !b.landed) return `FAIL: Back went to ${b.view}, not ${want} (${JSON.stringify(b)})`;
  }
  await page.evaluate(() => premadesBack());
  await T(page, 1900);
  const bk = await page.evaluate(() => { const r = document.getElementById('productCard').getBoundingClientRect();
    return { card: getComputedStyle(document.getElementById('premadesCard')).display, focus: [...document.body.classList].filter((c) => c.endsWith('-focus')), top: Math.round(r.top) }; });
  if (bk.card !== 'none' || bk.focus.length || bk.top < -2 || bk.top > 200) return `FAIL: Back did not return to the product grid (${JSON.stringify(bk)})`;
  // Forward again: every mug at once, six chosen with repeats, left-handed.
  await tap(page, '#premadesTile'); await T(page, 1500);
  await tap(page, '#premadesView .pm-prod[data-product="mugs"]'); await T(page, 900);
  await page.evaluate(() => document.querySelector('#premadesView .pm-lay[data-layout="all"]').click()); await T(page, 1200);
  const all = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('#premadesMugsAll img')];
    imgs.forEach((im) => { im.loading = 'eager'; });
    await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
    return { rows: document.querySelectorAll('#premadesMugsAll .pm-mugrow').length, loaded: imgs.filter((im) => im.naturalWidth > 0).length, n: SURPRISE_SETS.thanksgiving.designs.length,
      priced: [...document.querySelectorAll('#premadesMugsAll .pm-mugrow')].every((r) => /\$19\.95/.test(r.innerText) && r.querySelector('.pm-add')) };
  });
  if (all.rows !== all.n || all.loaded !== all.n || !all.priced) return `FAIL: all at once shows ${JSON.stringify(all)}`;
  const MUGS = ['golden-brown', 'golden-brown', 'dark-meat', 'thankful', 'uncle-gerald', 'golden-brown'];
  const trays = [];
  for (const k of MUGS) {
    await page.evaluate((k) => document.querySelector(`#premadesMugsAll .pm-add[data-add="${k}"]`).click(), k); await T(page, 150);
    trays.push(await page.evaluate(() => ({ line: document.getElementById('premadesTrayLine')?.textContent || '', btn: document.getElementById('premadesContinueBtn')?.textContent || '', mugs: document.querySelectorAll('#premadesTray .pm-traymug').length })));
  }
  const wantTray = [['$19.95', 'Order this mug'], ['$39.90', 'Order 2 mugs'], ['$59.85', 'Order 3 mugs'], ['$59.95', 'Order your set'], ['$77.90', 'Order 5 mugs'], ['$95.85', 'Order 6 mugs']];
  for (let i = 0; i < wantTray.length; i++) {
    const [price, btn] = wantTray[i], t = trays[i];
    if (t.mugs !== i + 1 || !t.line.includes(price) || !t.btn.includes(btn) || !t.btn.includes(price)) return `FAIL: with ${i + 1} mug(s) the tray reads ${JSON.stringify(t)}`;
  }
  const badge = await page.evaluate(() => document.querySelector('#premadesMugsAll .pm-add[data-add="golden-brown"]').textContent);
  if (!/×3/.test(badge)) return `FAIL: Golden Brown, chosen three times, says "${badge}"`;
  // Taking one out and putting it back.
  await page.evaluate(() => document.querySelectorAll('#premadesTray .pm-traymug button')[2].click()); await T(page, 150);
  const out = await page.evaluate(() => ({ n: premadesMugs.length, keys: premadesMugs.join() }));
  if (out.n !== 5 || out.keys !== 'golden-brown,golden-brown,thankful,uncle-gerald,golden-brown') return `FAIL: taking out the third mug left ${out.keys}`;
  await page.evaluate(() => holidayAdd('dark-meat')); await T(page, 150);
  const CHOSEN = ['golden-brown', 'golden-brown', 'thankful', 'uncle-gerald', 'golden-brown', 'dark-meat'];
  await tap(page, '#premadesHandGrid .btn-select[data-hand="left"]');
  await T(page, 500);
  log.apiCalls.length = 0;
  await followToOrder(page, () => tap(page, '#premadesContinueBtn'));
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
  if (!st.pending || st.pending.surpriseSet !== 'thanksgiving' || st.pending.preselectedSurpriseHand !== 'left' || JSON.stringify(st.pending.surpriseMugs) !== JSON.stringify(CHOSEN)) return `FAIL: the hand-off carried ${JSON.stringify(st.pending)}`;
  if (st.card === 'none' || !/Thanksgiving Set \+ 2 more/.test(st.title)) return `FAIL: the order page's card is "${st.title}" (${st.card})`;
  if (!/left-handed/.test(st.note) || !/\$95\.85/.test(st.note) || !/6 smart mugs/.test(st.note)) return `FAIL: the card says "${st.note}"`;
  if (st.pics !== 6) return `FAIL: the order page shows ${st.pics} of the six mugs`;
  if (st.base !== '$95.85') return `FAIL: the order page prices the six at ${st.base}`;
  if (st.head !== 'SURPRISE!!! Thanksgiving Set + 2 more') return `FAIL: the order is headed "${st.head}"`;
  if (log.apiCalls.some((c) => c.path === '/api/start-mockup')) return 'FAIL: the order page asked Printify for a mockup of the mugs';
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== 'smart-mug-set' || b.setKey !== 'thanksgiving' || b.hand !== 'left' || b.image || JSON.stringify(b.mugs) !== JSON.stringify(CHOSEN))
    return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, set: b.setKey, hand: b.hand, mugs: b.mugs, image: b.image })}`;
  return 'PASS: the Pre-mades & Sets tile ends the grid at from $11.95 (a Large placemat, the cheapest) and opens the products list (Magic Mugs, Welcome Mats, Placemats, each pictured, counted and priced, lit, landed); Magic Mugs opens on its shelf with Thanksgiving lit and the other holidays to come, one mug at a time with its price, How it works a button away (seven steps ending on the three prices); Back steps one view at a time to the grid; all at once shows every mug pictured and priced; the tray prices 1 to 6 mugs as $19.95, $39.90, $59.85, the set $59.95, $77.90, $95.85, counts repeats and takes one out; the order page shows the six, left-handed, at $95.85, asks for no mockup, and checks out thanksgiving / left / the six by key with no artwork of its own';
};

// The flyer's link: ?set=thanksgiving opens How it works, the page the QR is
// for, no photo needed; its button goes on to the shelf; Back goes the way
// it came.
scenarios.theLink = async (page) => {
  await page.goto('http://127.0.0.1:8788/needles-studio.html?set=thanksgiving');
  await T(page, 4500); await dismissAlerts(page);
  const st = await pmState(page);
  if (!st.shown || st.view !== 'how' || st.focus !== 'premades-focus' || !st.landed || st.steps !== 7) return `FAIL: ?set=thanksgiving opened ${JSON.stringify(st)}`;
  await tap(page, '#premadesShelfBtn'); await T(page, 1500);
  const sh = await pmState(page);
  if (sh.view !== 'shelf' || !sh.landed) return `FAIL: How it works went on to ${JSON.stringify(sh)}`;
  for (const want of ['how', 'products']) {
    await page.evaluate(() => premadesBack()); await T(page, 1500);
    const b = await pmState(page); if (b.view !== want) return `FAIL: Back went to ${b.view}, not ${want}`;
  }
  return 'PASS: ?set=thanksgiving opens How the magic mug works, lit, landed at its title, no photo needed; its button goes on to the shelf; Back goes to How it works, then the products list';
};

// THE FRAME, A PROP ON THE SHELF (Alyx, 29 Sep 2026): a framed mug shows No
// frame (the default), One frame and A frame each side under it; the one
// picked turns on the mug, goes into the tray with the mug, and is ordered.
scenarios.theFrames = async (page) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 7.99, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await dismissAlerts(page);
  await tap(page, '#premadesFrontBtn'); await T(page, 1500);
  await tap(page, '#premadesView .pm-prod[data-product="mugs"]'); await T(page, 1500);
  await page.evaluate(() => premadesSetLayout('one'));
  await page.evaluate(() => holidayStep(SURPRISE_SETS.thanksgiving.designs.findIndex((d) => d.key === 'pardon'))); await T(page, 700);
  const btns = await page.evaluate(() => [...document.querySelectorAll('#premadesFrameGrid .btn-select')].map((b) => b.textContent + (b.classList.contains('selected') ? '*' : '')));
  if (btns.join('|') !== 'No frame*|One frame|A frame each side') return `FAIL: the Pardon's frame buttons read ${JSON.stringify(btns)}`;
  await page.evaluate(() => pickPremadesFrame('two')); await T(page, 600);
  const mug = await page.evaluate(() => document.querySelector('#premadesView .pm-mat .pm-mug3d').dataset.mug3d);
  if (mug !== 'thanksgiving-pardon-two') return `FAIL: A frame each side put ${mug} on the mug`;
  await tap(page, '#premadesAddBtn'); await T(page, 300);
  const tray = await page.evaluate(() => [...document.querySelectorAll('#premadesTray .pm-traymug span')].map((s) => s.textContent));
  if (JSON.stringify(tray) !== '["The Pardon · A frame each side"]') return `FAIL: the tray reads ${JSON.stringify(tray)}`;
  await page.evaluate(() => holidayStep(SURPRISE_SETS.thanksgiving.designs.findIndex((d) => d.key === 'the-diet') - premadesMugIndex)); await T(page, 700);
  const dietBtns = await page.evaluate(() => [...document.querySelectorAll('#premadesFrameGrid .btn-select')].map((b) => b.textContent + (b.classList.contains('selected') ? '*' : '')));
  if (dietBtns.join('|') !== 'No frame|One frame|A frame each side*') return `FAIL: The Diet's frame buttons read ${JSON.stringify(dietBtns)}; the shelf's frame pick should carry over`;
  await page.evaluate(() => pickPremadesFrame('none')); await T(page, 600);
  await tap(page, '#premadesAddBtn'); await T(page, 300);
  await followToOrder(page, () => tap(page, '#premadesContinueBtn'));
  await T(page, 3500);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || JSON.stringify(b.mugs) !== '["pardon~two","the-diet"]') return `FAIL: checkout got ${JSON.stringify(b && b.mugs)}`;
  const { SURPRISE_SETS, holidayMugs, setPrintUrls } = await import(pathToFileURL(path.join(ROOT, 'lib', 'surprise-sets.js')).href);
  const urls = setPrintUrls(holidayMugs(SURPRISE_SETS.thanksgiving, b.mugs), 'right');
  if (!/thanksgiving-pardon-two-print\.png$/.test(urls[0]) || !/the-diet-print\.png$/.test(urls[1])) return `FAIL: the server would print ${urls}`;
  return 'PASS: a framed mug on the shelf offers No frame, One frame, A frame each side; the pick turns on the mug, rides into the tray and the order ("pardon~two"), and the server prints that framed file; the pick carries to The Diet, and No frame there orders the plain print';
};

// SUITCASES ON THE SHELF (Alyx, 30 Sep 2026). Twelve finished designs; the
// choice is the size, each with its case's picture and price; each size prints
// its own file, cut to that case's print shape; the order carries the size.
scenarios.theSuitcases = async (page) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 35.00, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await dismissAlerts(page);
  const files = await page.evaluate(async () => {
    const c = PREMADE_CATEGORIES.suitcases, load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im.naturalWidth / im.naturalHeight); im.onerror = () => r(null); im.src = u; });
    const out = []; for (const x of c.items) for (const p of c.packs) out.push([x.key, p.size, await load(`${c.dir}/print/${x.key}-${p.size}.jpg`)]);
    for (const x of c.items) for (const p of c.packs) out.push([x.key, p.size, await load(`${c.dir}/plain/${x.key}-${p.size}.jpg`)]);
    for (const x of c.items) out.push([x.key, 'show', await load(`${c.dir}/show/${x.key}.jpg`)]);
    return out;
  });
  const SHAPE = { Small: 5433 / 7323, Medium: 6260 / 8504, Large: 7217 / 9561, show: 600 / 800 };
  const bad = files.find(([, s, r]) => !r || Math.abs(r - SHAPE[s]) > 0.002);
  if (files.length !== 84 || bad) return `FAIL: suitcase files ${JSON.stringify(bad || files.length)}`;
  await page.evaluate(() => document.getElementById('premadesFrontBtn').click()); await T(page, 1500);
  const row = await page.evaluate(() => document.querySelector('#premadesView .pm-prod[data-product="suitcases"]')?.innerText.replace(/\n/g, ' '));
  if (!/Suitcases/.test(row || '') || !/12 designs · from \$169\.95/.test(row)) return `FAIL: the products list shows ${JSON.stringify(row)}`;
  await page.evaluate(() => document.querySelector('#premadesView .pm-prod[data-product="suitcases"]').click()); await T(page, 1500);
  await page.evaluate(() => premadesSetLayout('one')); await T(page, 400);
  const g = await page.evaluate(() => ({ view: premadesView, packs: [...document.querySelectorAll('#premadesPackGrid .btn-select')].map((b) => [b.innerText.replace(/\n/g, ' '), !!b.querySelector('img')]) }));
  const want = [['Small', '169.95'], ['Medium', '194.95'], ['Large', '214.95']];
  if (g.view !== 'gallery' || g.packs.length !== 3 || want.some(([l, pr], i) => !g.packs[i][1] || !g.packs[i][0].includes(l) || !g.packs[i][0].includes(pr))) return `FAIL: the suitcase gallery offers ${JSON.stringify(g)}`;
  await page.evaluate(() => pickPremadesPack(2)); await T(page, 300);
  const btn = await page.evaluate(() => document.getElementById('premadesMatOrderBtn').innerText);
  if (!/Order this medium suitcase · \$194\.95/.test(btn)) return `FAIL: the order button reads ${JSON.stringify(btn)}`;
  await page.evaluate(() => premadesBack()); await T(page, 900);
  if (await page.evaluate(() => premadesView) !== 'products') return 'FAIL: Back from the suitcases did not go to the products list';
  await page.evaluate(() => { pickPremadeCategory('suitcases'); premadesSetLayout('one'); premadesStep(-1); pickPremadesPack(2); }); await T(page, 900);
  const lastKey = await page.evaluate(() => PREMADE_CATEGORIES.suitcases.items.slice(-1)[0].key);
  await followToOrder(page, () => page.evaluate(() => document.getElementById('premadesMatOrderBtn').click()));
  await T(page, 3000);
  const o = await page.evaluate(() => ({ base: document.getElementById('summaryBase').textContent, label: document.getElementById('summaryStyleSize')?.textContent || '' }));
  if (o.base !== '$194.95' || !/Suitcase, Medium/.test(o.label)) return `FAIL: the order page shows ${JSON.stringify(o)}`;
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== 'suitcase' || b.sizeLabel !== 'Medium' || !(b.image || '').endsWith(`/art/suitcases/print/${lastKey}-Medium.jpg`)) return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, image: b.image })}`;
  return `PASS: 12 suitcases on the list from $169.95; each size its own print file at its case's shape; the gallery offers Small $169.95, Medium $194.95, Large $214.95 with pictures; Back steps to the list; the last, as a Medium, checks out as suitcase / Medium at $194.95 with ${lastKey}-Medium.jpg`;
};

// THE SUITCASE FADE (Alyx, 30 Sep 2026: "a fade tool on the panel ... from
// zero to 100"). The slider starts at the default the print files are baked
// at; the 3D case turns with the fade; a moved slider orders its own file,
// faded on the page and uploaded; the fade's colour is the studio's rule for
// the suitcase.
scenarios.theSuitcaseFade = async (page) => {
  const bodies = [], uploads = [];
  page.on('request', (r) => { const u = r.url(); try {
    if (u.includes('/api/create-checkout-session')) bodies.push(r.postDataJSON());
    if (u.includes('/api/generate') && (r.postDataJSON() || {}).action === 'uploadComposite') uploads.push(1); } catch (e) {} });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 35.00, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await dismissAlerts(page);
  await page.evaluate(() => { pickPremadeCategory('suitcases'); premadesSetLayout('one'); }); await T(page, 1500);
  const s0 = await page.evaluate(() => { const r = document.getElementById('premadesFade'); return r && { min: r.min, max: r.max, v: r.value, shown: document.getElementById('premadesFadeVal').textContent, hex: suitcaseFadeHex(), d: SUITCASE_FADE_DEFAULT, back: typeof MUG3D !== 'undefined' }; });
  if (!s0 || s0.min !== '0' || s0.max !== '100' || s0.v !== String(s0.d) || s0.shown !== s0.d + '%') return `FAIL: the fade slider reads ${JSON.stringify(s0)}`;
  await page.evaluate(() => { const r = document.getElementById('premadesFade'); r.value = 55; r.dispatchEvent(new Event('input')); }); await T(page, 1500);
  const s1 = await page.evaluate(() => ({ v: premadesFade, shown: document.getElementById('premadesFadeVal').textContent, art: (document.querySelector('.pm-case3d')?.dataset.art || '').slice(0, 11) }));
  if (s1.v !== 55 || s1.shown !== '55%' || s1.art !== 'data:image/') return `FAIL: moving the slider to 55 gave ${JSON.stringify(s1)}`;
  await page.evaluate(() => pickPremadesPack(3)); await T(page, 900);
  if (await page.evaluate(() => document.getElementById('premadesFade').value) !== '55') return 'FAIL: choosing a size reset the fade';
  await followToOrder(page, () => page.evaluate(() => document.getElementById('premadesMatOrderBtn').click()));
  await T(page, 3000);
  const pend = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('muggshotz_pending_order')); } catch (e) { return null; } });
  if (!uploads.length || !pend || !/__fake\/generated\.jpg$/.test(pend.placements.left) || pend.preselectedSuitcaseSize !== 'Large') return `FAIL: a fade of 55 ordered ${JSON.stringify(pend && { left: pend.placements.left, size: pend.preselectedSuitcaseSize, uploads: uploads.length })}`;
  return `PASS: the fade runs 0 to 100 from ${s0.d}% into ${s0.hex}; at 55 the 3D case wears the faded picture, a size change keeps it, and the Large orders its own uploaded file`;
};

// One mug on its own: Just this one, on the shelf, orders that one at $19.95.
scenarios.theJustOne = async (page) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 7.99, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await dismissAlerts(page);
  await tap(page, '#premadesFrontBtn'); await T(page, 1500);
  await tap(page, '#premadesView .pm-prod[data-product="mugs"]'); await T(page, 1500);
  await page.evaluate(() => premadesSetLayout('one'));
  await page.evaluate(() => holidayStep(SURPRISE_SETS.thanksgiving.designs.findIndex((d) => d.key === 'uncle-gerald'))); await T(page, 700);
  const name = await page.evaluate(() => document.getElementById('premadesMugName').textContent);
  if (name !== 'Uncle Gerald') return `FAIL: stepping to Uncle Gerald shows ${name}`;
  await followToOrder(page, () => tap(page, '#premadesJustOneBtn'));
  await T(page, 3500);
  const o = await page.evaluate(() => ({ base: document.getElementById('summaryBase').textContent, head: document.getElementById('orderHeadlineName').textContent, pics: document.querySelectorAll('#smartMugSetPictures img').length }));
  if (o.base !== '$19.95' || o.head !== 'SURPRISE!!! Thanksgiving smart mug' || o.pics !== 1) return `FAIL: the order page shows ${JSON.stringify(o)}`;
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || JSON.stringify(b.mugs) !== '["uncle-gerald"]' || b.setKey !== 'thanksgiving' || b.image) return `FAIL: checkout got ${JSON.stringify(b && { mugs: b.mugs, set: b.setKey, image: b.image })}`;
  return 'PASS: Just this one on the shelf orders that one mug: the order page shows it at $19.95 and checks out thanksgiving / uncle-gerald';
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
  if (!/Pre-mades & Sets/.test(b0.text) || !/No photo needed/.test(b0.text) || !/from \$11\.95/.test(b0.text)) return `FAIL: the button reads "${b0.text}"`;
  if (b0.focus !== 'initial-upload-focus' || b0.photo) return `FAIL: not a fresh visit (${JSON.stringify(b0)})`;
  await tap(page, '#premadesFrontBtn'); await T(page, 1800);
  const st = await pmState(page);
  if (!st.shown || st.focus !== 'premades-focus' || st.view !== 'products' || !st.landed) return `FAIL: the button did not open the lit products list (${JSON.stringify(st)})`;
  await page.evaluate(() => [...document.getElementById('premadesCard').querySelectorAll('button')].find((b) => /back/i.test(b.innerText) && b.offsetParent).click());
  await T(page, 1800);
  const back = await page.evaluate(() => { const r = document.getElementById('premadesFrontBtn').getBoundingClientRect();
    return { card: getComputedStyle(document.getElementById('premadesCard')).display, focus: [...document.body.classList].filter((c) => c.endsWith('-focus')).join(),
      onScreen: r.top >= 0 && r.bottom <= innerHeight }; });
  if (back.card !== 'none' || back.focus !== 'initial-upload-focus' || !back.onScreen) return `FAIL: Back left ${JSON.stringify(back)}`;
  return 'PASS: a fresh visit, no photo: the opening card carries a lit Pre-mades & Sets button (from $11.95, no photo needed); it opens the products list lit at its title, and Back returns to the opening card as it was';
};

// Everyday: the Unwelcome mats one at a time, next and back round the nine,
// and a mat orders as the doormat at its price with the mat's print file.
scenarios.theMats = async (page) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 13.69, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await dismissAlerts(page);
  await tap(page, '#premadesFrontBtn'); await T(page, 1500);
  await tap(page, '#premadesView .pm-prod[data-product="welcome-mats"]'); await T(page, 1900);
  const a = await pmState(page);
  if (a.view !== 'gallery' || a.imgs !== 1 || a.loaded !== 1 || !/\$19\.95/.test(a.text) || !a.landed) return `FAIL: Everyday opened ${JSON.stringify(a)}`;
  // All at once: every mat on one page, each pictured and priced; tapping one
  // opens it on its own.
  await page.evaluate(() => document.querySelector('#premadesView .pm-lay[data-layout="all"]').click()); await T(page, 900);
  const all = await pmState(page), allTiles = await page.evaluate(() => document.querySelectorAll('#premadesAll .btn-select').length);
  if (all.view !== 'gallery' || allTiles !== all.imgs || all.loaded !== all.imgs || allTiles < 2) return `FAIL: all at once shows ${allTiles} mats, ${all.loaded} of ${all.imgs} pictures loading`;
  await page.evaluate(() => document.querySelectorAll('#premadesAll .btn-select')[2].click()); await T(page, 1500);
  const one = await page.evaluate(() => ({ name: document.getElementById('premadesMatName')?.textContent, want: PREMADE_MATS[2].label, layout: premadesLayout }));
  if (one.name !== one.want || one.layout !== 'one') return `FAIL: tapping the third mat opened ${JSON.stringify(one)}`;
  await page.evaluate(() => premadesShowOne(0)); await T(page, 600);
  // Next goes round the Everyday line (the holiday line is its own tab).
  const names = [], n = await page.evaluate(() => premadeItems().length);
  for (let i = 0; i <= n; i++) { names.push(await page.evaluate(() => document.getElementById('premadesMatName').textContent)); await page.evaluate(() => premadesMatStep(1)); }
  if (new Set(names).size !== n || names[n] !== names[0]) return `FAIL: next went round ${names.join(', ')}`;
  await page.evaluate(() => premadesMatStep(-2)); // back past the first, round to the last
  const files = await page.evaluate(async () => {
    const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(`${im.naturalWidth}x${im.naturalHeight}`); im.onerror = () => r(null); im.src = u; });
    const out = []; for (const m of PREMADE_MATS) out.push([m.key, await load(`art/unwelcome/print/${m.key}.jpg`), await load(`art/unwelcome/show/${m.key}.jpg`)]); return out; });
  const badFiles = files.filter(([, p, sh]) => p !== '4650x2850' || sh !== '900x552');
  if (badFiles.length) return `FAIL: mat files ${JSON.stringify(badFiles)}`;
  // A REGULAR LINE AND A HOLIDAY LINE (Alyx, 27 Sep 2026): the mats with an
  // occasion are their own tab; Halloween holds Six Feet Under, which orders
  // as the doormat with its own print.
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#premadesLineTabs .pm-tab')].map((t) => t.dataset.line + (t.classList.contains('on') ? '*' : '')));
  if (JSON.stringify(tabs) !== JSON.stringify(['everyday*', 'halloween'])) return `FAIL: the mats' line tabs read ${JSON.stringify(tabs)}`;
  const everyday = await page.evaluate(() => premadeItems().every((x) => !x.occasion));
  if (!everyday) return 'FAIL: the Everyday line shows a holiday mat';
  await page.evaluate(() => document.querySelector('#premadesLineTabs .pm-tab[data-line="halloween"]').click()); await T(page, 900);
  const hw = await page.evaluate(() => ({ name: document.getElementById('premadesMatName')?.textContent, dots: document.querySelectorAll('.pm-dots span').length, keys: premadeItems().map((x) => x.key), allHalloween: premadeItems().every((x) => x.occasion === 'halloween') }));
  if (hw.name !== 'Witch Silhouette' || hw.dots !== hw.keys.length || !hw.allHalloween) return `FAIL: the Halloween line shows ${JSON.stringify(hw)}`;
  const lastKey = 'halloween-silhouettes';  // first: on the Halloween flyer
  await followToOrder(page, () => tap(page, '#premadesMatOrderBtn'));
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
  if (!b || b.productKey !== 'doormat' || !(b.image || '').endsWith(`/art/unwelcome/print/${lastKey}.jpg`)) return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, image: b.image })}`;
  return `PASS: Everyday opens one mat at a time at $19.95, all at once shows every mat and a tap opens it, next goes round all ${n} Everyday mats and back; every mat has its 4650 x 2850 print and 900 x 552 picture; the Halloween tab holds only Halloween mats, Witch Silhouette (on the flyer) first, which orders as the doormat at $19.95 with its own print file (${o.head})`;
};

// The placemats: a category with no designs stays hidden; with Bud's,
// Everyday lists its categories; every placemat has its print at the neoprene
// mat's 5610 x 3839 and its 900 x 616 picture; one or a set of two, and a set
// orders as the neoprene placemat's set of two at $24.95 with its own print.
scenarios.thePlacematSlot = async (page) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await page.route('**/api/printify-catalog**', (route) => route.fulfill({ json: { shipping: 6.78, shippingSeparate: true, source: 'live' } }));
  await openStudio(page); await dismissAlerts(page);
  const hidden = await page.evaluate(() => { const c = PREMADE_CATEGORIES.placemats, keep = c.items; c.items = []; const l = liveCategories().join(); c.items = keep; return l; });
  if (hidden.split(',').includes('placemats')) return `FAIL: with no placemat designs the list still offers placemats (${hidden})`;
  const files = await page.evaluate(async () => {
    const c = PREMADE_CATEGORIES.placemats, load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(`${im.naturalWidth}x${im.naturalHeight}`); im.onerror = () => r(null); im.src = u; });
    const out = []; for (const x of c.items) out.push([x.key, await load(`${c.dir}/print/${x.key}.jpg`), await load(`${c.dir}/show/${x.key}.jpg`), x.kind || 'Neoprene']); return out;
  });
  // Each at its own placemat's shape: the neoprene 12 x 18, or the Large 24 x 14.
  const SIZES = { Neoprene: ['5610x3839', '900x616'], Large: ['7350x4350', '900x533'] };
  const badFile = files.find(([, p, sh, kind]) => !SIZES[kind] || p !== SIZES[kind][0] || sh !== SIZES[kind][1]);
  if (!files.length || badFile) return `FAIL: placemat files ${JSON.stringify(badFile || files)}`;
  const lastKey = files[files.length - 1][0];
  await page.evaluate(() => document.getElementById('premadesFrontBtn').click()); await T(page, 1500);
  await page.evaluate(() => document.querySelector('#premadesView .pm-prod[data-product="placemats"]').click()); await T(page, 1500);
  const g = await page.evaluate(() => ({ view: premadesView, packs: [...document.querySelectorAll('#premadesPackGrid .btn-select')].map((b) => b.innerText.replace(/\n/g, ' ')) }));
  if (g.view !== 'gallery' || g.packs.length !== 2 || !/Just one \$13\.95/.test(g.packs[0]) || !/A set of two \$24\.95/.test(g.packs[1])) return `FAIL: the placemat gallery offers ${JSON.stringify(g)}`;
  await page.evaluate(() => pickPremadesPack(2)); await T(page, 300);
  if (!/\$24\.95/.test(await page.evaluate(() => document.getElementById('premadesMatOrderBtn').innerText))) return 'FAIL: the order button does not show the set price';
  // Back: the placemats -> the products list.
  await page.evaluate(() => premadesBack()); await T(page, 900);
  if (await page.evaluate(() => premadesView) !== 'products') return 'FAIL: Back from the placemats did not go to the products list';
  await page.evaluate(() => { pickPremadeCategory('placemats'); premadesSetLayout('one'); premadesStep(-1); pickPremadesPack(2); }); await T(page, 900);
  await followToOrder(page, () => page.evaluate(() => document.getElementById('premadesMatOrderBtn').click()));
  await T(page, 3000);
  const o = await page.evaluate(() => ({ base: document.getElementById('summaryBase').textContent, label: document.getElementById('summaryStyleSize')?.textContent || '' }));
  // The last placemat is a Large one (24 x 14): it orders as that, at its price.
  if (o.base !== '$20.95' || !/Large Placemats, set of 2/.test(o.label)) return `FAIL: the order page shows ${JSON.stringify(o)}`;
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== 'placemat-stitched' || b.sizeLabel !== '24 x 14 in, set of 2' || !(b.image || '').endsWith(`/art/placemats/print/${lastKey}.jpg`)) return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, image: b.image })}`;
  return `PASS: an empty placemat category stays hidden; filled (${files.length}, each at its own placemat's shape: 5610 x 3839 neoprene or 7350 x 4350 Large), the list offers it; the placemat offers one ($13.95) or a set of two ($24.95); Back steps to the products list; the last, a Large one, checks out as placemat-stitched / 24 x 14 in, set of 2 at $20.95, with the design\'s print file`;
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
