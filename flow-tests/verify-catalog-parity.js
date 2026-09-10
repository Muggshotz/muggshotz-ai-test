// THE ORDER PAGE KEEPS ITS OWN COPY OF EVERY PRODUCT, and copies drift.
//
// order.html carries hand-maintained mirrors of lib/products-catalog.js --
// prices, sizes, colour lists -- because it renders them without a build
// step. Two drifts were found in one pass on 10 Sep 2026:
//
//   * the Tundra's copy still said `colors: null` after the cup gained three
//     colours. The studio offered White, the order page never asked, and the
//     server's resolver throws "A color selection is required" for any
//     product with a colour list -- in the webhook, AFTER payment. Paid, and
//     no order placed.
//   * five coloured-mug lists lacked Cambridge Blue, which the studio offers.
//
// Other suites' comments refer to a verify-price-parity.js that no longer
// exists. This is its replacement, and it is wider: not only prices, but
// every size and every colour NAME, for every product on the page. Static --
// no browser -- so it is cheap enough to never skip.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'order.html'), 'utf8');
// The studio keeps copies of its own -- a drift THERE is what puts a colour
// on offer that the order page has never heard of.
const studio = fs.readFileSync(path.join(ROOT, 'needles-studio.html'), 'utf8');

// Pull `const NAME = {...};` / `[...]` out of a page by brace matching,
// skipping strings and line comments, and evaluate it in isolation.
function extract(name, from = src) {
  const m = new RegExp('const ' + name + ' = ([\\[{])').exec(from);
  if (!m) throw new Error(`no const ${name} in that file`);
  let i = m.index + m[0].length - 1, depth = 0, j = i, instr = null;
  while (j < from.length) {
    const c = from[j];
    if (instr) { if (c === '\\') { j += 2; continue; } if (c === instr) instr = null; }
    else if (c === '"' || c === "'" || c === '`') instr = c;
    else if (from.startsWith('//', j)) { j = from.indexOf('\n', j); continue; }
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return new Function('return ' + from.slice(i, j + 1))(); }
    j++;
  }
  throw new Error(`unterminated const ${name}`);
}
const num = (name) => parseFloat(new RegExp('const ' + name + ' = ([\\d.]+)').exec(src)[1]);

const names = (cols) => (cols || []).map((c) => c.name).sort();
const firstSize = (p) => Object.values(p.sizes || {})[0] || {};

(async () => {
  const { PRODUCTS_CATALOG: cat } = await import(path.join(ROOT, 'lib', 'products-catalog.js'));
  const O = {
    MUG_STYLES: extract('MUG_STYLES'), TRAVEL: extract('TRAVEL_MUG_CATALOG'),
    POSTER: extract('PHOTO_POSTER_CATALOG'), PUZZLE: extract('PUZZLE_SIZES'),
    SUITCASE: extract('SUITCASE_SIZES'), TOTE: extract('TOTE_BAG_SIZES'),
    STYLE_KEY: extract('MUG_STYLE_TO_PRODUCT_KEY'),
    COASTER: num('COASTER_PRICE'), MOUSE_PAD: num('MOUSE_PAD_PRICE'),
    CARD: num('GREETING_CARD_PRICE'), POST_IT: num('POST_IT_PRICE'), PHONE: num('PHONE_CASE_PRICE'),
  };

  const scenarios = {};
  const drift = (list, label, a, b) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) list.push(`${label}: order.html=${JSON.stringify(a)} catalog=${JSON.stringify(b)}`);
  };

  scenarios.travelCupsMatch = () => {
    const bad = [];
    for (const [key, o] of Object.entries(O.TRAVEL)) {
      const c = cat[key];
      if (!c) { bad.push(`${key} is on the order page but not in the catalog`); continue; }
      drift(bad, `${key} price`, o.price, c.price ?? firstSize(c).price);
      drift(bad, `${key} colours`, names(o.colors), names(c.colors));
      drift(bad, `${key} layout`, o.layoutType, c.layoutType);
    }
    for (const key of Object.keys(cat).filter((k) => k.startsWith('travel-mug-')))
      if (!O.TRAVEL[key]) bad.push(`${key} is in the catalog but not on the order page`);
    return bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: ${Object.keys(O.TRAVEL).length} travel cups match on price, layout and colour names`;
  };

  scenarios.mugStylesMatch = () => {
    const bad = []; let n = 0;
    for (const [style, key] of Object.entries(O.STYLE_KEY)) {
      const c = cat[key], o = O.MUG_STYLES[style];
      if (!c || !o) { bad.push(`style ${style} -> ${key}: missing on one side`); continue; }
      for (const [size, os] of Object.entries(o.sizes || {})) {
        const cs = (c.sizes || {})[size];
        if (!cs) { bad.push(`${key} ${size}: on the order page, not in the catalog`); continue; }
        n++;
        drift(bad, `${key} ${size} price`, os.price, cs.price);
        drift(bad, `${key} ${size} colours`, names(os.colors), names(cs.colors));
      }
    }
    return bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: ${n} mug style/size entries match on price and colour names`;
  };

  scenarios.sizedProductsMatch = () => {
    const bad = [];
    for (const [size, o] of Object.entries(O.TOTE)) {
      const cs = (cat['tote-bag'].sizes || {})[size];
      if (!cs) { bad.push(`tote ${size}: not in the catalog`); continue; }
      drift(bad, `tote-bag ${size} price`, o.price, cs.price);
      drift(bad, `tote-bag ${size} colours`, names(o.colors), names(cs.colors || cat['tote-bag'].colors));
    }
    for (const [size, o] of Object.entries(O.PUZZLE)) drift(bad, `photo-puzzle ${size} price`, o.price, (cat['photo-puzzle'].sizes[size] || {}).price);
    for (const [size, o] of Object.entries(O.SUITCASE)) drift(bad, `suitcase ${size} price`, o.price, (cat['suitcase'].sizes[size] || {}).price);
    for (const [size, o] of Object.entries(O.POSTER.base.sizes)) drift(bad, `photo-poster ${size} price`, o.price, (cat['photo-poster'].base.sizes[size] || {}).price);
    return bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS: tote, puzzle, suitcase and poster sizes match on price and colours';
  };

  scenarios.flatPricesMatch = () => {
    const bad = [];
    drift(bad, 'coaster-set price', O.COASTER, firstSize(cat['coaster-set']).price);
    drift(bad, 'coaster-set-round price (page uses COASTER_PRICE)', O.COASTER, firstSize(cat['coaster-set-round']).price);
    drift(bad, 'mouse-pad price', O.MOUSE_PAD, firstSize(cat['mouse-pad']).price);
    drift(bad, 'greeting-card price', O.CARD, firstSize(cat['greeting-card']).price);
    drift(bad, 'post-it-notes price', O.POST_IT, firstSize(cat['post-it-notes']).price);
    const pc = cat['phone-case-tough'];
    drift(bad, 'phone-case-tough price', O.PHONE, pc.price ?? firstSize(pc).price);
    return bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS: the six flat prices match the catalog';
  };

  // ---- The studio's own copies. ----
  const S = {
    GEN: extract('GEN_MUG_STYLES', studio),
    TRAVEL: extract('TRAVEL_MUG_CATALOG', studio),
    TOTE_COLOURS: extract('TOTE_BAG_COLORS_GEN', studio),
  };

  scenarios.studioMugColoursMatch = () => {
    const bad = []; let n = 0;
    for (const [style, key] of Object.entries(O.STYLE_KEY)) {
      const g = S.GEN[style], c = cat[key];
      if (!g || !c) { bad.push(`studio style ${style} -> ${key}: missing on one side`); continue; }
      for (const [size, cols] of Object.entries(g.colors || {})) {
        const cs = (c.sizes || {})[size];
        if (!cs) { bad.push(`${key} ${size}: offered in the studio, not in the catalog`); continue; }
        n++;
        drift(bad, `studio ${key} ${size} colours`, names(cols), names(cs.colors));
      }
    }
    return bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: the studio's ${n} mug style/size colour lists match the catalog`;
  };

  scenarios.studioTravelCupsMatch = () => {
    const bad = [];
    for (const [key, o] of Object.entries(S.TRAVEL)) {
      const c = cat[key];
      if (!c) { bad.push(`${key} is in the studio but not in the catalog`); continue; }
      drift(bad, `studio ${key} colours`, names(o.colors), names(c.colors));
      drift(bad, `studio ${key} layout`, o.layoutType, c.layoutType);
      drift(bad, `studio ${key} sizeLabel`, o.sizeLabel, c.sizeLabel ?? Object.keys(c.sizes || {})[0]);
    }
    for (const key of Object.keys(cat).filter((k) => k.startsWith('travel-mug-')))
      if (!S.TRAVEL[key]) bad.push(`${key} is in the catalog but not offered in the studio`);
    return bad.length ? `FAIL: ${bad.join('; ')}` : `PASS: the studio's ${Object.keys(S.TRAVEL).length} travel cups match the catalog on colours, layout and size`;
  };

  scenarios.studioToteColoursMatch = () => {
    const bad = [];
    const want = names(cat['tote-bag'].colors || firstSize(cat['tote-bag']).colors);
    drift(bad, 'studio tote colours', names(S.TOTE_COLOURS), want);
    for (const [size, cs] of Object.entries(cat['tote-bag'].sizes || {}))
      if (cs.colors) drift(bad, `studio tote colours vs catalog ${size}`, names(S.TOTE_COLOURS), names(cs.colors));
    return bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS: the studio\'s tote colour list matches the catalog for every size';
  };

  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    let r; try { r = fn(); } catch (e) { r = `ERROR: ${String(e).split('\n')[0]}`; }
    console.log(`[${name}] ${r}`);
    if (!/^PASS/.test(r)) fails++;
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL CATALOG-PARITY VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
