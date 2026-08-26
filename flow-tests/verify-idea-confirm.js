// Two bugs from Alyx's phone-case run on ?v=3:
//  1. "Click here when you are satisfied with your description" sent the
//     customer BACK to the Product card -- correct in the old design-first
//     flow, backwards now that the product is chosen before the description.
//  2. That same handler leaves product-focus on the body, which dims
//     .card:not(#productCard). The Needles generation stage lives inside
//     uploadPhotoCard, so the whole "Needles is working on it" panel painted
//     at 35% opacity behind a veil.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

async function toDescription(page, val, prep) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await page.waitForTimeout(1000);
  await prep(page);
  await page.waitForTimeout(1400);
  await page.fill('#ideaDesc', 'riding a dragon over a volcano');
  await page.waitForTimeout(600);
  await dismissAlerts(page);
  await page.waitForTimeout(300);
}

const prepPhone = async (p) => {
  await p.fill('#phoneModelSearchInputGen', 'iPhone 15 Pro Max');
  await p.waitForTimeout(1200);
  const hit = p.locator('#phoneModelResultsGen >> text=iPhone 15 Pro Max').first();
  if (await hit.count()) { await hit.click(); await p.waitForTimeout(700); }
  const yes = p.locator('#phoneModelConfirmGen button:has-text("Yes")');
  if (await yes.count()) await yes.click();
};

const scenarios = {

  // Confirming the description must go FORWARD to Generate, not back to Product.
  async confirmGoesToGenerate(page) {
    await toDescription(page, 'phone case', prepPhone);
    await page.evaluate(() => confirmIdeaSatisfied());
    await page.waitForTimeout(2500);
    const st = await page.evaluate(() => {
      const g = document.getElementById('generateBtn');
      const p = document.getElementById('productCard');
      const gr = g.getBoundingClientRect(), pr = p.getBoundingClientRect();
      return {
        generateInView: gr.top < innerHeight && gr.bottom > 0,
        productInView: pr.top < innerHeight && pr.bottom > 0,
        generateTop: Math.round(gr.top),
        body: [...document.body.classList],
      };
    });
    if (st.body.includes('product-focus')) return `FAIL: product-focus left on the body — everything else will be dimmed`;
    if (!st.generateInView) return `FAIL: Generate not in view after confirming (top=${st.generateTop})`;
    return `PASS: confirming the description lands on Generate (top=${st.generateTop}), no product-focus left behind`;
  },

  // The generation stage must never be veiled by a stale spotlight.
  async stageNotVeiled(page) {
    await toDescription(page, 'phone case', prepPhone);
    await page.evaluate(() => confirmIdeaSatisfied());
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await page.waitForTimeout(3500);
    const st = await page.evaluate(() => {
      const card = document.getElementById('uploadPhotoCard');
      const cs = getComputedStyle(card);
      return {
        opacity: Number(cs.opacity),
        filter: cs.filter,
        body: [...document.body.classList],
        stale: [...document.body.classList].filter(c => c.endsWith('-focus')),
      };
    });
    if (st.stale.length) return `FAIL: stale spotlight(s) survived into generation: ${JSON.stringify(st.stale)}`;
    if (st.opacity < 0.9) return `FAIL: generation stage veiled at opacity ${st.opacity} (filter: ${st.filter})`;
    return `PASS: stage fully visible during generation (opacity ${st.opacity}, no stale spotlight)`;
  },

  // Mugs still describe BEFORE choosing a product, so they must still go back.
  async mugStillReturnsToProduct(page) {
    await page.click('#postUploadForkRow button:has-text("Create Your Design")');
    await page.waitForTimeout(1500);
    await dismissAlerts(page);
    await page.fill('#ideaDesc', 'corgi commander');
    await page.waitForTimeout(500);
    await dismissAlerts(page);
    await page.evaluate(() => confirmIdeaSatisfied());
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => {
      const p = document.getElementById('productCard');
      const r = p.getBoundingClientRect();
      return { productInView: r.top < innerHeight && r.bottom > 0, body: [...document.body.classList] };
    });
    if (!st.productInView) return `FAIL: design-first path no longer reaches Product (body=${JSON.stringify(st.body)})`;
    return 'PASS: design-first path still goes to Product after describing';
  },
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
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL IDEA-CONFIRM VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
