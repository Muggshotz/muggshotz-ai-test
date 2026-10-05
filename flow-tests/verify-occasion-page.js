// THE OCCASION SITE (occasion.html, occasions/<name>.js; Alyx, 3 Oct 2026):
// the page a flyer's QR code opens, ordering straight to the order page and
// never through the studio. On a laptop and a phone:
//   * home: the headline, every Halloween mat pictured and priced, the Magic
//     Mugs, no "more" section while it has no designs; a flyer's ?ref= kept;
//   * a mat: lands on its view with Back and its title, steps round, and
//     Order checks out as the doormat with that mat's print file and the code,
//     marked as from the flyer (?from=flyer, kept when they come back without it);
//   * the Magic Mugs: the demonstration plays on the 3D mug, How it works
//     (six steps), each mug pictured and priced, and Order checks out the
//     halloween set with that one mug in the hand chosen;
//   * Back: every view steps back one, the order page's Back comes back to
//     the view it was opened from;
//   * "more": a test occasion with one coffee mug, coaster and placemat: each
//     shows, the coffee mug turns on the 3D mug, and each orders as itself.
// Run with the repo served on 127.0.0.1:8788.
const { launch, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const SCREENS = { laptop: { width: 1366, height: 860 }, phone: { width: 390, height: 844 } };
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];

// The order page as a page of its own, the same saved order (harness followToOrder).
async function checkout(page, bodies) {
  await page.waitForSelector('#orderPageFrame', { timeout: 15000 });
  await page.goto(`${BASE}/order.html`);
  await T(page, 3500);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2500);
  return bodies[bodies.length - 1];
}
function watchCheckout(page) {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  return bodies;
}
// Landed: the view's Back and title on screen.
async function landed(page) {
  return page.evaluate(() => {
    const b = document.querySelector('.view .back'), t = document.getElementById('viewTitle');
    if (!b || !t) return false;
    const rb = b.getBoundingClientRect(), rt = t.getBoundingClientRect();
    return rb.top >= 0 && rt.bottom <= innerHeight;
  });
}
const lineOf = (b) => (b && b.items ? b.items[0] : b) || {};

const scenarios = {};

scenarios.theHome = async (page) => {
  await page.goto(`${BASE}/occasion.html?o=halloween&ref=TEST-07`); await T(page, 2500);
  const h = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent,
    tiles: document.querySelectorAll('#secFeatured .tile').length,
    priced: [...document.querySelectorAll('#secFeatured .tile')].every((t) => t.querySelector('img') && t.querySelector('.pr')?.textContent === '$19.95'),
    magic: !!document.getElementById('secMagic'), more: !!document.getElementById('secMore'),
    ref: localStorage.getItem('muggshotz_referral_code'), title: document.title,
    cols: getComputedStyle(document.querySelector('#secFeatured .grid')).gridTemplateColumns.split(' ').length,
  }));
  const want = page.viewportSize().width >= 720 ? 3 : 2;
  if (h.h1 !== 'The Floor at Your DoorIs a Bit of a Bore.' || h.tiles !== 24 || !h.priced || !h.magic || h.more || h.ref !== 'TEST-07' || h.cols !== want) return `FAIL: home is ${JSON.stringify(h)}`;
  return `PASS: the headline, all 24 mats pictured at $19.95 (${want} across), the Magic Mugs, no empty "more", the flyer's code kept`;
};

scenarios.theMat = async (page) => {
  const bodies = watchCheckout(page);
  // Scanned the flyer once, came back later by the plain address.
  await page.goto(`${BASE}/occasion.html?o=halloween&from=flyer`); await T(page, 1200);
  await page.goto(`${BASE}/occasion.html?o=halloween&ref=TEST-07`); await T(page, 2000);
  await page.click('#secFeatured .tile[data-mat="six-feet-under"]'); await T(page, 900);
  if (!(await landed(page))) return 'FAIL: the mat view did not land with its Back and title on screen';
  const v = await page.evaluate(() => ({ name: document.querySelector('.nm-big')?.textContent, btn: document.getElementById('orderBtn')?.textContent }));
  if (v.name !== 'Six Feet Under' || v.btn !== 'Order this mat · $19.95') return `FAIL: the mat view shows ${JSON.stringify(v)}`;
  await page.click('.arr.r'); await T(page, 400);
  const next = await page.evaluate(() => document.querySelector('.nm-big')?.textContent);
  if (next !== 'Care for a Bite?') return `FAIL: next shows ${next}`;
  await page.click('.arr.l'); await T(page, 400);
  await page.click('#orderBtn');
  const raw = await checkout(page, bodies), b = lineOf(raw);
  if (b.productKey !== 'doormat' || !/\/art\/unwelcome\/print\/six-feet-under\.jpg$/.test(b.image || '') || b.referralCode !== 'TEST-07' || (raw || {}).source !== 'halloween/flyer')
    return `FAIL: checkout got ${JSON.stringify({ productKey: b.productKey, image: b.image, ref: b.referralCode, source: (raw || {}).source })}`;
  return 'PASS: a mat lands on its view, steps round, and checks out as the doormat with its own print file, the flyer code, and from halloween/flyer';
};

scenarios.theMagicMugs = async (page) => {
  const bodies = watchCheckout(page);
  await page.goto(`${BASE}/occasion.html?o=halloween`); await T(page, 2000);
  await page.click('#secMagic .card'); await T(page, 1200);
  if (!(await landed(page))) return 'FAIL: the Magic Mugs view did not land with its Back and title on screen';
  await T(page, 6000);
  const m = await page.evaluate(() => ({
    steps: document.querySelectorAll('.pm-step').length,
    mugs: [...document.querySelectorAll('.mugs .pm-mug3d img')].map((i) => i.alt),
    prices: [...document.querySelectorAll('.mugname span')].map((s) => s.textContent),
    demo: typeof MUG3D !== 'undefined' && MUG3D.mounted() && MUG3D.host() === document.getElementById('smartHowRevealStage'),
  }));
  if (m.steps !== 6 || JSON.stringify(m.mugs) !== '["Boo","Raise the Dead","Sheet Happens","Goes Right Through Me","When Pumpkins Dream","Sugar Skull","The Witching Hour","Marigold Raven","Marigold Cat","Marigold Jack-o’-Lantern","Silhouette Pumpkin","Silhouette Spider","Silhouette Cat","Silhouette Witch"]' || m.prices.some((p) => p !== '$19.95') || !m.demo) return `FAIL: the Magic Mugs show ${JSON.stringify(m)}`;
  await page.click('.mugs .pm-mug3d >> nth=1'); await T(page, 2500);
  const spun = await page.evaluate(() => MUG3D.mounted() && MUG3D.host() === document.querySelectorAll('.mugs .pm-mug3d-stage')[1]);
  if (!spun) return 'FAIL: tapping Sheet Happens did not turn it on the 3D mug';
  await page.click('[data-hand="left"]');
  // The Trick or Treat frame: the mugs wear it, and the order names it.
  await page.click('[data-frame="one"]'); await T(page, 1500);
  const fr = await page.evaluate(() => ({ files: [...document.querySelectorAll('.mugs .pm-mug3d')].map((e) => e.dataset.mug3d), handOn: document.querySelector('[data-hand="left"]').classList.contains('on'), frameOn: document.querySelector('[data-frame="one"]').classList.contains('on') }));
  // Every mug that offers the frame wears it; Sugar Skull and the Marigold and Silhouette sets offer none and stay plain.
  if (!fr.files.every((f) => /^halloween-(sugar-skull|marigold-|silhouette-)/.test(f) || f.endsWith('-one')) || !fr.files.includes('halloween-sugar-skull') || !fr.handOn || !fr.frameOn) return `FAIL: the frame choice shows ${JSON.stringify(fr)}`;
  await page.click('[data-order="sheet-happens"]');
  const raw = await checkout(page, bodies), b = lineOf(raw);
  if (b.setKey !== 'halloween' || JSON.stringify(b.mugs) !== '["sheet-happens~one"]' || b.hand !== 'left' || (raw || {}).source !== 'halloween') return `FAIL: checkout got ${JSON.stringify({ set: b.setKey, mugs: b.mugs, hand: b.hand, source: (raw || {}).source })}`;
  return 'PASS: the demonstration plays on the 3D mug, six steps, Raise the Dead and Sheet Happens at $19.95, a tap turns Sheet Happens, the Trick or Treat frame puts every mug in it, and it checks out as halloween / sheet-happens~one, left-handed, from halloween';
};

scenarios.theBack = async (page) => {
  await page.goto(`${BASE}/occasion.html?o=halloween`); await T(page, 2000);
  const state = () => page.evaluate(() => (document.getElementById('orderPageOverlay') ? 'order' : document.querySelector('.view')?.id || 'home'));
  await page.click('#secFeatured .tile[data-mat="witch-puddle"]'); await T(page, 700);
  await page.click('.view .back'); await T(page, 900);
  const tileOnScreen = await page.evaluate(() => { const r = document.querySelector('.tile[data-mat="witch-puddle"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  if ((await state()) !== 'home' || !tileOnScreen) return 'FAIL: Back from a mat did not land on Home at that mat';
  await page.click('#secFeatured .tile[data-mat="witch-puddle"]'); await T(page, 700);
  await page.click('#orderBtn'); await T(page, 1500);
  if ((await state()) !== 'order') return 'FAIL: Order did not open the order page over the site';
  await page.evaluate(() => document.getElementById('orderPageFrame').contentWindow.backToStudio && document.getElementById('orderPageFrame').contentWindow.document.querySelector('a[onclick*="backToStudio"]').click());
  await T(page, 1200);
  if ((await state()) !== 'viewMat') return `FAIL: the order page's Back went to ${await state()}, not the mat`;
  await page.click('.view .back'); await T(page, 900);
  await page.click('#secMagic .card'); await T(page, 900);
  await page.click('.view .back'); await T(page, 900);
  const magicOnScreen = await page.evaluate(() => { const r = document.getElementById('secMagic').getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight; });
  if ((await state()) !== 'home' || !magicOnScreen) return 'FAIL: Back from the Magic Mugs did not land on Home at the Magic Mugs';
  return "PASS: Back from a mat lands on Home at that mat; the order page's Back returns to the mat; Back from the Magic Mugs lands on Home at them";
};

// A test occasion with one of each "more" product, served in place of a file.
const TEST_OCCASION = `window.OCCASION = {
  key: "testocc", title: "Test", headline: "Test Page.", subline: "Sub", orderBy: "",
  featured: { title: "Mats", line: "18 x 30 in doormat", catalog: "doormat", size: "18 x 30", order: { productIcon: "doormat" },
    dir: "art/unwelcome", show: [900, 552], designs: [ { key: "six-feet-under", label: "Six Feet Under" } ] },
  magicMugs: { title: "Magic", line: "Hot.", set: "halloween", demo: "halloween-raise-the-dead" },
  moreTitle: "More",
  more: [
    { key: "coffee-mugs", title: "Coffee Mugs", line: "11oz", catalog: "classic-white-mug", size: "11oz", kind: "mug", pic: "mug-classic-white-11oz.webp",
      designs: [ { key: "gb", label: "Golden Brown", file: "art/surprise/wrap/golden-brown.jpg", pic: "art/surprise/mug/golden-brown.jpg" } ] },
    { key: "coasters", title: "Coasters", line: "4 x 4", catalog: "coaster-set", size: "4\\" x 4\\"", kind: "coaster", pic: "art/options/coaster-square.jpg",
      designs: [ { key: "c1", label: "Coaster One", file: "art/unwelcome/print/ouija.jpg", pic: "art/unwelcome/show/ouija.jpg" } ] },
    { key: "placemats", title: "Placemats", line: "18 x 12", catalog: "placemat-neoprene", size: "12 x 18 in", kind: "placemat", placemat: "Neoprene", pic: "art/options/placemat-neoprene.jpg",
      designs: [ { key: "p1", label: "Dino Pals", file: "art/placemats/print/dino-pals.jpg", pic: "art/placemats/show/dino-pals.jpg" } ] }
  ]
};`;

scenarios.theMore = async (page) => {
  await page.route('**/occasions/testocc.js*', (route) => route.fulfill({ contentType: 'application/javascript', body: TEST_OCCASION }));
  const results = [];
  for (const [key, want] of [['coffee-mugs', 'classic-white-mug'], ['coasters', 'coaster-set'], ['placemats', 'placemat-neoprene']]) {
    const bodies = watchCheckout(page);
    await page.goto(`${BASE}/occasion.html?o=testocc`); await T(page, 2000);
    const cards = await page.evaluate(() => [...document.querySelectorAll('#secMore .card')].map((c) => c.dataset.more + ':' + c.querySelector('.pr').textContent));
    if (cards.length !== 3) return `FAIL: the "more" section shows ${JSON.stringify(cards)}`;
    await page.click(`#secMore .card[data-more="${key}"]`); await T(page, key === 'coffee-mugs' ? 4000 : 900);
    if (!(await landed(page))) return `FAIL: ${key} did not land with its Back and title on screen`;
    if (key === 'coffee-mugs') {
      const live = await page.evaluate(() => MUG3D.mounted() && MUG3D.host() === document.querySelector('#moreMug .pm-mug3d-stage'));
      if (!live) return 'FAIL: the coffee mug did not turn on the 3D mug';
    }
    await page.click('#orderBtn');
    const b = lineOf(await checkout(page, bodies));
    const got = b.productKey || (b.mugType ? 'mug:' + b.mugType : '');
    const ok = key === 'coffee-mugs' ? (b.mugType === 'Classic White' && b.printMode === 'fullBleed' && /golden-brown\.jpg$/.test(b.panoramaImage || '')) : got === want;
    if (!ok) return `FAIL: ${key} checked out as ${JSON.stringify({ productKey: b.productKey, mugType: b.mugType, printMode: b.printMode, panorama: b.panoramaImage, image: b.image })}`;
    results.push(key);
  }
  return `PASS: with designs, the "more" section offers coffee mugs, coasters and placemats priced; the coffee mug turns on the 3D mug; each checks out as itself (${results.join(', ')})`;
};

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries(SCREENS)) {
    for (const [name, fn] of Object.entries(scenarios)) {
      const { browser, page, log } = await launch({ viewport, chromiumArgs: GL });
      let r;
      try { r = await fn(page); } catch (e) { r = 'ERROR: ' + e.message; }
      const errs = log.pageErrors.filter((e) => !/ResizeObserver/.test(e));
      if (r.startsWith('PASS') && errs.length) r = 'FAIL: page errors: ' + errs.join(' | ');
      if (!r.startsWith('PASS')) fails++;
      console.log(`[${screen}] [${name}] ${r}`);
      await browser.close();
    }
  }
  console.log(fails ? `\n${fails} OCCASION-PAGE VERIFICATION(S) FAILED` : '\nALL OCCASION-PAGE VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
