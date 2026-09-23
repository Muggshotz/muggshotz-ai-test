// THE PANEL CHECKLIST (Alyx, 23 Sep 2026: "You should have a checklist of
// everything that the panels need so that you don't keep missing things, such
// as back buttons, and mock up images. And prices, and names for the
// category. Every panel should have these things automatically."). The same
// list is in CLAUDE.md. This walks every product tile's rail, forward to
// Generate and back to the grid, on a laptop screen and a phone, and holds
// every panel it lands on to it:
//   * a NAME: the panel has a title;
//   * a BACK: a Back button on the panel, which goes to the panel before and
//     nothing else -- forward and back are the same list of panels reversed;
//   * PICTURES: the panel shows a picture of the product, every choice tile
//     carries one (a grid marked data-words is words by design: sizes, paper),
//     and every picture loads;
//   * PRICES: the panel shows a price, and in a grid where one choice shows a
//     price, every choice does;
//   * THE LANDING: the scroll puts the lit panel on screen -- its title and
//     its choices, not a dimmed neighbour -- whether it was reached forward or
//     by Back. A panel taller than the screen shows its title and first choice.
// The mug and travel-cup rails are their own (overlays and the 3D fitter) and
// are not walked here; Artwork Only has no product panels.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const SKIP = new Set(['mug', 'water bottle', 'artwork only']);
const SCREENS = { laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } };

// Which card each spotlight lights, read from the page's own CSS rules
// ("body.X .card:not(#Y)"), so a new panel is covered the day it is added.
const litPanel = (page) => page.evaluate(() => {
  const focus = [...document.body.classList].filter((c) => c.endsWith('-focus'));
  const map = {};
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const r of rules) {
      const m = /^body\.([\w-]+) \.card:not\(#(\w+)\)/.exec(r.selectorText || '');
      if (m) map[m[1]] = m[2];
    }
  }
  return { focus, card: focus.length === 1 ? (map[focus[0]] || null) : null };
});

// The checklist, on one panel.
const checkPanel = (page, cardId) => page.evaluate(async (cardId) => {
  const card = document.getElementById(cardId);
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
  const out = [];
  if (!vis(card)) return [`${cardId} is lit but not shown`];
  const title = card.querySelector('.card-title');
  if (!title || !title.innerText.trim()) out.push('no name');
  if (![...card.querySelectorAll('button')].some((b) => vis(b) && /back/i.test(b.innerText))) out.push('no Back button');
  const imgs = [...card.querySelectorAll('img')].filter(vis);
  await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
  if (!imgs.length) out.push('no picture');
  const broken = imgs.filter((im) => !im.naturalWidth).map((im) => im.getAttribute('src'));
  if (broken.length) out.push('pictures that do not load: ' + broken.join(', '));
  const tiles = [...card.querySelectorAll('.btn-select')].filter(vis);
  const bare = tiles.filter((t) => !t.closest('[data-words]') && !t.querySelector('img')).map((t) => t.innerText.split('\n')[0].trim());
  if (bare.length) out.push('choices with no picture: ' + bare.join(', '));
  if (!/\$\d/.test(card.innerText)) out.push('no price');
  const grids = new Set(tiles.map((t) => t.parentElement));
  for (const g of grids) {
    const gt = [...g.children].filter((t) => t.classList.contains('btn-select') && vis(t));
    const priced = gt.filter((t) => /\$\d/.test(t.innerText));
    if (priced.length && priced.length !== gt.length) out.push(`${gt.length - priced.length} of ${gt.length} choices in a grid have no price`);
  }
  return out;
}, cardId);

// The landing: the lit panel is on screen, title and choices.
const landing = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return `nothing at ${sel}`;
  const H = innerHeight, r = el.getBoundingClientRect();
  if (r.height <= H * 0.9) {
    return (r.top >= -2 && r.bottom <= H + 2) ? null : `${sel} is not fully on screen (top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)}, screen ${H})`;
  }
  const first = el.querySelector('.btn-select,.color-btn,input,textarea');
  const fr = first && first.getBoundingClientRect();
  if (r.top < -2 || r.top > H * 0.25) return `${sel} is taller than the screen and its title is not at the top (top ${Math.round(r.top)})`;
  if (fr && fr.bottom > H + 2) return `${sel}'s first choice is below the screen`;
  return null;
}, sel);

// Settle: the studio scrolls smoothly and waits for layout, so give each move
// time to finish before judging where it landed.
async function settle(page) { await T(page, 1900); await dismissAlerts(page); }

// Make this panel's choice, the first one on offer.
async function choose(page, cardId) {
  await page.evaluate((cardId) => {
    if (cardId === 'phoneCaseModelCard') { pendingPhoneCaseModel = 'iPhone 15 Pro'; confirmPhoneModelGen(true); return; }
    const card = document.getElementById(cardId);
    const t = [...card.querySelectorAll('.btn-select')].find((b) => !b.closest('[data-words]') || cardId === 'tshirtOptionCard');
    if (cardId === 'tshirtOptionCard') { t.click(); card.querySelector('#tshirtColorGrid .color-btn').click(); return; }
    (t || card.querySelector('.color-btn')).click();
  }, cardId);
}

async function walk(page, val) {
  const fails = [];
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.evaluate((v) => document.querySelector(`#productCard .btn-select[data-val="${v}"]`).click(), val);
  await settle(page);
  const rail = [];
  for (let step = 0; step < 6; step++) {
    const lit = await litPanel(page);
    if (lit.focus.includes('ideafirst-focus')) break;
    if (!lit.card) { fails.push(`after ${rail.length ? rail[rail.length - 1] : 'the tile'} no single panel is lit (${lit.focus.join(' ') || 'none'})`); return fails; }
    rail.push(lit.card);
    for (const f of await checkPanel(page, lit.card)) fails.push(`${lit.card}: ${f}`);
    const l = await landing(page, '#' + lit.card); if (l) fails.push(`forward: ${l}`);
    await choose(page, lit.card);
    await settle(page);
  }
  // The description box, then Generate.
  if (!(await page.evaluate(() => document.body.classList.contains('ideafirst-focus')))) { fails.push('never reached the description box'); return fails; }
  let l = await landing(page, '#ideaCard'); if (l) fails.push(`forward: ${l}`);
  await page.fill('#ideaDesc', 'a golden retriever in a bow tie');
  await page.evaluate(() => confirmIdeaSatisfied());
  await settle(page);
  l = await landing(page, '#generateBtn'); if (l) fails.push(`forward: ${l}`);
  // And back, one panel at a time.
  await page.evaluate(() => document.getElementById('generateBackBtn').click());
  await settle(page);
  if (!(await page.evaluate(() => document.body.classList.contains('ideafirst-focus')))) fails.push('Back under Generate did not return to the description box');
  l = await landing(page, '#ideaCard'); if (l) fails.push(`back: ${l}`);
  await page.evaluate(() => [...document.querySelectorAll('#ideaCard button')].find((b) => /back/i.test(b.innerText) && b.offsetParent).click());
  await settle(page);
  for (let i = rail.length - 1; i >= 0; i--) {
    const lit = await litPanel(page);
    if (lit.card !== rail[i]) { fails.push(`Back from ${i === rail.length - 1 ? 'the description' : rail[i + 1]} went to ${lit.card || lit.focus.join(' ') || 'the grid'}, not ${rail[i]}`); return fails; }
    l = await landing(page, '#' + rail[i]); if (l) fails.push(`back: ${l}`);
    await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('button')].find((b) => /back/i.test(b.innerText) && b.offsetParent).click(), rail[i]);
    await settle(page);
  }
  const end = await litPanel(page);
  if (end.focus.length) fails.push(`the last Back left a spotlight on: ${end.focus.join(' ')}`);
  l = await landing(page, '#productCard .btn-select.selected'); if (l) fails.push(`back to the grid: ${l}`);
  return fails.length ? fails : [`PASS: ${['tile', ...rail, 'idea', 'Generate'].join(' → ')} and back`];
}

(async () => {
  const only = process.argv[2];
  let fails = 0;
  const { browser: b0, page: p0 } = await launch({});
  await openStudio(p0); await uploadPhoto(p0);
  const vals = (await p0.evaluate(() => [...document.querySelectorAll('#productCard .btn-select[data-val]')].map((b) => b.dataset.val)))
    .filter((v) => !SKIP.has(v) && (!only || v === only));
  await b0.close();
  for (const [screen, viewport] of Object.entries(SCREENS)) {
    for (const val of vals) {
      const { browser, page, log } = await launch({ viewport });
      let res;
      try { await openStudio(page); await uploadPhoto(page); await dismissAlerts(page); res = await walk(page, val); }
      catch (e) { res = [`ERROR: ${String(e).split('\n')[0]}`]; }
      const pass = res.length === 1 && res[0].startsWith('PASS');
      console.log(`[${screen}] ${val}: ${pass ? res[0] : 'FAIL'}`);
      if (!pass) { res.forEach((f) => console.log('    - ' + f)); fails++; }
      if (log.pageErrors.length) { console.log(`    PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
      await browser.close();
    }
  }
  console.log(fails === 0 ? '\nEVERY PANEL PASSES THE CHECKLIST' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
