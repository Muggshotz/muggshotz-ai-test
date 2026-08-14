// Merged admin endpoint (July 2026): combines what used to be two
// separate files — admin-lookup.js and admin-tokens.js — into one,
// because Vercel's Hobby plan caps a project at 12 serverless
// functions, and having them as two separate files pushed this project
// to 13 and broke deployment. Routes by an `action` field in the
// request body, same pattern create-checkout-session.js already uses
// to handle its own three different jobs in one file.
//
// UPDATED (July 2026): printify-proxy.js merged in as a fourth job
// (action: "printify-catalog") for the same reason — it briefly pushed
// the project back over the 12-function cap on its own. It's a GET-only
// job like the others are POST-only, so it's routed by HTTP method
// first, before the action-field routing kicks in for POST requests.
const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRINTIFY_API_TOKEN        = process.env.PRINTIFY_API_TOKEN;

// HARDENED (July 2026): previously this password lived in plain text
// inside admin.html's own JavaScript — visible to anyone who viewed the
// page source, no login required. Read from an environment variable so
// it never ships to the browser. Falls back to the old hardcoded value
// only until ADMIN_PASSWORD is confirmed set in Vercel's project
// settings (Settings -> Environment Variables) — remove the fallback
// once that's confirmed.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '$Noneya6611$';

async function handleLookup(req, res) {
  const { password, deviceId, email } = req.body || {};

  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });
  if (!deviceId && !email) return res.status(400).json({ error: 'Provide a device ID or email to look up.' });

  try {
    const url = deviceId
      ? `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance,email,device_id`
      : `${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=id,token_balance,email,device_id`;

    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const rows = await resp.json();
    if (!resp.ok) throw new Error('Supabase lookup failed: ' + JSON.stringify(rows));
    if (!rows.length) return res.status(404).json({ error: 'No customer found.' });

    const c = rows[0];
    return res.status(200).json({
      deviceId: c.device_id,
      email: c.email || null,
      tokenBalance: c.token_balance
    });
  } catch (err) {
    console.error('Admin lookup error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleAdjust(req, res) {
  const { password, deviceId, count, action, reason } = req.body || {};

  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });
  if (!deviceId)   return res.status(400).json({ error: 'deviceId is required.' });
  if (!count || count < 1) return res.status(400).json({ error: 'count must be >= 1.' });
  if (!['grant','deduct'].includes(action)) return res.status(400).json({ error: 'action must be grant or deduct.' });
  if (!reason?.trim()) return res.status(400).json({ error: 'reason is required.' });

  try {
    const lookupResp = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    const rows = await lookupResp.json();

    let customer;
    if (rows.length) {
      customer = rows[0];
    } else {
      // FIXED (Aug 2026, found during real-device testing): Grant Tokens
      // used to hard-require an existing customer row, failing with
      // "No customer found" for any device that hasn't purchased or
      // generated yet -- meaning tokens could never be proactively
      // granted to a brand-new device (testing, or gifting credit to
      // someone before they've used the app at all). Deduct still
      // requires an existing customer -- nothing sensible to deduct
      // from a record that doesn't exist -- but Grant now creates the
      // customer row on the spot when none is found.
      if (action !== 'grant') {
        return res.status(404).json({ error: `No customer found for device ID: ${deviceId}` });
      }
      const createResp = await fetch(
        `${SUPABASE_URL}/rest/v1/customers`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({ device_id: deviceId, token_balance: 0 })
        }
      );
      const created = await createResp.json();
      if (!createResp.ok || !created.length) throw new Error('Supabase customer creation failed: ' + JSON.stringify(created));
      customer = created[0];
    }

    const delta     = action === 'grant' ? count : -count;
    const newBalance = Math.max(0, customer.token_balance + delta);

    const updateResp = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.${customer.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ token_balance: newBalance })
      }
    );
    const updated = await updateResp.json();
    if (!updateResp.ok) throw new Error('Supabase update failed: ' + JSON.stringify(updated));

    await fetch(`${SUPABASE_URL}/rest/v1/token_transactions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: customer.id,
        amount: delta,
        reason: `[ADMIN ${action.toUpperCase()}] ${reason}`,
        balance_after: newBalance
      })
    });

    console.log(`Admin ${action}: ${count} tokens for device ${deviceId}. New balance: ${newBalance}. Reason: ${reason}`);
    return res.status(200).json({ success: true, newBalance });
  } catch (err) {
    console.error('Admin token adjustment error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ===== Printify catalog relay (merged in from printify-proxy.js) =====
// Printify's API blocks direct browser requests (CORS), so The Portal
// (the-portal.html) can't call api.printify.com itself. This handles
// that: The Portal calls THIS endpoint (GET, not POST — no password
// gate, since it's read-only catalog data, not account data), and this
// function relays the request to Printify server-side and passes the
// result straight back. Uses PRINTIFY_API_TOKEN from Vercel's
// environment variables, so The Portal never needs its own token.
//
// Allow-list of Printify catalog paths this relay is willing to fetch.
// Deliberately narrow — this endpoint has no auth of its own (anyone
// could call it), so it must never become a general-purpose proxy that
// could be pointed at arbitrary URLs or Printify's non-catalog
// (account-mutating) endpoints.
function isAllowedPrintifyPath(path) {
  return (
    path === 'catalog/blueprints.json' ||
    /^catalog\/blueprints\/\d+\.json$/.test(path) ||
    /^catalog\/blueprints\/\d+\/print_providers\.json$/.test(path) ||
    /^catalog\/blueprints\/\d+\/print_providers\/\d+\/variants\.json$/.test(path)
  );
}

async function handlePrintifyCatalog(req, res) {
  if (!PRINTIFY_API_TOKEN) {
    console.error('CRITICAL: PRINTIFY_API_TOKEN is not set in Vercel environment variables.');
    return res.status(500).json({ error: 'Printify token is not configured on the server.' });
  }

  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing "path" query parameter.' });
  }
  if (!isAllowedPrintifyPath(path)) {
    return res.status(400).json({ error: `Path "${path}" is not an allowed catalog endpoint.` });
  }

  try {
    const printifyRes = await fetch(`https://api.printify.com/v1/${path}`, {
      headers: {
        Authorization: `Bearer ${PRINTIFY_API_TOKEN}`,
        Accept: 'application/json'
      }
    });

    const body = await printifyRes.text();

    if (!printifyRes.ok) {
      console.error(`Printify returned ${printifyRes.status} for path "${path}": ${body.slice(0, 300)}`);
      return res.status(printifyRes.status).json({ error: `Printify returned ${printifyRes.status}`, details: body.slice(0, 300) });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(body);
  } catch (err) {
    console.error('Printify catalog relay failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  // Printify catalog reads are GET requests (read-only, no password
  // needed) — check this first, before the POST/action routing below.
  if (req.method === 'GET' && req.query?.action === 'printify-catalog') {
    return handlePrintifyCatalog(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body || {};

  // "lookup" is the balance-lookup job (old admin-lookup.js). "grant"
  // and "deduct" are the token-adjustment job (old admin-tokens.js) —
  // kept as their original action names so admin.html barely needs to
  // change, just which URL it calls.
  if (action === 'lookup') return handleLookup(req, res);
  if (action === 'grant' || action === 'deduct') return handleAdjust(req, res);

  return res.status(400).json({ error: `Unknown action "${action}".` });
}
