// SUITCASE PREMADES, STEP 2: faded to the suitcase (Alyx, 30 Sep 2026: "fade to
// suitcase color ... anchor it to the hex number").
//   (serve the repo on 127.0.0.1:8788, then) node tools/suitcase-fade.cjs [<key> ...]
// For each design and size, art/suitcases/plain/<key>-<Size>.jpg (step 1,
// tools/suitcase-premade.py) is faded by the studio's own renderFadedArtwork at
// the shelf's default (SUITCASE_FADE_DEFAULT) into the colour
// suitcaseFadeHex() gives -- the studio's one rule for fade colour, so a colour
// added to the suitcase there is picked up here -- and written to
// art/suitcases/print/<key>-<Size>.jpg, the file ordered when the slider is
// left where it starts. The slider fades the same plain file on the page, so
// its preview at the default and this file are the same picture.
// Also art/suitcases/show/<key>.jpg (the all-at-once page, 600 x 800, from the
// Medium) and art/suitcases/still/<key>.jpg (the 3D case's first frame).
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ART = path.join(__dirname, '../art/suitcases');
(async () => {
  for (const d of ['print', 'show', 'still']) fs.mkdirSync(path.join(ART, d), { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8788/needles-studio.html');
  await page.waitForFunction(() => typeof renderFadedArtwork === 'function' && typeof suitcaseFadeHex === 'function' && typeof MUG3D !== 'undefined');
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => PREMADE_CATEGORIES.suitcases.items.map((x) => x.key));
  console.log('suitcase fade colour:', await page.evaluate(() => suitcaseFadeHex()), 'at', await page.evaluate(() => SUITCASE_FADE_DEFAULT) + '%');
  const b64 = (u) => Buffer.from(u.split(',')[1], 'base64');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'caseStill';
    d.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:1000px;z-index:99999;background:#f2f4f7'; document.body.appendChild(d); });
  for (const k of keys) {
    for (const size of ['Small', 'Medium', 'Large']) {
      const url = await page.evaluate(({ k, size }) => renderFadedArtwork('art/suitcases/plain/' + k + '-' + size + '.jpg', suitcaseFadeHex(), SUITCASE_FADE_DEFAULT, 100), { k, size });
      fs.writeFileSync(path.join(ART, 'print', k + '-' + size + '.jpg'), b64(url));
    }
    const show = await page.evaluate(async (k) => { const im = await loadImageFromUrl('art/suitcases/print/' + k + '-Medium.jpg?' + Date.now());
      const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'), r = 600 / 800, w = im.naturalWidth, h = im.naturalHeight;
      let sw = w, sh = h; if (w / h > r) sw = h * r; else sh = w / r; x.drawImage(im, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, 600, 800); return c.toDataURL('image/jpeg', 0.85); }, k);
    fs.writeFileSync(path.join(ART, 'show', k + '.jpg'), b64(show));
    await page.evaluate(async (k) => {
      await MUG3D.open(document.getElementById('caseStill'), Object.assign({}, SHELF_CASE_3D, { panoramaUrl: 'art/suitcases/print/' + k + '-Medium.jpg?' + Date.now(), panelUrls: [], restartOnView: false }));
      MUG3D.setSpinning(false);
    }, k);
    await page.waitForTimeout(900);
    await page.locator('#caseStill').screenshot({ path: path.join(ART, 'still', k + '.jpg'), type: 'jpeg', quality: 86 });
    await page.evaluate(() => MUG3D.close());
    console.log(k);
  }
  await browser.close();
})();
