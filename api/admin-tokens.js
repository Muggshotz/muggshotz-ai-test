// Admin token adjustment endpoint.
// Called only from admin.html — password verified server-side so the
// admin page can never be spoofed into granting tokens without it.
const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// HARDENED (July 2026): moved out of admin.html's own JavaScript, where
// it previously sat in plain text visible to anyone who viewed the page
// source. Now read from an environment variable so it never ships to
// the browser. Falls back to the old value only until ADMIN_PASSWORD is
// set in Vercel's project settings (Settings -> Environment Variables)
// — remove the fallback once that's confirmed set.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '$Noneya6611$';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, deviceId, count, action, reason } = req.body || {};
  // Always verify the password server-side
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });
  if (!deviceId)   return res.status(400).json({ error: 'deviceId is required.' });
  if (!count || count < 1) return res.status(400).json({ error: 'count must be >= 1.' });
  if (!['grant','deduct'].includes(action)) return res.status(400).json({ error: 'action must be grant or deduct.' });
  if (!reason?.trim()) return res.status(400).json({ error: 'reason is required.' });
  try {
    // Look up the customer by device ID
    const lookupResp = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    const rows = await lookupResp.json();
    if (!rows.length) return res.status(404).json({ error: `No customer found for device ID: ${deviceId}` });
    const customer  = rows[0];
    const delta     = action === 'grant' ? count : -count;
    const newBalance = Math.max(0, customer.token_balance + delta);
    // Update the balance
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
    // Log the transaction
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
