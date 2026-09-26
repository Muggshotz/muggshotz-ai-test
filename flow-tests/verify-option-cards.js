// THE OPTION CARDS (Alyx, 23 Sep 2026, on the ornament: "When I click on it,
// and decide to try to go back out and click something else I'm stuck.
// Because there is no back button. And what happened to our tradition of
// putting images of the actual product ... above the price."). Every card
// that asks for a shape, size or scent before generating must:
//   * show a real picture on every choice (the T-shirt: one for the card),
//     and every picture must actually load;
//   * have a Back that leaves the card, lifts its spotlight, and lets the
//     customer pick a different product straight away;
//   * be where Back from the description box returns to.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const CARDS = {
  'ornament': 'ornamentShapeCard',
  'wrapping paper': 'wrapSizeCard',
  'air freshener': 'airFreshenerOptionCard',
  // 'night light' -- off the grid 24 Sep 2026; its card stays for its return
  'sticker sheet': 'stickerSheetOptionCard',
  // Apparel (26 Sep 2026): the garment first; its size and colour are the next panel.
  'tshirt': 'apparelStyleCard',
  'car magnet': 'carMagnetOptionCard',
  'business cards': 'businessCardOptionCard',
};
// The business-card paper choices are words, not products, so they carry no
// picture; the check is on the things being bought.
const CHOICE = '.btn-select:not([data-paper])';

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await tap(page, `#productCard .btn-select[data-val="${val}"]`);
  await T(page, 1200);
  await dismissAlerts(page);
}
// A click by the element, not by where it sits on screen: the studio scrolls
// itself smoothly as panels open, and a click aimed at a moving tile can land
// outside the viewport -- a test that misses, not a page that is broken.
const tap = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, sel);

const scenarios = {};
for (const [val, cardId] of Object.entries(CARDS)) {
  scenarios['card_' + val.replace(/[^a-z]/g, '_')] = async (page) => {
    await pickProduct(page, val);
    const pics = await page.evaluate(async ([cardId, CHOICE]) => {
      const card = document.getElementById(cardId);
      if (!card || getComputedStyle(card).display === 'none') return { shown: false };
      const imgs = [...card.querySelectorAll('img')];
      await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
      const tiles = [...card.querySelectorAll(CHOICE)];
      return {
        shown: true,
        tiles: tiles.length,
        tilesWithPics: tiles.filter((t) => t.querySelector('img')).length,
        broken: imgs.filter((im) => !im.naturalWidth).map((im) => im.getAttribute('src')),
        pics: imgs.length,
        back: !!card.querySelector('button[onclick="optionCardBack()"]'),
      };
    }, [cardId, CHOICE]);
    if (!pics.shown) return `FAIL: picking ${val} did not open ${cardId}`;
    if (pics.tilesWithPics !== pics.tiles) return `FAIL: ${pics.tiles - pics.tilesWithPics} of ${pics.tiles} ${val} choices have no picture`;
    if (pics.broken.length) return `FAIL: pictures that do not load: ${pics.broken.join(', ')}`;
    if (!pics.back) return `FAIL: the ${val} card has no Back button`;

    // Back leaves the card and frees the grid: a different product can be picked.
    await tap(page, `#${cardId} button[onclick="optionCardBack()"]`);
    await T(page, 900);
    const after = await page.evaluate(() => [...document.body.classList].filter((c) => c.endsWith('-focus')));
    if (after.length) return `FAIL: Back left a spotlight on: ${after.join(', ')}`;
    await tap(page, '#productCard .btn-select[data-val="mouse pad"]');
    await T(page, 1200);
    await dismissAlerts(page);
    const moved = await page.evaluate(() => product);
    if (moved !== 'mouse pad') return `FAIL: after Back, picking the mouse pad left product=${moved}`;

    // Back from the description box returns to the option card.
    await tap(page, `#productCard .btn-select[data-val="${val}"]`);
    await T(page, 1200);
    await dismissAlerts(page);
    await tap(page, `#${cardId} ${CHOICE}`);
    // A garment opens its size and colour; it goes on once it has both.
    if (val === 'tshirt') { await T(page, 900); await tap(page, '#tshirtOptionGrid .btn-select'); await tap(page, '#tshirtColorGrid .color-btn'); }
    await T(page, 1200);
    await dismissAlerts(page);
    const atIdea = await page.evaluate(() => document.body.classList.contains('ideafirst-focus'));
    if (!atIdea) return `FAIL: picking a ${val} option did not reach the description box`;
    await page.evaluate(() => ideaStepBack());
    await T(page, 900);
    const backOn = await page.evaluate((cardId) => {
      if (cardId === 'apparelStyleCard') cardId = 'tshirtOptionCard'; // the panel before the description
      const card = document.getElementById(cardId);
      const r = card.getBoundingClientRect();
      return { lit: [...document.body.classList].filter((c) => c.endsWith('-focus')), inView: r.top < innerHeight && r.bottom > 0 };
    }, cardId);
    if (!backOn.lit.length || !backOn.inView) return `FAIL: Back from the description did not return to the ${val} card (${JSON.stringify(backOn)})`;
    return `PASS: ${val} — ${pics.tiles} choices, each with a picture, all loading; Back frees the grid; Back from the description returns to the card`;
  };
}

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch({ viewport: { width: 390, height: 844 } });
    let result;
    try {
      await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
      result = await fn(page);
    } catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
    console.log(`[${name}] ${result}`);
    if (!/^PASS/.test(result)) fails++;
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL OPTION-CARD VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
