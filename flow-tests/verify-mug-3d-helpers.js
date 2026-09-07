// The click path into a mug mockup, shared by the 3D suite and any ad-hoc
// drive that needs to reproduce a customer's exact sequence.
const { dismissAlerts } = require('./harness');
const T = (page, ms) => page.waitForTimeout(ms);
async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1000);
}
async function mugToPrintStyle(page, size = '11oz', styleIndex = 0) {
  await pickProduct(page, 'mug');
  await page.evaluate((s) => pickPreGenMugSize(s), size);
  await T(page, 500);
  await page.evaluate((i) => pickPreGenMugStyle(Object.keys(GEN_MUG_STYLES)[i]), styleIndex);
  await T(page, 500);
  await page.evaluate(() => { const b = document.querySelector('#preGenMugColorGrid .color-btn'); if (b) b.click(); });
  await T(page, 500);
  await page.evaluate(() => finishPreGenMugColorPick());
  await T(page, 900);
  await dismissAlerts(page);
}
async function ideaBoxUsable(page) {
  return page.evaluate(() => {
    const t = document.getElementById('ideaDesc'); if (!t) return false;
    const r = t.getBoundingClientRect();
    return r.height > 0 && r.width > 0 && getComputedStyle(t).display !== 'none';
  });
}
async function describeAndGenerate(page, text) {
  if (!(await ideaBoxUsable(page))) {
    await page.evaluate(() => { window.confirm = () => false; });
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await T(page, 1400);
    await dismissAlerts(page);
    if (!(await ideaBoxUsable(page))) throw new Error('the empty-box guard did not land on a usable idea box');
  }
  await page.fill('#ideaDesc', text);
  await dismissAlerts(page);
  await T(page, 400);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
}
// The real "Yes -- All 3 Sides" button. Nothing reaches the mockup with
// artwork on it until the customer has answered "Are you satisfied?"; a
// test that skipped this step handed the mug three empty slots and called
// the resulting blank mug a defect. It was the test that was wrong.
async function approveAllThree(page) {
  await page.evaluate(() => approveDesign(true));
  await T(page, 1200);
  await dismissAlerts(page);
}
const waitLanded = (page, t = 120000) =>
  page.waitForFunction(() => {
    const shown = (id) => { const el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none'; };
    return shown('seamFixOverlay') || shown('accessorizeCard') || shown('frameFadeOverlay') || shown('approveRow');
  }, null, { timeout: t });


module.exports = { pickProduct, mugToPrintStyle, describeAndGenerate, approveAllThree, waitLanded };
