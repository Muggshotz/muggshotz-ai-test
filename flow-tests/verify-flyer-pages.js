// THE FLYER AND WHERE IT LANDS (Alyx, 24 Sep 2026: "flyers that show one
// product's flow and the model simply; the smart mug first"). The API side is
// in verify-flyer-onboarding.mjs; this holds the two pages to:
//   * flyer-sheet.html with a product prints that product: its picture (the
//     smart mug's COLD -> HOT strip, loaded), its catalog price, its three
//     steps, the code, and a QR that points at start.html?ref=CODE; two to a
//     page, and nothing is cut off the flyer;
//   * without a product, or with one the list does not know, the generic mug
//     flyer, and the toolbar says why;
//   * start.html asks the code what it sells and pitches that: headline,
//     picture, price, steps and button, with the code kept on the studio link
//     and remembered for checkout; no sideways scroll on a phone;
//   * a code with no product keeps the coffee-mug pitch.
const path = require('path');
const { pathToFileURL } = require('url');
const { launch } = require('./harness');
const T = (p, ms) => p.waitForTimeout(ms);
const BASE = 'http://127.0.0.1:8788';
const ROOT = path.resolve(__dirname, '..');

let PRODUCTS = null;
async function products() {
  if (!PRODUCTS) PRODUCTS = (await import(pathToFileURL(path.join(ROOT, 'lib', 'flyer-products.js')).href)).flyerProducts();
  return PRODUCTS;
}

async function open(opts = {}) {
  const list = await products();
  const { browser, page, log } = await launch({ viewport: opts.viewport });
  // The QR library comes from a CDN this sandbox cannot reach; a stand-in
  // that records the text on the box, as the real one does (its title).
  await page.route('**/qrcode.min.js', (route) => route.fulfill({ contentType: 'application/javascript',
    body: "window.QRCode=function(el,o){el.title=o.text;var c=document.createElement('canvas');c.width=o.width;c.height=o.height;el.appendChild(c);};window.QRCode.CorrectLevel={M:0};" }));
  await page.route('**/api/admin?action=flyer-products*', (route) => route.fulfill({ json: { products: list } }));
  await page.route('**/api/get-balance**', (route) => {
    const u = new URL(route.request().url());
    const code = u.searchParams.get('referralCode');
    if (!code) return route.fulfill({ json: { tokenBalance: 0 } });
    const product = opts.productKey ? list.find((p) => p.key === opts.productKey) : null;
    return route.fulfill({ json: { code, found: true, fullName: 'Jane Smith', featuredProduct: product ? product.key : null, product } });
  });
  await page.goto(BASE + opts.path, { waitUntil: 'domcontentloaded' });
  await T(page, 1500);
  return { browser, page, log };
}

const SHEET = '/flyer-sheet.html?name=Jane+Smith&base=CHIPPER&codes=CHIPPER-01,CHIPPER-02';

const scenarios = {};

scenarios.theSmartMugFlyerTellsItsStory = async () => {
  const { browser, page } = await open({ path: SHEET + '&product=smart-mug' });
  try {
    const got = await page.evaluate(() => {
      const flyers = [...document.querySelectorAll('.flyer')];
      return {
        product: document.getElementById('sheet').classList.contains('product'),
        summary: document.getElementById('summary').textContent,
        flyers: flyers.map((f) => {
          const img = f.querySelector('.pf-picture');
          return {
            headline: f.querySelector('.pf-headline')?.textContent,
            price: f.querySelector('.pf-price')?.textContent,
            picture: img ? { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 } : null,
            steps: [...f.querySelectorAll('.pf-steps li')].map((li) => li.textContent.trim()),
            code: f.querySelector('.code')?.textContent,
            qr: f.querySelector('.qr')?.title,
            fits: f.scrollHeight <= f.clientHeight + 1 && f.scrollWidth <= f.clientWidth + 1,
            // The parts sit one under the next: no part starts above the
            // bottom of the one before it, and the last ends inside the box.
            stacked: (() => {
              const parts = ['.pf-top', '.pf-headline', '.pf-body', '.pf-foot'].map((s) => f.querySelector(s).getBoundingClientRect());
              const box = f.getBoundingClientRect();
              return parts.every((r, k) => k === 0 || r.top >= parts[k - 1].bottom - 1) && parts[parts.length - 1].bottom <= box.bottom + 1
                && [...f.querySelectorAll('.pf-scan > *')].every((el, k, all) => k === 0 || el.getBoundingClientRect().top >= all[k - 1].getBoundingClientRect().bottom - 1);
            })(),
          };
        }),
      };
    });
    if (!got.product) return 'FAIL: the sheet is not laid out as product flyers';
    if (got.flyers.length !== 2) return `FAIL: ${got.flyers.length} flyers for two codes`;
    const f = got.flyers[0];
    if (f.headline !== 'Heat reveals what matters.') return `FAIL: headline "${f.headline}"`;
    if (!/\$19\.95/.test(f.price)) return `FAIL: price "${f.price}" (catalog smart-mug 19.95)`;
    if (!f.picture || !/proposal-coldhot\.jpg$/.test(f.picture.src)) return `FAIL: picture ${JSON.stringify(f.picture)}`;
    if (!f.picture.loaded) return 'FAIL: the COLD -> HOT strip did not load';
    if (f.steps.length !== 3 || !/hot/i.test(f.steps[2])) return `FAIL: steps ${JSON.stringify(f.steps)}`;
    if (f.code !== 'CHIPPER-01' || got.flyers[1].code !== 'CHIPPER-02') return `FAIL: codes ${f.code}, ${got.flyers[1].code}`;
    if (f.qr !== `${BASE}/start.html?ref=CHIPPER-01`) return `FAIL: QR points at "${f.qr}"`;
    if (!got.flyers.every((x) => x.fits)) return 'FAIL: a flyer overflows its printed box (something would be cut off)';
    if (!got.flyers.every((x) => x.stacked)) return 'FAIL: parts of the flyer overlap or run past the bottom';
    if (!/SURPRISE!!! Smart Mug/.test(got.summary) || !/Two per page/.test(got.summary)) return `FAIL: summary "${got.summary}"`;
    await page.screenshot({ path: path.join(process.env.MZ_SHOT_DIR || __dirname, 'shot-flyer-smart-mug.png'), fullPage: true });
    return 'PASS: two smart mug flyers, COLD -> HOT strip loaded, $19.95, three steps, code and QR to start.html?ref=CODE, nothing cut off';
  } finally { await browser.close(); }
};

scenarios.withoutAProductTheGenericMugFlyerPrints = async () => {
  const { browser, page } = await open({ path: SHEET });
  try {
    const got = await page.evaluate(() => ({
      product: document.getElementById('sheet').classList.contains('product'),
      n: document.querySelectorAll('.flyer').length,
      pitch: document.querySelector('.flyer .pitch')?.textContent,
      qr: document.querySelector('.flyer .qr')?.title,
      summary: document.getElementById('summary').textContent,
    }));
    if (got.product || got.n !== 2) return `FAIL: ${JSON.stringify(got)}`;
    if (!/Your face\. Your mug\./.test(got.pitch)) return `FAIL: pitch "${got.pitch}"`;
    if (got.qr !== `${BASE}/start.html?ref=CHIPPER-01`) return `FAIL: QR "${got.qr}"`;
    return 'PASS: the generic mug flyer, two of them, QR to start.html?ref=CODE';
  } finally { await browser.close(); }
};

scenarios.anUnknownProductFallsBackAndSaysSo = async () => {
  const { browser, page } = await open({ path: SHEET + '&product=hoverboard' });
  try {
    const got = await page.evaluate(() => ({
      product: document.getElementById('sheet').classList.contains('product'),
      n: document.querySelectorAll('.flyer').length,
      summary: document.getElementById('summary').textContent,
    }));
    if (got.product || got.n !== 2) return `FAIL: ${JSON.stringify(got)}`;
    if (!/hoverboard/.test(got.summary) || !/generic/.test(got.summary)) return `FAIL: summary "${got.summary}"`;
    return `PASS: generic flyers, toolbar says: ${got.summary.slice(got.summary.indexOf('('))}`;
  } finally { await browser.close(); }
};

scenarios.theLandingPagePitchesTheCodesProduct = async () => {
  const { browser, page } = await open({ path: '/start.html?ref=CHIPPER-01', productKey: 'smart-mug', viewport: { width: 390, height: 844 } });
  try {
    const got = await page.evaluate(() => {
      const img = document.getElementById('heroImg');
      return {
        title: document.title,
        h1: document.getElementById('heroTitle').textContent,
        pitch: document.getElementById('heroPitch').textContent,
        img: { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, wide: img.classList.contains('wide') },
        cta: document.getElementById('cta').getAttribute('href'),
        ctaText: document.getElementById('ctaText').textContent,
        price: document.getElementById('priceLine').textContent,
        steps: [...document.querySelectorAll('#howSteps li')].map((li) => li.textContent.trim()),
        from: document.getElementById('from').textContent,
        also: document.getElementById('alsoLink').getAttribute('href'),
        codeLine: document.getElementById('codeLine').textContent,
        stored: localStorage.getItem('muggshotz_referral_code'),
        sideways: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    if (got.h1 !== 'Heat reveals what matters.') return `FAIL: h1 "${got.h1}"`;
    if (!/pour something hot/i.test(got.pitch)) return `FAIL: pitch "${got.pitch}"`;
    if (!/proposal-coldhot\.jpg$/.test(got.img.src) || !got.img.loaded || !got.img.wide) return `FAIL: hero ${JSON.stringify(got.img)}`;
    if (got.cta !== 'needles-studio.html?ref=CHIPPER-01' || got.also !== got.cta) return `FAIL: links ${got.cta} / ${got.also}`;
    if (got.ctaText !== '🎁 Pick my message') return `FAIL: button "${got.ctaText}"`;
    if (!/SURPRISE!!! Smart Mug \$19\.95/.test(got.price)) return `FAIL: price line "${got.price}"`;
    if (got.steps.length !== 3 || !/pick the message/i.test(got.steps[0])) return `FAIL: steps ${JSON.stringify(got.steps)}`;
    if (got.from !== '👋 Jane sent you') return `FAIL: from "${got.from}"`;
    if (got.stored !== 'CHIPPER-01' || !/CHIPPER-01/.test(got.codeLine)) return `FAIL: code not remembered (${got.stored} / "${got.codeLine}")`;
    if (!/Smart Mug/.test(got.title)) return `FAIL: title "${got.title}"`;
    if (got.sideways) return 'FAIL: the page scrolls sideways on a phone';
    await page.screenshot({ path: path.join(process.env.MZ_SHOT_DIR || __dirname, 'shot-flyer-landing-smart-mug.png'), fullPage: true });
    return 'PASS: smart mug headline, strip, $19.95, three steps, "Pick my message" to the studio with the code, Jane named, no sideways scroll on a phone';
  } finally { await browser.close(); }
};

scenarios.aCodeWithNoProductKeepsTheMugPitch = async () => {
  const { browser, page } = await open({ path: '/start.html?ref=CHIPPER-01' });
  try {
    const got = await page.evaluate(() => ({
      h1: document.getElementById('heroTitle').textContent,
      price: document.getElementById('priceLine').textContent,
      ctaText: document.getElementById('ctaText').textContent,
      from: document.getElementById('from').textContent,
      cta: document.getElementById('cta').getAttribute('href'),
    }));
    if (!/Your face\. Your mug\./.test(got.h1)) return `FAIL: h1 "${got.h1}"`;
    if (!/from \$14\.95/.test(got.price) || got.ctaText !== '🎨 Make my mug') return `FAIL: ${got.price} / ${got.ctaText}`;
    if (got.from !== '👋 Jane sent you' || got.cta !== 'needles-studio.html?ref=CHIPPER-01') return `FAIL: ${got.from} / ${got.cta}`;
    return 'PASS: the coffee-mug pitch, Jane named, code on the studio link';
  } finally { await browser.close(); }
};

(async () => {
  const results = {};
  for (const [name, fn] of Object.entries(scenarios)) {
    try { results[name] = await fn(); }
    catch (e) { results[name] = 'FAIL (threw): ' + (e.stack || e.message); }
    console.log(`[${name}] ${results[name]}`);
  }
  const failed = Object.values(results).filter((r) => !/^PASS/.test(r)).length;
  console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL FLYER-PAGES VERIFICATIONS PASSED');
  process.exit(failed ? 1 : 0);
})();
