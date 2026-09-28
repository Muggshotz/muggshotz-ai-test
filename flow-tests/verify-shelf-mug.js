// THE MUG ON THE SHELF TURNS (Alyx, 27 Sep 2026). The Magic Mugs shelf shows
// each design on the mockup's own 3D mug, black, turning by itself a little
// faster than the mockup, from handle-on-the-right-setup-facing (-90) on to
// the punchline, and only once it is looked at: off screen it waits, and it
// starts from -90 again every time it comes back. All at once: the first
// mug turns, the rest are stills of that first frame until one is tapped.
// Leaving the shelf lets the cup go, so the mockup can build its own.
const { launch, openStudio, dismissAlerts } = require('./harness');
const T = (p, ms) => p.waitForTimeout(ms);
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let fails = 0;
const ok = (n, c, d = '') => { c ? console.log('  PASS  ' + n) : (fails++, console.log('  FAIL  ' + n + (d ? '  -> ' + d : ''))); };
const angle = (page) => page.evaluate(() => window.__deg);
// Forward of a (wrapping at +-180), by how much.
const ahead = (a, b) => ((b - a) % 360 + 540) % 360 - 180;

async function run(viewport, tag) {
  const { browser, page, log } = await launch({ chromiumArgs: GL, viewport });
  console.log(`[${tag}]`);
  await openStudio(page); await dismissAlerts(page);
  await page.evaluate(() => { MUG3D.onSpin((d) => { window.__deg = d; }); try { localStorage.setItem('mz_premades_layout', 'one'); } catch (e) {} premadesLayout = 'one'; openPremades('grid'); });
  await T(page, 900);
  await page.evaluate(() => pickPremadeProduct('mugs')); await T(page, 2500);

  const one = await page.evaluate(() => {
    const box = document.querySelector('#premadesView .pm-mug3d'), stage = box && box.querySelector('.pm-mug3d-stage');
    const r = box ? box.getBoundingClientRect() : null;
    return { live: !!box && box.classList.contains('live'), canvas: !!(stage && stage.querySelector('canvas')), mounted: MUG3D.mounted(),
      still: box ? box.querySelector('img').getAttribute('src') : null, onScreen: !!r && r.top >= -2 && r.bottom <= innerHeight + 2,
      file: SURPRISE_SETS.thanksgiving.designs[premadesMugIndex].file };
  });
  ok('one at a time: the mug on show is the 3D mug, drawn over its still, on screen', one.live && one.canvas && one.mounted && one.onScreen && one.still === `art/surprise/mug/${one.file}.jpg`, JSON.stringify(one));
  const a0 = await angle(page); await T(page, 1200); const a1 = await angle(page);
  // Forward, not how fast: this headless browser draws a handful of frames a
  // second, and the turn is by the frame.
  ok('it turns by itself, forward, setup on to punchline', ahead(a0, a1) > 0, `${a0} -> ${a1}`);

  // The next mug starts at -90 too.
  await page.evaluate(() => holidayStep(1)); await T(page, 1500);
  const next = await page.evaluate(() => ({ live: !!document.querySelector('#premadesView .pm-mug3d.live'), deg: window.__deg }));
  ok('the next mug is the 3D mug, starting from the setup', next.live && ahead(-90, next.deg) >= 0 && ahead(-90, next.deg) < 60, JSON.stringify(next));

  // One turn, then it stops on the setup until tapped; a tap is one more
  // turn. Sped up here: this headless browser draws a few frames a second.
  await page.evaluate(() => { SHELF_MUG_3D.spinStep = 40; holidayStep(1); }); await T(page, 5000);
  const done = await page.evaluate(() => ({ spinning: MUG3D.spinning(), deg: window.__deg }));
  await T(page, 800); const still = await angle(page);
  ok('after one full turn it stops, back on the setup (-90), and stays', !done.spinning && done.deg === -90 && still === -90, JSON.stringify(done) + ' then ' + still);
  ok('stopped, it says Click to spin', await page.evaluate(() => getComputedStyle(document.querySelector('#premadesView .pm-mug3d .pm-spin-cue')).display !== 'none'));
  await page.locator('#premadesView .pm-mug3d .pm-mug3d-stage').click(); await T(page, 300);
  const again = await page.evaluate(() => MUG3D.spinning() && getComputedStyle(document.querySelector('#premadesView .pm-mug3d .pm-spin-cue')).display === 'none');
  await T(page, 5000);
  const again2 = await page.evaluate(() => ({ spinning: MUG3D.spinning(), deg: window.__deg }));
  ok('a tap turns it once more, and it stops on the setup again', again && !again2.spinning && again2.deg === -90, `${again} ${JSON.stringify(again2)}`);
  await page.evaluate(() => { SHELF_MUG_3D.spinStep = 0.6; });

  // All at once: the first turns, the rest are stills until tapped.
  await page.evaluate(() => premadesSetLayout('all')); await T(page, 2000);
  const all0 = await page.evaluate(() => [...document.querySelectorAll('#premadesMugsAll .pm-mug3d')].map((b) => b.classList.contains('live') ? 'live' : (b.querySelector('canvas') ? 'canvas' : 'still')));
  ok('all at once: the first mug turns, every other is a still', all0[0] === 'live' && all0.slice(1).every((s) => s === 'still') && all0.length === 9, all0.join());
  const cues = await page.evaluate(() => [...document.querySelectorAll('#premadesMugsAll .pm-mug3d')].map((b) => getComputedStyle(b.querySelector('.pm-spin-cue')).display !== 'none'));
  ok('every still says Click to spin, the turning one does not', !cues[0] && cues.slice(1).every(Boolean), cues.join());
  // Off screen it waits; back on screen it starts at -90 again. (The lit
  // card is pinned on screen, so off screen is further down its own list.)
  await page.evaluate(() => document.querySelectorAll('#premadesMugsAll .pm-mug3d')[0].scrollIntoView({ block: 'center' })); await T(page, 800);
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 700); await T(page, 60); }
  await T(page, 500);
  const gone = await page.evaluate(() => document.querySelectorAll('#premadesMugsAll .pm-mug3d')[0].getBoundingClientRect().bottom < 0);
  const off0 = await angle(page); await T(page, 900); const off1 = await angle(page);
  ok('scrolled off screen it holds still', gone && off0 === off1, `off screen ${gone}, ${off0} -> ${off1}`);
  await page.evaluate(() => document.querySelectorAll('#premadesMugsAll .pm-mug3d')[0].scrollIntoView({ block: 'center' }));
  await T(page, 150); const back = await angle(page);
  ok('back on screen it starts over, handle right, setup facing (-90)', ahead(-90, back) >= 0 && ahead(-90, back) < 30, String(back));
  await page.evaluate(() => document.querySelectorAll('#premadesMugsAll .pm-mug3d')[2].scrollIntoView({ block: 'center' })); await T(page, 400);
  await page.locator('#premadesMugsAll .pm-mug3d').nth(2).click(); await T(page, 1500);
  const all1 = await page.evaluate(() => [...document.querySelectorAll('#premadesMugsAll .pm-mug3d')].map((b) => b.classList.contains('live') ? 'live' : (b.querySelector('canvas') ? 'canvas' : 'still')));
  ok('a tap turns that one, and the first goes back to its still', all1[2] === 'live' && all1.filter((s) => s !== 'still').length === 1, all1.join());

  // How it works, step 4: holds on the setup, swivels half round, stops on
  // the punchline (+90); plays again when it comes back into view. Sped up.
  await page.evaluate(() => { HOW_MUG_3D.spinStep = 45; HOW_MUG_3D.holdMs = 1500; premadesGo('how'); }); await T(page, 1200);
  await page.evaluate(() => document.getElementById('premadesHowMug').scrollIntoView({ block: 'center' })); await T(page, 500);
  const h0 = await page.evaluate(() => ({ live: document.getElementById('premadesHowMug').classList.contains('live'), deg: window.__deg,
    step: document.getElementById('premadesHowMug').closest('.pm-step').innerText.includes('They turn it round') }));
  ok('How it works, step 4: the 3D mug, holding on the setup (-90) first', h0.live && h0.step && h0.deg === -90, JSON.stringify(h0));
  await page.waitForFunction(() => !MUG3D.spinning(), null, { timeout: 30000 }).catch(() => {});
  const h1 = await page.evaluate(() => ({ spinning: MUG3D.spinning(), deg: window.__deg }));
  ok('then it swivels round and stops on the punchline (+90)', !h1.spinning && h1.deg === 90, JSON.stringify(h1));
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -700); await T(page, 60); }
  await T(page, 500);
  const hGone = await page.evaluate(() => document.getElementById('premadesHowMug').getBoundingClientRect().top > innerHeight || document.getElementById('premadesHowMug').getBoundingClientRect().bottom < 0);
  await page.evaluate(() => document.getElementById('premadesHowMug').scrollIntoView({ block: 'center' })); await T(page, 300);
  const h2 = await angle(page);
  ok('back in view, it plays again from the setup', hGone && h2 === -90, `off screen ${hGone}, ${h2}`);
  await page.evaluate(() => { HOW_MUG_3D.spinStep = 4; HOW_MUG_3D.holdMs = 900; });

  // Leaving lets the cup go.
  await page.evaluate(() => { while (premadesView !== 'products') premadesBack(); }); await T(page, 900);
  ok('Back to the products list lets the cup go', await page.evaluate(() => !MUG3D.mounted() && premadesView === 'products'));

  if (log.pageErrors.length) { fails++; console.log('  FAIL  page errors: ' + JSON.stringify(log.pageErrors.slice(0, 3))); }
  await browser.close();
}

(async () => {
  await run({ width: 1280, height: 900 }, 'laptop');
  await run({ width: 390, height: 844 }, 'phone');
  console.log('\n' + (fails ? `${fails} FAILURE(S)` : 'ALL SHELF-MUG VERIFICATIONS PASSED'));
  process.exit(fails ? 1 : 0);
})();
