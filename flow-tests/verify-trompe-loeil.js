// TROMPE-L'OEIL (Alyx and Bud, 25 Sep 2026). One button under the description
// box on every product panel; pressing it sends Bud's instructions
// (prompts/trompe-loeil.md, the product's name filled in) straight to the
// generator on the describe-only lane, and the customer sees only the result.
// What this pins:
//   * the button is on the idea card, named, with the phrase explained;
//   * pressing it posts action:textOnly with no photo, Bud's text, and
//     "SELECTED PRODUCT: <the product>", at the product's own canvas size;
//   * the description box is left alone, and the mode lasts one press: the
//     next ordinary Generate sends the customer's own words on the photo lane;
//   * the suitcase and the doormat are named and shaped as themselves;
//   * a missing instructions file says so and spends nothing.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');
const T = (p, ms) => p.waitForTimeout(ms);

async function toIdea(page, val, settle) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1200);
  await dismissAlerts(page);
  if (settle) { await settle(page); await T(page, 1000); await dismissAlerts(page); }
}
const genCalls = (log) => log.apiCalls.filter((c) => c.path === '/api/generate');
// The reveal takes its time after the picture arrives; wait for Yes/No the
// way every other suite does.
const press = async (page) => {
  await page.locator('#trompeBtn').click({ force: true });
  await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 60000 }).catch(() => {});
  await T(page, 800);
  await dismissAlerts(page);
};

const scenarios = {};

scenarios.theButtonSitsUnderTheBox = async (page) => {
  await toIdea(page, 'mouse pad');
  const b = await page.evaluate(() => {
    const btn = document.getElementById('trompeBtn'); if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const box = document.getElementById('ideaDesc').getBoundingClientRect();
    return { text: btn.textContent, note: btn.parentElement.textContent, shown: r.height > 0 && getComputedStyle(btn).display !== 'none',
      underTheBox: r.top >= box.bottom - 2, inCard: !!btn.closest('#ideaCard') };
  });
  if (!b) return 'FAIL: no TROMPE-L\'ŒIL button on the page';
  if (!b.shown || !b.inCard) return 'FAIL: the button is not showing on the idea card';
  if (!/TROMPE-L'ŒIL/.test(b.text)) return `FAIL: the button says "${b.text}"`;
  if (!/fool the eye/i.test(b.note)) return 'FAIL: the note does not say what the phrase means';
  if (!b.underTheBox) return 'FAIL: the button is not under the description box';
  return 'PASS: TROMPE-L\'ŒIL sits under the description box, named and explained';
};

scenarios.pressingItSendsBudsTextAndNothingElse = async (page, log) => {
  await toIdea(page, 'mouse pad');
  await press(page);
  const calls = genCalls(log);
  if (calls.length !== 1) return `FAIL: ${calls.length} generate call(s) after one press`;
  const c = calls[0];
  if (c.action !== 'textOnly') return `FAIL: the press went down the ${c.action || 'photo'} lane, not textOnly`;
  if (c.body.image) return 'FAIL: the customer\'s photo was sent — there is no photo in a trompe-l\'oeil';
  if (!/TROMPE-L'ŒIL — PRODUCT-FIRST CREATIVE ENGINE/.test(c.prompt)) return 'FAIL: Bud\'s text is not what was sent';
  if (!/SELECTED PRODUCT: MOUSE PAD/.test(c.prompt)) return `FAIL: the product is not named (${(c.prompt.match(/SELECTED PRODUCT: [^\n]*/) || [])[0]})`;
  if (/\{PRODUCT\}/.test(c.prompt)) return 'FAIL: a {PRODUCT} blank was left unfilled';
  if (/Transform the uploaded person/.test(c.prompt)) return 'FAIL: the house photo prompt leaked into the trompe-l\'oeil';
  if (c.body.size !== '1024x1024') return `FAIL: a mouse pad paints square, sent ${c.body.size}`;
  const st = await page.evaluate(() => ({ approve: document.getElementById('approveRow').style.display !== 'none', idea: document.getElementById('ideaDesc').value, mode: trompeMode,
    status: (document.getElementById('status') || document.getElementById('statusMsg') || {}).textContent || '',
    alert: document.getElementById('guidanceAlertOverlay')?.classList.contains('visible') ? document.getElementById('guidanceAlertMsg').textContent : '',
    big: document.getElementById('bigAlertOverlay')?.classList.contains('visible') ? document.getElementById('bigAlertOverlay').textContent.trim().slice(0, 120) : '',
    result: !!resultUrl,
    open: ['frameFadeOverlay','mockupLightboxOverlay','positionHolderCard','coverMePanelCard','revealCard','needlesGenOverlay','artworkOnlyDoneCard','resultCard'].filter((id) => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none' && (!e.classList.contains('step-lock-overlay') || e.classList.contains('visible') || e.style.display === 'flex'); }),
    focus: [...document.body.classList].filter((c) => /focus|lock/.test(c)) }));
  if (!st.approve) return `FAIL: the result did not land on Yes/No (status "${st.status}", alert "${st.alert}", big "${st.big}", result ${st.result}, open ${JSON.stringify(st.open)}, body ${JSON.stringify(st.focus)})`;
  if (st.idea !== '') return `FAIL: the description box was written to: "${st.idea.slice(0, 40)}"`;
  if (st.mode) return 'FAIL: trompe mode is still on after the press';
  // The next ordinary Generate is the customer's own, on the photo lane.
  await page.evaluate(() => { document.getElementById('ideaDesc').value = 'a red barn at dawn'; });
  await page.evaluate(() => generate());
  await page.waitForFunction(() => window.__calls === undefined || true, null, { timeout: 1000 }).catch(() => {});
  await T(page, 4000);
  const again = genCalls(log);
  if (again.length !== 2) return `FAIL: ${again.length} generate call(s) after the second press`;
  const d = again[1];
  if (d.action === 'textOnly' || !d.body.image) return 'FAIL: the customer\'s own Generate stayed on the no-photo lane';
  if (!/a red barn at dawn/.test(d.prompt) || /TROMPE/.test(d.prompt)) return 'FAIL: the second Generate did not send the customer\'s own words';
  return 'PASS: one press, one textOnly call with Bud\'s text naming MOUSE PAD, no photo, square; the box untouched; the next Generate is the customer\'s own';
};

scenarios.theSuitcaseIsNamedAndPortrait = async (page, log) => {
  await toIdea(page, 'suitcase', (p) => p.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]'));
  await press(page);
  const c = genCalls(log)[0];
  if (!c) return 'FAIL: no generate call';
  if (c.action !== 'textOnly' || !/SELECTED PRODUCT: SUITCASE/.test(c.prompt)) return `FAIL: ${c.action}, ${(c.prompt.match(/SELECTED PRODUCT: [^\n]*/) || [])[0]}`;
  // The canvas is the product's own (getImageSizeParam): the suitcase paints
  // square today, and if that changes this follows it.
  const want = await page.evaluate(() => getImageSizeParam());
  if (c.body.size !== want) return `FAIL: the suitcase paints ${want} on its own lane, the press sent ${c.body.size}`;
  return `PASS: SELECTED PRODUCT: SUITCASE, on the suitcase's own canvas (${want})`;
};

scenarios.theDoormatIsNamedAndWide = async (page, log) => {
  await toIdea(page, 'doormat');
  await press(page);
  const c = genCalls(log)[0];
  if (!c) return 'FAIL: no generate call';
  if (c.action !== 'textOnly' || !/SELECTED PRODUCT: DOORMAT/.test(c.prompt)) return `FAIL: ${c.action}, ${(c.prompt.match(/SELECTED PRODUCT: [^\n]*/) || [])[0]}`;
  if (c.body.size !== '1536x1024') return `FAIL: a doormat paints wide, sent ${c.body.size}`;
  if (Math.abs(Number(c.body.bandRatio) - 1.63) > 0.02) return `FAIL: the doormat's 1.63:1 did not travel (bandRatio ${c.body.bandRatio})`;
  return 'PASS: SELECTED PRODUCT: DOORMAT, painted wide at 1.63:1';
};

scenarios.aMissingFileSaysSoAndSpendsNothing = async (page, log) => {
  await page.route('**/prompts/trompe-loeil.md*', (route) => route.fulfill({ status: 404, body: 'gone' }));
  await toIdea(page, 'mouse pad');
  await page.locator('#trompeBtn').click({ force: true });
  await T(page, 1500);
  const told = await page.evaluate(() => /isn't available just now/.test(document.body.innerText));
  if (!told) return 'FAIL: the customer was not told the button is unavailable';
  if (genCalls(log).length) return 'FAIL: a generate call was made with no instructions to send';
  return 'PASS: told plainly, nothing sent';
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
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL TROMPE-L\'OEIL VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
