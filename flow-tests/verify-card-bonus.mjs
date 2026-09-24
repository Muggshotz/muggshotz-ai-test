// BUSINESS-CARD SPINS, server side (Alyx, 24 Sep 2026). Runs the real
// api/send-verification.js, api/verify-email.js and api/get-balance.js against
// an in-memory stand-in for Supabase's customers table and for Resend, and
// holds them to the rules:
//   * the card's code is offered while it is on, and refused once it is off;
//   * a brand-new card visitor gets a row at 0 and 5 spins only when the
//     email is verified;
//   * once per email address, whatever its capitals, from any device;
//   * two claims sent before either is verified pay once;
//   * the ordinary one-spin verification is unchanged.
process.env.SUPABASE_URL = 'https://fake.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.RESEND_API_KEY = 'test-resend';

let rows = [], nextId = 1; const mail = [];
const unesc = (p) => p.replace(/\\(.)/g, '$1');
function match(row, params) {
  for (const [k, v] of params) {
    if (['select', 'limit', 'order', 'columns'].includes(k)) continue;
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    const cell = row[k] == null ? null : String(row[k]);
    if (op === 'eq' && cell !== val) return false;
    if (op === 'neq' && cell === val) return false;
    if (op === 'ilike' && (cell || '').toLowerCase() !== unesc(val).toLowerCase()) return false;
  }
  return true;
}
const pick = (row, sel) => !sel || sel === '*' ? { ...row } : Object.fromEntries(sel.split(',').map((c) => [c.trim(), row[c.trim()] ?? null]));
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.startsWith('https://api.resend.com')) { mail.push(JSON.parse(opts.body)); return json(200, { id: 'm' + mail.length }); }
  const u = new URL(url); if (!u.pathname.startsWith('/rest/v1/customers')) return json(404, { message: 'no table ' + u.pathname });
  const params = [...u.searchParams.entries()], sel = u.searchParams.get('select'), lim = u.searchParams.get('limit');
  const hdr = new Headers(opts.headers || {}), method = (opts.method || 'GET').toUpperCase();
  const single = /vnd\.pgrst\.object/.test(hdr.get('accept') || '');
  let out;
  if (method === 'GET') { out = rows.filter((r) => match(r, params)); if (lim) out = out.slice(0, +lim); out = out.map((r) => pick(r, sel)); }
  else if (method === 'POST') { const body = [].concat(JSON.parse(opts.body)); out = body.map((b) => { const r = { id: nextId++, token_balance: 0, email: null, email_verified: false, verification_token: null, role: null, has_purchased: false, ...b }; rows.push(r); return pick(r, sel); }); }
  else if (method === 'PATCH') { const body = JSON.parse(opts.body); out = rows.filter((r) => match(r, params)).map((r) => { Object.assign(r, body); return pick(r, sel); }); }
  if (single) { if (out.length !== 1) return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${out.length} rows` }); return json(200, out[0]); }
  return json(200, out);
};

const send = (await import('../api/send-verification.js')).default;
const verify = (await import('../api/verify-email.js')).default;
const balance = (await import('../api/get-balance.js')).default;
const cards = await import('../lib/card-bonus.js');
function call(fn, req) {
  return new Promise((resolve) => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; },
      json(b) { resolve({ code: this.code, body: b }); }, send(b) { resolve({ code: this.code, body: String(b) }); } };
    fn(req, res);
  });
}
const post = (body) => call(send, { method: 'POST', body });
const click = (token) => call(verify, { method: 'GET', query: { token } });
const bal = async (deviceId) => (await call(balance, { method: 'GET', query: { deviceId } })).body;
const row = (d) => rows.find((r) => r.device_id === d);
const lastToken = () => { const m = /token=([^"&]+)/.exec(mail[mail.length - 1].html); return decodeURIComponent(m[1]); };

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

let r = await call(balance, { method: 'GET', query: { card: 'muggsy' } });
check('the card code is offered, 5 spins, any capitals', r.body.on === true && r.body.spins === 5, JSON.stringify(r.body));
r = await call(balance, { method: 'GET', query: { card: 'NOPE' } });
check('an unknown code is not offered', r.body.on === false, JSON.stringify(r.body));

r = await post({ email: 'Bob@Example.com', deviceId: 'dev-A', cardCode: 'MUGGSY' });
check('a brand-new card visitor can send a claim', r.code === 200, JSON.stringify(r.body));
check('...and gets a row at 0, not the device freebie', row('dev-A')?.token_balance === 0, JSON.stringify(row('dev-A')));
check('...and an email promising 5 free spins', /5 free spins/.test(mail.at(-1)?.subject || ''), mail.at(-1)?.subject);
const tokA = lastToken();
check('...carrying the card in its token', cards.cardFromToken(tokA) === 'MUGGSY', tokA.slice(0, 20));
let b = await bal('dev-A');
check('before the email is verified: still 0, not verified', b.tokenBalance === 0 && b.emailVerified === false, JSON.stringify(b));
r = await click(tokA);
check('verifying pays 5 spins', row('dev-A').token_balance === 5 && row('dev-A').email_verified === true, JSON.stringify(row('dev-A')));
check('...and the page says so', /5 free spins/.test(r.body), r.body.slice(0, 80));
b = await bal('dev-A');
check('the meter then reads 5, verified', b.tokenBalance === 5 && b.emailVerified === true, JSON.stringify(b));
r = await click(tokA);
check('clicking the same link again pays nothing more', row('dev-A').token_balance === 5, JSON.stringify(row('dev-A')));

r = await post({ email: 'bob@example.COM', deviceId: 'dev-B-incognito', cardCode: 'MUGGSY' });
check('a private window with the same email (other capitals) is refused', r.code === 400 && /already claimed/.test(r.body.error), JSON.stringify(r.body));
check('...and pays nothing', (row('dev-B-incognito')?.token_balance || 0) === 0, JSON.stringify(row('dev-B-incognito')));

await post({ email: 'carol@example.com', deviceId: 'dev-C1', cardCode: 'MUGGSY' }); const tokC1 = lastToken();
await post({ email: 'Carol@example.com', deviceId: 'dev-C2', cardCode: 'MUGGSY' }); const tokC2 = lastToken();
await click(tokC1); r = await click(tokC2);
check('two claims sent before either is verified pay once', row('dev-C1').token_balance === 5 && row('dev-C2').token_balance === 0, `C1 ${row('dev-C1').token_balance}, C2 ${row('dev-C2').token_balance}`);
check('...and the second page says the email has claimed', /already claimed/.test(r.body), r.body.slice(0, 120));

rows.push({ id: nextId++, device_id: 'dev-D', token_balance: 0, email: null, email_verified: false, verification_token: null });
r = await post({ email: 'dan@example.com', deviceId: 'dev-D' }); await click(lastToken());
check('the ordinary verification still pays 1', r.code === 200 && row('dev-D').token_balance === 1, JSON.stringify(row('dev-D')));
r = await post({ email: 'eve@example.com', deviceId: 'dev-new-no-card' });
check('without a card, a device with no row is still turned away', r.code === 404, JSON.stringify(r.body));

await post({ email: 'fay@example.com', deviceId: 'dev-F', cardCode: 'MUGGSY' }); const tokF = lastToken();
cards.CARD_CODES.MUGGSY.on = false;
r = await call(balance, { method: 'GET', query: { card: 'MUGGSY' } });
check('switched off: no longer offered', r.body.on === false, JSON.stringify(r.body));
r = await post({ email: 'gus@example.com', deviceId: 'dev-G', cardCode: 'MUGGSY' });
check('switched off: a new claim is refused', r.code === 400 && /ended/.test(r.body.error), JSON.stringify(r.body));
await click(tokF);
check('switched off: a link sent before pays no card spins, only the ordinary 1', row('dev-F').token_balance === 1, JSON.stringify(row('dev-F')));

let fails = 0;
for (const t of results) { console.log(`${t.ok ? 'PASS' : 'FAIL'}: ${t.name}${t.ok ? '' : ' -- ' + t.detail}`); if (!t.ok) fails++; }
console.log(fails ? `\n${fails} FAILURE(S)` : `\nALL ${results.length} CARD-BONUS CHECKS PASSED`);
process.exit(fails ? 1 : 0);
