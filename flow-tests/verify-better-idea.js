// "GOT A BETTER IDEA?" (Alyx, 6-7 Oct 2026): the last tile of a flyer page's
// mats, where a visitor describes their own mat. On a laptop and a phone, with
// every server call faked:
//   * a new visitor: types an idea, gives an email (the Halloween flyer's code),
//     waits for the link, and the mat paints by itself once the tries arrive --
//     through the described-design lane, the mat's rule and its 1.63 shape and
//     nothing else; the tile becomes their mat, and Order checks it out as a
//     doormat with that picture as the print, never through the studio;
//   * a visitor with tries left: it paints straight away, and Try another
//     keeps their words to edit;
//   * the pool closed: no email is asked for, the token packs are offered, and
//     a pack bought here comes back to /halloween;
// and the pool itself (lib/free-pool.js): each flyer's own, two tries a time,
// closed at 300 and staying closed until a sale from that flyer's page buys 50
// back (never past full, never into another flyer's pool) or it is reopened.
// Run with the repo served on 127.0.0.1:8788.
const path = require('path');
const { pathToFileURL } = require('url');
const { launch, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const SCREENS = { laptop: { width: 1366, height: 860 }, phone: { width: 390, height: 844 } };
const PIC = `${BASE}/art/unwelcome/show/six-feet-under.jpg`;

// The faked server: tries on this device, whether the flyers' pool is open,
// and every body the page sent.
async function fake(page, state) {
  const sent = { verify: [], generate: [], checkout: [] };
  await page.route('**/api/get-balance**', (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get('card')) return route.fulfill({ json: { on: true, spins: 2, pool: true, open: state.open } });
    return route.fulfill({ json: { tokenBalance: state.tries, emailVerified: state.verified, hasPurchased: false, isAdmin: false } });
  });
  await page.route('**/api/send-verification', (route) => { sent.verify.push(route.request().postDataJSON()); route.fulfill({ json: { success: true } }); });
  await page.route('**/api/generate', (route) => { sent.generate.push(route.request().postDataJSON()); state.tries = Math.max(0, state.tries - 1); route.fulfill({ json: { imageUrl: PIC } }); });
  await page.route('**/api/create-checkout-session', (route) => { sent.checkout.push(route.request().postDataJSON()); route.fulfill({ json: { url: `${BASE}/__fake/checkout-redirect` } }); });
  return sent;
}
const tile = (page) => page.evaluate(() => { const t = document.getElementById('ideaTile-mat'); return t ? { open: t.classList.contains('open'), text: t.textContent.replace(/\s+/g, ' ').trim(), img: (t.querySelector('img.mine') || {}).src || null } : null; });
async function openAndType(page, words) {
  await page.goto(`${BASE}/occasion.html?o=halloween`); await T(page, 1800);
  await page.click('#ideaTile-mat'); await T(page, 700);
  await page.fill('#ideaText-mat', words);
  await page.click('#ideaTile-mat .go'); await T(page, 900);
}
const IDEA = 'A grumpy ghost holding a sign: No soliciting, unless you have candy';

const scenarios = {};
scenarios.aNewVisitor = async (page) => {
  const state = { tries: 0, verified: false, open: true };
  const sent = await fake(page, state);
  await openAndType(page, IDEA);
  let t = await tile(page);
  if (!t || !/Your first two are free/.test(t.text)) return `FAIL: no email step after Make my mat (${JSON.stringify(t)})`;
  await page.fill('#ideaEmail-mat', 'ghost@example.com');
  await page.click('#ideaTile-mat .go'); await T(page, 900);
  const v = sent.verify[0] || {};
  if (v.email !== 'ghost@example.com' || v.cardCode !== 'HALLOWEEN' || !v.deviceId) return `FAIL: the email went as ${JSON.stringify(v)}`;
  t = await tile(page);
  if (!/Check your email/.test(t.text) || !/ghost@example\.com/.test(t.text)) return `FAIL: no waiting step (${t.text})`;
  if (sent.generate.length) return 'FAIL: painted before the email was confirmed';
  state.tries = 2; state.verified = true;           // they tapped the link
  await T(page, 6000);
  const g = sent.generate[0];
  if (!g) return 'FAIL: the mat did not paint by itself once the tries arrived';
  if (g.action !== 'textOnly' || g.prompt !== IDEA || g.size !== '1536x1024' || 'bandRatio' in g || !/^doormat artwork/.test(g.shapingRule) || g.image || g.styleDirective)
    return `FAIL: painted as ${JSON.stringify(g)}`;
  t = await tile(page);
  if (t.img !== PIC || !/Order this mat · \$19\.95/.test(t.text) || !/Try another idea/.test(t.text) || !/1 try left/.test(t.text)) return `FAIL: the tile did not become their mat (${JSON.stringify(t)})`;
  const ratio = await page.evaluate(() => { const r = document.querySelector('#ideaTile-mat img.mine').getBoundingClientRect(); return r.width / r.height; });
  if (Math.abs(ratio - 4650 / 2850) > 0.02) return `FAIL: their mat is shown at ${ratio.toFixed(3)}:1, not the mat's 1.632`;
  await page.click('#ideaTile-mat .go'); await T(page, 1200);
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'));
  const overlay = await page.evaluate(() => !!document.getElementById('orderPageFrame'));
  if (!pending || pending.productIcon !== 'doormat' || pending.placements.left !== PIC || pending.premadeItem || pending.occasion !== 'halloween' || !overlay)
    return `FAIL: the order went as ${JSON.stringify(pending)} (checkout over the page: ${overlay})`;
  return 'PASS: idea, email with the flyer code, a wait, then it paints by itself from their words alone, filling the canvas (no strip), shown at the mat\'s 1.63; the tile becomes their mat and orders as a doormat with it';
};
scenarios.withTriesLeft = async (page) => {
  const state = { tries: 3, verified: true, open: true };
  const sent = await fake(page, state);
  await openAndType(page, IDEA); await T(page, 1500);
  if (sent.verify.length || sent.generate.length !== 1) return `FAIL: with tries left it asked for an email or did not paint (${sent.verify.length}, ${sent.generate.length})`;
  await page.click('#ideaTile-mat .go.alt'); await T(page, 600);
  const kept = await page.inputValue('#ideaText-mat').catch(() => null);
  if (kept !== IDEA) return `FAIL: Try another lost their words (${kept})`;
  return 'PASS: tries left paint straight away; Try another keeps their words';
};
scenarios.thePoolClosed = async (page) => {
  const state = { tries: 0, verified: false, open: false };
  const sent = await fake(page, state);
  await openAndType(page, IDEA);
  const t = await tile(page);
  if (!/Today's free tries are all taken/.test(t.text) || !/3 more tries · \$1\.33/.test(t.text) || !/20 more tries · \$5/.test(t.text) || sent.verify.length)
    return `FAIL: closed pool shows ${JSON.stringify(t)} (emails sent: ${sent.verify.length})`;
  await page.click('#ideaTile-mat .go'); await T(page, 1200);
  const c = sent.checkout[0] || {};
  if (c.type !== 'token_purchase' || c.packId !== '3tokens' || c.returnTo !== '/halloween') return `FAIL: the pack went as ${JSON.stringify(c)}`;
  return 'PASS: a closed pool asks for no email, offers the packs, and a pack bought here comes back to /halloween';
};

// THE MAGIC MUG'S BOX (Alyx, 7 Oct 2026: "the same box at the end of the
// magic mugs"): the mugs' grid ends with it; two halves to describe; it paints
// through the same lane with the wrap's 2.14 as the band, the punchline left
// and the setup right; the tile shows the flat wrap; Order cuts the print to
// 2475 x 1155 from the painting and checks it out as a smart mug with the hand
// chosen, the halves swapped for the left hand.
scenarios.theMugBox = async (page) => {
  const state = { tries: 3, verified: true, open: true };
  const sent = await fake(page, state);
  await page.goto(`${BASE}/occasion.html?o=halloween`); await T(page, 1800);
  await page.evaluate(() => occGo('magic')); await T(page, 1200);
  const last = await page.evaluate(() => { const t = [...document.querySelectorAll('.mugs > *')].pop(); return t ? { id: t.id, text: t.textContent.replace(/\s+/g, ' ').trim() } : null; });
  if (!last || last.id !== 'ideaTile-mug' || !/Got a better idea\?.*Your own Magic Mug.*\$19\.95/.test(last.text)) return `FAIL: the mugs' grid ends with ${JSON.stringify(last)}`;
  await page.click('#ideaTile-mug'); await T(page, 700);
  await page.click('#ideaTile-mug .go'); await T(page, 500);
  if (sent.generate.length || !/both halves/.test(await page.textContent('#ideaTile-mug'))) return 'FAIL: it painted with the halves empty';
  await page.fill('#ideaText-mug', 'A vampire at the dentist');
  await page.fill('#ideaText2-mug', 'The dentist: "Well, there\'s your problem"');
  await page.click('#ideaTile-mug .go'); await T(page, 1500);
  const g = sent.generate[0];
  if (!g) return 'FAIL: the mug did not paint';
  if (g.action !== 'textOnly' || g.size !== '1536x1024' || Math.abs(g.bandRatio - 2475 / 1155) > 0.001 || !/^a Magic Mug's wrap/.test(g.shapingRule)
    || !/RIGHT scene is the setup[^\n]*A vampire at the dentist/.test(g.prompt) || !/LEFT scene is the punchline[^\n]*your problem/.test(g.prompt) || g.image || g.styleDirective)
    return `FAIL: painted as ${JSON.stringify(g)}`;
  const t = await page.evaluate(() => { const el = document.getElementById('ideaTile-mug'), im = el.querySelector('img.mine'), r = im.getBoundingClientRect(); return { text: el.textContent.replace(/\s+/g, ' ').trim(), src: im.src, ratio: r.width / r.height }; });
  if (t.src !== PIC || !/Order this mug · \$19\.95/.test(t.text) || !/right-handed/.test(t.text) || Math.abs(t.ratio - 2475 / 1155) > 0.02) return `FAIL: the tile became ${JSON.stringify(t)}`;
  const order = async () => {
    await page.click('#ideaTile-mug .go'); await T(page, 1500);
    const p = await page.evaluate(() => JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'));
    const overlay = await page.evaluate(() => !!document.getElementById('orderPageFrame'));
    await page.evaluate(() => closeOrderOverlay()); await T(page, 600);
    const size = await page.evaluate((u) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = u; }), p.placements.left);
    return { p, overlay, size };
  };
  const right = await order();
  if (!right.overlay || right.p.productIcon !== 'smart mug' || right.p.preselectedSurpriseHand !== 'right' || !/^data:image\/jpeg/.test(right.p.placements.left) || right.p.occasion !== 'halloween'
    || right.p.ideaPrompt !== 'A vampire at the dentist / The dentist: "Well, there\'s your problem"' || JSON.stringify(right.size) !== '[2475,1155]')
    return `FAIL: the right-handed order went as ${JSON.stringify({ ...right, p: { ...right.p, placements: { left: right.p.placements.left.slice(0, 30) } } })}`;
  await page.evaluate(() => occHand('left')); await T(page, 300);
  if (!/left hand/.test(await page.textContent('#ideaTile-mug'))) return 'FAIL: picking the left hand did not change the note under the mug';
  const left = await order();
  if (left.p.preselectedSurpriseHand !== 'left' || JSON.stringify(left.size) !== '[2475,1155]' || left.p.placements.left === right.p.placements.left) return 'FAIL: the left-handed print is not the halves swapped';
  // The halves really swapped: the left half of one print is the right half of the other.
  const same = await page.evaluate(([a, b]) => new Promise((res) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    Promise.all([load(a), load(b)]).then(([ia, ib]) => {
      const c = document.createElement('canvas'); c.width = 2475; c.height = 1155; const x = c.getContext('2d');
      x.drawImage(ia, 0, 0); const A = x.getImageData(0, 0, 1237, 1155).data;
      x.drawImage(ib, 0, 0); const B = x.getImageData(1238, 0, 1237, 1155).data;
      let d = 0; for (let i = 0; i < A.length; i += 40) d += Math.abs(A[i] - B[i]);
      res(d / (A.length / 40));
    });
  }), [right.p.placements.left, left.p.placements.left]);
  if (same > 6) return `FAIL: the left print's right half differs from the right print's left half by ${same.toFixed(1)} a pixel`;
  return 'PASS: the mugs\' grid ends with the box; two halves; painted once as a 2.14 strip, punchline left and setup right; the tile shows the flat wrap; Order cuts the 2475 x 1155 print and checks out a smart mug for the hand chosen, halves swapped for the left';
};

// CONSIGNMENT (Alyx, 6-7 Oct 2026): under a painted design, "Love it? Get
// paid for it" and an (i) that explains the terms; the form wants a name, an
// email and the tick; the design goes to the pitch system as a consign kind
// with the picture itself; then the tile says so and still offers the order.
scenarios.consignIt = async (page) => {
  const state = { tries: 3, verified: true, open: true };
  const sent = await fake(page, state);
  const pitches = [];
  await page.route('**/api/admin', (route) => { pitches.push(route.request().postDataJSON()); route.fulfill({ json: { ok: true, id: 'test-1' } }); });
  await openAndType(page, IDEA); await T(page, 1500);
  let t = await tile(page);
  if (!/Love it\? Get paid for it/.test(t.text)) return `FAIL: no consignment offer under the mat (${t.text})`;
  await page.click('#ideaTile-mat .info'); await T(page, 300);
  const info = await page.evaluate(() => { const el = document.getElementById('ideaInfo'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; });
  if (!info || !/25% of the net profit on every one sold/.test(info) || !/until 1 November 2027/.test(info) || !/does not use a try/.test(info)) return `FAIL: the (i) panel says ${JSON.stringify(info)}`;
  await page.click('#ideaInfo .go'); await T(page, 200);
  if (await page.evaluate(() => !!document.getElementById('ideaInfo'))) return 'FAIL: Got it did not close the panel';
  await page.click('#ideaTile-mat .consignrow .go'); await T(page, 400);
  await page.click('#ideaTile-mat .go'); await T(page, 300);
  t = await tile(page);
  if (pitches.length || !/who to pay/.test(t.text)) return `FAIL: it sent with no name (${pitches.length}; ${t.text})`;
  await page.fill('#ideaName-mat', 'Casper Ghost');
  await page.fill('#ideaEmail-mat', 'casper@example.com');
  await page.click('#ideaTile-mat .go'); await T(page, 300);
  t = await tile(page);
  if (pitches.length || !/tick the box/.test(t.text)) return `FAIL: it sent without the tick (${pitches.length}; ${t.text})`;
  await page.check('#ideaAgree-mat');
  await page.click('#ideaTile-mat .go'); await T(page, 1500);
  const p = pitches[0];
  if (!p || p.action !== 'pitch' || p.kind !== 'consign' || p.text !== IDEA || p.name !== 'Casper Ghost' || p.email !== 'casper@example.com' || p.agree !== true || !p.deviceId
    || !/^data:image\/jpeg;base64,/.test(p.image || '') || !p.context || p.context.occasion !== 'halloween' || !/Mats/.test(p.context.product))
    return `FAIL: the submission went as ${JSON.stringify({ ...p, image: (p && p.image || '').slice(0, 24) })}`;
  t = await tile(page);
  if (!/Submitted for consignment/.test(t.text) || !/Order this mat · \$19\.95/.test(t.text) || /Get paid for it/.test(t.text)) return `FAIL: after sending the tile reads ${t.text}`;
  return 'PASS: Love it? Get paid for it, the (i) terms (25% of net profit until 1 Nov 2027, no try used), name, email and the tick required, the design itself sent as a consign pitch, then the tile says so and still orders';
};

// THE COUNTER (Alyx, 7 Oct 2026): a confirmed email at zero tokens sees the
// product's free spins; at none, "buy some, or come back later", and Generate's
// gate closes to the popup instead of a round trip.
scenarios.theStudioCounter = async (page) => {
  const pool = { left: 18, bank: 0, used: 2, cap: 5 };
  await page.route('**/api/get-balance**', (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.has('pool')) return route.fulfill({ json: { name: u.searchParams.get('pool'), ...pool, canSpin: (pool.used < pool.cap && pool.left > 0) || pool.bank > 0 } });
    return route.fulfill({ json: { tokenBalance: 0, emailVerified: true, freeSpin: true, hasPurchased: false, isAdmin: false } });
  });
  await page.goto(`${BASE}/needles-studio.html`); await T(page, 2500);
  const line = () => page.evaluate(() => { const el = document.getElementById('freeSpinsLine'); return el && el.style.display !== 'none' ? el.textContent.replace(/\s+/g, ' ').trim() : null; });
  if (await line()) return `FAIL: the counter shows before a product is picked (${await line()})`;
  await page.evaluate(() => { product = 'mug'; }); await T(page, 2500);
  let t = await line();
  if (!t || !/Free spins: 18 left for mugs/.test(t) || !/3 of your 5/.test(t)) return `FAIL: with spins left it reads ${JSON.stringify(t)}`;
  if (await page.evaluate(() => outOfSpins())) return 'FAIL: the gate is closed with 18 free spins left';
  pool.left = 0; pool.bank = 4;
  await page.evaluate(() => { product = 'doormat'; }); await T(page, 2500);
  t = await line();
  if (!t || !/4 spare free spins up for grabs for doormats/.test(t)) return `FAIL: with only the bank it reads ${JSON.stringify(t)}`;
  pool.bank = 0;
  await page.evaluate(() => { product = 'coaster'; }); await T(page, 2500);
  t = await line();
  if (!t || !/No free spins left for coasters right now/.test(t) || !/come back later/.test(t)) return `FAIL: at none it reads ${JSON.stringify(t)}`;
  if (!(await page.evaluate(() => outOfSpins()))) return 'FAIL: the gate stays open with no free spins';
  return 'PASS: the counter follows the product: spins left and the five, the banked spares, or buy some / come back later with the gate closed';
};

async function thePool() {
  const store = {};
  const realFetch = global.fetch;
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  const alerts = [];
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://ntfy.sh/')) { alerts.push(init.headers.Title); return { ok: true }; }
    const m = u.match(/\/flyer-free\/(.+)\.json$/); if (!m) throw new Error('unexpected fetch ' + u);
    if ((init.method || 'GET') === 'POST') { store[m[1]] = init.body; return { ok: true, text: async () => '' }; }
    return store[m[1]] ? { ok: true, status: 200, json: async () => JSON.parse(store[m[1]]) } : { ok: false, status: 404 };
  };
  process.env.RESEND_API_KEY = 'alerts-on';
  try {
    const P = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'free-pool.js')).href + '?t=' + Date.now());
    const C = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'card-bonus.js')).href);
    const o = C.cardOffer('halloween');
    if (!o || o.spins !== 2 || o.pool !== 'halloween' || o.page !== '/halloween') return `FAIL: the flyer's code is ${JSON.stringify(o)}`;
    if (C.cardOffer('MUGGSY').pool) return "FAIL: Bud's business card draws from a flyer's pool";
    // A sale with the pool at 20 used: back to 0, and the 30 over expands the
    // limit to 330 (Alyx, 7 Oct 2026: "overpayment expands the limit").
    await P.takeFromPool('halloween', 2); for (let i = 0; i < 9; i++) await P.takeFromPool('halloween', 2);
    let p = await P.creditPool('halloween');
    if (p.given !== 0 || p.size !== 330 || p.sales !== 1) return `FAIL: a sale at 20 used left ${JSON.stringify(p)}`;
    let given = 0;
    while (await P.takeFromPool('halloween', 2)) { given += 2; if (given > 400) break; }
    p = await P.readPool('halloween');
    if (given !== 330 || p.given !== 330 || p.open || alerts.length !== 1 || !/halloween flyer: free tries used up/.test(alerts[0])) return `FAIL: the pool gave ${given}, reads ${JSON.stringify(p)}, alerts ${JSON.stringify(alerts)}`;
    if (await P.takeFromPool('halloween', 2)) return 'FAIL: a closed pool paid again';
    if (alerts.length !== 1) return 'FAIL: the closed pool alerted again on a refusal';
    // Another flyer's pool is untouched by all of that.
    const x = await P.readPool('xmas');
    if (x.given !== 0 || !x.open) return `FAIL: the xmas pool reads ${JSON.stringify(x)}`;
    // A sale from the Halloween page buys 50 back and opens it; one from xmas buys Halloween nothing.
    await P.creditPool('xmas');
    if ((await P.readPool('halloween')).given !== 330) return 'FAIL: an xmas sale paid into the halloween pool';
    p = await P.creditPool('halloween');
    if (p.given !== 280 || p.size !== 330 || !p.open || p.sales !== 2 || !(await P.takeFromPool('halloween', 2))) return `FAIL: a sale left ${JSON.stringify(p)}`;
    const r = await P.reopenPool('halloween');
    if (!r.open || r.given !== 0 || r.size !== 300 || r.sales !== 2 || !(await P.takeFromPool('halloween', 2))) return `FAIL: reopening left ${JSON.stringify(r)}`;
    // THE CATEGORY POOLS: 25 a category, one a spin, 30 back a sale with the
    // surplus banked, and banked spins moved to a category that needs them.
    const CP = P.CATEGORY_POOL, mug = P.categoryKey('mug'), bottle = P.categoryKey('water bottle');
    if (mug !== 'cat-mug' || bottle !== 'cat-bottle') return `FAIL: category keys ${mug}, ${bottle}`;
    const sold = P.saleCategories({ product_keys: 'classic-white-mug,doormat' });
    if (JSON.stringify(sold) !== '["cat-mug","cat-doormat"]' || JSON.stringify(P.saleCategories({ product_key: 'doormat' })) !== '["cat-doormat"]' || P.saleCategories({}).length) return `FAIL: a sale feeds ${JSON.stringify(sold)}`;
    let spins = 0; while (await P.takeFromPool(mug, 1, CP)) { spins++; if (spins > 100) break; }
    let c = await P.readPool(mug, CP);
    if (spins !== 25 || c.size !== 25 || c.open) return `FAIL: the mug pool gave ${spins}, reads ${JSON.stringify(c)}`;
    c = await P.creditPool(mug, CP);
    if (c.given !== 0 || c.bank !== 5 || !c.open || c.sales !== 1) return `FAIL: a mug sale at 25 used left ${JSON.stringify(c)}`;
    c = await P.creditPool(mug, CP);
    if (c.given !== 0 || c.bank !== 35) return `FAIL: a second sale left ${JSON.stringify(c)}`;
    if ((await P.readPool('halloween')).given !== 2) return 'FAIL: a mug sale paid into the halloween flyer pool';
    for (let i = 0; i < 25; i++) await P.takeFromPool(bottle, 1, CP);
    let moved; try { moved = await P.movePool(mug, bottle, 40); return `FAIL: moved more than the bank holds (${JSON.stringify(moved)})`; } catch (e) {}
    moved = await P.movePool(mug, bottle, 30);
    const mugAfter = await P.readPool(mug, CP);
    if (moved.given !== 0 || moved.bank !== 5 || !moved.open || mugAfter.bank !== 5 || !(await P.takeFromPool(bottle, 1, CP))) return `FAIL: moving 30 left bottle ${JSON.stringify(moved)}, mug ${JSON.stringify(mugAfter)}`;
    // FIVE EACH, THEN THE LOTTERY: a device's free spins are counted; the bank pays one at a time until empty.
    if (P.FREE_SPIN_CAP !== 5) return `FAIL: the cap is ${P.FREE_SPIN_CAP}`;
    if ((await P.readFreeUsed('dev-a')) !== 0) return 'FAIL: a new device has used spins';
    for (let i = 0; i < 5; i++) await P.noteFreeSpin('dev-a');
    if ((await P.readFreeUsed('dev-a')) !== 5 || (await P.readFreeUsed('dev-b')) !== 0) return 'FAIL: the free-spin count is wrong';
    let fromBank = 0; while (await P.takeFromBank(bottle)) { fromBank++; if (fromBank > 50) break; }
    const bottleAfter = await P.readPool(bottle, CP);
    if (fromBank !== 5 || bottleAfter.bank !== 0 || (await P.takeFromBank(bottle))) return `FAIL: the bank paid ${fromBank}, left ${JSON.stringify(bottleAfter)}`;
    return 'PASS: each flyer its own pool, two a time, a sale buys 50 back (the rest grows the pool, never into another flyer), closed at 300 with one alert until a sale or a reopen; each category 25, a sale buys 30 back with the surplus banked and movable; five free spins a device, then the bank one at a time';
  } finally { global.fetch = realFetch; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.RESEND_API_KEY; }
}

(async () => {
  let fails = 0;
  const r0 = await thePool().catch((e) => 'ERROR: ' + e.message);
  if (!r0.startsWith('PASS')) fails++;
  console.log(`[thePool] ${r0}`);
  for (const [screen, viewport] of Object.entries(SCREENS)) {
    for (const [name, fn] of Object.entries(scenarios)) {
      const { browser, page, log } = await launch({ viewport });
      let r;
      try { r = await fn(page); } catch (e) { r = 'ERROR: ' + e.message; }
      const errs = log.pageErrors.filter((e) => !/ResizeObserver/.test(e));
      if (r.startsWith('PASS') && errs.length) r = 'FAIL: page errors: ' + errs.join(' | ');
      if (!r.startsWith('PASS')) fails++;
      console.log(`[${screen}] [${name}] ${r}`);
      await browser.close();
    }
  }
  console.log(fails ? `\n${fails} BETTER-IDEA VERIFICATION(S) FAILED` : '\nALL BETTER-IDEA VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
