// THE STUDIO'S 3D CUP SHOWS THE PRINT (Alyx, 5 Oct 2026: "The Studio 3D
// silhouette should directly reflect exactly what will be seen on the print.
// Why would these two images be different?"). For the 40oz Vacuum, whose print
// is held inside Printify's safe area with its ends faded into one colour:
//   * the 3D model's safe area is the catalog's, number for number;
//   * from the same picture -- red at one end, blue at the other, so a seam
//     would show -- the browser's drawing (mug3d.js safeFaded) and the
//     server's print file (buildSafeFadedImage) agree pixel for pixel, up to
//     resampling and the print's JPEG;
//   * the band on the 3D cup is that print: both its ends the one same colour
//     the print's ends are, and its whole picture the print's, not the
//     picture before it.
// Run with the repo served on 127.0.0.1:8788.
const path = require('path');
const { pathToFileURL } = require('url');
const { launch, BASE } = require('./harness');
const ROOT = path.join(__dirname, '..');
const W = 3710, H = 2817, KEY = 'travel-mug-40oz-vacuum';

(async () => {
  const sharp = (await import(pathToFileURL(path.join(ROOT, 'node_modules', 'sharp', 'lib', 'index.js')).href)).default;
  const { getProduct } = await import(pathToFileURL(path.join(ROOT, 'lib', 'products-catalog.js')).href);
  const { buildSafeFadedImage } = await import(pathToFileURL(path.join(ROOT, 'api', 'create-printify-order.js')).href);
  const safeArea = getProduct(KEY).safeArea;
  const results = [];
  const check = (name, ok, detail) => { results.push(ok); console.log(`[${name}] ${ok ? 'PASS' : 'FAIL'}: ${detail}`); };

  // The picture: a red end, a blue end, a soft gradient and dark bars between.
  const pw = 1800, ph = Math.round(pw * H / W);
  const raw = Buffer.alloc(pw * ph * 3);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const t = x / (pw - 1), i = (y * pw + x) * 3, bar = (Math.floor(x / 90) % 4 === 1 && y > ph * 0.3 && y < ph * 0.7);
    raw[i] = bar ? 30 : Math.round(230 * (1 - t) + 20 * t); raw[i + 1] = bar ? 30 : Math.round(60 + 120 * Math.sin(Math.PI * t)); raw[i + 2] = bar ? 30 : Math.round(30 * (1 - t) + 220 * t);
  }
  const png = await sharp(raw, { raw: { width: pw, height: ph, channels: 3 } }).png().toBuffer();
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  const server = await sharp(await buildSafeFadedImage(dataUrl, W, H, safeArea)).removeAlpha().raw().toBuffer();
  const px = (buf, w, x, y) => { const i = (y * w + x) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
  const serverEdge = px(server, W, 2, Math.round(H / 2));

  const { browser, page } = await launch({ viewport: { width: 900, height: 900 }, chromiumArgs: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    await page.route('**/__safe_area_test.png', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
    await page.goto(`${BASE}/needles-studio.html`);
    await page.waitForFunction(() => typeof MUG3D !== 'undefined', null, { timeout: 20000 });

    // 1. The model's safe area is the catalog's.
    const src = require('fs').readFileSync(path.join(ROOT, 'mug3d.js'), 'utf8');
    const m = /'travel-mug-40oz-vacuum':\s*\{[\s\S]*?safeArea:\{\s*x:([\d/ .]+),\s*y:([\d/ .]+)\s*\}/.exec(src);
    const ev = (s) => s.split('/').map(Number).reduce((a, b) => a / b);
    check('sameSafeArea', !!m && Math.abs(ev(m[1]) - safeArea.x) < 1e-12 && Math.abs(ev(m[2]) - safeArea.y) < 1e-12,
      m ? `model ${m[1].trim()} x ${m[2].trim()}, catalog ${safeArea.x} x ${safeArea.y}` : 'no safeArea on the model');

    // 2. The browser's drawing at the print's own size against the server's print.
    const b64 = await page.evaluate(async ([w, h, sa]) => {
      const c = await MUG3D.safeFadedFrom('/__safe_area_test.png', w / h, sa, w);
      return c.toDataURL('image/png').split(',')[1];
    }, [W, H, safeArea]);
    const browserPx = await sharp(Buffer.from(b64, 'base64')).removeAlpha().raw().toBuffer();
    let sum = 0, worst = 0;
    for (let i = 0; i < server.length; i++) { const d = Math.abs(server[i] - browserPx[i]); sum += d; if (d > worst) worst = d; }
    const mean = sum / server.length;
    const bEdge = px(browserPx, W, 2, Math.round(H / 2)), bOther = px(browserPx, W, W - 3, Math.round(H / 2));
    const near = (a, b, t) => a.every((v, i) => Math.abs(v - b[i]) <= t);
    check('sameAsThePrint', mean < 2.5 && near(bEdge, serverEdge, 3) && near(bOther, serverEdge, 3),
      `mean difference ${mean.toFixed(2)} of 255 (largest ${worst}); ends ${bEdge} and ${bOther}, the print's ${serverEdge}`);

    // 3. The 3D cup's band wears that print.
    const band = await page.evaluate(async () => {
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:600px;z-index:99999';
      document.body.appendChild(host);
      await MUG3D.open(host, { tumblerKey: 'travel-mug-40oz-vacuum', colorHex: '#ffffff', panoramaUrl: '/__safe_area_test.png', panelUrls: [] });
      const c = MUG3D.bandCanvas(0), g = c.getContext('2d');
      const at = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
      return { w: c.width, h: c.height, left: at(1, c.height >> 1), right: at(c.width - 2, c.height >> 1), png: c.toDataURL('image/png').split(',')[1] };
    });
    const bandPx = await sharp(Buffer.from(band.png, 'base64')).removeAlpha().raw().toBuffer();
    const serverSmall = await sharp(server, { raw: { width: W, height: H, channels: 3 } }).resize(band.w, band.h, { fit: 'fill' }).raw().toBuffer();
    let s2 = 0; for (let i = 0; i < bandPx.length; i++) s2 += Math.abs(bandPx[i] - serverSmall[i]);
    const mean2 = s2 / bandPx.length;
    check('theBandIsThePrint', near(band.left, band.right, 3) && near(band.left, serverEdge, 4) && mean2 < 4,
      `band ends ${band.left} | ${band.right} (the print's ${serverEdge}); whole band against the print: ${mean2.toFixed(2)} of 255`);
  } finally { await browser.close(); }
  const failed = results.filter((r) => !r).length;
  console.log(failed ? `\n${failed} SAFE-AREA-PREVIEW VERIFICATION(S) FAILED` : '\nALL SAFE-AREA-PREVIEW VERIFICATIONS PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
