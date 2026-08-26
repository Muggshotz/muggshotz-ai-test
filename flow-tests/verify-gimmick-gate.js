// Alyx, Aug 2026: the two-track system exists ONLY to host the three gimmick
// templates (Cover Me, Face It, Home Sweet Home), and those only fit coffee
// mugs and travel cups. Every other product goes straight down the
// description path and must never be shown the gimmick panels -- nobody wants
// a poster of themselves on the cover of Newsweek.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await page.waitForTimeout(1000);
}

const gimmickState = (page) => page.evaluate(() => {
  const card = document.getElementById('designMethodCard');
  const r = card ? card.getBoundingClientRect() : null;
  return {
    display: card ? getComputedStyle(card).display : null,
    height: r ? Math.round(r.height) : 0,
    inViewport: r ? (r.top < innerHeight && r.bottom > 0) : false,
  };
});

// Drive the single door directly: showDesignMethodCard() is where every route
// into the gimmick panels has to pass, per its own comment.
async function throughTheDoor(page) {
  return page.evaluate(() => {
    const before = document.getElementById('designMethodCard').style.display;
    showDesignMethodCard();
    return { before, after: document.getElementById('designMethodCard').style.display };
  });
}

const scenarios = {};

for (const val of ['suitcase', 'puzzle', 'tote bag', 'phone case', 'photo poster', 'greeting card', 'post-it note']) {
  scenarios['noGimmicks_' + val.replace(/[^a-z]/gi, '_')] = async (page) => {
    await pickProduct(page, val);
    const r = await throughTheDoor(page);
    if (r.after === 'block') return `FAIL: ${val} was shown the gimmick panels`;
    const st = await gimmickState(page);
    if (st.height > 0 && st.inViewport) return `FAIL: ${val} gimmick card visible on screen (${st.height}px)`;
    return `PASS: ${val} skips the gimmick panels`;
  };
}

for (const val of ['mug', 'water bottle']) {
  scenarios['keepsGimmicks_' + val.replace(/[^a-z]/gi, '_')] = async (page) => {
    await pickProduct(page, val);
    const r = await throughTheDoor(page);
    if (r.after !== 'block') return `FAIL: ${val} LOST the gimmick panels — they are the whole reason track one exists`;
    return `PASS: ${val} keeps the gimmick panels`;
  };
}

// The list itself, so a future edit can't silently widen it.
scenarios.gimmickListExact = async (page) => {
  const list = await page.evaluate(() => PRODUCTS_WITH_GIMMICKS.slice().sort());
  const want = ['mug', 'water bottle'];
  if (JSON.stringify(list) !== JSON.stringify(want)) return `FAIL: list drifted to ${JSON.stringify(list)}`;
  return 'PASS: gimmicks limited to exactly mug + travel cup';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    try {
      await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
      const result = await fn(page, log);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GIMMICK-GATE VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
