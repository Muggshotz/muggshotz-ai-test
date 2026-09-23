// THE DOORMAT'S WHITE BORDER (Alyx, 23 Sep 2026: "begin with the doormat
// border"). The mat prints 4650 x 2850 (1.63:1) but the studio painted it
// square, and Printify fits rather than fills, so it printed with white down
// both sides. It now paints on the widest canvas, asks for the mat's shape
// letterboxed inside it (bandRatio), trims the white rows and cuts to the
// exact print shape. The painter stub here answers the way the real one is
// asked to: the mat's band on a white 1536 x 1024 canvas.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const MAT = 4650 / 2850;

async function run(page, log) {
  // A letterboxed painting: the band 1536 wide at the mat's shape, white above and below.
  const b64 = await page.evaluate((mat) => {
    const c = document.createElement('canvas'); c.width = 1536; c.height = 1024;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1536, 1024);
    const h = Math.round(1536 / mat), y = Math.round((1024 - h) / 2);
    const gr = g.createLinearGradient(0, 0, 1536, 0); gr.addColorStop(0, '#b3202a'); gr.addColorStop(1, '#1f3f8f');
    g.fillStyle = gr; g.fillRect(0, y, 1536, h);
    return c.toDataURL('image/png').split(',')[1];
  }, MAT);
  await page.route('**/__fake/generated.jpg', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(b64, 'base64') }));
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="doormat"]').click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  if (!(await page.evaluate(() => document.body.classList.contains('ideafirst-focus')))) return 'FAIL: the Doormat tile did not reach the idea box';
  await page.fill('#ideaDesc', 'a golden retriever in a bow tie');
  await dismissAlerts(page);
  log.apiCalls.length = 0;
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await T(page, 800);
  const gen = log.apiCalls.find((x) => x.path === '/api/generate');
  if (!gen) return 'FAIL: nothing was painted';
  if (gen.body.size !== '1536x1024') return `FAIL: the doormat painted on ${gen.body.size}, not 1536x1024`;
  if (Number(gen.body.bandRatio) !== 1.63) return `FAIL: the painter was not asked for the mat's 1.63 shape (bandRatio ${gen.body.bandRatio})`;
  const d = await page.evaluate(async () => {
    const im = await loadImageFromUrl(findDesignById(currentDesignId).url);
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let white = 0; for (let x = 0; x < c.width; x++) for (const y of [1, c.height - 2]) { const i = (y * c.width + x) * 4; if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) white++; }
    return { w: im.naturalWidth, h: im.naturalHeight, white };
  });
  const shape = d.w / d.h;
  if (Math.abs(shape - MAT) > 0.01) return `FAIL: the doormat design is ${d.w}x${d.h} (${shape.toFixed(3)}:1), not ${MAT.toFixed(3)}:1 -- it would print with white sides`;
  if (d.white) return `FAIL: ${d.white} white pixels left on the design's top and bottom rows -- the letterbox was not trimmed`;
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await passFadePage(page);
  await T(page, 8000);
  const start = log.apiCalls.find((x) => x.path === '/api/start-mockup' && x.action === 'start');
  if (!start) return 'FAIL: approving the doormat fetched no Printify mockup';
  if (start.body.productKey !== 'doormat' || start.body.sizeLabel !== '18 x 30') return `FAIL: the mockup asked for ${start.body.productKey} / ${start.body.sizeLabel}`;
  return `PASS: the doormat paints 1536x1024 asking for 1.63:1, comes back ${d.w}x${d.h} (${shape.toFixed(3)}:1) with no white, and the mockup is doormat / 18 x 30`;
}

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } })) {
    const { browser, page, log } = await launch({ viewport, echoUploads: true });
    let result;
    try { await openStudio(page); await uploadPhoto(page); await dismissAlerts(page); result = await run(page, log); }
    catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
    console.log(`[${screen}] ${result}`);
    if (!/^PASS/.test(result)) fails++;
    const errs = log.consoleErrors.filter((e) => !/ERR_TUNNEL|ERR_CONNECTION/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs.slice(0, 5))}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nDOORMAT VERIFIED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
