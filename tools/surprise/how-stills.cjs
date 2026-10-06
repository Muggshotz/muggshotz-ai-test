// HOW IT WORKS, DRAWN AS THE MUG REALLY IS (Alyx, 3 Oct 2026: the step
// pictures showed the picture on a BLACK mug -- "our mugs turn white ... we're
// going to have to replace those magic mugs in the example ... with what they
// actually would look like"). The studio's own 3D mug (MUG3D, SHELF_MUG_3D:
// a white wall hot, black rim, inside and handle) wearing Golden Brown, the
// design the steps describe, at the heat and angle each step tells:
//   black.jpg   cold, the setup's side facing       (steps 1 and 5)
//   emerge.jpg  half warm, the picture rising        (step 2, the wide one)
//   hot.jpg     hot, the setup facing                (step 3)
//   other.jpg   hot, turned round to the punchline   (step 4)
//   (serve the repo on 127.0.0.1:8788, then) node tools/surprise/how-stills.cjs [<file> <set>]
// A HOLIDAY'S OWN PICTURES (Alyx, 6 Oct 2026: the Halloween page's tutorial
// showed Thanksgiving mugs): given a design and a set key, the four are drawn
// from that design into art/premades/how/<set>/, and the set's `how` in
// SURPRISE_SETS points magicMugStepsHtml there. With neither, Golden Brown
// into art/premades/how/, the pictures every other page shows.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const FILE = process.argv[2] || 'golden-brown';
const OUT = path.join(__dirname, '../../art/premades/how', process.argv[3] || '');
fs.mkdirSync(OUT, { recursive: true });
const SHOTS = [
  { name: 'black', heat: 0, angle: -90, w: 910, h: 660 },
  { name: 'emerge', heat: 0.4, angle: -90, w: 924, h: 674 },
  { name: 'hot', heat: 1, angle: -90, w: 910, h: 660 },
  { name: 'other', heat: 1, angle: 90, w: 910, h: 660 },
];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8788/needles-studio.html');
  await page.waitForFunction(() => typeof MUG3D !== 'undefined' && typeof SHELF_MUG_3D !== 'undefined');
  for (const s of SHOTS) {
    await page.evaluate(async ({ s, f }) => {
      let d = document.getElementById('howStill'); if (d) d.remove();
      d = document.createElement('div'); d.id = 'howStill';
      d.style.cssText = `position:fixed;left:0;top:0;width:${s.w}px;height:${s.h}px;z-index:99999;background:#f2f4f7`;
      document.body.appendChild(d);
      await MUG3D.open(d, Object.assign({}, SHELF_MUG_3D, { panoramaUrl: 'art/surprise/wrap/' + f + '.jpg', panelUrls: [], restartOnView: false, turns: 0, still: true, heat: s.heat }));
      MUG3D.setSpinning(false); MUG3D.setAngle(s.angle); MUG3D.setHeat(s.heat);
    }, { s, f: FILE });
    await page.waitForTimeout(900);
    await page.locator('#howStill').screenshot({ path: path.join(OUT, s.name + '.jpg'), type: 'jpeg', quality: 88 });
    await page.evaluate(() => MUG3D.close());
    console.log(path.relative(path.join(__dirname, '../..'), path.join(OUT, s.name + '.jpg')));
  }
  await browser.close();
})();
