// THE SUITCASE SHELF'S STILLS: art/suitcases/still/<key>.jpg, one per design.
//   (serve the repo on 127.0.0.1:8788, then) node tools/suitcase-stills.cjs [<key> ...]
// The first frame of the shelf's turning suitcase, drawn by the studio's own 3D
// suitcase (MUG3D with boxKey 'suitcase', SHELF_CASE_3D in needles-studio.html),
// wearing the Medium's print file. The page shows it until the 3D case is
// built, and a phone that cannot draw the case still sees the case.
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '../art/suitcases/still');
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8788/needles-studio.html');
  await page.waitForFunction(() => typeof MUG3D !== 'undefined' && typeof SHELF_CASE_3D !== 'undefined');
  const keys = process.argv.slice(2).length ? process.argv.slice(2)
    : await page.evaluate(() => PREMADE_CATEGORIES.suitcases.items.map((x) => x.key));
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'caseStill';
    d.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:1000px;z-index:99999;background:#f2f4f7'; document.body.appendChild(d); });
  for (const k of keys) {
    await page.evaluate(async (k) => {
      await MUG3D.open(document.getElementById('caseStill'), Object.assign({}, SHELF_CASE_3D, { panoramaUrl: 'art/suitcases/print/' + k + '-Medium.jpg', panelUrls: [], restartOnView: false }));
      MUG3D.setSpinning(false);
    }, k);
    await page.waitForTimeout(900);
    await page.locator('#caseStill').screenshot({ path: path.join(OUT, k + '.jpg'), type: 'jpeg', quality: 86 });
    await page.evaluate(() => MUG3D.close());
    console.log('still/' + k + '.jpg');
  }
  await browser.close();
})();
