// A small, single-purpose endpoint: it only checks whether the submitted
// password matches the real admin password. It does nothing else — no
// customer lookups, no balance changes. This exists so the "Unlock" button
// on admin.html can verify the password immediately, instead of silently
// accepting anything and only failing later when a real grant/deduct is
// attempted (which was the bug — Unlock never actually checked anything).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { password } = req.body;

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Incorrect admin password." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
