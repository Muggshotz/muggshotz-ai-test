// BUILD-MARKER: ADMIN-STORAGE-CLEANUP-v3
// If you can see this comment on GitHub, this exact paste landed.
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

// ---------------------------------------------------------------------------
// COST PROBE (Aug 2026, Alyx's request). Printify's catalog API carries no
// wholesale cost at all — cost only exists on a product that actually lives
// in the shop. That is exactly why every shippingCost/estimatedProfit in
// lib/products-catalog.js is still a 0 placeholder, and why checkout is
// currently charging $0 shipping on every order.
//
// This closes that gap the only way the API allows: create a throwaway draft
// product for a blueprint/provider, read the real per-variant cost off it,
// then delete it. It reuses the same create/delete machinery
// create-printify-order.js and start-mockup.js already use for temporary
// mockup products, so this is not a new capability — only a new reader.
//
// Deliberately POST + password. It must NEVER move to the unauthenticated
// GET relay above: catalog GETs need no auth, so exposing costs there would
// publish this shop's wholesale pricing to anyone who found the URL.
//
// Shipping is the easy half and needs no product at all — Printify serves it
// from the catalog; it simply was not on the GET whitelist.
const PROBE_TITLE_PREFIX = 'ZZ_COST_PROBE_DELETE_ME';

// 1x1 transparent PNG. Printify refuses to create a product whose print_areas
// reference no real uploaded image. Nothing is ever printed from this — the
// product is deleted seconds later.
const PROBE_PIXEL_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const PROBE_SHOP_ID = '27439202';

async function printifyCall(path, opts = {}) {
  const res = await fetch(`https://api.printify.com/v1/${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${PRINTIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`Printify ${res.status} on ${path}: ${String(text).slice(0, 300)}`);
  return body;
}

async function handleCostProbe(req, res) {
  const { password, blueprintId, printProviderId } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });
  if (!PRINTIFY_API_TOKEN) return res.status(500).json({ error: 'Printify token is not configured on the server.' });
  if (!blueprintId || !printProviderId) {
    return res.status(400).json({ error: 'blueprintId and printProviderId are both required.' });
  }

  let productId = null;
  try {
    const catalog = await printifyCall(
      `catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`
    );
    const variants = Array.isArray(catalog?.variants) ? catalog.variants : [];
    if (!variants.length) return res.status(404).json({ error: 'No variants for that blueprint/provider.' });

    // Shipping needs no product — straight off the catalog.
    let shipping = null;
    try {
      shipping = await printifyCall(
        `catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/shipping.json`
      );
    } catch (e) {
      shipping = { error: e.message };
    }

    // Cost DOES need a product, so make a throwaway one.
    const uploaded = await printifyCall('uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: 'cost-probe-pixel.png', contents: PROBE_PIXEL_PNG_B64 })
    });
    const variantIds = variants.map(v => v.id);
    const firstPosition = variants[0]?.placeholders?.[0]?.position || 'front';

    const created = await printifyCall(`shops/${PROBE_SHOP_ID}/products.json`, {
      method: 'POST',
      body: JSON.stringify({
        title: `${PROBE_TITLE_PREFIX} ${blueprintId}/${printProviderId}`,
        description: 'Temporary cost probe. Safe to delete.',
        blueprint_id: Number(blueprintId),
        print_provider_id: Number(printProviderId),
        variants: variantIds.map(id => ({ id, price: 100, is_enabled: true })),
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{ position: firstPosition, images: [{ id: uploaded.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }]
        }]
      })
    });
    productId = created.id;

    const full = await printifyCall(`shops/${PROBE_SHOP_ID}/products/${productId}.json`);
    const titleById = new Map(variants.map(v => [v.id, v.title]));
    const costs = (full.variants || [])
      .map(v => ({
        variantId: v.id,
        title: v.title || titleById.get(v.id) || null,
        costCents: v.cost ?? null,
        cost: v.cost != null ? Number((v.cost / 100).toFixed(2)) : null
      }))
      .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));

    return res.status(200).json({
      blueprintId: Number(blueprintId),
      printProviderId: Number(printProviderId),
      variantCount: costs.length,
      costs,
      shipping,
      note: 'Wholesale cost per unit, before shipping. The probe product was deleted.'
    });
  } catch (err) {
    console.error('Cost probe failed:', err.message);
    return res.status(500).json({ error: err.message, probeProductId: productId });
  } finally {
    // ALWAYS clean up, including on failure — an orphan would sit in the real
    // shop. The title prefix makes any orphan that does survive obvious.
    if (productId) {
      try {
        await printifyCall(`shops/${PROBE_SHOP_ID}/products/${productId}.json`, { method: 'DELETE' });
      } catch (e) {
        console.error(`Cost probe could not delete temp product ${productId}:`, e.message);
      }
    }
  }
}

// ---------------------------------------------------------------------
// STORAGE CLEANUP (Sep 2026, Alyx): every AI generation, fade and frame
// composite is saved to the "generations" bucket and nothing ever removed
// one, so the project hit Supabase's storage quota and every new upload
// -- including the ones behind the Edge Fade page's Continue -- started
// failing. This is the admin-side broom. Two modes, both password-gated:
//   scan   -> lists the bucket and reports count/size/age breakdown, plus
//             exactly what a given "older than N days" delete would remove.
//             Never deletes anything.
//   delete -> removes files older than N days. Requires confirm:true and
//             N >= 1. Files are independent (one per generation, with the
//             timestamp in the name), so removing old ones cannot affect
//             new ones; the only cost is a customer whose browser still
//             links an old design in "My Designs". Orders already placed
//             are safe: Printify holds its own copy of the print file.
// Lives here rather than in its own file for the same reason everything
// else in this file does: Vercel's 12-function cap.
const GENERATIONS_BUCKET = 'generations';
const STORAGE_LIST_PAGE  = 1000;
const STORAGE_DELETE_BATCH = 200;
const AGE_BANDS = [
  { label: '0-7 days',   min: 0,  max: 7 },
  { label: '8-14 days',  min: 8,  max: 14 },
  { label: '15-30 days', min: 15, max: 30 },
  { label: '31-60 days', min: 31, max: 60 },
  { label: '61-90 days', min: 61, max: 90 },
  { label: 'over 90 days', min: 91, max: Infinity }
];

function storageHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

// Walks the whole bucket, page by page, oldest first. Storage's own
// created_at is the age source; the Date.now() stamp baked into every
// filename by uploadGenerationToStorage is the fallback if it's missing.
async function listAllGenerationFiles() {
  const files = [];
  let offset = 0;
  for (;;) {
    const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${GENERATIONS_BUCKET}`, {
      method: 'POST',
      headers: storageHeaders(),
      body: JSON.stringify({ prefix: '', limit: STORAGE_LIST_PAGE, offset, sortBy: { column: 'created_at', order: 'asc' } })
    });
    const rows = await resp.json();
    if (!resp.ok) throw new Error('Supabase storage list failed: ' + JSON.stringify(rows));
    if (!Array.isArray(rows)) throw new Error('Supabase storage list returned an unexpected shape.');
    for (const r of rows) {
      if (!r || !r.name || r.id === null) continue; // folders have a null id
      let createdMs = Date.parse(r.created_at || r.updated_at || '');
      if (!Number.isFinite(createdMs)) {
        const m = r.name.match(/-(\d{13})\.\w+$/);
        createdMs = m ? Number(m[1]) : NaN;
      }
      files.push({ name: r.name, createdMs, size: Number(r.metadata?.size) || 0 });
    }
    if (rows.length < STORAGE_LIST_PAGE) break;
    offset += rows.length;
    if (offset > 250000) break; // safety valve; nobody has this many
  }
  return files;
}

function ageInDays(createdMs, nowMs) {
  if (!Number.isFinite(createdMs)) return Infinity; // undatable = treated as old
  return Math.floor((nowMs - createdMs) / 86400000);
}

function summarizeFiles(files, olderThanDays, nowMs) {
  const byAge = AGE_BANDS.map(b => ({ label: b.label, count: 0, bytes: 0 }));
  let totalBytes = 0, oldestMs = Infinity, newestMs = -Infinity, undatable = 0;
  const wouldRemove = { count: 0, bytes: 0 };
  for (const f of files) {
    totalBytes += f.size;
    const age = ageInDays(f.createdMs, nowMs);
    if (Number.isFinite(f.createdMs)) {
      if (f.createdMs < oldestMs) oldestMs = f.createdMs;
      if (f.createdMs > newestMs) newestMs = f.createdMs;
    } else {
      undatable++;
    }
    const band = AGE_BANDS.findIndex(b => age >= b.min && age <= b.max);
    if (band >= 0) { byAge[band].count++; byAge[band].bytes += f.size; }
    if (age > olderThanDays) { wouldRemove.count++; wouldRemove.bytes += f.size; }
  }
  return {
    count: files.length,
    totalBytes,
    oldest: Number.isFinite(oldestMs) ? new Date(oldestMs).toISOString() : null,
    newest: Number.isFinite(newestMs) ? new Date(newestMs).toISOString() : null,
    undatable,
    byAge,
    olderThanDays,
    wouldRemove
  };
}

async function deleteGenerationFiles(names) {
  let deleted = 0;
  const failures = [];
  for (let i = 0; i < names.length; i += STORAGE_DELETE_BATCH) {
    const batch = names.slice(i, i + STORAGE_DELETE_BATCH);
    const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${GENERATIONS_BUCKET}`, {
      method: 'DELETE',
      headers: storageHeaders(),
      body: JSON.stringify({ prefixes: batch })
    });
    const body = await resp.json().catch(() => null);
    if (!resp.ok) {
      failures.push({ from: i, count: batch.length, error: JSON.stringify(body).slice(0, 300) });
      continue;
    }
    deleted += Array.isArray(body) ? body.length : batch.length;
  }
  return { deleted, failures };
}

async function handleStorageCleanup(req, res) {
  const { password, mode, olderThanDays, confirm } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase is not configured on the server.' });
  }
  const days = Number.parseInt(olderThanDays, 10);
  if (!Number.isInteger(days) || days < 1) {
    return res.status(400).json({ error: 'olderThanDays must be a whole number of at least 1.' });
  }
  if (mode !== 'scan' && mode !== 'delete') {
    return res.status(400).json({ error: 'mode must be "scan" or "delete".' });
  }
  if (mode === 'delete' && confirm !== true) {
    return res.status(400).json({ error: 'Delete requires confirm: true.' });
  }

  try {
    const nowMs = Date.now();
    const files = await listAllGenerationFiles();
    const before = summarizeFiles(files, days, nowMs);
    if (mode === 'scan') return res.status(200).json({ mode, ...before });

    const doomed = files.filter(f => ageInDays(f.createdMs, nowMs) > days);
    const { deleted, failures } = await deleteGenerationFiles(doomed.map(f => f.name));
    const deletedBytes = doomed.reduce((sum, f) => sum + f.size, 0);
    // Re-list so the numbers reported are what's really left, not arithmetic.
    const after = summarizeFiles(await listAllGenerationFiles(), days, nowMs);
    return res.status(200).json({
      mode,
      olderThanDays: days,
      deletedCount: deleted,
      deletedBytes: failures.length ? null : deletedBytes,
      failures,
      before: { count: before.count, totalBytes: before.totalBytes },
      after: { count: after.count, totalBytes: after.totalBytes, oldest: after.oldest }
    });
  } catch (err) {
    console.error('Admin storage cleanup error:', err.message);
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
  if (action === 'cost-probe') return handleCostProbe(req, res);
  if (action === 'storage-cleanup') return handleStorageCleanup(req, res);

  return res.status(400).json({ error: `Unknown action "${action}".` });
}
