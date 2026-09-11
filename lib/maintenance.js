// lib/maintenance.js
//
// The kill switch. One flag in Supabase that stops the shop taking money.
//
// Why it lives here and not in an environment variable: a Vercel env var
// needs a redeploy to change, which is minutes and a laptop. This is a row,
// so admin.html can flip it from a phone in seconds. When the generator
// starts producing bad print files you want the cord within reach, not
// behind a build.
//
// Why the check is server-side: order.html is a static asset and the site
// installs as a standalone app, so a stale cached page will happily keep
// posting to the checkout endpoint after you have "turned it off." Hiding
// the button is grace, not control. The refusal has to happen where the
// Stripe session is created.
//
// FAILS OPEN, deliberately, and this is the opposite of what
// calculateShippingCharge does. That one guards money on every single
// order, so a failed lookup must stop the sale. This one is an exceptional
// state that is off virtually always, so a Supabase hiccup must NOT take
// the shop down on its own. Unreachable means "not in maintenance."

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_MESSAGE = "We've taken the studio down for a short repair. Nothing you made is lost.";

const OFF = Object.freeze({ on: false, message: "", eta: "" });

function headers() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

/**
 * Current maintenance state. Never throws — every failure path returns OFF
 * so that an outage in Supabase cannot close the shop by itself.
 */
export async function readMaintenance() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return OFF;

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=maintenance_mode,maintenance_message,maintenance_eta`,
      { headers: headers() }
    );
    if (!resp.ok) {
      // Table not created yet is the common case here, and it means the
      // switch has never been armed. Selling is the correct behaviour.
      console.error("Maintenance flag unreadable (failing open, shop stays up):", resp.status);
      return OFF;
    }
    const rows = await resp.json();
    if (!Array.isArray(rows) || !rows.length) return OFF;

    const row = rows[0];
    if (row.maintenance_mode !== true) return OFF;

    return {
      on: true,
      message: (row.maintenance_message || "").trim() || DEFAULT_MESSAGE,
      eta: (row.maintenance_eta || "").trim()
    };
  } catch (err) {
    console.error("Maintenance flag errored (failing open, shop stays up):", err.message);
    return OFF;
  }
}

/**
 * Set the flag. Throws on failure — unlike the read, a write that silently
 * did nothing would leave you believing the shop is closed while it sells.
 */
export async function writeMaintenance({ on, message, eta }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured, so the maintenance switch cannot be set.");
  }

  const patch = { maintenance_mode: !!on, updated_at: new Date().toISOString() };
  if (typeof message === "string") patch.maintenance_message = message.slice(0, 500);
  if (typeof eta     === "string") patch.maintenance_eta     = eta.slice(0, 200);

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.1`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });

  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`Could not set the maintenance flag: ${JSON.stringify(body)}`);
  }
  if (!Array.isArray(body) || !body.length) {
    throw new Error("Maintenance row is missing — run supabase/site-settings.sql first.");
  }

  const row = body[0];
  return {
    on: row.maintenance_mode === true,
    message: row.maintenance_message || "",
    eta: row.maintenance_eta || ""
  };
}
