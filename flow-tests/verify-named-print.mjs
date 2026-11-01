// NAMED MATS, server side (Alyx, 1 Nov 2026: "the blank line will be an
// interface"). Runs lib/named-designs.js and api/named-print.js with the
// pictures read from disk, and holds them to the rules:
//   * every design an occasion marks named: true is in NAMED_DESIGNS, with
//     its print and page files on disk;
//   * a name is trimmed and capitalised; one too long or with odd characters
//     is refused; blank is allowed and prints the blank as it is;
//   * the name lands inside the blank: pixels change there and nowhere else;
//   * a long name is narrowed to the blank, never spills;
//   * the API serves a JPEG of the picture's own size, cacheable, and refuses
//     an unknown design or a bad name.
import fs from 'fs'; import path from 'path'; import sharp from 'sharp';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const { NAMED_DESIGNS, cleanName, renderNamed } = await import('../lib/named-designs.js');
const handler = (await import('../api/named-print.js')).default;
const results = []; const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

// 1. Every named design on every occasion page is registered, with its files.
for (const f of fs.readdirSync(path.join(root, 'occasions')).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(root, 'occasions', f), 'utf8'); const win = {};
  new Function('window', src)(win);
  for (const d of (win.OCCASION.featured.designs || []).filter((x) => x.named)) {
    const reg = NAMED_DESIGNS[d.key];
    check(`${f}: ${d.key} is a named design with its files`, reg && fs.existsSync(path.join(root, reg.print)) && fs.existsSync(path.join(root, reg.show)), JSON.stringify(reg));
    check(`${f}: ${d.key}'s maxLen matches the page's`, reg && (d.maxLen || 14) === reg.maxLen, `${d.maxLen} vs ${reg && reg.maxLen}`);
  }
}

// 2. The name itself.
const d = NAMED_DESIGNS['rear-entrance'];
check('a name is trimmed and capitalised', cleanName('  bob  ', d) === 'BOB' && cleanName('mary   lou', d) === 'MARY LOU', cleanName('  bob  ', d));
check("O'Brien and Jean-Luc are names", cleanName("o'brien", d) === "O'BRIEN" && cleanName('Jean-Luc', d) === 'JEAN-LUC', '');
check('too long is refused', cleanName('Bartholomew-Jenkins', d) === null, '');
check('odd characters are refused', cleanName('<script>', d) === null && cleanName('bob & co', d) === 'BOB & CO', '');
check('blank is allowed', cleanName('', d) === '' && cleanName('   ', d) === '', '');

// 3. The lettering lands in the blank and nowhere else.
const show = fs.readFileSync(path.join(root, d.show));
const plain = await renderNamed(d, '', show), bob = await renderNamed(d, 'BOB', show);
const [pm, bm] = [await sharp(plain).metadata(), await sharp(bob).metadata()];
check('a blank name prints the picture as it is, at its own size', pm.width === bm.width && pm.height === bm.height && pm.width === 900, `${pm.width}x${pm.height} vs ${bm.width}x${bm.height}`);
const raw = async (buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true });
const [A, B] = [await raw(plain), await raw(bob)];
const { width: W, height: H, channels: C } = A.info;
const box = { x0: Math.round(W * d.box.x0), y0: Math.round(H * d.box.y0), x1: Math.round(W * d.box.x1), y1: Math.round(H * d.box.y1) };
let inside = 0, outside = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * C; const diff = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
  if (diff > 60) { if (x >= box.x0 && x < box.x1 && y >= box.y0 - 2 && y < box.y1 + 2) inside++; else outside++; }
}
check('the name is lettered inside the blank', inside > 200, `${inside} pixels changed inside`);
check('...and nowhere else', outside === 0, `${outside} pixels changed outside the blank`);
const long = await renderNamed(d, 'BARTHOLOMEW JR', show); const [L] = [await raw(long)];
let longOut = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * C; if (Math.abs(A.data[i] - L.data[i]) > 60 && !(x >= box.x0 && x < box.x1 && y >= box.y0 - 2 && y < box.y1 + 2)) longOut++; }
check('a long name is narrowed to the blank, never spills', longOut === 0, `${longOut} pixels outside`);

// 4. The API, its pictures read from disk in place of the site.
globalThis.fetch = async (url) => { const p = new URL(String(url)).pathname.slice(1); const f = path.join(root, p); return fs.existsSync(f) ? new Response(fs.readFileSync(f), { status: 200 }) : new Response(null, { status: 404 }); };
function call(query) {
  return new Promise((resolve) => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b, headers: this.headers }); }, send(b) { resolve({ code: this.code, body: b, headers: this.headers }); } };
    handler({ method: 'GET', query, headers: { host: 'muggshotz.com' } }, res);
  });
}
let r = await call({ design: 'rear-entrance', name: 'bob', size: 'show' }); let m = r.code === 200 ? await sharp(r.body).metadata() : {};
check('the API serves the page picture with the name, as a cacheable JPEG', r.code === 200 && r.headers['Content-Type'] === 'image/jpeg' && /max-age/.test(r.headers['Cache-Control']) && m.width === 900, `${r.code} ${JSON.stringify(r.headers)} ${m.width}`);
r = await call({ design: 'rear-entrance', name: 'bob', size: 'print' }); m = r.code === 200 ? await sharp(r.body).metadata() : {};
check('...and the print file at the mat\'s 4650 x 2850', r.code === 200 && m.width === 4650 && m.height === 2850, `${r.code} ${m.width}x${m.height}`);
r = await call({ design: 'no-such-mat', name: 'bob' });
check('an unknown design is refused', r.code === 404, JSON.stringify(r.body));
r = await call({ design: 'rear-entrance', name: 'Bartholomew-Jenkins' });
check('a bad name is refused with the rule', r.code === 400 && /Up to 14/.test(r.body.error), JSON.stringify(r.body));

let fails = 0;
for (const t of results) { console.log(`${t.ok ? 'PASS' : 'FAIL'}: ${t.name}${t.ok ? '' : ' -- ' + t.detail}`); if (!t.ok) fails++; }
console.log(fails ? `\n${fails} FAILURE(S)` : `\nALL ${results.length} NAMED-PRINT CHECKS PASSED`);
process.exit(fails ? 1 : 0);
