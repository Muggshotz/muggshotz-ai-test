// THE SHELF'S STILLS: art/surprise/mug/<file>.jpg, one per holiday mug.
//   (serve the repo on 127.0.0.1:8788, then) node tools/surprise/mug-stills.cjs [<file> ...]
// The first frame of the shelf's turning mug, drawn by the studio's own 3D
// mug (MUG3D, SHELF_MUG_3D in needles-studio.html) at the angle the shelf
// starts at: black magic mug, handle on the right, the setup facing. All at
// once shows these until a mug is tapped, and every stage sits on its still,
// so a phone that cannot draw the cup still sees the cup. With no names, every
// design in SURPRISE_SETS; the texture each is drawn from is
// art/surprise/wrap/<file>.jpg (holiday-mug.py makes it).
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '../../art/surprise/mug');
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8788/needles-studio.html');
  await page.waitForFunction(() => typeof MUG3D !== 'undefined' && typeof SHELF_MUG_3D !== 'undefined');
  const files = process.argv.slice(2).length ? process.argv.slice(2)
    : await page.evaluate(() => Object.values(SURPRISE_SETS).flatMap((s) => s.designs.map((d) => d.file)));
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'mugStill';
    d.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:720px;z-index:99999;background:#f2f4f7'; document.body.appendChild(d); });
  for (const f of files) {
    await page.evaluate(async (f) => {
      const host = document.getElementById('mugStill');
      await MUG3D.open(host, Object.assign({}, SHELF_MUG_3D, { panoramaUrl: 'art/surprise/wrap/' + f + '.jpg', panelUrls: [], restartOnView: false }));
      MUG3D.setSpinning(false); MUG3D.setAngle(SHELF_MUG_3D.startAngle);
    }, f);
    await page.waitForTimeout(700);
    await page.locator('#mugStill').screenshot({ path: path.join(OUT, f + '.jpg'), type: 'jpeg', quality: 86 });
    await page.evaluate(() => MUG3D.close());
    console.log('mug/' + f + '.jpg');
  }
  await browser.close();
})();
