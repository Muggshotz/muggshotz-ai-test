// Server-side relay for The Portal (the-portal.html) — Printify's API
// blocks direct browser requests (CORS), so the browser can't call
// api.printify.com itself. This function sits in between: the browser
// calls THIS endpoint, and this endpoint (running on Vercel's server,
// not in a browser) calls Printify on its behalf and hands back the
// result. Uses the PRINTIFY_API_TOKEN already set in Vercel's
// environment variables, so the browser never needs its own token.
//
// One flexible endpoint rather than several separate files, since this
// project is already at Vercel Hobby's 12-function cap (see admin.js's
// merge history) — routes by a `path` query param instead.
const PRINTIFY_API_TOKEN = process.env.PRINTIFY_API_TOKEN;

// Allow-list of Printify catalog paths this relay is willing to fetch.
// Deliberately narrow — this endpoint has no auth of its own (anyone
// could call it), so it must never become a general-purpose proxy that
// could be pointed at arbitrary URLs or Printify's non-catalog
// (account-mutating) endpoints.
function isAllowedPath(path) {
  return (
    path === 'catalog/blueprints.json' ||
    /^catalog\/blueprints\/\d+\.json$/.test(path) ||
    /^catalog\/blueprints\/\d+\/print_providers\.json$/.test(path) ||
    /^catalog\/blueprints\/\d+\/print_providers\/\d+\/variants\.json$/.test(path)
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PRINTIFY_API_TOKEN) {
    console.error('CRITICAL: PRINTIFY_API_TOKEN is not set in Vercel environment variables.');
    return res.status(500).json({ error: 'Printify token is not configured on the server.' });
  }

  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing "path" query parameter.' });
  }
  if (!isAllowedPath(path)) {
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

    // Pass Printify's JSON straight through unchanged.
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(body);
  } catch (err) {
    console.error('Printify proxy request failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
