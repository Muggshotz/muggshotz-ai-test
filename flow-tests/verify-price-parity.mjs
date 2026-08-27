// order.html keeps its OWN copy of every price -- PHONE_CASE_PRICE,
// PUZZLE_SIZES, SUITCASE_SIZES, TOTE_BAG_SIZES, COASTER_PRICE, MOUSE_PAD_PRICE
// -- entirely separate from lib/products-catalog.js, which is what the SERVER
// charges from (create-checkout-session.js reads the catalog, not this page).
//
// So a price changed in one place and not the other shows the customer one
// number and bills them another. That is exactly what happened when phone
// cases moved to $19.95: the catalog changed, order.html still said $24.95.
//
// This is a pure file-comparison check -- no browser needed.
// ESM: the repo's package.json sets "type": "module", so no require() here.
// .mjs ON PURPOSE. This is the one suite written as an ES module; every
// other test here is CommonJS, and flow-tests/package.json pins the folder
// to commonjs so those keep working under the repo root's "type": "module".
// The extension is what exempts this file from that pin -- renaming it back
// to .js breaks it with "Cannot use import statement outside a module".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const order = fs.readFileSync(path.join(ROOT, 'order.html'), 'utf8');


// Extract the balanced { ... } block that follows `anchor`, so parsing can
// never bleed into whatever is declared next. Size keys can contain ESCAPED
// quotes ("4\" x 4\""), so the key pattern has to allow them.
function blockAfter(src, anchor) {
  const i = src.indexOf(anchor);
  if (i < 0) return null;
  const start = src.indexOf('{', i);
  if (start < 0) return null;
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}

const KEYED_PRICE = /"((?:[^"\\]|\\.)*)":\s*\{\s*variantId:\s*\d+,\s*price:\s*([0-9.]+)/g;
const unesc = (k) => k.replace(/\\"/g, '"');

function catalogPrices(key) {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'products-catalog.js'), 'utf8');
  const block = blockAfter(src, `"${key}":`);
  if (!block) return null;
  const sizes = blockAfter(block, 'sizes:');
  if (!sizes) return null;
  const out = {};
  for (const m of sizes.matchAll(KEYED_PRICE)) out[unesc(m[1])] = parseFloat(m[2]);
  return out;
}

function orderTable(name) {
  const block = blockAfter(order, `const ${name}`);
  if (!block) return null;
  const out = {};
  for (const m of block.matchAll(/"((?:[^"\\]|\\.)*)":\s*\{[^{}]*?price:\s*([0-9.]+)/g)) {
    out[unesc(m[1])] = parseFloat(m[2]);
  }
  return out;
}

const checks = [];

// --- flat, single-variant products -----------------------------------------
for (const [label, constName, catalogKey] of [
  ['phone case', 'PHONE_CASE_PRICE', 'phone-case-tough'],
  ['coasters',   'COASTER_PRICE',    'coaster-set'],
  ['mouse pad',  'MOUSE_PAD_PRICE',  'mouse-pad'],
]) {
  const m = order.match(new RegExp(`const ${constName}\\s*=\\s*([0-9.]+)`));
  if (!m) { checks.push(`FAIL: ${label}: ${constName} not found in order.html`); continue; }
  const onPage = parseFloat(m[1]);
  const cat = catalogPrices(catalogKey);
  if (!cat) { checks.push(`FAIL: ${label}: "${catalogKey}" not in the catalog`); continue; }
  const catVals = [...new Set(Object.values(cat))];
  if (catVals.length !== 1) {
    checks.push(`FAIL: ${label}: catalog has ${catVals.length} distinct prices (${catVals.join(', ')}) but order.html uses one flat ${constName}`);
    continue;
  }
  if (catVals[0] !== onPage) {
    checks.push(`FAIL: ${label}: order.html says $${onPage}, catalog says $${catVals[0]} — customer sees one price, server bills the other`);
  } else {
    checks.push(`PASS: ${label}: $${onPage} matches the catalog`);
  }
}

// --- per-size tables --------------------------------------------------------
for (const [label, tableName, catalogKey] of [
  ['puzzle',   'PUZZLE_SIZES',   'photo-puzzle'],
  ['suitcase', 'SUITCASE_SIZES', 'suitcase'],
]) {
  const onPage = orderTable(tableName);
  if (!onPage) { checks.push(`FAIL: ${label}: ${tableName} not found`); continue; }
  const cat = catalogPrices(catalogKey);
  let bad = null;
  for (const [size, price] of Object.entries(onPage)) {
    if (cat[size] === undefined) { bad = `${size} exists on order.html but not in the catalog`; break; }
    if (cat[size] !== price) { bad = `${size}: order.html $${price} vs catalog $${cat[size]}`; break; }
  }
  if (!bad) {
    for (const size of Object.keys(cat)) {
      if (onPage[size] === undefined) { bad = `${size} is in the catalog but missing from order.html`; break; }
    }
  }
  checks.push(bad ? `FAIL: ${label}: ${bad}` : `PASS: ${label}: all ${Object.keys(onPage).length} sizes match the catalog`);
}

// --- posters: nested under base.sizes, and duplicated in THREE places -------
// (lib/products-catalog.js, needles-studio.html, order.html)
{
  const catSrc = fs.readFileSync(path.join(ROOT, 'lib', 'products-catalog.js'), 'utf8');
  const studio = fs.readFileSync(path.join(ROOT, 'needles-studio.html'), 'utf8');

  const pull = (src, anchorText) => {
    const blk = blockAfter(src, anchorText);
    if (!blk) return null;
    const base = blockAfter(blk, 'base:');
    if (!base) return null;
    const sizes = blockAfter(base, 'sizes:');
    if (!sizes) return null;
    const out = {};
    for (const m of sizes.matchAll(/"((?:[^"\\]|\\.)*)":\s*\{[^{}]*?price:\s*([0-9.]+)/g)) {
      out[unesc(m[1])] = parseFloat(m[2]);
    }
    return out;
  };

  const fromCatalog = pull(catSrc, '"photo-poster":');
  const fromStudio  = pull(studio, 'const PHOTO_POSTER_CATALOG');
  const fromOrder   = pull(order,  'const PHOTO_POSTER_CATALOG');

  if (!fromCatalog || !fromStudio || !fromOrder) {
    checks.push('FAIL: poster: could not read one of the three poster tables');
  } else {
    let bad = null;
    const keys = new Set([...Object.keys(fromCatalog), ...Object.keys(fromStudio), ...Object.keys(fromOrder)]);
    for (const k of keys) {
      const a = fromCatalog[k], b = fromStudio[k], c = fromOrder[k];
      if (a === undefined || b === undefined || c === undefined) { bad = `${k} missing from one of the three tables (catalog=${a} studio=${b} order=${c})`; break; }
      if (!(a === b && b === c)) { bad = `${k}: catalog $${a}, studio $${b}, order $${c}`; break; }
    }
    checks.push(bad ? `FAIL: poster: ${bad}` : `PASS: poster: all ${keys.size} sizes agree across catalog, studio and order page`);
  }

  // Frames are gone. Nothing should still offer them.
  const framedStillOffered =
    studio.includes("pickPosterFramed(true)") ||
    /framedUpsell:\s*\{/.test(catSrc.slice(catSrc.indexOf('"photo-poster":'), catSrc.indexOf('"photo-poster":') + 4000));
  checks.push(framedStillOffered
    ? 'FAIL: poster: the framed option is still reachable — the frame cost 50x the print'
    : 'PASS: poster: framed upsell fully removed');
}

// --- travel cups: the studio and the order page must offer the SAME cups ---
// order.html builds its travel-cup tiles from its OWN TRAVEL_MUG_CATALOG, and
// selectedTravelProductKey starts null there -- it is only set by clicking a
// tile on that page. So a cup the studio sells but this table omits does not
// error: the customer arrives, finds their cup simply absent, and picks a
// different one. A silent substitution, charged correctly, for a product they
// never chose. The 32oz Gator and the 30oz Tundra were in exactly that state.
{
  const catSrc = fs.readFileSync(path.join(ROOT, 'lib', 'products-catalog.js'), 'utf8');
  const travelKeys = [...new Set([...catSrc.matchAll(/"(travel-mug-[a-z0-9-]+)":\s*\{/g)].map(m => m[1]))];

  // Read the studio locally: the shared `studio` const is declared further
  // down this file, so touching it here is a temporal-dead-zone error.
  const studioSrc = fs.readFileSync(path.join(ROOT, 'needles-studio.html'), 'utf8');
  const studioBlock = blockAfter(studioSrc, 'const TRAVEL_MUG_CATALOG');
  const orderBlock = blockAfter(order, 'const TRAVEL_MUG_CATALOG');
  const keysIn = (b) => b ? [...new Set([...b.matchAll(/"(travel-mug-[a-z0-9-]+)":\s*\{/g)].map(m => m[1]))] : [];
  const studioKeys = keysIn(studioBlock);
  const orderKeys = keysIn(orderBlock);

  if (!studioBlock || !orderBlock) {
    checks.push('FAIL: travel cups: could not read TRAVEL_MUG_CATALOG from the studio or the order page');
  } else {
    const absent = studioKeys.filter(k => !orderKeys.includes(k));
    checks.push(absent.length
      ? `FAIL: travel cups: sold in the studio, absent from order.html: ${absent.join(', ')} — the customer's cup silently vanishes at checkout`
      : `PASS: travel cups: all ${studioKeys.length} studio cups exist on the order page`);

    const notInCatalog = studioKeys.filter(k => !travelKeys.includes(k));
    checks.push(notInCatalog.length
      ? `FAIL: travel cups: no server catalog entry for ${notInCatalog.join(', ')} — the order would throw`
      : `PASS: travel cups: every studio cup has a server catalog entry`);

    // Price agreement, catalog vs order page. The catalog nests price under
    // sizes[<sizeLabel>]; the order page keeps a flat `price` per cup.
    let bad = null;
    for (const k of studioKeys) {
      if (!orderKeys.includes(k) || !travelKeys.includes(k)) continue;
      const catBlock = blockAfter(catSrc, `"${k}":`);
      const sizes = catBlock && blockAfter(catBlock, 'sizes:');
      const catPrice = sizes && sizes.match(/price:\s*([0-9.]+)/);
      const ordEntry = blockAfter(orderBlock.slice(orderBlock.indexOf(`"${k}":`)), `"${k}":`);
      const ordPrice = ordEntry && ordEntry.match(/price:\s*([0-9.]+)/);
      if (!catPrice || !ordPrice) { bad = `${k}: could not read a price from one side`; break; }
      if (parseFloat(catPrice[1]) !== parseFloat(ordPrice[1])) {
        bad = `${k}: catalog $${catPrice[1]}, order page $${ordPrice[1]}`; break;
      }
    }
    checks.push(bad
      ? `FAIL: travel cups: ${bad}`
      : `PASS: travel cups: every price agrees between the catalog and the order page`);
  }
}

// --- every studio product must be orderable --------------------------------
const studio = fs.readFileSync(path.join(ROOT, 'needles-studio.html'), 'utf8');
const gridVals = [...new Set([...studio.matchAll(/data-val="([^"]+)"[^>]*onclick="pick\(this,'product'\)"/g)].map(m => m[1]))];
const NOT_YET_ORDERABLE = ['greeting card', 'post-it note'];  // on the grid, no catalog entry yet
const missing = gridVals.filter(v =>
  !NOT_YET_ORDERABLE.includes(v) &&
  !order.includes(`selectedProductFamily === '${v}'`) &&
  v !== 'mug' && v !== 'water bottle'
);
checks.push(missing.length
  ? `FAIL: on the studio grid but order.html has no PRICING branch: ${missing.join(', ')} — would be priced as a MUG`
  : `PASS: every orderable studio product has an order.html pricing branch (${gridVals.length} on the grid)`);

// --- and a CHECKOUT branch, which is a different chain entirely -----------
// The check above only proves a product can be PRICED. order.html builds the
// checkout payload in a second, separate if/else chain, and coasters and
// mouse pads were missing from it: they priced correctly, showed a correct
// summary, and then fell through to the final else -- the MUG branch -- so
// the order that reached Printify was a mug. The customer paid for coasters
// and would have received a mug. Passing the pricing check is not evidence
// of anything about checkout.
{
  const payloadStart = order.indexOf('async function submitOrder') >= 0
    ? order.indexOf('async function submitOrder')
    : order.indexOf('type: \'mug_order\'');
  const payloadChain = order.slice(payloadStart);
  const FAMILY_GUARD = {
    'coaster': 'isCoaster()',
    'mouse pad': 'isMousePad()',
    'puzzle': 'isPuzzle()',
    'tote bag': 'isToteBag()',
    'suitcase': 'isSuitcase()',
    'phone case': 'isPhoneCase()',
    'photo poster': 'isPhotoPoster()',
  };
  const noCheckout = Object.entries(FAMILY_GUARD)
    .filter(([, guard]) => !payloadChain.includes(guard))
    .map(([fam]) => fam);
  checks.push(noCheckout.length
    ? `FAIL: no CHECKOUT branch in order.html for: ${noCheckout.join(', ')} — these fall through to the mug branch and order a MUG`
    : `PASS: every product family has its own checkout branch, not just a price`);
}

let fails = 0;
for (const c of checks) { console.log('[price-parity] ' + c); if (/^FAIL/.test(c)) fails++; }
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PRICE-PARITY VERIFICATIONS PASSED');
process.exit(fails ? 1 : 0);
