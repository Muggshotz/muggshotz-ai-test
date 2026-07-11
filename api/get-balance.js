const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Simple read-only lookup: given a device ID, return its current token
// balance (and whether it's an admin/unlimited account) so the front end
// can display a live token meter without needing to run a generation
// first. Never creates a new customer row — if the device doesn't exist
// yet, it just hasn't generated anything, so we report 0 rather than
// creating a row here (the first real generate() call handles creation).
//
// hasPurchased added (July 2026): true once this customer has ever
// completed ANY real payment — a token pack, the $5 Preview
// Reservation, or a real product order. Used to gate the Wraparound
// generation option, since it costs more in API usage than a single
// image and shouldn't be available on a customer's very first free
// token (that would effectively hand out 3 images for the price of 1).
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ error: "Missing device ID." });
    }
    const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=token_balance,role,has_purchased`;
    const resp = await fetch(url, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const rows = await resp.json();
    if (!resp.ok) throw new Error("Supabase lookup failed: " + JSON.stringify(rows));
    if (rows.length === 0) {
      return res.status(200).json({ tokenBalance: 0, isAdmin: false, isNewDevice: true, hasPurchased: false });
    }
    const customer = rows[0];
    return res.status(200).json({
      tokenBalance: customer.token_balance,
      isAdmin: customer.role === "admin",
      isNewDevice: false,
      hasPurchased: customer.has_purchased === true
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
