// Classic White was missing from the one screen a customer could pick it on
// (2026-08-27). Alyx, after roughly a thousand iterations: "a major major
// mistake we've made in coffee mugs."
//
// The style grid renders from PRE_GEN_MUG_STYLE_PRICES, which carried three
// styles. Every other mug table in the app carries four: GEN_MUG_STYLES,
// GEN_STYLE_TO_PRODUCT_KEY, order.html's MUG_STYLES, and the server catalog.
// So the cheapest mug we sell had real variant IDs, a checkout branch and an
// order-page tile, and was never once offered. The floor on every mug sold
// was $19.95 while a $14.95 option sat one table away.
//
// Nothing errored. Nothing looked broken. It was a table short by one line
// while every other table agreed with itself -- which is exactly why a
// thousand runs never surfaced it, and exactly what a cross-table check is
// for.
//
// This suite also pins the two things that made restoring it non-trivial,
// because both would strand a customer rather than throw:
//   * a style with NO COLOURS must still be able to proceed. The
//     "Satisfied - Continue" button was revealed only by picking a colour,
//     so choosing Classic White left nothing to click.
//   * the grid renders a thumbnail per style, and Classic White has never
//     had a local asset.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

async function toMugStyles(page) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
  await T(page, 1000);
  await page.evaluate(() => pickPreGenMugSize('11oz'));
  await T(page, 700);
}

const scenarios = {};

// ---- 1. The four tables must agree. This is the actual bug. ----
scenarios.everyMugTableAgrees = async (page) => {
  const t = await page.evaluate(() => ({
    picker: Object.keys(PRE_GEN_MUG_STYLE_PRICES),
    styles: Object.keys(GEN_MUG_STYLES),
    keys: Object.keys(GEN_STYLE_TO_PRODUCT_KEY),
    thumbs: Object.keys(PRE_GEN_MUG_STYLE_THUMBNAILS),
  }));
  const ref = t.styles.slice().sort();
  for (const [name, list] of Object.entries(t)) {
    const got = list.slice().sort();
    if (JSON.stringify(got) !== JSON.stringify(ref)) {
      const missing = ref.filter(x => !got.includes(x));
      const extra = got.filter(x => !ref.includes(x));
      return `FAIL: ${name} disagrees — missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)}`;
    }
  }
  return `PASS: all four mug tables carry the same ${ref.length} styles (${ref.join(', ')})`;
};

// ---- 2. And the cheapest one is actually on screen. ----
scenarios.classicWhiteIsOnTheGrid = async (page) => {
  await toMugStyles(page);
  const tiles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#preGenMugStyleGrid .btn-select')).map(b => ({
      style: b.dataset.style,
      text: b.textContent.replace(/\s+/g, ' ').trim(),
      h: Math.round(b.getBoundingClientRect().height),
    })));
  const cw = tiles.find(t => t.style === 'Classic White');
  if (!cw) return `FAIL: Classic White is not on the grid — only ${tiles.map(t => t.style).join(', ')}`;
  if (cw.h === 0) return 'FAIL: the Classic White tile has no height';
  if (!/14\.95/.test(cw.text)) return `FAIL: Classic White tile does not show $14.95 at 11oz — "${cw.text}"`;
  return `PASS: Classic White is on the grid at $14.95 (${tiles.length} styles offered)`;
};

// ---- 3. The upgrade ladder is legible, and correct at both sizes. ----
scenarios.upgradeDeltasAreShownAndCorrect = async (page) => {
  await toMugStyles(page);
  for (const size of ['11oz', '15oz']) {
    await page.evaluate((sz) => pickPreGenMugSize(sz), size);
    await T(page, 500);
    const got = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#preGenMugStyleGrid .btn-select')).map(b => ({
        style: b.dataset.style,
        text: b.textContent.replace(/\s+/g, ' ').trim(),
      })));
    const base = await page.evaluate((sz) => PRE_GEN_MUG_STYLE_PRICES[MUG_UPGRADE_BASE_STYLE][sz], size);
    for (const tile of got) {
      const price = await page.evaluate(([st, sz]) => PRE_GEN_MUG_STYLE_PRICES[st][sz], [tile.style, size]);
      const want = price - base;
      if (want <= 0) {
        if (/\+\$/.test(tile.text)) return `FAIL: ${size} ${tile.style} is the base but shows an upgrade delta`;
        continue;
      }
      if (!tile.text.includes('+$' + want.toFixed(2)))
        return `FAIL: ${size} ${tile.style} should show +$${want.toFixed(2)} — got "${tile.text}"`;
    }
  }
  return 'PASS: upgrade deltas shown and correct at both sizes (+$3.00 Trimmed/Accented, +$5.00 Color Pop)';
};

// ---- 4. A style with no colours must not strand the customer. ----
scenarios.colourlessStyleCanStillProceed = async (page) => {
  await toMugStyles(page);
  await page.evaluate(() => pickPreGenMugStyle('Classic White'));
  await T(page, 900);
  const st = await page.evaluate(() => {
    const btn = document.getElementById('preGenMugColorFinishBtn');
    const card = document.getElementById('mugStyleCard');
    const b = btn.getBoundingClientRect(), c = card.getBoundingClientRect();
    return {
      // The GRID, not the wrap. #preGenMugColorWrap also contains the mug
      // mockup and the Continue button, so it has to stay visible even for a
      // style with no colours -- hiding it was the first, wrong fix, and it
      // gave the Continue button display:block with a zero-size box at the
      // page origin. Only the swatch grid should disappear.
      colourGridShown: getComputedStyle(document.getElementById('preGenMugColorGrid')).display !== 'none',
      swatchCount: document.querySelectorAll('#preGenMugColorGrid .color-btn').length,
      finishShown: getComputedStyle(btn).display !== 'none',
      // display:block is NOT enough. #mugStyleCard is max-height:90vh with
      // overflow-y:hidden, so a button below the clip is rendered, visible to
      // getComputedStyle, and impossible for a customer to reach or click.
      // That is exactly how this shipped: the first version of this check
      // asserted display alone and passed while the flow was frozen.
      finishReachable: b.height > 0 && b.top >= c.top - 2 && b.bottom <= c.bottom + 2,
      finishOffsetBelowCard: Math.round(b.bottom - c.bottom),
      chosen: mugColorChosenPreGen,
      colour: selectedGenColor,
    };
  });
  if (st.colourGridShown || st.swatchCount)
    return `FAIL: a colour grid is showing (${st.swatchCount} swatches) for a mug that has no colours`;
  if (!st.finishShown) return 'FAIL: no Continue button — picking Classic White strands the customer with nothing to click';
  if (!st.finishReachable) return `FAIL: the Continue button is rendered but clipped ${st.finishOffsetBelowCard}px below #mugStyleCard, which has overflow-y:hidden — the customer cannot reach it and the flow is frozen`;
  if (st.chosen !== true) return 'FAIL: mugColorChosenPreGen is false, so the rail thinks a choice is still outstanding';
  if (st.colour !== null) return `FAIL: selectedGenColor is ${JSON.stringify(st.colour)} for a colourless style`;

  // And it must actually carry through to a product key, not just look right.
  await page.evaluate(() => finishPreGenMugColorPick());
  await T(page, 900);
  const key = await page.evaluate(() => GEN_STYLE_TO_PRODUCT_KEY[selectedGenStyle]);
  if (key !== 'classic-white-mug') return `FAIL: Classic White maps to ${key}`;
  return 'PASS: a colourless style proceeds cleanly, Continue is reachable, and it maps to classic-white-mug';
};

// ---- 5. Every style has a thumbnail the grid can actually draw. ----
scenarios.everyStyleHasArtwork = async (page) => {
  await toMugStyles(page);
  const broken = await page.evaluate(async () => {
    const out = [];
    for (const [style, src] of Object.entries(PRE_GEN_MUG_STYLE_THUMBNAILS)) {
      if (!src) { out.push(style + ' (no src)'); continue; }
      const ok = await new Promise(r => {
        const im = new Image();
        im.onload = () => r(im.naturalWidth > 0);
        im.onerror = () => r(false);
        im.src = src;
        setTimeout(() => r(false), 8000);
      });
      if (!ok) out.push(style + ' -> ' + src);
    }
    return out;
  });
  if (broken.length) return `FAIL: thumbnail will not render for: ${broken.join('; ')}`;
  return 'PASS: every mug style has a thumbnail that loads';
};

// ---- 6. The two sizes show the RIGHT mug, decided by Printify's data. ----
// The uploaded files were mislabelled, and eyeballing would not have settled
// it. Printify's print areas for bp 478 do: 11oz is 2475x1155, 15oz is
// 2475x1275 -- identical width, so identical diameter, so the 15oz holds more
// purely by being ~10% TALLER. The proportionally taller photo is therefore
// the 15oz. This pins the mapping by measuring the images themselves, so a
// future re-upload cannot silently swap them back.
scenarios.sizePhotosAreNotSwapped = async (page) => {
  await toMugStyles(page);
  const shapes = await page.evaluate(async () => {
    const srcs = MUG_COLORLESS_SIZE_PHOTOS['Classic White'];
    if (!srcs) return null;
    async function ratio(src) {
      const im = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = src;
      });
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      // Column ink counts -> body width; row extent -> body height.
      const cols = new Array(c.width).fill(0);
      let minY = c.height, maxY = 0;
      for (let y = 0; y < c.height; y += 2) {
        for (let px = 0; px < c.width; px += 2) {
          const i2 = (y * c.width + px) * 4;
          if (d[i2] < 245 || d[i2 + 1] < 245 || d[i2 + 2] < 245) {
            cols[px]++;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      const peak = Math.max(...cols), keep = [];
      cols.forEach((n, i3) => { if (n >= peak * 0.55) keep.push(i3); });
      const bw = keep.length ? keep[keep.length - 1] - keep[0] : 0;
      return bw ? (maxY - minY) / bw : 0;
    }
    return { r11: await ratio(srcs['11oz']), r15: await ratio(srcs['15oz']) };
  });
  if (!shapes) return 'FAIL: MUG_COLORLESS_SIZE_PHOTOS has no Classic White entry';
  if (!shapes.r11 || !shapes.r15) return `FAIL: could not measure the mug photos (${JSON.stringify(shapes)})`;
  if (!(shapes.r15 > shapes.r11))
    return `FAIL: the 15oz photo (H/W ${shapes.r15.toFixed(3)}) is not taller than the 11oz (${shapes.r11.toFixed(3)}) — the files are swapped. Printify: 11oz 2475x1155, 15oz 2475x1275, same width so the 15oz is the taller mug.`;
  return `PASS: 15oz photo is the taller mug (H/W ${shapes.r15.toFixed(3)} vs ${shapes.r11.toFixed(3)}), matching Printify's print areas`;
};

// ---- 7. On a short window, EVERY style must leave a reachable next step. ----
// Alyx, one message apart: "I clicked to select on Classic White and it didn't
// take me anywhere, we seem to be frozen here" / "Same thing when I select
// trimmed". Two different styles, one cause: #mugStyleCard is capped at 90vh,
// and it used to be overflow-y:HIDDEN inside an overlay that could never
// scroll past it. Anything below the cap was rendered, display:block, and
// unreachable by any means the customer had.
//
// So this asserts the thing a customer actually needs, at a size where the
// card genuinely overflows: after picking a style, the next control is inside
// the card's visible box AND is the topmost element at its own centre point.
// A colourless style hands you "Satisfied - Continue"; every other style hands
// you the swatch grid. Either way something must be there to press.
scenarios.everyStyleLeavesAReachableNextStepOnAShortWindow = async (page) => {
  await toMugStyles(page);
  const styles = await page.evaluate(() => Object.keys(PRE_GEN_MUG_STYLE_PRICES));
  const bad = [];

  // Reachable = has a box, sits inside the card's visible bounds, and is the
  // topmost element at its own centre. Checking display alone is what let this
  // ship twice.
  const reach = (page, sel, nth) => page.evaluate(({ sel, nth }) => {
    const card = document.getElementById('mugStyleCard');
    const c = card.getBoundingClientRect();
    const list = document.querySelectorAll(sel);
    const el = nth == null ? document.querySelector(sel) : list[nth];
    if (!el) return { missing: true, count: list.length };
    const r = el.getBoundingClientRect();
    const hit = r.height ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return {
      count: list.length,
      h: Math.round(r.height),
      inCard: r.top >= c.top - 2 && r.bottom <= c.bottom + 2,
      past: Math.round(r.bottom - c.bottom),
      onTop: !!hit && (hit === el || el.contains(hit) || hit.contains(el)),
      overflowY: getComputedStyle(card).overflowY,
    };
  }, { sel, nth });

  for (const style of styles) {
    await page.locator(`#preGenMugStyleGrid .btn-select[data-style="${style}"]`).click();
    await T(page, 1100);

    const n = await page.evaluate(() => document.querySelectorAll('#preGenMugColorGrid .color-btn').length);
    if (n) {
      // EVERY swatch, not just the first. The grid wraps to several rows and
      // only the top row was ever above the clip, so a check on the first
      // swatch passes while most of the colours on offer cannot be picked.
      for (let i = 0; i < n; i++) {
        const st = await reach(page, '#preGenMugColorGrid .color-btn', i);
        if (!st.h) { bad.push(`${style}: swatch ${i + 1}/${n} has no box`); break; }
        if (!st.inCard) { bad.push(`${style}: swatch ${i + 1}/${n} sits ${st.past}px past the card's bottom edge (overflow-y:${st.overflowY})`); break; }
        if (!st.onTop) { bad.push(`${style}: swatch ${i + 1}/${n} is covered by something else`); break; }
      }
      // Then walk the rest of the journey: pick the LAST colour (the one
      // furthest down the grid) and make sure Continue is reachable after it.
      await page.locator('#preGenMugColorGrid .color-btn').nth(n - 1).click();
      await T(page, 1200);
    }

    const fin = await reach(page, '#preGenMugColorFinishBtn', null);
    if (fin.missing || !fin.h) bad.push(`${style}: no Continue button to press`);
    else if (!fin.inCard) bad.push(`${style}: Continue sits ${fin.past}px past the card's bottom edge (overflow-y:${fin.overflowY}) — the customer cannot reach it`);
    else if (!fin.onTop) bad.push(`${style}: Continue is covered by something else`);
  }

  if (bad.length) return `FAIL: ${bad.length} dead end(s) at 430x560 — ${bad.join('; ')}`;
  return `PASS: all ${styles.length} styles walk style -> every colour -> Continue with nothing out of reach on a 430x560 window`;
};
scenarios.everyStyleLeavesAReachableNextStepOnAShortWindow.viewport = { width: 430, height: 560 };

// ---- 8. And the card must never be a cage. ----
// The guard on the above: even with every programmatic scroll working, a
// customer who scrolls away by hand needs a way back. overflow-y:hidden on a
// height-capped card takes that away and depends on us never missing a beat.
scenarios.styleCardIsScrollableByHand = async (page) => {
  await toMugStyles(page);
  const ov = await page.evaluate(() => getComputedStyle(document.getElementById('mugStyleCard')).overflowY);
  if (ov === 'hidden' || ov === 'visible' || ov === 'clip')
    return `FAIL: #mugStyleCard is max-height:90vh with overflow-y:${ov} — content past the cap is unreachable and the customer has no scrollbar to recover with`;
  return `PASS: #mugStyleCard is overflow-y:${ov}, so the customer can always scroll to whatever is below the cap`;
};
scenarios.styleCardIsScrollableByHand.viewport = { width: 430, height: 620 };


// ---- 9. The mockup slot must actually show a mug. ----
// Alyx picked Classic White and got a white rectangle with one faint curve in
// it. The photo was fine; the slot's filter was not. It carries
// brightness(1.15) contrast(1.12) to lift Printify's dim mockups, and the
// Classic White product shot is a white mug on white with no dark pixels
// anywhere -- body 233, edge 219, shadow 237, all of which clip to 255.
//
// So this renders the slot to a canvas exactly as the browser paints it,
// filter included, and asks the only question that matters: is there still a
// mug in there? Measured as the share of pixels that are neither pure white
// nor near it. A blank rectangle scores ~0. Asserting on the filter STRING
// would pass any value that happens to be set, including the one that caused
// this, so it deliberately does not.
scenarios.theMockupSlotStillShowsAMug = async (page) => {
  await toMugStyles(page);
  const bad = [];
  const styles = await page.evaluate(() => Object.keys(PRE_GEN_MUG_STYLE_PRICES));
  for (const style of styles) {
    await page.locator(`#preGenMugStyleGrid .btn-select[data-style="${style}"]`).click();
    await T(page, 900);
    const n = await page.evaluate(() => document.querySelectorAll('#preGenMugColorGrid .color-btn').length);
    if (n) { await page.locator('#preGenMugColorGrid .color-btn').first().click(); await T(page, 1000); }
    const m = await page.evaluate(async () => {
      const img = document.getElementById('preGenMugMockupImg');
      if (!img || getComputedStyle(img).display === 'none') return { shown: false };
      if (!img.complete || !img.naturalWidth) {
        await new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 3000); });
      }
      if (!img.naturalWidth) return { shown: true, loaded: false };
      const c = document.createElement('canvas');
      c.width = 160; c.height = 160;
      const ctx = c.getContext('2d');
      // Paint through the SAME filter the page applies, so this measures what
      // the customer sees rather than what the source file contains.
      ctx.filter = getComputedStyle(img).filter === 'none' ? 'none' : getComputedStyle(img).filter;
      ctx.drawImage(img, 0, 0, 160, 160);
      const d = ctx.getImageData(0, 0, 160, 160).data;
      let ink = 0, total = 160 * 160;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.min(d[i], d[i + 1], d[i + 2]) < 245) ink++;
      }
      return { shown: true, loaded: true, inkPct: ink / total, filter: getComputedStyle(img).filter };
    });
    if (!m.shown) { bad.push(`${style}: no mockup shown at all`); continue; }
    if (!m.loaded) { bad.push(`${style}: mockup image never loaded`); continue; }
    // 5% is generous -- a real mug photo scores far higher, and the blown-out
    // Classic White scored 0.3%.
    if (m.inkPct < 0.05)
      bad.push(`${style}: only ${(m.inkPct * 100).toFixed(1)}% of the mockup is non-white — it renders as a blank rectangle (filter: ${m.filter})`);
  }
  if (bad.length) return `FAIL: ${bad.join('; ')}`;
  return `PASS: all ${styles.length} styles render a visible mug in the mockup slot`;
};


(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    // A scenario may pin its own window size. The freeze this suite exists
    // for was invisible at the default 1280x900 and fatal at 430x620, so
    // "it passed" has to mean "it passed at the size it broke at".
    const { browser, page, log } = await launch(fn.viewport ? { viewport: fn.viewport } : {});
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
  console.log(fails === 0 ? '\nALL MUG-STYLE VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
