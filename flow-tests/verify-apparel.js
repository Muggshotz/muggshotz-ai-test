// APPAREL (Alyx, 26 Sep 2026: "RAID printifies catalog ... T shirts and
// sweatshirts and hoodies"; priced "wholesale ... tack on $3 ... round up or
// down to the nearest $0.95"). What this pins:
//   * the studio's and the order page's APPAREL tables are exactly what
//     tools/apparel-table.mjs prints from lib/products-catalog.js;
//   * every catalog variant's price is its garment's rule price, a whole
//     number of dollars plus 95 cents;
//   * the Apparel tile opens a lit garment panel (name, Back, a picture and a
//     price on every garment, every picture loading); a garment opens its
//     size and colour panel, whose Back is the garment panel;
//   * a hoodie, size and colour carries through to the order page, which
//     prices it from the table and checks out apparel-hoodie with that size
//     and colour; a colour with its own price (the kids tee's Charcoal XS)
//     is priced as its own.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const ROOT = path.join(__dirname, '..');
const T = (page, ms) => page.waitForTimeout(ms);
const tap = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, sel);
const tableOf = (src) => { const m = /const APPAREL=(\{.*?\});\n/.exec(src); return m ? m[1] : null; };

const scenarios = {};

scenarios.theTablesAndThePrices = async () => {
  const want = /const APPAREL=(\{.*\});/.exec(execFileSync('node', [path.join(ROOT, 'tools', 'apparel-table.mjs')], { encoding: 'utf8' }))[1];
  const bad = [];
  for (const f of ['needles-studio.html', 'order.html']) {
    const got = tableOf(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    if (got !== want) bad.push(`${f}'s APPAREL is not the catalog's (run node tools/apparel-table.mjs)`);
  }
  const { PRODUCTS_CATALOG } = await import(pathToFileURL(path.join(ROOT, 'lib', 'products-catalog.js')).href);
  let n = 0;
  for (const k of Object.keys(JSON.parse(want))) {
    const p = PRODUCTS_CATALOG[k];
    if (!p) { bad.push(`${k} is not in the catalog`); continue; }
    for (const [s, e] of Object.entries(p.sizes)) for (const c of e.colors) {
      const price = typeof c.price === 'number' ? c.price : e.price; n++;
      if (Math.round(price * 100) % 100 !== 95) bad.push(`${k} ${s} ${c.name} is $${price}, not a 95-cent price`);
    }
    if (Object.values(p.sizes).reduce((a, e) => a + e.colors.length, 0) > 100) bad.push(`${k} has more than Printify's 100 variants`);
  }
  return bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: the studio and the order page carry the catalog's table exactly; ${n} variants, every one at a 95-cent price, no garment over 100 variants`;
};

scenarios.thePanelsAndTheOrder = async (page, log) => {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  const tile = await page.evaluate(() => document.querySelector('#productCard .btn-select[data-val="tshirt"]').innerText);
  if (!/Apparel/.test(tile) || !/\$6\.95/.test(tile)) return `FAIL: the tile reads "${tile.replace(/\n/g, ' / ')}"`;
  await tap(page, '#productCard .btn-select[data-val="tshirt"]');
  await T(page, 1900); await dismissAlerts(page);
  const st = await page.evaluate(async () => {
    const card = document.getElementById('apparelStyleCard'), r = card.getBoundingClientRect();
    const tiles = [...card.querySelectorAll('.btn-select')];
    const imgs = tiles.map((t) => t.querySelector('img')).filter(Boolean);
    await Promise.all(imgs.map((im) => im.complete ? null : new Promise((res) => { im.onload = im.onerror = res; })));
    return { focus: [...document.body.classList].filter((c) => c.endsWith('-focus')).join(), title: card.querySelector('.card-title').innerText,
      back: [...card.querySelectorAll('button')].some((b) => b.offsetParent && /back/i.test(b.innerText)),
      tiles: tiles.length, pics: imgs.filter((im) => im.naturalWidth > 0).length, prices: tiles.filter((t) => /\$\d/.test(t.innerText)).length,
      top: Math.round(r.top), H: innerHeight, size: getComputedStyle(document.getElementById('tshirtOptionCard')).display };
  });
  if (st.focus !== 'apparel-style-focus' || !/Apparel/i.test(st.title) || !st.back) return `FAIL: the garment panel is not lit with its name and Back (${JSON.stringify(st)})`;
  if (st.tiles !== 11 || st.pics !== 11 || st.prices !== 11) return `FAIL: ${st.tiles} garments, ${st.pics} pictures loading, ${st.prices} prices`;
  if (st.top < -2 || st.top > st.H * 0.25) return `FAIL: the garment panel did not land at its title (top ${st.top})`;
  if (st.size !== 'none') return 'FAIL: the size panel shows before a garment is picked';
  await tap(page, '#apparelStyleGrid .btn-select[data-apparel="apparel-hoodie"]');
  await T(page, 1900);
  const sz = await page.evaluate(() => ({ focus: [...document.body.classList].filter((c) => c.endsWith('-focus')).join(), title: document.getElementById('apparelSizeTitle').innerText,
    sizes: [...document.querySelectorAll('#tshirtOptionGrid .btn-select')].map((b) => b.innerText.replace(/\n/g, ' ')), colours: document.querySelectorAll('#tshirtColorGrid .color-btn').length,
    pic: document.getElementById('apparelSizePic').getAttribute('src') }));
  if (sz.focus !== 'tshirt-option-focus' || !/Hoodie/i.test(sz.title) || sz.pic !== 'art/options/apparel-hoodie.jpg') return `FAIL: the hoodie opened ${JSON.stringify(sz)}`;
  if (!sz.sizes.includes('S $23.95') || !sz.sizes.includes('5XL $27.95') || sz.colours !== 12) return `FAIL: the hoodie's sizes are ${sz.sizes.join(', ')} with ${sz.colours} colours`;
  // Back is the garment panel, and forward again.
  await page.evaluate(() => apparelSizeBack());
  await T(page, 1500);
  if (await page.evaluate(() => [...document.body.classList].filter((c) => c.endsWith('-focus')).join()) !== 'apparel-style-focus') return 'FAIL: Back from the size did not light the garment panel';
  await tap(page, '#apparelStyleGrid .btn-select[data-apparel="apparel-hoodie"]');
  await T(page, 1200);
  await tap(page, '#tshirtOptionGrid .btn-select[data-opt="XL"]');
  await tap(page, '#tshirtColorGrid .color-btn[data-tcolor="Navy"]');
  await T(page, 1500); await dismissAlerts(page);
  if (!(await page.evaluate(() => document.body.classList.contains('ideafirst-focus')))) return 'FAIL: a garment, size and colour did not reach the description box';
  // The order page, handed the design the way the studio hands it.
  const pending = await page.evaluate(() => ({ placements: { left: location.origin + '/__fake/design.png', front: null, right: null }, deviceId: 'dev_test', productIcon: 'tshirt',
    preselectedApparel: selectedApparel, preselectedTshirt: selectedTshirt, preselectedTshirtColor: selectedTshirtColor }));
  await page.evaluate((p) => localStorage.setItem('muggshotz_pending_order', JSON.stringify(p)), pending);
  await page.goto('http://127.0.0.1:8788/order.html'); await T(page, 3000);
  const o = await page.evaluate(() => ({ base: document.getElementById('summaryBase').textContent, head: document.getElementById('orderHeadlineName').textContent,
    label: document.getElementById('summaryStyleSize')?.textContent || '' }));
  if (o.base !== '$23.95' || o.head !== 'Hoodie' || !/Hoodie, XL, Navy/.test(o.label)) return `FAIL: the order page shows ${JSON.stringify(o)}`;
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== 'apparel-hoodie' || b.sizeLabel !== 'XL' || b.colorName !== 'Navy') return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, c: b.colorName })}`;
  // A colour with its own price.
  await page.evaluate(() => localStorage.setItem('muggshotz_pending_order', JSON.stringify({ placements: { left: location.origin + '/__fake/design.png' }, deviceId: 'dev_test', productIcon: 'tshirt',
    preselectedApparel: 'apparel-kids-tee', preselectedTshirt: 'XS', preselectedTshirtColor: 'Charcoal' })));
  await page.goto('http://127.0.0.1:8788/order.html'); await T(page, 2500);
  const kid = await page.evaluate(() => document.getElementById('summaryBase').textContent);
  if (kid !== '$11.95') return `FAIL: the kids tee in Charcoal XS is priced ${kid}, not its own $11.95`;
  return 'PASS: Apparel from $6.95 opens a lit panel of 11 garments, each with a loading picture and a price; the hoodie opens its sizes ($23.95 to $27.95) and 12 colours, Back returns to the garments; XL Navy reaches the description, and the order page prices it $23.95, heads it Hoodie and checks out apparel-hoodie / XL / Navy; Charcoal XS kids tee is $11.95';
};

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } })) {
    for (const [name, fn] of Object.entries(scenarios)) {
      if (name === 'theTablesAndThePrices' && screen === 'phone') continue;
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
  console.log(fails === 0 ? '\nALL APPAREL VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
