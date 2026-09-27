// PLACEMATS (Alyx, 27 Sep 2026: "create the category"). Two Printify products
// behind one tile: Cotton (18 x 14 in, prints 2925 x 2325) and Neoprene
// (Printify's 12 x 18 desk mat, prints 5610 x 3839, which replaced Quilted)
// (12 x 18 in, prints 2925 x 2025). What this pins:
//   * the tile shows its price; it opens a lit card with both kinds, each with
//     a picture and its price ($16.95 / $13.95, Alyx's prices);
//   * each kind paints wide and comes back cut to its own print shape, and
//     approving fetches the right Printify mockup;
//   * the order page prices the kind carried from the studio and checks out
//     its own catalog product and size.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
// Cotton is bought singly here, Neoprene as a set of two (the same design twice,
// priced as one item), so both routes through the card are driven.
const KINDS = {
  Cotton: { key: 'placemat-cotton', size: '18 x 14 in', price: '$16.95', ratio: 2925 / 2325, pack: 1, label: /Cotton Placemat, 18 x 14/ },
  Neoprene: { key: 'placemat-neoprene', size: '12 x 18 in, set of 2', price: '$24.95', ratio: 5610 / 3839, pack: 2, label: /Neoprene Placemats, set of 2/ },
  // The Stitched Edge desk mat's two sizes (27 Sep 2026): each its own shape.
  Large: { key: 'placemat-stitched', size: '24 x 14 in', price: '$11.95', ratio: 7350 / 4350, pack: 1, label: /Large Placemat, 24 x 14/ },
  Kids: { key: 'placemat-stitched', size: '14.5 x 12.2 in, set of 2', price: '$16.95', ratio: 4709 / 3984, pack: 2, label: /Kids' Placemats, set of 2/ }
};

async function run(page, log, kind) {
  const want = KINDS[kind];
  // A full-canvas painting, so the cut to shape is the only thing changing it.
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1536; c.height = 1024;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 1536, 0);
    gr.addColorStop(0, '#b3202a'); gr.addColorStop(1, '#1f3f8f'); g.fillStyle = gr; g.fillRect(0, 0, 1536, 1024);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.route('**/__fake/generated.jpg', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(b64, 'base64') }));
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  const tile = await page.evaluate(() => document.querySelector('#productCard .btn-select[data-val="placemat"]')?.innerText || '');
  if (!/Placemats/.test(tile) || !/\$9\.95/.test(tile)) return `FAIL: the tile reads "${tile.replace(/\n/g, ' / ')}"`;
  await page.evaluate(() => document.querySelector('#productCard .btn-select[data-val="placemat"]').click());
  await T(page, 1800); await dismissAlerts(page);
  const card = await page.evaluate(async () => {
    const c = document.getElementById('placematOptionCard');
    const tiles = [...c.querySelectorAll('.btn-select')];
    const imgs = tiles.map((t) => t.querySelector('img'));
    await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
    return { focus: [...document.body.classList].filter((x) => x.endsWith('-focus')).join(), shown: getComputedStyle(c).display !== 'none',
      tiles: tiles.map((t) => t.innerText.replace(/\n/g, ' ')), pics: imgs.filter((im) => im.naturalWidth > 0).length, top: Math.round(c.getBoundingClientRect().top), H: innerHeight };
  });
  if (!card.shown || card.focus !== 'placemat-option-focus') return `FAIL: the tile did not open the lit placemat card (${JSON.stringify(card)})`;
  const wantTiles = [/Cotton.*\$16\.95/, /Neoprene.*\$13\.95/, /Large.*24 x 14.*\$11\.95/, /Kids.*14\.5 x 12\.2.*\$9\.95/];
  if (card.tiles.length !== 4 || card.pics !== 4 || wantTiles.some((re, i) => !re.test(card.tiles[i]))) return `FAIL: the card offers ${JSON.stringify(card.tiles)} with ${card.pics} pictures`;
  if (card.top < -2 || card.top > card.H * 0.5) return `FAIL: the card did not land at its title (top ${card.top})`;
  await page.evaluate((k) => document.querySelector(`#placematOptionGrid .btn-select[data-opt="${k}"]`).click(), kind);
  await T(page, 1200); await dismissAlerts(page);
  // One, or a set of two: asked before the description.
  if (await page.evaluate(() => document.body.classList.contains('ideafirst-focus'))) return 'FAIL: the idea box opened before one-or-two was chosen';
  const packs = await page.evaluate(() => [...document.querySelectorAll('#placematPackGrid .btn-select')].map((b) => b.innerText.replace(/\n/g, ' ')));
  const setPrice = { Cotton: '29.95', Neoprene: '24.95', Large: '20.95', Kids: '16.95' }[kind], onePrice = { Cotton: '16.95', Neoprene: '13.95', Large: '11.95', Kids: '9.95' }[kind];
  if (packs.length !== 2 || !packs[0].includes('Just one $' + onePrice) || !packs[1].includes('A set of two $' + setPrice)) return `FAIL: the one-or-two choice reads ${JSON.stringify(packs)}`;
  await page.evaluate((n) => document.querySelector(`#placematPackGrid .btn-select[data-pack="${n}"]`).click(), want.pack);
  await T(page, 1200); await dismissAlerts(page);
  if (!(await page.evaluate(() => document.body.classList.contains('ideafirst-focus')))) return 'FAIL: picking a placemat did not reach the idea box';
  await page.fill('#ideaDesc', 'autumn leaves around a pumpkin pie');
  await dismissAlerts(page);
  log.apiCalls.length = 0;
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await T(page, 800);
  const gen = log.apiCalls.find((x) => x.path === '/api/generate');
  if (!gen) return 'FAIL: nothing was painted';
  if (gen.body.size !== '1536x1024') return `FAIL: the placemat painted on ${gen.body.size}, not 1536x1024`;
  const d = await page.evaluate(async () => {
    const im = await loadImageFromUrl(findDesignById(currentDesignId).url);
    return { w: im.naturalWidth, h: im.naturalHeight };
  });
  const shape = d.w / d.h;
  if (Math.abs(shape - want.ratio) > 0.01) return `FAIL: the ${kind} design is ${d.w}x${d.h} (${shape.toFixed(3)}:1), not its print's ${want.ratio.toFixed(3)}:1`;
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await passFadePage(page);
  await T(page, 8000);
  const start = log.apiCalls.find((x) => x.path === '/api/start-mockup' && x.action === 'start');
  if (!start) return `FAIL: approving the ${kind} placemat fetched no Printify mockup`;
  if (start.body.productKey !== want.key || start.body.sizeLabel !== want.size) return `FAIL: the mockup asked for ${start.body.productKey} / ${start.body.sizeLabel}`;
  // The order page, handed the kind the way the studio hands it.
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  const pending = await page.evaluate(() => ({ placements: { left: location.origin + '/__fake/design.png', front: null, right: null }, deviceId: 'dev_test', productIcon: 'placemat', preselectedPlacemat: selectedPlacemat, preselectedPlacematPack: selectedPlacematPack }));
  await page.evaluate((p) => localStorage.setItem('muggshotz_pending_order', JSON.stringify(p)), pending);
  await page.goto('http://127.0.0.1:8788/order.html'); await T(page, 3000);
  const o = await page.evaluate(() => ({ base: document.getElementById('summaryBase').textContent, label: document.getElementById('summaryStyleSize')?.textContent || '' }));
  if (o.base !== want.price || !want.label.test(o.label)) return `FAIL: the order page shows ${JSON.stringify(o)}`;
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
  const b = bodies[bodies.length - 1];
  if (!b || b.productKey !== want.key || b.sizeLabel !== want.size || !b.image) return `FAIL: checkout got ${JSON.stringify(b && { k: b.productKey, s: b.sizeLabel, image: !!b.image })}`;
  return `PASS: ${kind}${want.pack === 2 ? ' (set of two)' : ''}: the lit card offers all four kinds with pictures and prices, then one or a set of two; it paints 1536x1024 and comes back ${d.w}x${d.h} (${shape.toFixed(3)}:1); the mockup and checkout are ${want.key} / ${want.size} at ${want.price}`;
}

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } })) {
    for (const kind of Object.keys(KINDS)) {
      const { browser, page, log } = await launch({ viewport, echoUploads: true });
      let result;
      try { await openStudio(page); await uploadPhoto(page); await dismissAlerts(page); result = await run(page, log, kind); }
      catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
      console.log(`[${screen}] ${result}`);
      if (!/^PASS/.test(result)) fails++;
      if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
      await browser.close();
    }
  }
  console.log(fails === 0 ? '\nALL PLACEMAT VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
