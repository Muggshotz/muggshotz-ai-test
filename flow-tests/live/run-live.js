// A LIVE RUN, DRIVEN FOR ALYX (Sep 2026). His idea: "You could run the test and
// give me the thing to look at... show me the thing that I would otherwise have
// gone through the steps to generate, and then all you have to do is seek my
// approval on what's been generated."
//
// Unlike everything in flow-tests/, this points at the REAL site and does NOT
// stub the image service. It spends real chips, so it carries its own ledger
// and generates as few times as the question allows -- this one generates ONCE
// and varies the size afterwards, because the size is applied on the client.
//
// Device: mz-claude-test, funded by Alyx from the admin page, kept separate
// from his own balance so the counter stays readable as a ledger.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// The PAGE is served locally (so we are testing the code in this working tree,
// not whatever is on main) and only the /api/ calls are forwarded to the real
// Vercel functions. Forwarded from Node rather than from the browser because
// this session's egress proxy re-terminates TLS and Node trusts its CA bundle
// while Playwright's bundled Chromium does not -- and disabling certificate
// verification is never the answer.
const PAGE = 'http://127.0.0.1:8788';
const API  = 'https://muggshotz-ai-test.vercel.app';
const DEVICE = 'mz-claude-test';
const OUT = process.argv[2] || '/tmp/live-out';
const PROMPT = process.argv[3] || 'Put him on a tiny red tricycle in a parade.';
const SIZES = (process.argv[4] || '100,70,40').split(',').map(Number);

const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 880 } });
  await ctx.addInitScript(id => {
    try { localStorage.setItem('muggshotz_device_id', id); } catch (e) {}
  }, DEVICE);
  const page = await ctx.newPage();
  page.on('pageerror', e => log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type()==='error') log('CONSOLE-ERR:', m.text().slice(0,160)); });

  // EVERYTHING that leaves the page goes through Node, not just /api/.
  //
  // First diagnosed run: /api/generate came back 200 in 20s with a 125-byte
  // body -- the JSON carrying the image URL. The picture itself lives on
  // Supabase, and when the browser went to fetch THAT, Chromium refused it
  // (ERR_CERT_AUTHORITY_INVALID) because this session's egress proxy
  // re-terminates TLS and the bundled browser does not read the CA store. The
  // studio worked perfectly and the harness could not see the result.
  //
  // Node trusts the bundle, so every outbound request is relayed through it.
  // Certificate verification stays fully on; it just happens in the process
  // that is configured for it.
  //
  // TWO patterns, one handler: the page's own /api/ calls are RELATIVE, so
  // they resolve against the local origin and are http -- matching only
  // https:// silently stopped intercepting them and the python file server
  // answered with 404 HTML.
  const relay = async route => {
    const req = route.request();
    const raw = new URL(req.url());
    const isApi = raw.pathname.startsWith('/api/');
    const url = isApi ? API + raw.pathname + raw.search : req.url();
    try {
      const bodyBuf = ['GET','HEAD'].includes(req.method()) ? undefined : req.postDataBuffer();
      const h = { ...req.headers() };
      delete h.host; delete h.origin; delete h.referer; delete h['content-length'];
      const t = Date.now();
      const r = await fetch(url, { method: req.method(), headers: h, body: bodyBuf });
      const buf = Buffer.from(await r.arrayBuffer());
      if (isApi || buf.length > 40000) {
        const tag = isApi ? 'api ' + raw.pathname : raw.hostname + raw.pathname.slice(0, 28);
        log('  ' + tag + ' -> ' + r.status + ' in ' + Math.round((Date.now()-t)/1000) + 's, ' + buf.length + ' bytes');
      }
      await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream' }, body: buf });
    } catch (e) {
      log('RELAY FAILED:', url.slice(0, 90), e.message);
      await route.fulfill({ status: 502, body: JSON.stringify({ error: 'relay failed: ' + e.message }) });
    }
  };
  await page.route('**/api/**', relay);
  await page.route('https://**', relay);

  const balance = async () => page.evaluate(async d => {
    const r = await fetch('/api/get-balance?deviceId=' + encodeURIComponent(d));
    return (await r.json()).tokenBalance;
  }, DEVICE);

  const clearAlerts = async () => {
    for (let i = 0; i < 8; i++) {
      const n = await page.evaluate(() => {
        let n = 0;
        document.querySelectorAll('.big-alert-overlay.visible').forEach(o => { o.classList.remove('visible'); o.style.display = 'none'; n++; });
        return n;
      });
      if (!n) break;
      await page.waitForTimeout(200);
    }
  };

  await page.goto(PAGE + '/needles-studio.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const before = await balance();
  log('chips before:', before);
  if (before < 1) { log('NO CHIPS on ' + DEVICE + ' -- grant some and re-run.'); await browser.close(); process.exit(2); }

  // upload
  await page.evaluate(() => { const g=document.getElementById('openingGuideTimer'); if(g)clearTimeout(g); });
  await page.setInputFiles('#fileInput', path.join(__dirname, '..', 'test-photo.jpg'));
  await page.waitForTimeout(2500); await clearAlerts();

  // ANSWER THE INTENT GATE FIRST (found by screenshotting a timeout: the
  // "HOW WILL YOU GET YOUR ART?" modal was sitting over a finished generation,
  // so the reveal could never be seen). Calling pickTrackDescribe() directly
  // skipped the gate rather than satisfying it, and it came back.
  await page.evaluate(() => { if (typeof chooseIntentAI === 'function') chooseIntentAI(); });
  await page.waitForTimeout(1500); await clearAlerts();

  // AI track
  await page.evaluate(() => pickTrackDescribe());
  await page.waitForTimeout(1200); await clearAlerts();
  await page.evaluate(() => confirmStyleAndContinue());
  await page.waitForTimeout(1200); await clearAlerts();

  // idea + product
  await page.evaluate(p => { const b=document.getElementById('ideaDesc'); b.value=p; b.dispatchEvent(new Event('input',{bubbles:true})); }, PROMPT);
  await page.waitForTimeout(800); await clearAlerts();
  await page.evaluate(() => { const t=document.querySelector('#productCard .btn-select[data-val="mouse pad"]'); pick(t,'product'); });
  await page.waitForTimeout(1500); await clearAlerts();

  log('generating (real API, ~25s)...');
  const t0 = Date.now();
  await page.evaluate(() => document.getElementById('generateBtn').click());
  try {
    await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 180000 });
  } catch (e) {
    const st = await page.evaluate(() => ({
      status: document.getElementById('statusMsg')?.textContent?.slice(0,200) || '',
      timer: document.getElementById('genTimer')?.textContent || '',
      alert: [...document.querySelectorAll('.big-alert-overlay.visible')].map(o=>o.textContent.slice(0,160)),
    }));
    log('TIMED OUT. on screen:', JSON.stringify(st));
    await page.screenshot({ path: path.join(OUT, 'timeout.png') });
    throw e;
  }
  log('generated in ' + Math.round((Date.now()-t0)/1000) + 's');
  await page.waitForTimeout(4000); await clearAlerts();

  await page.evaluate(() => { const b=[...document.querySelectorAll('#approveRow button')].find(x=>x.textContent.includes('Yes')); b.click(); });
  await page.waitForFunction(() => document.getElementById('frameFadeOverlay')?.style.display === 'flex', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  log('on the Edge Fade screen');

  // one generation, several sizes: the size is applied client-side
  const files = [];
  for (const size of SIZES) {
    await page.evaluate(s => {
      document.getElementById('frameFadeAmountSlider').value = 35;
      document.getElementById('frameFadeSizeSlider').value = s;
      updateFrameFadePreview();
    }, size);
    await page.waitForTimeout(2500);
    const dataUrl = await page.evaluate(() => document.getElementById('frameFadeArtworkImg').src);
    const b64 = dataUrl.split(',')[1];
    const f = path.join(OUT, `size-${size}.jpg`);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    files.push(f);
    log('captured size ' + size + '% -> ' + f);
  }

  const after = await balance();
  log('chips after:', after, '| spent:', before - after);
  fs.writeFileSync(path.join(OUT, 'ledger.txt'), `before ${before}\nafter ${after}\nspent ${before - after}\nprompt ${PROMPT}\n`);
  await browser.close();
})();
