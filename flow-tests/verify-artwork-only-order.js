// ARTWORK ONLY NEVER REACHES CHECKOUT (24 Sep 2026). Artwork Only is a picture,
// not a product. The order page picks a price by product and falls through
// to the MUG for anything it does not know, so an Artwork Only order that got
// there would be billed as a mug. The studio stops it before checkout
// (approveDesign; goToOrder refuses it too) and the order page sends one
// straight back to the studio. This pins both.
const { launch, openStudio, dismissAlerts } = require('./harness');
const BASE = 'http://127.0.0.1:8788';
(async () => {
  let fails = 0;
  const out = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`); if (!ok) fails++; };
  // 1. an Artwork Only order arriving at the order page goes back to the studio
  {
    const { browser, page } = await launch({});
    await page.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('muggshotz_pending_order', JSON.stringify({ placements: { left: 'https://example.com/a.png' }, productIcon: 'artwork only', deviceId: 'dev-test' })); } });
    const posted = [];
    page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) posted.push(r.url()); });
    await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    const u = new URL(page.url());
    out(u.pathname === '/needles-studio.html', `an Artwork Only order sent to the order page lands on ${u.pathname}`);
    const kept = await page.evaluate(() => localStorage.getItem('muggshotz_pending_order'));
    out(!kept, 'and the stale Artwork Only order is cleared');
    out(!posted.length, 'and nothing is sent to checkout');
    await browser.close();
  }
  // 2. the studio's Checkout does nothing for Artwork Only
  {
    const { browser, page } = await launch({});
    await openStudio(page); await dismissAlerts(page);
    const r = await page.evaluate(async () => { localStorage.removeItem('muggshotz_pending_order'); product = 'artwork only'; await goToOrder(); return { url: location.pathname, pending: localStorage.getItem('muggshotz_pending_order') }; });
    await page.waitForTimeout(800);
    out(r.url.endsWith('needles-studio.html') && !r.pending && page.url().includes('needles-studio.html'), `the studio's Checkout does nothing for Artwork Only (${JSON.stringify(r)})`);
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nARTWORK ONLY NEVER REACHES CHECKOUT');
  process.exit(fails ? 1 : 0);
})();
