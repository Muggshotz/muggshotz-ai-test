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
const tile = (page) => page.evaluate(() => { const t = document.getElementById('ideaTile'); return t ? { open: t.classList.contains('open'), text: t.textContent.replace(/\s+/g, ' ').trim(), img: (t.querySelector('img.mine') || {}).src || null } : null; });
async function openAndType(page, words) {
  await page.goto(`${BASE}/occasion.html?o=halloween`); await T(page, 1800);
  await page.click('#ideaTile'); await T(page, 700);
  await page.fill('#ideaText', words);
  await page.click('#ideaTile .go'); await T(page, 900);
}
const IDEA = 'A grumpy ghost holding a sign: No soliciting, unless you have candy';

const scenarios = {};
scenarios.aNewVisitor = async (page) => {
  const state = { tries: 0, verified: false, open: true };
  const sent = await fake(page, state);
  await openAndType(page, IDEA);
  let t = await tile(page);
  if (!t || !/Your first two are free/.test(t.text)) return `FAIL: no email step after Make my mat (${JSON.stringify(t)})`;
  await page.fill('#ideaEmail', 'ghost@example.com');
  await page.click('#ideaTile .go'); await T(page, 900);
  const v = sent.verify[0] || {};
  if (v.email !== 'ghost@example.com' || v.cardCode !== 'HALLOWEEN' || !v.deviceId) return `FAIL: the email went as ${JSON.stringify(v)}`;
  t = await tile(page);
  if (!/Check your email/.test(t.text) || !/ghost@example\.com/.test(t.text)) return `FAIL: no waiting step (${t.text})`;
  if (sent.generate.length) return 'FAIL: painted before the email was confirmed';
  state.tries = 2; state.verified = true;           // they tapped the link
  await T(page, 6000);
  const g = sent.generate[0];
  if (!g) return 'FAIL: the mat did not paint by itself once the tries arrived';
  if (g.action !== 'textOnly' || g.prompt !== IDEA || g.size !== '1536x1024' || g.bandRatio !== 1.63 || !/^doormat artwork/.test(g.shapingRule) || g.image || g.styleDirective)
    return `FAIL: painted as ${JSON.stringify(g)}`;
  t = await tile(page);
  if (t.img !== PIC || !/Order this mat · \$19\.95/.test(t.text) || !/Try another idea/.test(t.text) || !/1 try left/.test(t.text)) return `FAIL: the tile did not become their mat (${JSON.stringify(t)})`;
  const ratio = await page.evaluate(() => { const r = document.querySelector('#ideaTile img.mine').getBoundingClientRect(); return r.width / r.height; });
  if (Math.abs(ratio - 4650 / 2850) > 0.02) return `FAIL: their mat is shown at ${ratio.toFixed(3)}:1, not the mat's 1.632`;
  await page.click('#ideaTile .go'); await T(page, 1200);
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'));
  const overlay = await page.evaluate(() => !!document.getElementById('orderPageFrame'));
  if (!pending || pending.productIcon !== 'doormat' || pending.placements.left !== PIC || pending.premadeItem || pending.occasion !== 'halloween' || !overlay)
    return `FAIL: the order went as ${JSON.stringify(pending)} (checkout over the page: ${overlay})`;
  return 'PASS: idea, email with the flyer code, a wait, then it paints by itself as a 1.63 mat from their words alone; the tile becomes their mat and orders as a doormat with it';
};
scenarios.withTriesLeft = async (page) => {
  const state = { tries: 3, verified: true, open: true };
  const sent = await fake(page, state);
  await openAndType(page, IDEA); await T(page, 1500);
  if (sent.verify.length || sent.generate.length !== 1) return `FAIL: with tries left it asked for an email or did not paint (${sent.verify.length}, ${sent.generate.length})`;
  await page.click('#ideaTile .go.alt'); await T(page, 600);
  const kept = await page.inputValue('#ideaText').catch(() => null);
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
  await page.click('#ideaTile .go'); await T(page, 1200);
  const c = sent.checkout[0] || {};
  if (c.type !== 'token_purchase' || c.packId !== '3tokens' || c.returnTo !== '/halloween') return `FAIL: the pack went as ${JSON.stringify(c)}`;
  return 'PASS: a closed pool asks for no email, offers the packs, and a pack bought here comes back to /halloween';
};

async function thePool() {
  const store = {};
  const realFetch = global.fetch;
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  const alerts = [];
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://ntfy.sh/')) { alerts.push(init.headers.Title); return { ok: true }; }
    const m = u.match(/\/flyer-free\/([a-z0-9-]+)\.json$/); if (!m) throw new Error('unexpected fetch ' + u);
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
    // A sale with the pool at 20 used: back to 0, never into credit.
    await P.takeFromPool('halloween', 2); for (let i = 0; i < 9; i++) await P.takeFromPool('halloween', 2);
    let p = await P.creditPool('halloween');
    if (p.given !== 0 || p.sales !== 1) return `FAIL: a sale at 20 used left ${JSON.stringify(p)}`;
    let given = 0;
    while (await P.takeFromPool('halloween', 2)) { given += 2; if (given > 400) break; }
    p = await P.readPool('halloween');
    if (given !== 300 || p.given !== 300 || p.open || alerts.length !== 1 || !/halloween flyer: free tries used up/.test(alerts[0])) return `FAIL: the pool gave ${given}, reads ${JSON.stringify(p)}, alerts ${JSON.stringify(alerts)}`;
    if (await P.takeFromPool('halloween', 2)) return 'FAIL: a closed pool paid again';
    if (alerts.length !== 1) return 'FAIL: the closed pool alerted again on a refusal';
    // Another flyer's pool is untouched by all of that.
    const x = await P.readPool('xmas');
    if (x.given !== 0 || !x.open) return `FAIL: the xmas pool reads ${JSON.stringify(x)}`;
    // A sale from the Halloween page buys 50 back and opens it; one from xmas buys Halloween nothing.
    await P.creditPool('xmas');
    if ((await P.readPool('halloween')).given !== 300) return 'FAIL: an xmas sale paid into the halloween pool';
    p = await P.creditPool('halloween');
    if (p.given !== 250 || !p.open || p.sales !== 2 || !(await P.takeFromPool('halloween', 2))) return `FAIL: a sale left ${JSON.stringify(p)}`;
    const r = await P.reopenPool('halloween');
    if (!r.open || r.given !== 0 || r.sales !== 2 || !(await P.takeFromPool('halloween', 2))) return `FAIL: reopening left ${JSON.stringify(r)}`;
    return 'PASS: each flyer its own pool; two a time, a sale buys 50 back (floored at zero, never into another flyer), closed at 300 with one alert, staying closed until a sale or a reopen';
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
