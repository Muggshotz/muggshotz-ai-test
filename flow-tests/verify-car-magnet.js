// The car magnet (Alyx, 22 Sep 2026). Three sizes, three print areas, and
// the picture has to be each one's exact shape -- buildSingleImage fits, it
// does not fill, so any other shape prints with white bars. What this pins:
//   * the tile opens the size card, and a size hands off to the idea box;
//   * each size paints on the right canvas and asks for the right shape: the
//     square paints square; the 7.5 x 4.5 starts from the widest canvas; the
//     10 x 3 is a 3:1 strip, carried to the server as bandRatio on the PHOTO
//     lane as well as the described one;
//   * the design that comes back is cut to that size's exact print shape;
//   * approving fetches Printify's mockup for the car magnet at that size.
const { launch, openStudio, uploadPhoto, dismissAlerts, passFadePage } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const SHAPES = { '5 x 5 in': 1, '7.5 x 4.5 in': 2475 / 1575, '10 x 3 in': 3 };
const CANVAS = { '5 x 5 in': '1024x1024', '7.5 x 4.5 in': '1536x1024', '10 x 3 in': '1536x1024' };

async function magnetTo(page, size, log) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="car magnet"]').click({ force: true });
  await T(page, 1000);
  const card = await page.evaluate(() => {
    const c = document.getElementById('carMagnetOptionCard');
    return { shown: !!c && getComputedStyle(c).display !== 'none', tiles: c ? c.querySelectorAll('.btn-select').length : 0 };
  });
  if (!card.shown) return 'FAIL: the Car Magnet tile did not open its size card';
  if (card.tiles !== 3) return `FAIL: the size card has ${card.tiles} sizes, not 3`;
  await page.click(`#carMagnetOptionGrid .btn-select[data-opt="${size}"]`);
  await T(page, 1200);
  await dismissAlerts(page);
  const idea = await page.evaluate(() => document.body.classList.contains('ideafirst-focus'));
  if (!idea) return `FAIL: picking ${size} did not hand off to the idea box`;
  await page.fill('#ideaDesc', 'my dog driving a convertible');
  await dismissAlerts(page);
  log.apiCalls.length = 0;
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 });
  await T(page, 800);
  return null;
}

const scenarios = {};
const OPTS = {};

for (const size of Object.keys(SHAPES)) {
  const name = 'magnet_' + size.replace(/[^0-9]+/g, '_');
  // echoUploads: the default stub answers every upload with one fixed square,
  // which would hide exactly the shape this checks.
  OPTS[name] = { echoUploads: true };
  scenarios[name] = async (page, log) => {
    const early = await magnetTo(page, size, log);
    if (early) return early;
    const gen = log.apiCalls.find((c) => c.path === '/api/generate');
    if (!gen) return 'FAIL: nothing was painted';
    if (gen.body.size !== CANVAS[size]) return `FAIL: ${size} painted on ${gen.body.size}, not ${CANVAS[size]}`;
    const strip = SHAPES[size] > 1.6;
    if (strip && Number(gen.body.bandRatio) !== 3) return `FAIL: the 10 x 3 photo request carried bandRatio ${gen.body.bandRatio}, not 3 -- the painter would fill the canvas and the strip would be cut from it`;
    if (!strip && gen.body.bandRatio) return `FAIL: ${size} asked for a strip (bandRatio ${gen.body.bandRatio})`;
    if (!/car magnet artwork/.test(gen.prompt || '')) return 'FAIL: the painter was not told this is a car magnet';
    const shape = await page.evaluate(async () => {
      const d = findDesignById(currentDesignId);
      const im = await loadImageFromUrl(d.url);
      return im.naturalWidth / im.naturalHeight;
    });
    if (Math.abs(shape - SHAPES[size]) > 0.01) return `FAIL: the ${size} design is ${shape.toFixed(3)}:1, not ${SHAPES[size].toFixed(3)}:1 -- it would print with white bars`;
    await page.locator('#approveRow button:has-text("Yes")').first().click();
    await passFadePage(page);
    await T(page, 8000);
    const start = log.apiCalls.find((c) => c.path === '/api/start-mockup' && c.action === 'start');
    if (!start) return `FAIL: approving the ${size} magnet fetched no Printify mockup`;
    if (start.body.productKey !== 'car-magnet' || start.body.sizeLabel !== size) return `FAIL: the mockup asked for ${start.body.productKey} / ${start.body.sizeLabel}`;
    return `PASS: ${size} paints on ${gen.body.size}${strip ? ' as a 3:1 strip (bandRatio 3 on the photo lane)' : ''}, comes back ${shape.toFixed(3)}:1, and approving fetches the car-magnet mockup at ${size}`;
  };
}

// A described 10 x 3 asks the described lane for the strip too.
scenarios.describedStripAsksForTheBand = async (page) => {
  const r = await page.evaluate(() => {
    product = 'car magnet'; selectedCarMagnet = '10 x 3 in';
    const strip = describeTextOnlyPayload();
    selectedCarMagnet = '5 x 5 in';
    const square = describeTextOnlyPayload();
    return { strip: strip.bandRatio, stripRule: strip.shapingRule, square: square.bandRatio || null, squareRule: square.shapingRule };
  });
  if (r.strip !== 3) return `FAIL: a described 10 x 3 asks for ${r.strip}, not a 3:1 strip`;
  if (!/3 times wider/.test(r.stripRule)) return `FAIL: the 10 x 3 rule does not give the shape: "${r.stripRule}"`;
  if (r.square) return `FAIL: a described square asks for a strip (${r.square})`;
  if (!/square picture/.test(r.squareRule)) return `FAIL: the square rule does not say square: "${r.squareRule}"`;
  return 'PASS: a described 10 x 3 asks for a 3:1 strip; a described square asks for a square';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch(OPTS[name] || {});
    try {
      await openStudio(page);
      await uploadPhoto(page);
      await dismissAlerts(page);
      const result = await fn(page, log);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
    }
    const errs = log.consoleErrors.filter((e) => !/ERR_TUNNEL|ERR_CONNECTION/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs.slice(0, 5))}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL CAR-MAGNET VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
