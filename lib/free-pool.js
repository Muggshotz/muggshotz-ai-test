// lib/free-pool.js
//
// A FLYER'S FREE TRIES, PAYING THEIR OWN WAY (Alyx, 7 Oct 2026). A visitor who
// reaches a flyer page's "Got a better idea?" box gives an email address and
// gets two free tries (lib/card-bonus.js, a code with pool:'<flyer>'). Every
// try handed out is counted against THAT FLYER'S pool of 300, and every
// product bought from that flyer's page buys 50 of them back: "if a flyer is
// selling it pays for itself ... Every flyer must pay for its own keep." One
// flyer never pays for another. OVERPAYMENT EXPANDS THE LIMIT (Alyx, 7 Oct
// 2026, of his first sale at 2 handed out: "It's like a prepaid credit card
// that you paid too much in"): what a sale buys back beyond what was handed
// out is added to the pool's size, so a flyer that sells reads 0 of 348. A pool that runs dry closes and stays closed
// (the next day too) until a sale buys tries back or Alyx opens it again from
// the admin page for a fresh 300.
//
// It counts tries HANDED OUT (two per confirmed email), not pictures drawn: a
// try is spent money once it is given, and given is the moment we can still
// say no. Token packs buy nothing back (they are not on any flyer), nor do
// orders placed through the studio: only an order whose source names the
// flyer (api/create-checkout-session.js withSource: "halloween/door").
//
// Each flyer's state is one small JSON file in the generations bucket, in a
// folder of its own, so the admin storage cleanup (top-level files only) never
// touches it. Two verifications landing in the same instant could both read
// the same count; at worst a pool overshoots by a try or two, cheaper than a
// database table for it.
import { sendAlert } from "./alerts.js";
import { getProduct } from "./products-catalog.js";

// A PRODUCT CATEGORY'S FREE SPINS (Alyx, 7 Oct 2026: "each product can
// generate 25 free spins without a purchase, but every purchase buys back 30
// spins ... purchased products can help fund free spins for each individual
// category"). The same pool, keyed cat-<category> (the catalog's
// generatorIcon: mug, doormat, bottle ...), 25 deep, 30 back a sale -- and a
// sale past full goes into the pool's BANK instead of being lost, so a
// category that sells more than it hands out builds a surplus Alyx can move
// to one that needs the help (movePool, the admin page).
export const CATEGORY_POOL = { size: 25, credit: 30, bank: true };
// FIVE EACH, THEN THE LOTTERY (Alyx, 7 Oct 2026: "cap users off at five free
// spins. If you can't figure out what you want at 5 free spins then you're
// doing something wrong" -- but the surplus from the 30-against-25 disparity
// is first come, first served: "as long as there are spins available in the
// free pool, whoever makes the spin gets to use it"). A customer's first five
// free spins come from the category's pool; after that, only from its BANK,
// one at a time, while any are there. The count of free spins a device has
// had is a small file beside the pools.
export const FREE_SPIN_CAP = 5;
const usedUrl = (d) => `${SUPABASE_URL}/storage/v1/object/generations/flyer-free/used/${encodeURIComponent(String(d || "").slice(0, 80))}.json`;
export async function readFreeUsed(deviceId) {
  if (!SUPABASE_URL || !KEY || !deviceId) return 0;
  const resp = await fetch(usedUrl(deviceId), { headers: headers() });
  if (resp.status === 404 || resp.status === 400) return 0;
  if (!resp.ok) throw new Error(`Free-spin count unreadable: ${resp.status}`);
  return Number((await resp.json()).used) || 0;
}
export async function noteFreeSpin(deviceId) {
  const used = (await readFreeUsed(deviceId)) + 1;
  const resp = await fetch(usedUrl(deviceId), { method: "POST", headers: { ...headers(), "Content-Type": "application/json", "x-upsert": "true" }, body: JSON.stringify({ used, at: new Date().toISOString() }) });
  if (!resp.ok) throw new Error("Free-spin count could not be saved: " + await resp.text());
  return used;
}
/** One spin from the category's banked surplus, first come first served. False when the bank is empty. */
export async function takeFromBank(key, opts = CATEGORY_POOL) {
  const p = await readPool(key, opts);
  if (!((p.bank || 0) > 0)) return false;
  await writePool({ ...p, bank: p.bank - 1 });
  return true;
}
const CATEGORY_ALIASES = { "water bottle": "bottle" };   // the studio's name for the catalog's icon
export function categoryKey(name) {
  const n = String(name || "").toLowerCase().trim();
  return "cat-" + (CATEGORY_ALIASES[n] || n || "other");
}
/** The category pools a settled order feeds: one per item bought. */
export function saleCategories(metadata) {
  const keys = String(metadata?.product_keys || metadata?.product_key || "").split(",").map((k) => k.trim()).filter(Boolean);
  return keys.map((k) => getProduct(k)?.generatorIcon).filter(Boolean).map(categoryKey);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const POOL_SIZE = 300;
export const SALE_CREDIT = 50;
const flyerKey = (f) => String(f || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);
const poolUrl = (f) => `${SUPABASE_URL}/storage/v1/object/generations/flyer-free/${flyerKey(f)}.json`;
const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}` });

/** { flyer, given, size, open, openedAt, sales, bank }. A pool never written is open and empty. */
export async function readPool(flyer, opts = {}) {
  const fresh = { flyer: flyerKey(flyer), given: 0, size: opts.size || POOL_SIZE, open: true, openedAt: null, sales: 0, bank: 0 };
  if (!SUPABASE_URL || !KEY || !fresh.flyer) return fresh;
  const resp = await fetch(poolUrl(flyer), { headers: headers() });
  if (resp.status === 404 || resp.status === 400) return fresh;
  if (!resp.ok) throw new Error(`The free-try pool for ${fresh.flyer} could not be read: ${resp.status}`);
  return { ...fresh, ...(await resp.json()) };
}

async function writePool(p) {
  const resp = await fetch(poolUrl(p.flyer), {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json", "x-upsert": "true" },
    body: JSON.stringify(p)
  });
  if (!resp.ok) throw new Error(`The free-try pool for ${p.flyer} could not be saved: ` + await resp.text());
}

/** Room for n more tries right now? */
export function poolHasRoom(p, n) {
  return !!p.open && p.given + n <= p.size;
}

/**
 * Takes n tries from a flyer's pool. True if they were given; false if the
 * pool is closed or too low -- and then it closes, so the page stops offering
 * them, and Alyx's phone hears about it once.
 */
export async function takeFromPool(flyer, n, opts = {}) {
  const p = await readPool(flyer, opts);
  if (!poolHasRoom(p, n)) {
    if (p.open) { await writePool({ ...p, open: false }); await closedAlert(p); }
    return false;
  }
  const given = p.given + n, open = given + n <= p.size;
  await writePool({ ...p, given, open });
  if (!open) await closedAlert({ ...p, given });
  return true;
}

/**
 * A sale: tries back into the pool (50 for a flyer, 30 for a category). What
 * is left over once the pool is full is never lost: a category banks it (its
 * lottery, api/generate.js), a flyer's pool grows by it.
 */
export async function creditPool(flyer, opts = {}) {
  const n = opts.credit || SALE_CREDIT;
  const p = await readPool(flyer, opts);
  const over = Math.max(0, n - p.given);
  const given = Math.max(0, p.given - n);
  const bank = (p.bank || 0) + (opts.bank ? over : 0);
  const size = opts.bank ? p.size : p.size + over;
  const next = { ...p, given, bank, size, sales: (p.sales || 0) + 1, open: p.open || given + 1 <= size };
  await writePool(next);
  return next;
}

/** Alyx's switch: open again with a fresh 300 (a grown limit starts over too). */
export async function reopenPool(flyer, opts = {}) {
  const p = { ...(await readPool(flyer, opts)), given: 0, size: opts.size || POOL_SIZE, open: true, openedAt: new Date().toISOString() };
  await writePool(p);
  return p;
}

/** Banked surplus moved from one category's pool to another: n spins, no more than the bank holds. */
export async function movePool(from, to, n, opts = CATEGORY_POOL) {
  n = Math.floor(Number(n)); if (!(n > 0)) throw new Error("How many spins to move?");
  const a = await readPool(from, opts), b = await readPool(to, opts);
  if (a.flyer === b.flyer) throw new Error("Pick two different categories.");
  if ((a.bank || 0) < n) throw new Error(`${a.flyer} has only ${a.bank || 0} spare spins banked.`);
  const given = Math.max(0, b.given - n), bank = (b.bank || 0) + Math.max(0, n - b.given);
  await writePool({ ...a, bank: a.bank - n });
  const next = { ...b, given, bank, open: b.open || given + 1 <= b.size };
  await writePool(next);
  return next;
}

// THE ALERT (Alyx, 7 Oct 2026: "send me an alert which specifically tells me
// that the 300 has been reached ... I can opt whether to extend it or not").
// On the ideas channel, so it is a cuckoo and not a cash register; it can
// never fail the thing that fired it.
async function closedAlert(p) {
  try {
    await sendAlert("idea", `${p.flyer} flyer: free tries used up`,
      `All ${p.size} free tries for the ${p.flyer} flyer have been handed out (${p.sales || 0} sale${p.sales === 1 ? "" : "s"} so far). The box now offers token packs. A sale buys 50 back; or open it for another ${p.size} on the admin page.`);
  } catch (e) { console.warn("Pool alert not sent:", e.message); }
}
