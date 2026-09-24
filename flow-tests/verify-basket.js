// THE BASKET, ON THE PAGE (Alyx, 23 Sep 2026: "Begin build a basket"). The
// server half -- several items priced, one payment, one Printify order -- is
// pinned by verify-back-half.js. This pins what the customer does:
//   * Add to Basket keeps the item and goes back to the studio, which then
//     shows the basket link;
//   * a basket plus the design on the page are paid for together, in one
//     basket_order carrying every item and the address once;
//   * with only a basket (no new design) the page is just basket, address,
//     summary and pay, and items can be removed;
//   * a paid basket is emptied; a single order with no basket is unchanged.
const { launch, dismissAlerts } = require('./harness');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const T = (page, ms) => page.waitForTimeout(ms);
const BASE = 'http://127.0.0.1:8788';
const IMG = 'https://example.com/design.png';

const MAGNET_PENDING = { placements: { left: IMG }, deviceId: 'test-dev', productIcon: 'car magnet', preselectedCarMagnet: '7.5 x 4.5 in' };
const DOORMAT_PENDING = { placements: { left: IMG }, deviceId: 'test-dev', productIcon: 'doormat' };
const MAGNET_ITEM = { item: { productKey: 'car-magnet', sizeLabel: '5 x 5 in', image: IMG }, productKey: 'car-magnet', sizeLabel: '5 x 5 in', colorName: null, label: 'Car Magnet, 5 x 5 in', basePrice: 5.95, price: 5.95, thumb: IMG };
const STEIN_ITEM = { item: { productKey: 'beer-stein', sizeLabel: '22oz', image: IMG }, productKey: 'beer-stein', sizeLabel: '22oz', colorName: null, label: 'Beer Stein', basePrice: 24.95, price: 24.95, thumb: IMG };

// The shipping quote is not stubbed by the harness; answer it the way the
// real endpoint does, $6.17 per item, so the summary shows a live figure.
async function quoteShipping(page) {
  await page.route('**/api/printify-catalog**', (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get('action') === 'basketShipping') {
      const n = JSON.parse(u.searchParams.get('items') || '[]').length;
      return route.fulfill({ json: { shipping: Math.round(n * 6.17 * 100) / 100, source: 'live' } });
    }
    return route.fulfill({ json: { shipping: 6.17, shippingSeparate: true, source: 'live' } });
  });
}
function seed(page, { pending = null, basket = null }) {
  return page.addInitScript(({ pending, basket }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (pending) localStorage.setItem('muggshotz_pending_order', JSON.stringify(pending)); else localStorage.removeItem('muggshotz_pending_order');
    if (basket) localStorage.setItem('muggshotz_basket', JSON.stringify(basket)); else localStorage.removeItem('muggshotz_basket');
  }, { pending, basket });
}
function tapCheckout(page) {
  const bodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/create-checkout-session')) { try { bodies.push(r.postDataJSON()); } catch (e) {} } });
  return bodies;
}
async function fillAndPay(page) {
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', 'Test Customer'); set('email', 'test@example.com'); set('phone', '5555550100');
    set('address1', '123 Test St'); set('city', 'Westland'); set('state', 'MI'); set('zip', '48185'); set('country', 'US');
    submitOrder();
  });
  await T(page, 2000);
}
const shown = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; }, id);

const scenarios = {};

scenarios.addToBasketGoesBackToTheStudio = async (page) => {
  await seed(page, { pending: MAGNET_PENDING });
  await quoteShipping(page);
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 1500);
  if (!(await shown(page, 'addToBasketBtn'))) return 'FAIL: no Add to Basket button beside Continue to Payment';
  await Promise.all([page.waitForURL(/needles-studio\.html/, { timeout: 10000 }), page.click('#addToBasketBtn')]);
  await T(page, 1500);
  await dismissAlerts(page);
  const st = await page.evaluate(() => ({
    basket: JSON.parse(localStorage.getItem('muggshotz_basket') || '[]'),
    pending: localStorage.getItem('muggshotz_pending_order'),
    pill: (() => { const p = document.getElementById('basketPill'); return p && getComputedStyle(p).display !== 'none' ? p.textContent : null; })()
  }));
  if (st.basket.length !== 1) return `FAIL: the basket holds ${st.basket.length} items`;
  const b = st.basket[0];
  if (b.productKey !== 'car-magnet' || b.sizeLabel !== '7.5 x 4.5 in') return `FAIL: the basket kept ${b.productKey} / ${b.sizeLabel}`;
  if (b.price !== 6.95) return `FAIL: the basket shows ${b.price}, the magnet is 6.95`;
  if (b.item.image !== IMG) return 'FAIL: the basket item lost its artwork';
  if (st.pending) return 'FAIL: the design is still pending after going into the basket -- it could be ordered twice';
  if (!st.pill || !/1/.test(st.pill)) return `FAIL: the studio shows no basket link (${st.pill})`;
  return `PASS: Add to Basket keeps the 7.5 x 4.5 magnet at $6.95 and returns to the studio, which shows "${st.pill.trim()}"`;
};

scenarios.basketAndNewDesignPayTogether = async (page) => {
  await seed(page, { pending: DOORMAT_PENDING, basket: [MAGNET_ITEM] });
  await quoteShipping(page);
  const bodies = tapCheckout(page);
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 2000);
  if (!(await shown(page, 'basketCard'))) return 'FAIL: the basket is not shown on the order page';
  const sum = await page.evaluate(() => ({
    basketRow: document.getElementById('summaryBasket').textContent,
    base: document.getElementById('summaryBase').textContent,
    ship: document.getElementById('summaryShipping').textContent,
    total: document.getElementById('summaryTotal').textContent,
    current: document.getElementById('basketCurrentNote') && getComputedStyle(document.getElementById('basketCurrentNote')).display !== 'none'
  }));
  if (sum.basketRow !== '$5.95') return `FAIL: the summary's basket row reads ${sum.basketRow}`;
  if (sum.ship !== '$12.34') return `FAIL: shipping reads ${sum.ship}, the quote for two items is $12.34`;
  // The doormat's price is the catalog's, not a number typed here: it was
  // $16.95 when this was written and $19.95 by the afternoon of 24 Sep 2026.
  const { PRODUCTS_CATALOG } = await import(path.join(ROOT, 'lib', 'products-catalog.js'));
  const doormat = Object.values(PRODUCTS_CATALOG['doormat'].sizes)[0].price;
  if (sum.base !== '$' + doormat.toFixed(2)) return `FAIL: the doormat reads ${sum.base}, the catalog bills $${doormat.toFixed(2)}`;
  const sub = doormat + 5.95 + 12.34;
  const want = '$' + (sub + Math.ceil(0.029 * Math.round(sub * 100) + 35) / 100).toFixed(2);
  if (sum.total !== want) return `FAIL: total ${sum.total}, expected ${want} (doormat + basket + shipping + fee)`;
  if (!sum.current) return 'FAIL: the page does not say the design above goes in with the basket';
  await fillAndPay(page);
  const b = bodies[bodies.length - 1];
  if (!b) return 'FAIL: nothing was sent to checkout';
  if (b.type !== 'basket_order') return `FAIL: sent type=${b.type}`;
  const keys = (b.items || []).map((i) => i.productKey).join(',');
  if (keys !== 'car-magnet,doormat') return `FAIL: the basket order carries ${keys}`;
  if (!b.shippingAddress || b.shippingAddress.zip !== '48185') return 'FAIL: the address is missing';
  if ((b.items || []).some((i) => i.shippingAddress || i.customerName)) return 'FAIL: an item carries the address -- it belongs to the order once';
  return `PASS: basket + doormat shown together (total ${sum.total}), and paid as one basket_order of ${keys}`;
};

scenarios.basketOnlyPage = async (page) => {
  await seed(page, { basket: [MAGNET_ITEM, STEIN_ITEM] });
  await quoteShipping(page);
  const bodies = tapCheckout(page);
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 2000);
  const st = await page.evaluate(() => {
    const vis = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    return { basket: vis('basketCard'), mug: vis('mugStyleCard'), size: vis('sizeCard'), add: vis('addToBasketBtn'), pay: vis('submitBtn'), shipping: vis('shippingCard'),
      rows: document.querySelectorAll('#basketList .basket-row').length, baseRow: getComputedStyle(document.getElementById('summaryStyleSize').parentElement).display };
  });
  if (!st.basket || st.rows !== 2) return `FAIL: basket shown=${st.basket}, rows=${st.rows}`;
  if (st.mug || st.size) return 'FAIL: the mug pickers show on a basket-only page';
  if (st.add) return 'FAIL: Add to Basket shows with nothing new to add';
  if (!st.pay || !st.shipping) return 'FAIL: the address or the pay button is hidden';
  if (st.baseRow !== 'none') return 'FAIL: the summary still shows a product line for a design that is not there';
  await page.click('#basketList .basket-row:first-child .basket-remove');
  await T(page, 800);
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('muggshotz_basket') || '[]').map((b) => b.productKey));
  if (left.join(',') !== 'beer-stein') return `FAIL: removing the first item left ${left}`;
  await fillAndPay(page);
  const b = bodies[bodies.length - 1];
  if (!b || b.type !== 'basket_order' || (b.items || []).length !== 1 || b.items[0].productKey !== 'beer-stein')
    return `FAIL: the basket-only payment sent ${JSON.stringify(b && { type: b.type, items: (b.items || []).map((i) => i.productKey) })}`;
  return 'PASS: a basket-only page shows the basket, address, summary and pay and no pickers; an item can be removed; the rest is paid as a basket';
};

scenarios.paidBasketIsEmptied = async (page) => {
  await seed(page, { basket: [MAGNET_ITEM] });
  await page.goto(`${BASE}/order.html?checkout=success&basket=1`, { waitUntil: 'domcontentloaded' });
  await T(page, 1200);
  const left = await page.evaluate(() => localStorage.getItem('muggshotz_basket'));
  if (left) return `FAIL: the basket survived its own payment: ${left}`;
  return 'PASS: returning from a paid checkout empties the basket';
};

scenarios.singleOrderUnchanged = async (page) => {
  await seed(page, { pending: MAGNET_PENDING });
  await quoteShipping(page);
  const bodies = tapCheckout(page);
  await page.goto(`${BASE}/order.html`, { waitUntil: 'domcontentloaded' });
  await T(page, 1500);
  if (await shown(page, 'basketCard')) return 'FAIL: an empty basket is shown';
  await fillAndPay(page);
  const b = bodies[bodies.length - 1];
  if (!b || b.type !== 'mug_order' || b.productKey !== 'car-magnet' || b.sizeLabel !== '7.5 x 4.5 in') return `FAIL: a single order sent ${JSON.stringify(b && { type: b.type, key: b.productKey, size: b.sizeLabel })}`;
  return 'PASS: with no basket, the order page sends the single order exactly as before';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch({});
    let result;
    try { result = await fn(page, log); }
    catch (e) { result = `ERROR: ${String(e).split('\n')[0]}`; }
    console.log(`[${name}] ${result}`);
    if (!/^PASS/.test(result)) fails++;
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL BASKET VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
