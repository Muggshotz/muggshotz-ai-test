// Admin customer lookup endpoint.
// Called only from admin.html — password verified server-side, and this
// is the ONLY place that ever touches Supabase to look up a customer's
// balance for the admin page. Nothing about the customer's data or the
// Supabase key is ever visible in the browser's page source.
const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// RESTORED/HARDENED (July 2026): previously this exact password lived
// in plain text inside admin.html's own JavaScript — visible to anyone
// who viewed the page source, no login required. Moved to an
// environment variable so it never ships to the browser at all. Falls
// back to the old hardcoded value ONLY if the env var hasn't been set
// yet in Vercel, so nothing breaks today — but this fallback should be
// removed once ADMIN_PASSWORD is confirmed set in Vercel's project
// settings (Settings -> Environment Variables).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '$Noneya6611$';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
