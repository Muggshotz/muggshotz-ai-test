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
  'night light': 'nightBuddyOptionCard',
  'sticker sheet': 'stickerSheetOptionCard',
  'tshirt': 'tshirtOptionCard',
  'car magnet': 'carMagnetOptionCard',
};

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
}

const scenarios = {};
for (const [val, cardId] of Object.entries(CARDS)) {
  scenarios['card_' + val.replace(/[^a-z]/g, '_')] = async (page) => {
    await pickProduct(page, val);
    const pics = await page.evaluate(async (cardId) => {
      const card = document.getElementById(cardId);
      if (!card || getComputedStyle(card).display === 'none') return { shown: false };
      const imgs = [...card.querySelectorAll('img')];
      await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
      const tiles = [...card.querySelectorAll('.btn-select')];
      return {
        shown: true,
        tiles: tiles.length,
        tilesWithPics: tiles.filter((t) => t.querySelector('img')).length,
        broken: imgs.filter((im) => !im.naturalWidth).map((im) => im.getAttribute('src')),
        pics: imgs.length,
        back: !!card.querySelector('button[onclick="optionCardBack()"]'),
      };
    }, cardId);
    if (!pics.shown) return `FAIL: picking ${val} did not open ${cardId}`;
    if (val === 'tshirt') { if (pics.pics < 1) return 'FAIL: the T-shirt card has no picture'; }
    else if (pics.tilesWithPics !== pics.tiles) return `FAIL: ${pics.tiles - pics.tilesWithPics} of ${pics.tiles} ${val} choices have no picture`;
    if (pics.broken.length) return `FAIL: pictures that do not load: ${pics.broken.join(', ')}`;
    if (!pics.back) return `FAIL: the ${val} card has no Back button`;

    // Back leaves the card and frees the grid: a different product can be picked.
    await page.click(`#${cardId} button[onclick="optionCardBack()"]`);
    await T(page, 900);
    const after = await page.evaluate(() => [...document.body.classList].filter((c) => c.endsWith('-focus')));
    if (after.length) return `FAIL: Back left a spotlight on: ${after.join(', ')}`;
    await page.locator('#productCard .btn-select[data-val="mouse pad"]').click({ force: true });
    await T(page, 1200);
    await dismissAlerts(page);
    const moved = await page.evaluate(() => product);
    if (moved !== 'mouse pad') return `FAIL: after Back, picking the mouse pad left product=${moved}`;

    // Back from the description box returns to the option card.
    await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
    await T(page, 1200);
    await dismissAlerts(page);
    await page.locator(`#${cardId} .btn-select`).first().click({ force: true });
    // The shirt goes on once it has a colour as well as a size.
    if (val === 'tshirt') await page.locator('#tshirtColorGrid .color-btn').first().click({ force: true });
    await T(page, 1200);
    await dismissAlerts(page);
    const atIdea = await page.evaluate(() => document.body.classList.contains('ideafirst-focus'));
    if (!atIdea) return `FAIL: picking a ${val} option did not reach the description box`;
    await page.evaluate(() => ideaStepBack());
    await T(page, 900);
    const backOn = await page.evaluate((cardId) => {
      const card = document.getElementById(cardId);
      const r = card.getBoundingClientRect();
      return { lit: [...document.body.classList].filter((c) => c.endsWith('-focus')), inView: r.top < innerHeight && r.bottom > 0 };
    }, cardId);
    if (!backOn.lit.length || !backOn.inView) return `FAIL: Back from the description did not return to the ${val} card (${JSON.stringify(backOn)})`;
    return `PASS: ${val} — ${val === 'tshirt' ? 'a card picture' : pics.tiles + ' choices, each with a picture'}, all loading; Back frees the grid; Back from the description returns to the card`;
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
