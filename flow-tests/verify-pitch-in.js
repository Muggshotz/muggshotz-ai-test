// PITCH IN, REPORT A BUG AND THE PHONE ALERTS (Alyx, 26 Sep 2026). What this
// pins:
//   * the server (api/admin.js, action "pitch") refuses what it should (no
//     idea, no email, no agreement, a bad picture), quietly drops a bot, and
//     for a good pitch saves it to the private "pitches" bucket, emails
//     myideaformuggshotz@gmail.com with "My Idea" at the start of the subject
//     (a bug: "Bug Report"), reply-to the sender, the picture attached, and
//     rings the right phone channel -- with every outside service stood in for;
//   * the phone channels: three, distinct, derived from a server secret, and
//     only given out for the admin password; a sale's alert says what sold;
//   * the page: a fresh visit, no photo, shows a lit Pitch In button on the
//     opening card; it opens the form, which asks for the idea, an email and
//     the terms, sends exactly what was typed, and thanks them; the grid ends
//     with the Pitch In tile; the Report a bug button is on the studio and the
//     order page, and sends where it was pressed.
const path = require('path');
const { pathToFileURL } = require('url');
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const ROOT = path.join(__dirname, '..');
const T = (page, ms) => page.waitForTimeout(ms);
const scenarios = {};

// The server, with Supabase, Resend and ntfy stood in for.
scenarios.theServer = async () => {
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key', RESEND_API_KEY: 're_test_key', ADMIN_PASSWORD: 'admin-pw' });
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  };
  const admin = await import(pathToFileURL(path.join(ROOT, 'api', 'admin.js')).href + '?t=' + Date.now());
  const alerts = await import(pathToFileURL(path.join(ROOT, 'lib', 'alerts.js')).href);
  const call = async (body) => {
    let status = 0, json = null;
    const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; } };
    await admin.default({ method: 'POST', body, query: {} }, res);
    return { status, json };
  };
  const bad = [];
  const png = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
  // Refusals.
  for (const [b, want] of [
    [{ action: 'pitch', kind: 'idea', text: 'hi', email: 'a@b.co', agree: true }, /tell us your idea/],
    [{ action: 'pitch', kind: 'idea', text: 'A mug that sings', agree: true }, /email/],
    [{ action: 'pitch', kind: 'idea', text: 'A mug that sings', email: 'a@b.co' }, /agree/],
    [{ action: 'pitch', kind: 'idea', text: 'A mug that sings', email: 'not-an-email', agree: true }, /email address/],
    [{ action: 'pitch', kind: 'idea', text: 'A mug that sings', email: 'a@b.co', agree: true, image: 'data:text/html;base64,AAAA' }, /picture/],
    [{ action: 'pitch', kind: 'spam', text: 'A mug that sings' }, /Unknown kind/]
  ]) { const r = await call(b); if (r.status !== 400 || !want.test(r.json?.error || '')) bad.push(`${JSON.stringify(b).slice(0, 60)} gave ${r.status} ${r.json?.error}`); }
  // A bot fills the hidden field: told OK, nothing sent anywhere.
  calls.length = 0;
  const bot = await call({ action: 'pitch', kind: 'idea', text: 'Buy cheap watches', email: 'x@y.co', agree: true, website: 'http://spam' });
  if (bot.status !== 200 || calls.length) bad.push(`a bot got ${bot.status} and ${calls.length} outside calls`);
  // A good idea, with a picture.
  calls.length = 0;
  const ok = await call({ action: 'pitch', kind: 'idea', text: 'A mug where the handle is a tiny ladder', name: 'Jane Test', email: 'Jane@Example.com', agree: true, image: png, deviceId: 'dev_1' });
  if (ok.status !== 200 || !ok.json?.id) bad.push(`a good idea gave ${ok.status} ${JSON.stringify(ok.json)}`);
  const up = calls.filter((c) => c.url.startsWith('https://sb.test/storage/v1/object/pitches/idea/'));
  if (up.length !== 2 || !up.some((c) => c.url.endsWith('.jpg')) || !up.some((c) => c.url.endsWith('.json'))) bad.push(`saved ${up.map((c) => c.url).join(', ')}`);
  const rec = JSON.parse((up.find((c) => c.url.endsWith('.json')) || { opts: { body: '{}' } }).opts.body);
  if (rec.text !== 'A mug where the handle is a tiny ladder' || rec.email !== 'jane@example.com' || rec.name !== 'Jane Test' || !rec.image) bad.push(`the record is ${JSON.stringify(rec)}`);
  if (!calls.some((c) => c.url === 'https://sb.test/storage/v1/bucket' && /"public":false/.test(c.opts.body))) bad.push('the pitches bucket was not asked for as private');
  const mail = calls.find((c) => c.url === 'https://api.resend.com/emails');
  const m = mail ? JSON.parse(mail.opts.body) : {};
  if (m.to !== 'myideaformuggshotz@gmail.com' || !/^My Idea: A mug where the handle/.test(m.subject || '') || m.reply_to !== 'jane@example.com' || !(m.attachments || []).length) bad.push(`the email was ${JSON.stringify({ to: m.to, subject: m.subject, reply: m.reply_to, att: (m.attachments || []).length })}`);
  const topics = alerts.alertTopics();
  const ring = calls.find((c) => c.url.startsWith('https://ntfy.sh/'));
  if (!ring || ring.url !== `https://ntfy.sh/${topics.idea}` || !/Jane Test/.test(ring.opts.headers.Title)) bad.push(`the idea rang ${ring && ring.url} "${ring && ring.opts.headers.Title}"`);
  // A bug: its own subject, its own channel, and where it happened.
  calls.length = 0;
  const bug = await call({ action: 'pitch', kind: 'bug', text: 'The Back button did nothing on the mats', context: { page: '/needles-studio.html', version: 'V387', focus: 'premades-focus' } });
  const bm = JSON.parse((calls.find((c) => c.url === 'https://api.resend.com/emails') || { opts: { body: '{}' } }).opts.body);
  const bring = calls.find((c) => c.url.startsWith('https://ntfy.sh/'));
  if (bug.status !== 200 || !/^Bug Report: The Back button/.test(bm.subject || '') || !/V387/.test(bm.html || '') || !bring || bring.url !== `https://ntfy.sh/${topics.bug}`) bad.push(`the bug gave ${bug.status}, "${bm.subject}", ${bring && bring.url}`);
  // The channels: three, different, secret-derived; given out only for the password.
  if (new Set(Object.values(topics)).size !== 3 || Object.values(topics).some((t) => !/^muggshotz-(ideas|bugs|sales)-[0-9a-f]{16}$/.test(t || ''))) bad.push(`the channels are ${JSON.stringify(topics)}`);
  if (Object.values(topics).some((t) => t.includes('re_test_key'))) bad.push('a channel name shows the secret');
  if ((await call({ action: 'alert-topics', password: 'wrong' })).status !== 403) bad.push('the channels were given out without the password');
  const at = await call({ action: 'alert-topics', password: 'admin-pw' });
  if (JSON.stringify(at.json?.topics) !== JSON.stringify(topics)) bad.push('the admin page does not get the channels');
  // A sale's words.
  const s1 = alerts.saleAlertText({ amount_total: 5995, metadata: { order_type: 'mug_order', product_key: 'smart-mug-set', size_label: 'Set of 4' } }, 'SURPRISE!!! Smart Mug Set');
  const s2 = alerts.saleAlertText({ metadata: { order_type: 'gift_certificate', amount_cents: '2500' }, rail: 'square' });
  if (s1.title !== 'Sale: SURPRISE!!! Smart Mug Set (Set of 4)' || !/\$59\.95/.test(s1.message) || !/Gift certificate \$25\.00/.test(s2.title) || !/Square/.test(s2.message)) bad.push(`sale words ${JSON.stringify([s1, s2])}`);
  // And the webhook rings it once a checkout settles.
  const hook = require('fs').readFileSync(path.join(ROOT, 'api', 'stripe-webhook.js'), 'utf8');
  const settle = hook.slice(hook.indexOf('export async function settleCheckoutSession'), hook.indexOf('export async function settleSquareCheckout'));
  if (!/await sendAlert\("sale"/.test(settle)) bad.push('the webhook does not ring a sale when a checkout settles');
  return bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS: refusals, a bot and a good idea handled; saved private, emailed to myideaformuggshotz@gmail.com as "My Idea: ..." with reply-to and the picture, the idea channel rung; a bug as "Bug Report: ..." on its own channel with where it happened; three secret channels, admin-only; a sale says what sold';
};

scenarios.thePage = async (page, log) => {
  const posts = [];
  await page.route('**/api/admin', async (route) => {
    const b = route.request().postDataJSON();
    if (b && b.action === 'pitch') { posts.push(b); return route.fulfill({ json: { ok: true, id: 'test-1' } }); }
    return route.continue();
  });
  await openStudio(page); await dismissAlerts(page);
  // A fresh visit, no photo: the button is on the opening card, lit.
  const b0 = await page.evaluate(() => {
    const onScreen = (el) => { if (!el) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.3 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el; };
    const b = document.getElementById('pitchInFrontBtn'), card = document.getElementById('uploadPhotoCard');
    return b && { inCard: card.contains(b), shown: !!b.offsetParent, lit: getComputedStyle(card).opacity === '1', text: b.innerText, bug: onScreen(document.getElementById('bugReportBtn')) };
  });
  if (!b0 || !b0.inCard || !b0.shown || !b0.lit || !/Pitch In/.test(b0.text)) return `FAIL: no lit Pitch In button on the opening card (${JSON.stringify(b0)})`;
  if (!b0.bug) return 'FAIL: no Report a bug button on the studio';
  await page.evaluate(() => document.getElementById('pitchInFrontBtn').click()); await T(page, 500);
  const o = await page.evaluate(() => ({ open: document.getElementById('pitchOverlay').classList.contains('open'), title: document.querySelector('#pitchBox h2').innerText, terms: !!document.querySelector('#pitchBox details') }));
  if (!o.open || !/Pitch In/i.test(o.title) || !o.terms) return `FAIL: the button opened ${JSON.stringify(o)}`;
  // It asks for what it needs.
  const tryIt = async () => { await page.click('#pitchSend'); await T(page, 200); return page.evaluate(() => document.getElementById('pitchMsg').textContent); };
  if (!/tell us your idea/i.test(await tryIt())) return 'FAIL: an empty idea was not refused';
  await page.fill('#pitchText', 'A mug where the handle is a tiny ladder');
  if (!/email/i.test(await tryIt())) return 'FAIL: an idea with no email was not refused';
  await page.fill('#pitchName', 'Jane Test'); await page.fill('#pitchEmail', 'jane@example.com');
  if (!/agree/i.test(await tryIt())) return 'FAIL: an idea without the terms ticked was not refused';
  await page.check('#pitchAgree');
  if (posts.length) return 'FAIL: something was sent before the form was complete';
  await page.click('#pitchSend'); await T(page, 800);
  const p = posts[0] || {};
  if (p.kind !== 'idea' || p.text !== 'A mug where the handle is a tiny ladder' || p.email !== 'jane@example.com' || p.name !== 'Jane Test' || p.agree !== true || !p.deviceId) return `FAIL: it sent ${JSON.stringify(p)}`;
  if (!(await page.evaluate(() => /We have your idea/.test(document.getElementById('pitchDone')?.innerText || '')))) return 'FAIL: no thank-you after sending';
  await page.click('#pitchClose'); await T(page, 300);
  if (await page.evaluate(() => document.getElementById('pitchOverlay').classList.contains('open'))) return 'FAIL: Back did not close the form';
  // The grid ends with Pitch In.
  await uploadPhoto(page); await dismissAlerts(page);
  await page.click('#postUploadForkRow button:has-text("Select Your Product")'); await T(page, 700);
  const tile = await page.evaluate(() => { const t = document.getElementById('pitchInTile'); return t && { last: t === t.parentElement.lastElementChild, text: t.innerText }; });
  if (!tile || !tile.last || !/Pitch In/.test(tile.text)) return `FAIL: the grid's Pitch In tile is ${JSON.stringify(tile)}`;
  await page.evaluate(() => document.getElementById('pitchInTile').click()); await T(page, 400);
  if (!(await page.evaluate(() => document.getElementById('pitchOverlay').classList.contains('open') && document.getElementById('pitchName').value === 'Jane Test'))) return 'FAIL: the tile did not open the form with their name remembered';
  await page.evaluate(() => closePitch());
  // A bug, from the corner button: sent with where it happened.
  await page.evaluate(() => document.getElementById('bugReportBtn').click()); await T(page, 400);
  await page.fill('#pitchText', 'The Back button did nothing');
  await page.click('#pitchSend'); await T(page, 800);
  const bgp = posts[1] || {};
  if (bgp.kind !== 'bug' || bgp.text !== 'The Back button did nothing' || !/needles-studio\.html/.test(bgp.context?.page || '') || !/^V\d+/.test(bgp.context?.version || '')) return `FAIL: the bug sent ${JSON.stringify(bgp)}`;
  // The order page has it too.
  await page.goto('http://127.0.0.1:8788/order.html'); await T(page, 2500);
  if (!(await page.evaluate(() => { const el = document.getElementById('bugReportBtn'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el; }))) return 'FAIL: no Report a bug button on the order page';
  return `PASS: a fresh visit shows a lit Pitch In button; the form refuses no idea, no email and no terms, sends exactly what was typed and thanks them; Back closes it; the grid ends with Pitch In, which remembers their name; Report a bug sends where it happened (${bgp.context.version}); the order page has the bug button`;
};

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } })) {
    for (const [name, fn] of Object.entries(scenarios)) {
      if (name === 'theServer' && screen === 'phone') continue;
      let result;
      if (name === 'theServer') {
        try { result = await fn(); } catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
        console.log(`[${screen}] [${name}] ${result}`);
        if (!/^PASS/.test(result)) fails++;
        continue;
      }
      const { browser, page, log } = await launch({ viewport });
      try { result = await fn(page, log); } catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
      console.log(`[${screen}] [${name}] ${result}`);
      if (!/^PASS/.test(result)) fails++;
      if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
      await browser.close();
    }
  }
  console.log(fails === 0 ? '\nALL PITCH-IN VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
