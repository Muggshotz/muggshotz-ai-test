// THE SPINNER THAT NEVER STOPPED (Alyx, Sep 2026: "I stopped it at 700 seconds,
// that was getting ridiculous").
//
// callGenerateAPI had no time limit on either of its two waits. The dangerous
// one is the second: fetch() settles on HEADERS, and resp.json() waits for the
// BODY, so a connection that goes quiet after a 200 leaves a promise that never
// settles -- no error to catch, no spinner to stop.
//
// This stubs exactly that: a response whose headers arrive and whose body never
// does. If the clock works, the call gives up and says so. If it does not, this
// suite hangs, which is the bug.
const { chromium } = require('playwright');
const PAGE = 'http://127.0.0.1:8788/needles-studio.html';
let pass = 0, fail = 0;
const ok = (n, d) => { pass++; console.log(`PASS: ${n}`, d === undefined ? '' : JSON.stringify(d)); };
const no = (n, d) => { fail++; console.log(`FAIL: ${n}`, d === undefined ? '' : JSON.stringify(d)); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newContext({ viewport: { width: 430, height: 880 } }).then(c => c.newPage());
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(async () => {
    GEN_SLOW_NOTICE_MS = 300;
    GEN_HARD_TIMEOUT_MS = 1200;
    const realFetch = window.fetch;
    // Headers land (ok:true, status 200); the body never does -- unless the
    // abort signal fires, which is the whole point.
    window.fetch = (url, opts) => {
      if (String(url).includes('/api/generate')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => new Promise((_, reject) => {
            const s = opts && opts.signal;
            if (s) s.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
          })
        });
      }
      return realFetch(url, opts);
    };
    const started = Date.now();
    let noticeSeen = false;
    const watch = setInterval(() => {
      const el = document.getElementById('needlesGenOverlayStatus');
      if (el && /taking longer/i.test(el.textContent || '')) noticeSeen = true;
    }, 50);
    let message = null, timedOut = false, threw = false;
    try {
      await callGenerateAPI({ workingImage: 'data:,', prompt: 'x' });
    } catch (e) {
      threw = true; message = e.message; timedOut = !!e.timedOut;
    }
    clearInterval(watch);
    window.fetch = realFetch;
    return { threw, timedOut, message, noticeSeen, elapsed: Date.now() - started };
  });

  res.threw ? ok('a body that never arrives does not hang for ever', { elapsed: res.elapsed })
            : no('the call returned instead of giving up', res);
  res.timedOut ? ok('it is reported as a timeout, not a generic failure')
               : no('the error is not flagged as a timeout', res);
  /longer|stopped waiting|took too long/i.test(res.message || '')
    ? ok('the customer is told in plain words', { message: res.message })
    : no('the message would not mean anything to a customer', res);
  /token/i.test(res.message || '')
    ? ok('the message accounts for the token, rather than leaving them to wonder')
    : no('it leaves the customer guessing about the token', res);
  res.noticeSeen ? ok('a reassurance appears before the hard stop')
                 : no('nothing was said during the long wait', res);
  (res.elapsed >= 1000 && res.elapsed < 4000)
    ? ok('it waits the configured time, no longer', { elapsed: res.elapsed })
    : no('the wait does not match the configured timeout', res);


  // RECOVERY: the same stall, but this time a picture really was saved. The
  // customer should get it and never learn anything went wrong.
  const rec = await page.evaluate(async () => {
    GEN_SLOW_NOTICE_MS = 300;
    GEN_HARD_TIMEOUT_MS = 800;
    const realFetch = window.fetch;
    const SAVED = 'https://example.test/storage/v1/object/public/generations/dev-123.png';
    let askedRecent = false;
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/get-balance') && u.includes('recent=1')) {
        askedRecent = true;
        return Promise.resolve({ ok: true, status: 200,
          json: async () => ({ recent: [{ url: SAVED, madeAt: Date.now() }] }) });
      }
      if (u.includes('/api/generate')) {
        return Promise.resolve({ ok: true, status: 200,
          json: () => new Promise((_, reject) => {
            const s = opts && opts.signal;
            if (s) s.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
          }) });
      }
      return realFetch(url, opts);
    };
    let returned = null, threw = null;
    try { returned = await callGenerateAPI({ workingImage: 'data:,', prompt: 'x' }); }
    catch (e) { threw = e.message; }
    window.fetch = realFetch;
    return { returned, threw, askedRecent, SAVED };
  });

  rec.askedRecent ? ok('a stall asks storage whether the picture was saved')
                  : no('it gave up without checking storage', rec);
  rec.returned === rec.SAVED
    ? ok('a picture that was saved is handed over, stall and all')
    : no('the saved picture was not recovered', rec);

  // And when there genuinely is nothing, it must not claim there is.
  const none = await page.evaluate(async () => {
    GEN_SLOW_NOTICE_MS = 300;
    GEN_HARD_TIMEOUT_MS = 800;
    const realFetch = window.fetch;
    window.fetch = (url, opts) => {
      const u = String(url);
      if (u.includes('/api/get-balance') && u.includes('recent=1'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ recent: [] }) });
      if (u.includes('/api/generate'))
        return Promise.resolve({ ok: true, status: 200,
          json: () => new Promise((_, reject) => {
            const s = opts && opts.signal;
            if (s) s.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
          }) });
      return realFetch(url, opts);
    };
    let returned = null, message = null;
    try { returned = await callGenerateAPI({ workingImage: 'data:,', prompt: 'x' }); }
    catch (e) { message = e.message; }
    window.fetch = realFetch;
    return { returned, message };
  });

  none.returned === null ? ok('nothing saved means nothing is invented')
                         : no('it returned a picture that does not exist', none);
  /no picture was saved/i.test(none.message || '')
    ? ok('and the customer is told the token should not have been spent', { message: none.message })
    : no('the empty case does not explain the token', none);

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL GENERATE-TIMEOUT VERIFICATIONS PASSED');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
