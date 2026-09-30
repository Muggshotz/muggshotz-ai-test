// BACK GOES ALL THE WAY BACK (Alyx, 27 Sep 2026: "For every single product on
// every single flow path, You should be able to go all the way back to the very
// beginning screen by simply successively clicking the back button. All the way
// up to check out. Once you click checkout you can no longer go back.")
//
// For each product tile: forward from the opening page, through the product's
// panels, the description, Generate, the finished picture and everything after
// Yes, to the screen with Checkout on it. Then press the Back on whatever
// screen is showing, again and again. It fails if a Back
//   * does nothing (the screen and the page stay where they were),
//   * goes forward (to a screen that came later on the way in),
//   * skips a screen (lands further back than the one before it), or
//   * comes round to a screen it already went back through, or
//   * is missing before the opening page is reached.
// First, Checkout: it opens the order page over the studio, and the order
// page's Back must return to the Checkout screen as it was.
// Artwork Only has no checkout; its walk back starts at the finished picture.
// Usage: node verify-back-all-the-way.js [tile value] (all tiles by default).
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);
const SCREENS = { laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } };
const SKIP = new Set(['premades', 'pitch in']);

// Which screen the customer is on: a pop-up if one is open, the finished
// picture, the lit panel, else the card in the middle of the screen.
const screenOf = (page) => page.evaluate(() => {
  const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  const ov = [...document.querySelectorAll('.step-lock-overlay,[id$="Overlay"]')].filter((o) => shown(o) && o.querySelector('button'));
  if (ov.length) return 'overlay:' + ov[ov.length - 1].id;
  const cls = [...document.body.classList];
  const row = document.getElementById('approveRow');
  if (cls.includes('design-revealed') && row && shown(row)) return 'result';
  const focus = cls.filter((c) => c.endsWith('-focus'));
  if (focus.includes('initial-upload-focus')) return 'opening';
  if (focus.includes('generate-focus') || focus.includes('final-generate-focus')) return 'panel:generate';
  if (focus.length) {
    // The lit panel, by the page's own dimming rule: body.X .card:not(#Y).
    let id = null;
    for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) { const m = /^body\.([\w-]+) \.card:not\(#(\w+)\)/.exec(r.selectorText || ''); if (m && focus.includes(m[1])) id = m[2]; } }
    return 'panel:' + (id || focus.sort().join('+'));
  }
  // Nothing lit: what is in the middle of the screen, the innermost card
  // (the product grid and the finished picture both sit inside the opening card).
  const mid = innerHeight / 2;
  if (row && shown(row)) { const r = row.getBoundingClientRect(), pic = document.getElementById('previewImg'); const top = pic && shown(pic) ? pic.getBoundingClientRect().top : r.top; if (top <= mid + 200 && r.bottom >= mid - 200) return 'result'; }
  const cards = [...document.querySelectorAll('.card,#accessorizeCard')].filter((c) => shown(c)).filter((c) => { const r = c.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
  // The panel is the outermost named card there, the opening card aside (the
  // product grid sits inside it; a caption box sits inside Fit Your Picture).
  const outer = cards.filter((c) => c.id && c.id !== 'uploadPhotoCard' && !cards.some((o) => o !== c && o.id && o.id !== 'uploadPhotoCard' && o.contains(c)));
  const named = outer[0] || cards.find((c) => c.id);
  return 'panel:' + (named ? named.id : 'nothing');
});

// The Back on the current screen: in the open pop-up, else in the lit panel,
// else under the finished picture, else under Generate, else the Back in the
// card in the middle of the screen. Pressed where a customer would press it.
const pressBack = (page) => page.evaluate(() => {
  const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  const isBack = (b) => shown(b) && getComputedStyle(b).opacity !== '0' && /(^|\s)(←|↩️)?\s*(Back|Return)\b/.test(b.innerText.trim()) && !b.disabled;
  const firstBack = (root) => root && [...root.querySelectorAll('button')].find(isBack);
  const ov = [...document.querySelectorAll('.step-lock-overlay,[id$="Overlay"]')].filter((o) => shown(o) && o.querySelector('button'));
  let b = ov.length ? firstBack(ov[ov.length - 1]) : null;
  const cls = [...document.body.classList];
  if (!b && !ov.length) {
    const lit = [...document.querySelectorAll('.card')].filter((c) => shown(c) && getComputedStyle(c).opacity === '1' && c.id !== 'uploadPhotoCard');
    if (cls.includes('design-revealed')) b = document.getElementById('approveBackBtn');
    else if (cls.includes('generate-focus') || cls.includes('final-generate-focus')) b = document.getElementById('generateBackBtn');
    else if (cls.some((c) => c.endsWith('-focus'))) b = lit.map(firstBack).find(Boolean) || firstBack(document.getElementById('uploadPhotoCard'));
    else {
      const mid = innerHeight / 2;
      const row = document.getElementById('approveRow');
      const cards = [...document.querySelectorAll('.card,#accessorizeCard')].filter(shown).filter((c) => { const r = c.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
      const inner = cards.filter((c) => c.id && c.id !== 'uploadPhotoCard' && !cards.some((o) => o !== c && o.id && o.id !== 'uploadPhotoCard' && o.contains(c)));
      if (!inner.length) inner.push(...cards.filter((c) => c.id));
      const rr = row && shown(row) && row.getBoundingClientRect();
      b = (rr && rr.top <= mid + 200 && rr.bottom >= mid - 200) ? document.getElementById('approveBackBtn') : inner.map(firstBack).find(Boolean);
      // Else the Back nearest the middle of the screen, where the eye is.
      if (!b) b = [...document.querySelectorAll('button')].filter(isBack).sort((x, y) => Math.abs(x.getBoundingClientRect().top - mid) - Math.abs(y.getBoundingClientRect().top - mid))[0] || null;
    }
    if (b && !isBack(b)) b = null;
  }
  if (!b) return null;
  b.scrollIntoView({ block: 'center' });
  b.click();
  return (b.id || b.getAttribute('onclick') || b.innerText).trim().slice(0, 40);
});

async function settle(page) { await T(page, 1900); await dismissAlerts(page); }

// Forward: the product's panels (first choice each), the description, Generate,
// Yes, and every Continue after it, to the screen with Checkout.
async function forward(page, val) {
  const trail = [];
  const note = async () => { const s = await screenOf(page); if (trail[trail.length - 1] !== s) { trail.push(s); if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/in-${String(trail.length).padStart(2, '0')}-${s.replace(/\W+/g, '_')}.png` }); } return s; };
  await note();
  await page.click('#postUploadForkRow button:has-text("Select Your Product")'); await T(page, 700);
  await note();
  await page.evaluate((v) => document.querySelector(`#productCard .btn-select[data-val="${v}"]`).click(), val);
  await settle(page);
  // The travel cup's panel scrolls into view unlit: a cup, a colour, then its
  // print style, as a customer answers them.
  if (val === 'water bottle') {
    await note();
    await page.evaluate(() => pickPreGenTravelVariant('travel-mug-40oz-vacuum')); await settle(page); await note();
    await page.locator('#travelMugColorGridGen .color-btn[data-color="Red"]').first().click({ force: true }); await settle(page); await note();
  }
  for (let i = 0; i < 12; i++) {
    await note();
    if (await page.evaluate(() => /\b(ideafirst|idea)-focus\b/.test(document.body.className))) break;
    const did = await page.evaluate(() => {
      // A pop-up asking a question (the mug's size, its style): its first answer.
      const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
      const ov = [...document.querySelectorAll('.step-lock-overlay')].filter((o) => shown(o) && o.querySelector('button,.btn-select'));
      if (ov.length) {
        const o = ov[ov.length - 1];
        const go = [...o.querySelectorAll('button')].find((b) => shown(b) && /Continue|Satisfied|Done/.test(b.innerText) && !b.disabled);
        if (go) { go.click(); return o.id + ' continue'; }
        const t = [...o.querySelectorAll('.btn-select,button')].find((b) => shown(b) && !b.closest('[data-words]') && !b.classList.contains('selected') && !/Back|Cancel|Close|✕/.test(b.innerText));
        if (!t) return null; t.click(); return o.id;
      }
      if (document.getElementById('phoneCaseModelCard')?.offsetParent && document.body.classList.contains('phone-model-focus')) { pendingPhoneCaseModel = 'iPhone 15 Pro'; confirmPhoneModelGen(true); return 'phone model'; }
      // The lit panel, found the way the page dims the rest: body.X .card:not(#Y).
      const focus = [...document.body.classList].filter((c) => c.endsWith('-focus'));
      let litId = null;
      for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; }
        for (const r of rules) { const m = /^body\.([\w-]+) \.card:not\(#(\w+)\)/.exec(r.selectorText || ''); if (m && focus.includes(m[1])) litId = m[2]; } }
      const lit = (litId && document.getElementById(litId)) || [...document.querySelectorAll('.card')].find((c) => c.offsetParent && getComputedStyle(c).opacity === '1' && c.id !== 'uploadPhotoCard' && c.querySelector('.btn-select,.color-btn'));
      if (!lit) return null;
      // How to design it: the plain way, describing it to Needles.
      if (lit.id === 'designMethodCard') { const c = document.getElementById('designByDescriptionContinueBtn'); if (c && c.offsetParent) { c.click(); return 'describe'; }
        const d = document.getElementById('declinePropsBtn'); if (d && d.offsetParent) { d.click(); return 'describe'; } }
      // Every question on the panel gets its first answer (a size and a
      // colour, a kind and one-or-two), then a Continue if it has one.
      const grids = new Set([...lit.querySelectorAll('.btn-select,.color-btn')].filter((b) => b.offsetParent).map((b) => b.parentElement));
      let any = false;
      for (const g of grids) { const t = [...g.children].find((b) => b.offsetParent && (b.classList.contains('btn-select') || b.classList.contains('color-btn'))); if (t && !g.querySelector('.selected')) { t.click(); any = true; } }
      const go = [...lit.querySelectorAll('button')].find((b) => b.offsetParent && /Continue|Done|Next/.test(b.innerText) && !b.disabled);
      if (go) { go.click(); any = true; }
      if (!any) { const t = [...lit.querySelectorAll('.btn-select')].find((b) => b.offsetParent && !b.closest('[data-words]')); if (!t) return null; t.click(); }
      return lit.id;
    });
    if (!did) break;
    await settle(page);
  }
  if (!(await page.evaluate(() => /\b(ideafirst|idea)-focus\b/.test(document.body.className)))) return { trail, error: `never reached the description box (at ${await screenOf(page)})` };
  await page.fill('#ideaDesc', 'a golden retriever in a bow tie'); await dismissAlerts(page);
  // "Satisfied — Generate" paints in one click (Alyx, 30 Sep 2026): the
  // description's button is the last press before the picture, no Generate panel.
  await page.evaluate(() => { refreshIdeaPromptLabel(); document.getElementById('ideaGuidancePrompt').click(); });
  // The mug's describe route stays on the description with a choice (Return
  // to photos, or Generate); there a customer presses that Generate.
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    if (document.body.classList.contains('generation-active') || document.getElementById('approveRow')?.style.display !== 'none') return;
    const b = [...document.querySelectorAll('#mugIdeaActionRow .generate-btn, #generateBtn')].find((x) => x.offsetParent);
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
  });
  const made = await page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: 90000 }).then(() => true).catch(() => false);
  if (!made) return { trail, error: 'no finished picture' };
  await settle(page); await note();
  // Artwork Only has no checkout: the finished picture, to save, is its end.
  if (val === 'artwork only') return { trail };
  await page.evaluate(() => [...document.querySelectorAll('#approveRow button')].find((b) => b.offsetParent && /^✅ Yes/.test(b.innerText.trim())).click());
  for (let i = 0; i < 12; i++) {
    await settle(page);
    const s = await note();
    if (s === 'overlay:finalChoiceOverlay') return { trail };
    const did = await page.evaluate(() => {
      const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
      const ov = [...document.querySelectorAll('.step-lock-overlay,[id$="Overlay"]')].filter((o) => shown(o) && o.querySelector('button'));
      const root = ov.length ? ov[ov.length - 1] : document;
      const btns = [...root.querySelectorAll('button')].filter(shown).filter((b) => !b.disabled);
      // Its Continue, else (in a pop-up asking a question) its first answer.
      const b = btns.find((b) => /^(✅ )?(Continue|Done|Next|Looks good|Satisfied)/.test(b.innerText.trim()))
        || (ov.length ? btns.find((b) => !/Back|Return|Cancel|Close|✕|Save|Copy|Download|Upload|Checkout/.test(b.innerText)) : null);
      if (!b) return null; b.click(); return b.innerText.trim();
    });
    if (!did) return { trail, error: `stuck on the way to Checkout at ${s}` };
  }
  return { trail, error: 'never reached the Checkout screen' };
}

async function backAllTheWay(page, trail) {
  const fails = [], path = [await screenOf(page)];
  const idx = (s) => trail.indexOf(s);
  for (let i = 0; i < 40; i++) {
    const here = path[path.length - 1];
    if (here === 'opening') return { path, fails };
    const y0 = await page.evaluate(() => Math.round(scrollY));
    const pressed = await pressBack(page);
    if (!pressed) { fails.push(`no Back on ${here}`); break; }
    await settle(page);
    const there = await screenOf(page), y1 = await page.evaluate(() => Math.round(scrollY));
    path.push(there);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/back-${String(path.length).padStart(2, '0')}-${there.replace(/\W+/g, '_')}.png` });
    if (there === here && Math.abs(y1 - y0) < 20) { fails.push(`Back (${pressed}) on ${here} did nothing`); break; }
    if (idx(here) >= 0 && idx(there) > idx(here)) { fails.push(`Back (${pressed}) on ${here} went forward to ${there}`); break; }
    if (path.slice(0, -1).includes(there) && there !== here) { fails.push(`Back (${pressed}) on ${here} came round again to ${there}`); break; }
    // Never past a screen: it lands on the screen just before the last one it
    // knows from the way in (a screen the way in never named counts as that one).
    const known = [...path.slice(0, -1)].reverse().find((x) => idx(x) >= 0);
    const k = known ? idx(known) : -1;
    // (A screen passed through again on the way in, as the page waits for the
    // next pop-up, is not a screen of its own.)
    // (Nor is the opening card glimpsed behind a mockup that is still loading,
    // after the picture is made.)
    const skipped = idx(there) >= 0 ? trail.slice(idx(there) + 1, k).filter((x, j) => trail.indexOf(x) === idx(there) + 1 + j)
      .filter((x) => !(x === 'panel:uploadPhotoCard' && idx(x) > idx('result'))) : [];
    if (k > 0 && skipped.length && there !== 'opening') { fails.push(`Back (${pressed}) on ${here} skipped ${skipped.join(', ')}, landing on ${there}`); break; }
  }
  if (!fails.length) fails.push(`never reached the opening page (ended at ${path[path.length - 1]})`);
  return { path, fails };
}

if (require.main !== module) { module.exports = { forward, backAllTheWay, screenOf, settle }; return; }
(async () => {
  const only = process.argv[2];
  let failures = 0;
  const { browser: b0, page: p0 } = await launch({});
  await openStudio(p0); await uploadPhoto(p0);
  const vals = (await p0.evaluate(() => [...document.querySelectorAll('#productCard .btn-select[data-val]')].map((b) => b.dataset.val)))
    .filter((v) => !SKIP.has(v) && (!only || v === only));
  await b0.close();
  for (const [screen, viewport] of Object.entries(SCREENS).filter(([k]) => !process.env.ONLY_SCREEN || k === process.env.ONLY_SCREEN)) {
    for (const val of vals) {
      // The travel cup's panels draw the cup in 3D; its tests run with WebGL on.
      const GL = val === 'water bottle' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : undefined;
      const { browser, page, log } = await launch({ viewport, echoUploads: true, chromiumArgs: GL });
      let line;
      try {
        await openStudio(page); await uploadPhoto(page); await dismissAlerts(page);
        const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1536; c.height = 1024; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 1536, 0); gr.addColorStop(0, '#b3202a'); gr.addColorStop(1, '#1f3f8f'); g.fillStyle = gr; g.fillRect(0, 0, 1536, 1024); return c.toDataURL('image/png').split(',')[1]; });
        await page.route('**/__fake/generated.jpg', (r) => r.fulfill({ contentType: 'image/png', body: Buffer.from(b64, 'base64') }));
        const f = await forward(page, val);
        // Checkout opens the order page over the studio (nothing is paid
        // until Continue to Payment); its Back must land on the Checkout
        // screen again, as it was.
        if (!f.error && val !== 'artwork only') {
          await page.evaluate(() => [...document.querySelectorAll('#finalChoiceOverlay button')].find((b) => /Checkout/.test(b.innerText)).click());
          const opened = await page.waitForSelector('#orderPageFrame', { timeout: 20000 }).then(() => true).catch(() => false);
          if (!opened) f.error = 'Checkout did not open the order page';
          else {
            await T(page, 3500);
            const fr = page.frame({ url: /order\.html/ });
            await fr.click('a.back-link'); await settle(page);
            const s = await screenOf(page);
            if (s !== 'overlay:finalChoiceOverlay' || await page.$('#orderPageOverlay')) f.error = `Back on the order page went to ${s}, not the Checkout screen`;
          }
        }
        if (f.error) line = `FAIL forward: ${f.error}\n    in: ${f.trail.join(' → ')}`;
        else {
          const b = await backAllTheWay(page, f.trail);
          line = b.fails.length ? `FAIL: ${b.fails.join('; ')}\n    in:   ${f.trail.join(' → ')}\n    back: ${b.path.join(' → ')}`
            : `PASS: ${b.path.length - 1} Backs from Checkout to the opening page\n    back: ${b.path.join(' → ')}`;
        }
      } catch (e) { line = `ERROR: ${String(e).split('\n')[0]}`; }
      console.log(`[${screen}] ${val}: ${line}`);
      if (!line.startsWith('PASS')) failures++;
      if (log.pageErrors.length) { console.log(`    PAGE ERRORS: ${JSON.stringify(log.pageErrors).slice(0, 300)}`); failures++; }
      await browser.close();
    }
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nEVERY BACK GOES ALL THE WAY BACK');
  process.exit(failures ? 1 : 0);
})();
