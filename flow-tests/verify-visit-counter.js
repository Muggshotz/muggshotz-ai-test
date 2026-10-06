// THE VISITOR COUNT (Alyx, 5 Oct 2026: "monitor how many times a website has
// been visited by someone outside, and maintain a running count ... in my
// command center, the admin page"):
//   * the pages: the Halloween page reached from a flyer sends one note, with
//     its ?from= tag, today's date and "new"; a refresh sends none; the studio
//     the same day sends its own, no longer new; checkout, the start and gift
//     pages each send theirs; a browser marked as staff sends nothing;
//   * the server (lib/visits.js): a person's note is added to the day's row
//     through count_visit; robots and headless browsers, made-up pages and
//     dates far from today are not; an odd tag is kept as "other";
//   * admin.html: unlocking marks the browser as staff, and the Visitors panel
//     adds the rows up by today, 7 days and all time, by page and by flyer tag.
// Run with the repo served on 127.0.0.1:8788.
const path = require('path');
const { pathToFileURL } = require('url');
const { launch, BASE } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function thePages() {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  try {
    const notes = [];
    await page.route('**/api/visit', (route) => { try { notes.push(JSON.parse(route.request().postData())); } catch (e) { notes.push(null); } route.fulfill({ status: 204 }); });
    // Our own test runs are not counted unless a test asks to watch it work.
    await page.goto(`${BASE}/occasion.html?o=halloween&from=door`);
    await T(page, 2500);
    if (notes.length) return `FAIL: a test run on 127.0.0.1 was counted ${JSON.stringify(notes)}`;
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mz_count_local', '1'); });
    await page.goto(`${BASE}/occasion.html?o=halloween&from=door`);
    await T(page, 2500);
    const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    const want1 = JSON.stringify({ page: 'halloween', source: 'door', day: today, isNew: true });
    if (notes.length !== 1 || JSON.stringify(notes[0]) !== want1) return `FAIL: the flyer arrival sent ${JSON.stringify(notes)}, not ${want1}`;
    await page.reload(); await T(page, 2000);
    if (notes.length !== 1) return `FAIL: a refresh counted again ${JSON.stringify(notes)}`;
    await page.goto(`${BASE}/needles-studio.html`); await T(page, 3000);
    const want2 = JSON.stringify({ page: 'studio', source: '', day: today, isNew: false });
    if (notes.length !== 2 || JSON.stringify(notes[1]) !== want2) return `FAIL: the studio sent ${JSON.stringify(notes.slice(1))}, not ${want2}`;
    for (const [file, name] of [['order.html', 'order'], ['start.html', 'start'], ['gift.html', 'gift']]) {
      const before = notes.length;
      await page.goto(`${BASE}/${file}`); await T(page, 1500);
      if (notes.length !== before + 1 || notes[before].page !== name) return `FAIL: ${file} sent ${JSON.stringify(notes.slice(before))}`;
    }
    // Staff: nothing at all, even on a page not yet counted today.
    await page.evaluate(() => { localStorage.setItem('mz_staff', '1'); localStorage.removeItem('mz_counted_halloween'); });
    const before = notes.length;
    await page.goto(`${BASE}/occasion.html?o=halloween&from=wall`); await T(page, 2500);
    if (notes.length !== before) return `FAIL: a staff browser was counted ${JSON.stringify(notes.slice(before))}`;
    return 'PASS: a flyer arrival is counted once with its tag and as new; a refresh is not; the studio, checkout, start and gift pages count once each; staff and test runs are never counted';
  } finally { await browser.close(); }
}

async function theServer() {
  const { recordVisit, cleanVisit } = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'visits.js')).href);
  // lib/visits.js reads the Supabase settings when it loads; set before import above is too late, so
  // the module is checked for "no settings, no call" first, then with a stubbed fetch through a fresh copy.
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, text: async () => '' }; };
  try {
    const now = new Date(); const day = dayOf(now);
    const person = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
    if (await recordVisit({ page: 'halloween', source: 'door', day, isNew: true }, person)) return 'FAIL: counted with no Supabase settings';
    process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
    const fresh = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'visits.js')).href + '?fresh=1');
    const yes = await fresh.recordVisit({ page: 'halloween', source: 'Door', day, isNew: true }, person);
    const c = calls[0];
    if (!yes || calls.length !== 1 || !c.url.endsWith('/rest/v1/rpc/count_visit') || JSON.stringify(c.body) !== JSON.stringify({ p_day: day, p_page: 'halloween', p_source: 'door', p_new: true }))
      return `FAIL: a person's visit went as ${JSON.stringify(calls)}`;
    const robots = ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'facebookexternalhit/1.1', 'Mozilla/5.0 HeadlessChrome/120.0', 'curl/8.4.0', ''];
    for (const ua of robots) if (await fresh.recordVisit({ page: 'studio', source: '', day, isNew: false }, ua)) return `FAIL: counted the robot "${ua}"`;
    const far = new Date(now.getTime() - 5 * 86400000);
    for (const bad of [{ page: 'Not A Page!', day }, { page: '../admin', day }, { page: 'studio', day: dayOf(far) }, { page: 'studio', day: 'yesterday' }])
      if (await fresh.recordVisit(bad, person)) return `FAIL: counted ${JSON.stringify(bad)}`;
    if (calls.length !== 1) return `FAIL: refused notes still reached Supabase ${JSON.stringify(calls.slice(1))}`;
    const odd = cleanVisit({ page: 'studio', source: '<script>', day }, now);
    if (!odd || odd.source !== 'other') return `FAIL: an odd tag came out as ${JSON.stringify(odd)}`;
    return 'PASS: a person is counted through count_visit with the tag tidied; robots, headless browsers, made-up pages and far-off dates are not; an odd tag is kept as "other"';
  } finally { global.fetch = realFetch; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
}

async function theAdminPanel() {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  try {
    const now = new Date(), d = (n) => { const x = new Date(now); x.setDate(x.getDate() - n); return dayOf(x); };
    const rows = [
      { day: d(0), page: 'halloween', source: 'door', visits: 5, new_visitors: 4 },
      { day: d(0), page: 'studio', source: '', visits: 3, new_visitors: 1 },
      { day: d(3), page: 'halloween', source: 'wall', visits: 2, new_visitors: 2 },
      { day: d(20), page: 'order', source: '', visits: 7, new_visitors: 0 },
    ];
    await page.route('**/api/admin**', (route) => {
      const r = route.request();
      if (r.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      const b = r.postDataJSON() || {};
      if (b.action === 'visits') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows }) });
      if (b.action === 'ledger') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ betas: [], campaigns: [], missingTables: [], totals: { betas: 0, earned: 0, paid: 0, owed: 0 } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto(`${BASE}/admin.html`); await T(page, 1000);
    await page.fill('#pwInput', 'test'); await page.click('#unlockBtn'); await T(page, 1500);
    const got = await page.evaluate(() => ({
      staff: localStorage.getItem('mz_staff'),
      rows: [...document.querySelectorAll('#visitsTable tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim().replace(/\s+/g, ' '))),
      newAll: (document.querySelector('#visitsTable b') || {}).textContent,
      checked: (document.getElementById('visitsChecked') || {}).textContent || '',
    }));
    if (got.staff !== '1') return 'FAIL: unlocking did not mark this browser as staff';
    const row = (label) => (got.rows.find((r) => r[0] === label) || []).slice(1).join(' | ');
    const want = {
      'All pages': '8 (5 new) | 10 (7 new) | 17 (7 new)',
      'Halloween page': '5 (4 new) | 7 (6 new) | 7 (6 new)',
      'Studio': '3 (1 new) | 3 (1 new) | 3 (1 new)',
      'Checkout': '0 | 0 | 7',
      'Halloween page · door': '5 (4 new) | 5 (4 new) | 5 (4 new)',
      'Halloween page · wall': '0 | 2 (2 new) | 2 (2 new)',
    };
    for (const [label, w] of Object.entries(want)) if (row(label) !== w) return `FAIL: "${label}" reads "${row(label)}", not "${w}" (${JSON.stringify(got.rows)})`;
    if (got.newAll !== '7') return `FAIL: new people all time reads ${got.newAll}`;
    if (!/^Checked at \d{1,2}:\d{2}:\d{2}/.test(got.checked)) return `FAIL: the refresh shows no time it was checked (${JSON.stringify(got.checked)})`;
    return 'PASS: unlocking marks the browser as staff; the Visitors panel adds up today, 7 days and all time by page and by flyer tag, and says when it was checked';
  } finally { await browser.close(); }
}

(async () => {
  let failed = 0;
  for (const [name, fn] of [['thePages', thePages], ['theServer', theServer], ['theAdminPanel', theAdminPanel]]) {
    let r; try { r = await fn(); } catch (e) { r = 'FAIL: ' + e.message; }
    if (!r.startsWith('PASS')) failed++;
    console.log(`[${name}] ${r}`);
  }
  console.log(failed ? `\n${failed} VISIT-COUNTER VERIFICATION(S) FAILED` : '\nALL VISIT-COUNTER VERIFICATIONS PASSED');
  process.exit(failed ? 1 : 0);
})();
