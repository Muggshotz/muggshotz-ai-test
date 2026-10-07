// lib/free-pool.js
//
// A FLYER'S FREE TRIES, PAYING THEIR OWN WAY (Alyx, 7 Oct 2026). A visitor who
// reaches a flyer page's "Got a better idea?" box gives an email address and
// gets two free tries (lib/card-bonus.js, a code with pool:'<flyer>'). Every
// try handed out is counted against THAT FLYER'S pool of 300, and every
// product bought from that flyer's page buys 50 of them back: "if a flyer is
// selling it pays for itself ... Every flyer must pay for its own keep." One
// flyer never pays for another. A pool that runs dry closes and stays closed
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const POOL_SIZE = 300;
export const SALE_CREDIT = 50;
const flyerKey = (f) => String(f || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
const poolUrl = (f) => `${SUPABASE_URL}/storage/v1/object/generations/flyer-free/${flyerKey(f)}.json`;
const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}` });

/** { flyer, given, size, open, openedAt, sales }. A pool never written is open and empty. */
export async function readPool(flyer) {
  const fresh = { flyer: flyerKey(flyer), given: 0, size: POOL_SIZE, open: true, openedAt: null, sales: 0 };
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
export async function takeFromPool(flyer, n) {
  const p = await readPool(flyer);
  if (!poolHasRoom(p, n)) {
    if (p.open) { await writePool({ ...p, open: false }); await closedAlert(p); }
    return false;
  }
  const given = p.given + n, open = given + n <= p.size;
  await writePool({ ...p, given, open });
  if (!open) await closedAlert({ ...p, given });
  return true;
}

/** A product sold from the flyer's page: 50 tries back, never past a full pool. */
export async function creditPool(flyer, n = SALE_CREDIT) {
  const p = await readPool(flyer);
  const given = Math.max(0, p.given - n);
  const next = { ...p, given, sales: (p.sales || 0) + 1, open: p.open || given + 2 <= p.size };
  await writePool(next);
  return next;
}

/** Alyx's switch: open again with a fresh 300. */
export async function reopenPool(flyer) {
  const p = { ...(await readPool(flyer)), given: 0, size: POOL_SIZE, open: true, openedAt: new Date().toISOString() };
  await writePool(p);
  return p;
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
