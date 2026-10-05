// lib/visits.js
//
// THE VISITOR COUNT (Alyx, 5 Oct 2026). Each public page sends one note per
// browser per day (count-visit.js); api/visit.js hands it here, and this adds
// it to that day's row in page_visits (supabase/page-visits.sql). admin.html
// reads the rows back through api/admin.js (action "visits").
//
// Counted: people. Not counted: Alyx (his browsers are marked as staff the
// moment he unlocks admin.html, and count-visit.js sends nothing from them),
// our own automated tests (they run headless, on 127.0.0.1), and anything
// that says it is a robot. Nothing about who is stored: a page, a source tag,
// a day and two numbers.
//
// NEVER THROWS. A visitor must never see an error because a count failed.

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The pages the site sends: the studio, checkout, the beta start page, the gift
// page, and any occasion page by its key (halloween, ...).
const PAGE = /^[a-z][a-z0-9-]{1,29}$/;
// The flyer's ?from= tag: door, wall, ... ('' for none).
const SOURCE = /^[a-z0-9][a-z0-9_\/-]{0,39}$/;
// Search engines, link previews, uptime checkers, scripts and headless
// browsers (our own test runs among them).
const ROBOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\//i;

export function isRobot(userAgent) {
  return !userAgent || ROBOT.test(String(userAgent));
}

// The visit's day as the visitor's own browser saw it (YYYY-MM-DD), so "today"
// means the same day it does to you; held within a day of the server's own
// clock either side, so a wrong or made-up date cannot land anywhere else.
export function visitDay(day, now = new Date()) {
  const s = String(day || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s + 'T12:00:00Z');
  if (!Number.isFinite(t) || Math.abs(t - now.getTime()) > 36 * 3600 * 1000) return null;
  return s;
}

// The note, checked and tidied: { day, page, source, isNew } or null.
export function cleanVisit(body, now = new Date()) {
  const b = body && typeof body === 'object' ? body : {};
  const page = String(b.page || '').toLowerCase();
  if (!PAGE.test(page)) return null;
  const day = visitDay(b.day, now);
  if (!day) return null;
  let source = String(b.source || '').toLowerCase().trim();
  if (source && !SOURCE.test(source)) source = 'other';
  return { day, page, source, isNew: b.isNew === true };
}

// Adds the visit. Returns true when it was counted.
export async function recordVisit(body, userAgent, now = new Date()) {
  try {
    if (isRobot(userAgent)) return false;
    const v = cleanVisit(body, now);
    if (!v || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/count_visit`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_day: v.day, p_page: v.page, p_source: v.source, p_new: v.isNew })
    });
    if (!resp.ok) { console.error('Visit count failed:', resp.status, (await resp.text()).slice(0, 300)); return false; }
    return true;
  } catch (err) {
    console.error('Visit count failed:', err.message);
    return false;
  }
}
