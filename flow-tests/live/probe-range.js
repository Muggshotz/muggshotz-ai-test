// DO THE DIALS DO ANYTHING? (Alyx, Sep 2026: "we may have left funny on the
// table... what we should have been doing is pushing towards the borders of
// what would be acceptable before going just too far.")
//
// A Muggshotz Classic + Lifelike run -- the gentlest setting we offer, head
// 1.0x, zero push, the full lockdown -- came back with a head near 1.7x. That
// is a heavier caricature than anything we got while ASKING for 2.2x. So the
// model was never the ceiling we decided it was this morning, and something in
// our own prompt is suppressing exaggeration at the top of the range while
// permitting it at the bottom.
//
// This runs several settings against the same photo and the same words, and
// keeps the picture each one produces. It does NOT wait for the studio to
// render the result -- it takes the URL out of the generate response and
// downloads it directly, which is the part that works.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE = 'http://127.0.0.1:8788';
const API = 'https://muggshotz-ai-test.vercel.app';
const DEVICE = 'mz-claude-test';
const OUT = process.argv[2] || '/tmp/range';
const PROMPT = 'Put him on a tiny red tricycle in a parade.';

// style tile text (matched loosely) : degree tile value : label
const RUNS = [
  ['Photorealistic',           '0.15', '1-photoreal-lifelike'],
  ['Muggshotz Classic',        '0.15', '2-classic-lifelike'],
  ['Caricature Assassination', '0.35', '3-assassination-wild'],
];

const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [styleText, degree, label] of RUNS) {
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
        const r = await fetch(url, { method: req.method(), headers: h, body, signal: AbortSignal.timeout(120000) });
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
    await page.setInputFiles('#fileInput', path.join(__dirname, '..', 'test-photo.jpg'));
    await page.waitForTimeout(2500); await clear();
    await page.evaluate(() => { if (typeof chooseIntentAI === 'function') chooseIntentAI(); });
    await page.waitForTimeout(1200); await clear();
    await page.evaluate(() => pickTrackDescribe());
    await page.waitForTimeout(1000); await clear();
    await page.evaluate(t => {
      const tile = [...document.querySelectorAll('#styleSectionCard .btn-select')].find(b => b.textContent.includes(t));
      if (!tile) throw new Error('no style tile: ' + t);
      pick(tile, 'style');
    }, styleText);
    await page.waitForTimeout(500);
    await page.evaluate(() => confirmStyleAndContinue());
    await page.waitForTimeout(1000); await clear();
    await page.evaluate(p => { const b=document.getElementById('ideaDesc'); b.value=p; b.dispatchEvent(new Event('input',{bubbles:true})); }, PROMPT);
    await page.waitForTimeout(700); await clear();
    await page.evaluate(() => { const t=document.querySelector('#productCard .btn-select[data-val="mouse pad"]'); pick(t,'product'); });
    await page.waitForTimeout(1200); await clear();
    await page.evaluate(d => { const t=[...document.querySelectorAll('#likenessSectionCard .btn-select')].find(b=>b.dataset.val===d); pick(t,'likeness'); }, degree);
    await page.waitForTimeout(600); await clear();

    log(label + ': generating...');
    const t0 = Date.now();
    await page.evaluate(() => document.getElementById('generateBtn').click());
    for (let i = 0; i < 90 && !imageUrl; i++) await page.waitForTimeout(2000);
    if (!imageUrl) { log(label + ': NO URL returned'); await ctx.close(); continue; }
    const r = await fetch(imageUrl, { signal: AbortSignal.timeout(90000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const f = path.join(OUT, label + '.png');
    fs.writeFileSync(f, buf);
    fs.writeFileSync(path.join(OUT, label + '.prompt.txt'), sentPrompt || '(not captured)');
    log(label + ': ' + Math.round((Date.now()-t0)/1000) + 's, ' + Math.round(buf.length/1024) + 'KB -> ' + f);
    await ctx.close();
  }
  const bal = await (await fetch(API + '/api/get-balance?deviceId=' + DEVICE)).json();
  log('chips remaining:', bal.tokenBalance);
  await browser.close();
})();
