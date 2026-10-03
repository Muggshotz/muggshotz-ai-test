// THE SMART MUG: DEMONSTRATION OR SKIP, AND THE MUG ITSELF (Alyx, 28-29 Sep 2026).
//   - The 11oz Smart Mug square asks first: "See the demonstration" or "Skip
//     the demonstration" (it replaced the (i)); Back there leaves the sizes up.
//   - The demonstration is How the magic mug works: its 3D mug plays the heat
//     reveal, about 21 seconds: cold black and still, the heat words at 1s
//     while the setup rises, the setup to be read from 4.5s, a slow turn from
//     6s (retimed 3 Oct 2026), stopped on the punchline (+90) at 12.7s, the
//     cooling words at 16.7s and the fade back to black, still by 20.7s. The words sit on a dark band. A
//     click replays it at once. Its Back returns to the question; its button
//     goes on to the designs, whose Back returns to it.
//   - On the designs, a tap plays the heat-up on the large mug (Alyx, 29 Sep
//     2026: "pause, fade in, spin to the other side, and freeze as they fade
//     back out to cool"); the frame buttons (for a design framed more than one
//     way) and the hand buttons under it change the mug as it turns, and the
//     print ordered is the one showing. Under them, "What else is brewing?",
//     then "This is the one". Skip's designs Back returns to the question.
//     Changing the hand or frame plays it again with the new choice.
//   - A flashing "New" sits at the bottom of both Magic Mug squares: the
//     Smart Mug on Coffee Mug Size, and Magic Mugs on the Pre-mades.
const { launch, openStudio, dismissAlerts } = require('./harness');
const T = (p, ms) => p.waitForTimeout(ms);
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let fails = 0;
const ok = (n, c, d = '') => { c ? console.log('  PASS  ' + n) : (fails++, console.log('  FAIL  ' + n + (d ? '  -> ' + d : ''))); };
const shown = (page, id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).display !== 'none', id);

async function run(viewport, tag) {
  const { browser, page, log } = await launch({ chromiumArgs: GL, viewport });
  console.log(`[${tag}]`);
  await openStudio(page); await dismissAlerts(page);
  await page.evaluate(() => { product = 'mug'; refreshMugSizeCardVisibility(); });
  await T(page, 400);

  // The flashing "New" on both Magic Mug squares.
  const nw = await page.evaluate(() => { const b = document.querySelector('#preGenSizeSmartBtn .new-flash');
    premadesView = 'products'; renderPremades();
    const m = document.querySelector('#premadesProducts .pm-prod[data-product="mugs"] .new-flash');
    const f = (el) => el && { text: el.textContent, anim: getComputedStyle(el).animationName, last: el === el.parentElement.lastElementChild };
    return { smart: f(b), mugs: f(m) }; });
  ok('a flashing "New" at the bottom of the Smart Mug square and of the Pre-mades Magic Mugs square',
    nw.smart && nw.smart.text === 'New' && nw.smart.anim === 'newFlash' && nw.smart.last && nw.mugs && nw.mugs.text === 'New' && nw.mugs.anim === 'newFlash' && nw.mugs.last, JSON.stringify(nw));

  // The question.
  ok('the (i) is gone from the Smart Mug square', await page.evaluate(() => !document.getElementById('smartMugInfoBtn')));
  await page.locator('#preGenSizeSmartBtn').click(); await T(page, 500);
  const ask = await page.evaluate(() => { const c = document.getElementById('smartDemoCard');
    return { open: getComputedStyle(document.getElementById('smartDemoOverlay')).display !== 'none', title: c.querySelector('.card-title').textContent,
      pic: !!c.querySelector('img'), price: /\$\d/.test(c.innerText), yes: !!document.getElementById('smartDemoYesBtn'), skip: !!document.getElementById('smartDemoSkipBtn'),
      back: /Back/.test(c.innerText), product, designs: getComputedStyle(document.getElementById('surpriseCard')).display }; });
  ok('the Smart Mug square asks: demonstration or skip, with a name, picture, price and Back', ask.open && ask.title && ask.pic && ask.price && ask.yes && ask.skip && ask.back && ask.product === 'mug' && ask.designs === 'none', JSON.stringify(ask));
  await page.evaluate(() => closeSmartDemo()); await T(page, 300);
  ok('its Back leaves the sizes up', !(await shown(page, 'smartDemoOverlay')) && await shown(page, 'mugSizeLockOverlay'));

  // The demonstration.
  await page.locator('#preGenSizeSmartBtn').click(); await T(page, 400);
  await page.locator('#smartDemoYesBtn').click();
  ok('"See the demonstration" opens How the magic mug works, six steps, words only for 1-5', await page.evaluate(() =>
    getComputedStyle(document.getElementById('smartHowOverlay')).display !== 'none' && document.querySelectorAll('#smartHowSteps .pm-step').length === 6
    && document.querySelectorAll('#smartHowSteps .pm-simg').length === 0));
  const tl = await page.evaluate(async () => {
    MUG3D.onSpin((d) => { window.__deg = d; });
    const log = [], t0 = performance.now();
    await new Promise((r) => { const iv = setInterval(() => { const w = document.getElementById('smartHowRevealWords');
      log.push({ t: performance.now() - t0, deg: window.__deg, w: w.textContent, b: w.classList.contains('smart-blink') }); }, 200);
      setTimeout(() => { clearInterval(iv); r(); }, 30000); });
    return log;
  });
  // The clock starts once the mug has loaded: find it by the first words.
  const first = tl.find((r) => r.w);
  const start = first ? first.t - 1000 : 0;
  const at = (s) => tl.reduce((a, r) => (Math.abs(r.t - start - s * 1000) < Math.abs(a.t - start - s * 1000) ? r : a), tl[0]);
  const s0 = tl.filter((r) => r.t < start + 900 && r.deg !== undefined), s3 = at(3), s6 = at(5.2), s11 = at(9.3), s16 = at(14.5), s19 = at(18.2), s24 = at(23), end = tl[tl.length - 1];
  ok('cold and still, no words, before 1s', s0.length > 0 && s0.every((r) => r.deg === -90 && !r.w), JSON.stringify(s0.slice(-1)));
  ok('the heat words blink while the setup rises, the mug still', /absorbs the liquid's heat/.test(s3.w) && s3.b && s3.deg === -90, JSON.stringify(s3));
  ok('the setup to be read at 5.2s: no words, still facing', !s6.w && s6.deg === -90, JSON.stringify(s6));
  ok('turning slowly at 9.3s, no words', !s11.w && s11.deg > -90 && s11.deg < 90, JSON.stringify(s11));
  ok('stopped on the punchline (+90) at 14.5s, no words', s16.deg === 90 && !s16.w, JSON.stringify(s16));
  ok('the cooling words blink at 18.2s', /cools down again/.test(s19.w) && s19.b && s19.deg === 90, JSON.stringify(s19));
  ok('still, the blinking stopped, at 23s and after', !s24.b && s24.deg === 90 && end.deg === 90 && !end.b, JSON.stringify([s24, end]));
  const band = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('smartHowRevealWords')); return { bg: c.backgroundColor, color: c.color }; });
  ok('the words are white on a dark band', /rgba?\(10, 14, 22/.test(band.bg) && band.color === 'rgb(255, 255, 255)', JSON.stringify(band));
  ok('it wears the light picture, not the full print', await page.evaluate(() =>
    performance.getEntriesByType('resource').some((e) => /art\/surprise\/reveal\/proposal\.jpg/.test(e.name))));
  const replay = await page.evaluate(async () => {
    const t0 = performance.now(); document.getElementById('smartHowRevealStage').click();
    const w = document.getElementById('smartHowRevealWords');
    await new Promise((r) => { const iv = setInterval(() => { if (/absorbs/.test(w.textContent)) { clearInterval(iv); r(); } }, 50); setTimeout(() => { clearInterval(iv); r(); }, 8000); });
    return Math.round(performance.now() - t0);
  });
  ok('a click on the mug replays it: the heat words within 1.6s', replay < 1600, replay + 'ms');
  await page.evaluate(() => smartHowBack()); await T(page, 300);
  ok('its Back returns to the question, the mug let go', await shown(page, 'smartDemoOverlay') && !(await shown(page, 'smartHowOverlay')) && await page.evaluate(() => !MUG3D.mounted()));
  await page.locator('#smartDemoYesBtn').click(); await T(page, 400);
  await page.locator('#smartHowOnBtn').click(); await T(page, 1500);
  const on = await page.evaluate(() => ({ product, surprise: getComputedStyle(document.getElementById('surpriseCard')).display,
    line: document.getElementById('surpriseHowLine').innerText, blink: document.getElementById('surpriseHowLine').classList.contains('smart-blink') }));
  ok('its button goes on to the designs', on.product === 'smart mug' && on.surprise === 'block', JSON.stringify(on));
  ok('the designs\' line: tap a design to see it on your mug, blinking, no price', /Tap a design to see it on your mug/.test(on.line) && on.blink && !/\$/.test(on.line), JSON.stringify(on));
  await page.evaluate(() => surpriseBack()); await T(page, 500);
  ok('the designs\' Back returns to the demonstration it came from', await shown(page, 'smartHowOverlay') && await page.evaluate(() => product === 'mug'));
  await page.evaluate(() => smartHowBack()); await T(page, 300);

  // Skip, and the mug itself.
  await page.locator('#smartDemoSkipBtn').click(); await T(page, 1200);
  ok('"Skip the demonstration" goes straight to the designs', await page.evaluate(() => product === 'smart mug' && getComputedStyle(document.getElementById('surpriseCard')).display === 'block'
    && getComputedStyle(document.getElementById('smartDemoOverlay')).display === 'none'));
  await page.evaluate(() => { MUG3D.onSpin((d) => { window.__deg = d; }); pickSurprise('proposal'); });
  await page.waitForFunction(() => /absorbs the liquid's heat/.test(document.getElementById('surpriseRevealWords').textContent), null, { timeout: 20000 });
  const mug = await page.evaluate(() => ({ host: MUG3D.mounted() && MUG3D.host() === document.getElementById('surpriseRevealStage'), deg: window.__deg, zoom: MUG3D.zoom(),
    pic: performance.getEntriesByType('resource').some((e) => /art\/surprise\/reveal\/proposal\.jpg/.test(e.name)) }));
  ok('a tapped design plays the heat-up on the large mug: the heat words, the setup facing', mug.host && mug.deg === -90 && mug.zoom > 1.3 && mug.pic, JSON.stringify(mug));
  const lay = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
    const m = r('surpriseReveal'), h = r('surpriseHandGrid'), b = r('surpriseBrew'), c = r('surpriseContinueBtn');
    return { order: m.bottom <= h.top + 1 && h.bottom <= b.top + 1 && b.bottom <= c.top + 1, frameShown: getComputedStyle(document.getElementById('surpriseFrameWrap')).display !== 'none',
      btn: document.getElementById('surpriseContinueBtn').textContent, head: document.querySelector('#surpriseBrew .brew-h').textContent, onscreen: m.top >= -2 && c.bottom <= innerHeight + 2 }; });
  ok('under the mug: the frame buttons, the hand buttons, "What else is brewing?", "This is the one"', lay.order && lay.frameShown && /This is the one/.test(lay.btn) && lay.head === 'What else is brewing?', JSON.stringify(lay));
  ok('the mug and "This is the one" are both on screen', lay.onscreen, JSON.stringify(lay));

  // The hand: the mug changes to that hand's print and plays it again.
  const r0 = await page.evaluate(() => surpriseRevealRun);
  await page.evaluate(() => pickSurpriseHand('left'));
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /reveal\/proposal-left\.jpg/.test(e.name)), null, { timeout: 15000 });
  await page.waitForFunction(() => /absorbs/.test(document.getElementById('surpriseRevealWords').textContent), null, { timeout: 15000 });
  const hand = await page.evaluate((r) => ({ replayed: surpriseRevealRun > r, url: surprisePrintUrl() }), r0);
  ok('the left-hand button puts the left-handed print on the mug and plays it again, and that print is the one ordered', hand.replayed && /proposal-print-left\.png$/.test(hand.url), JSON.stringify(hand));

  // The frame, as a prop (the decal mugs, 29 Sep 2026): No frame, One frame,
  // A frame each side, No frame the default; the one chosen is on the mug and
  // is the print ordered.
  const fr = await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('#surpriseFrameGrid .btn-select')].map((b) => b.textContent + (b.classList.contains('selected') ? '*' : ''));
    pickSurpriseFrame('two');
    await new Promise((r) => setTimeout(r, 2500));
    const out = { btns, file: surpriseFile(), url: surprisePrintUrl(),
      pic: performance.getEntriesByType('resource').some((e) => /reveal\/proposal-two-left\.jpg/.test(e.name)) };
    out.outlined = [...document.querySelectorAll('#surpriseBrewRow .brew-item.on')].map((i) => i.dataset.file).join();
    pickSurpriseFrame('none');
    return out;
  });
  ok('three frame buttons, No frame the default; the frame chosen is on the mug and is the print ordered',
    fr.btns.join('|') === 'No frame*|One frame|A frame each side' && fr.outlined === 'proposal' && fr.file === 'proposal-two' && /proposal-two-print-left\.png$/.test(fr.url) && fr.pic, JSON.stringify(fr));
  await page.evaluate(() => pickSurpriseHand('right')); await T(page, 1500);

  // What else is brewing?
  const brew = await page.evaluate(() => { const items = [...document.querySelectorAll('#surpriseBrewRow .brew-item')];
    return { n: items.length, pics: items.every((i) => i.querySelector('img')), on: items.filter((i) => i.classList.contains('on')).map((i) => i.dataset.file) }; });
  ok('"What else is brewing?": every design, pictured, the one showing outlined', brew.n >= 12 && brew.pics && brew.on.join() === 'proposal', JSON.stringify(brew));
  const y0 = await page.evaluate(() => scrollY);
  await page.evaluate(() => document.querySelector('#surpriseBrewRow .brew-item[data-file="valentine"]').click());
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /reveal\/valentine\.jpg/.test(e.name)), null, { timeout: 15000 });
  await T(page, 800);
  const after = await page.evaluate(() => { const m = document.getElementById('surpriseReveal').getBoundingClientRect();
    return { file: surpriseRevealFile, sel: selectedSurprise, onscreen: m.top >= -2 && m.bottom <= innerHeight + 2,
      on: [...document.querySelectorAll('#surpriseBrewRow .brew-item.on')].map((i) => i.dataset.file), y: scrollY }; });
  ok('a tap in the row puts that design on the mug, where the customer is', after.file === 'valentine' && after.sel === 'valentine' && after.onscreen && after.on.join() === 'valentine' && Math.abs(after.y - y0) < 250, JSON.stringify({ y0, ...after }));
  await page.evaluate(() => document.querySelector('#surpriseBrewRow .brew-item[data-file="reveal-girl"]').click()); await T(page, 1500);
  const girl = await page.evaluate(() => ({ file: surpriseFile(), t: selectedSurprise, v: selectedSurpriseVariant }));
  ok('a Ready? side in the row puts that side on the mug', girl.file === 'reveal-girl' && girl.t === 'ready' && girl.v === 'girl', JSON.stringify(girl));

  await page.evaluate(() => surpriseBack()); await T(page, 500);
  ok('Back from the designs lets the mug go and returns to the question', await page.evaluate(() => !MUG3D.mounted()) && await shown(page, 'smartDemoOverlay'));

  if (log.pageErrors.length) { fails++; console.log('  FAIL  page errors: ' + JSON.stringify(log.pageErrors.slice(0, 3))); }
  await browser.close();
}

(async () => {
  await run({ width: 1280, height: 770 }, 'laptop');
  await run({ width: 390, height: 844 }, 'phone');
  console.log('\n' + (fails ? `${fails} FAILURE(S)` : 'ALL SMART-MUG FLOW VERIFICATIONS PASSED'));
  process.exit(fails ? 1 : 0);
})();
