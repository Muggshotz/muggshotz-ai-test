// THE SECOND FACE: does the dial carry a DIFFERENT person the same way?
//
// The 2.8 ceiling was measured on exactly one face -- Alyx's. Alyx's objection
// to stopping there is fair: "higher numbers do no harm, but they also give no
// benefit... so just set the thing at 4.0." The counter is that "no harm" was
// only ever shown on his own photo, and the untested region above it is where
// every other customer lives.
//
// So this runs the same climb on other subjects. One photo, one set of words,
// only the exaggeration moving: 1.0 (the full lockdown, no push at all), then
// 2.0, 3.0 and 4.0. The question is not "is the head bigger" -- we know it is.
// It is Alyx's own test, and it is the one that decides:
//
//     does the sum of it project the person, or does it go slack?
//
// Push is held proportional to head so only ONE thing is moving. The shipped
// top rung is head 2.8 with push 160, so push ~= (head - 1) * 89, rounded.
//
//   usage: node probe-subject.js <photo.jpg> <outdir> [headRatios]
//   e.g.  node probe-subject.js face.jpg out 1.0,2.0,3.0,4.0
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE = 'http://127.0.0.1:8788';
const API = 'https://muggshotz-ai-test.vercel.app';
const DEVICE = 'mz-claude-test';
const PHOTO = process.argv[2];
const OUT = process.argv[3] || '/tmp/subject';
// No pronoun: the subject varies and the prompt must not decide for them.
const PROMPT = 'Riding a tiny red tricycle in a parade.';
const STYLE = 'Caricature Assassination';

if (!PHOTO || !fs.existsSync(PHOTO)) { console.error('need a photo path'); process.exit(1); }

// label : head : push : features
//
// The default ladder is the one Alyx called for -- 1.0 with no push at all as
// the control, then 2.0, 3.0, 4.0. A third argument overrides it with a
// comma-separated list of head ratios ("6.0,8.0"), because the ceiling hunt
// keeps wanting one more rung and copying this file to get it is how you end
// up with two probes that disagree.
const SLOPE = 89; // push = (head - 1) * SLOPE, from the shipped 2.8/160 rung
const rung = h => [
  'r-' + h.toFixed(1) + 'x-' + String(Math.round((h - 1) * SLOPE)).padStart(3, '0'),
  h,
  Math.round((h - 1) * SLOPE),
  h <= 1 ? 0 : 4,
];
const RUNS = (process.argv[4] ? process.argv[4].split(',').map(Number) : [1.0, 2.0, 3.0, 4.0])
  .filter(h => h > 0)
  .map(rung);

const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [label, head, push, feat] of RUNS) {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 880 } });
    await ctx.addInitScript(id => { try { localStorage.setItem('muggshotz_device_id', id); } catch (e) {} }, DEVICE);
    const page = await ctx.newPage();
    let imageUrl = null, sentPrompt = null;

    const relay = async route => {
      const req = route.request();
      const raw = new URL(req.url());
      const isApi = raw.pathname.startsWith('/api/');
      const url = isApi ? API + raw.pathname + raw.search : req.url();
      try {
        const body = ['GET','HEAD'].includes(req.method()) ? undefined : req.postDataBuffer();
        const h = { ...req.headers() }; delete h.host; delete h.origin; delete h.referer; delete h['content-length'];
        if (raw.pathname === '/api/generate' && body) { try { sentPrompt = JSON.parse(body.toString('utf8')).prompt; } catch (e) {} }
        const r = await fetch(url, { method: req.method(), headers: h, body, signal: AbortSignal.timeout(180000) });
        const buf = Buffer.from(await r.arrayBuffer());
        if (raw.pathname === '/api/generate') { try { imageUrl = JSON.parse(buf.toString('utf8')).imageUrl; } catch (e) {} }
        await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream' }, body: buf });
      } catch (e) { await route.fulfill({ status: 502, body: '{}' }); }
    };
    await page.route('**/api/**', relay);
    await page.route('https://**', relay);

    const clear = async () => { for (let i=0;i<6;i++){ const n = await page.evaluate(()=>{let n=0;document.querySelectorAll('.big-alert-overlay.visible').forEach(o=>{o.classList.remove('visible');o.style.display='none';n++;});return n;}); if(!n)break; await page.waitForTimeout(200);} };

    await page.goto(PAGE + '/needles-studio.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.setInputFiles('#fileInput', PHOTO);
    await page.waitForTimeout(2500); await clear();
    await page.evaluate(() => { if (typeof chooseIntentAI === 'function') chooseIntentAI(); });
    await page.waitForTimeout(1200); await clear();
    await page.evaluate(() => pickTrackDescribe());
    await page.waitForTimeout(1000); await clear();
    await page.evaluate(t => {
      const tile = [...document.querySelectorAll('#styleSectionCard .btn-select')].find(b => b.textContent.includes(t));
      if (!tile) throw new Error('no style tile: ' + t);
      pick(tile, 'style');
    }, STYLE);
    await page.waitForTimeout(500);
    await page.evaluate(() => confirmStyleAndContinue());
    await page.waitForTimeout(1000); await clear();
    await page.evaluate(p => { const b=document.getElementById('ideaDesc'); b.value=p; b.dispatchEvent(new Event('input',{bubbles:true})); }, PROMPT);
    await page.waitForTimeout(700); await clear();
    await page.evaluate(() => { const t=document.querySelector('#productCard .btn-select[data-val="mouse pad"]'); pick(t,'product'); });
    await page.waitForTimeout(1200); await clear();
    // always the top (third) position, so the override below is what decides
    await page.evaluate(() => { const t=[...document.querySelectorAll('#likenessSectionCard .btn-select')].find(b=>b.dataset.val==='0.35'); pick(t,'likeness'); });
    await page.waitForTimeout(600); await clear();

    await page.evaluate(([t, h, p, f]) => {
      const tile = [...document.querySelectorAll('#styleSectionCard .btn-select')].find(b => b.textContent.includes(t));
      tile.dataset.head = '1.0|1.5|' + h;
      tile.dataset.push = '0|60|' + p;
      tile.dataset.feat = '0|3|' + f;
    }, [STYLE, head, push, feat]);
    await page.waitForTimeout(300);

    log(label + ': generating...');
    const t0 = Date.now();
    await page.evaluate(() => document.getElementById('generateBtn').click());
    for (let i = 0; i < 120 && !imageUrl; i++) await page.waitForTimeout(2000);
    if (!imageUrl) { log(label + ': NO URL returned'); await ctx.close(); continue; }
    const r = await fetch(imageUrl, { signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const f = path.join(OUT, label + '.png');
    fs.writeFileSync(f, buf);
    fs.writeFileSync(path.join(OUT, label + '.prompt.txt'), sentPrompt || '(not captured)');
    log(label + ': ' + Math.round((Date.now()-t0)/1000) + 's, ' + Math.round(buf.length/1024) + 'KB -> ' + f);
    await ctx.close();
  }
  try {
    const bal = await (await fetch(API + '/api/get-balance?deviceId=' + DEVICE)).json();
    log('chips remaining:', bal.tokenBalance);
  } catch (e) { log('balance check failed'); }
  await browser.close();
})();
