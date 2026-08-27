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
  ? `FAIL: on the studio grid but order.html has no branch: ${missing.join(', ')} — would be priced as a MUG`
  : `PASS: every orderable studio product has an order.html branch (${gridVals.length} on the grid)`);

let fails = 0;
for (const c of checks) { console.log('[price-parity] ' + c); if (/^FAIL/.test(c)) fails++; }
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PRICE-PARITY VERIFICATIONS PASSED');
process.exit(fails ? 1 : 0);
