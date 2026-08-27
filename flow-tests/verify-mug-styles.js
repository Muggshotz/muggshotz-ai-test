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
  const st = await page.evaluate(() => ({
    colourWrapShown: getComputedStyle(document.getElementById('preGenMugColorWrap')).display !== 'none',
    finishShown: getComputedStyle(document.getElementById('preGenMugColorFinishBtn')).display !== 'none',
    chosen: mugColorChosenPreGen,
    colour: selectedGenColor,
  }));
  if (st.colourWrapShown) return 'FAIL: a colour grid is showing for a mug that has no colours';
  if (!st.finishShown) return 'FAIL: no Continue button — picking Classic White strands the customer with nothing to click';
  if (st.chosen !== true) return 'FAIL: mugColorChosenPreGen is false, so the rail thinks a choice is still outstanding';
  if (st.colour !== null) return `FAIL: selectedGenColor is ${JSON.stringify(st.colour)} for a colourless style`;

  // And it must actually carry through to a product key, not just look right.
  await page.evaluate(() => finishPreGenMugColorPick());
  await T(page, 900);
  const key = await page.evaluate(() => GEN_STYLE_TO_PRODUCT_KEY[selectedGenStyle]);
  if (key !== 'classic-white-mug') return `FAIL: Classic White maps to ${key}`;
  return 'PASS: a colourless style proceeds cleanly and maps to classic-white-mug';
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
  console.log(fails === 0 ? '\nALL MUG-STYLE VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
