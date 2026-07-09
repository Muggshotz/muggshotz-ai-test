// api/phone-case-catalog.js
// Pulls every phone case blueprint from Printify's catalog and returns
// a clean list of supported phone models, blueprint IDs, and print providers.
// This does NOT place orders or touch customer data — read-only catalog lookup.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PRINTIFY_CATALOG_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'PRINTIFY_CATALOG_TOKEN not configured' });
  }

  try {
    const blueprintsResp = await fetch('https://api.printify.com/v1/catalog/blueprints.json', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!blueprintsResp.ok) {
      const errText = await blueprintsResp.text();
      return res.status(blueprintsResp.status).json({
        error: 'Failed to fetch Printify catalog',
        details: errText
      });
    }

    const allBlueprints = await blueprintsResp.json();

    const phoneCaseKeywords = ['phone case', 'iphone case', 'samsung case', 'galaxy case'];
    const phoneCaseBlueprints = allBlueprints.filter((bp) => {
      const haystack = `${bp.title || ''} ${bp.description || ''} ${bp.brand || ''} ${bp.model || ''}`.toLowerCase();
      return phoneCaseKeywords.some((kw) => haystack.includes(kw)) || (haystack.includes('case') && haystack.includes('phone'));
    });

    const results = [];
    for (const bp of phoneCaseBlueprints) {
      let providers = [];
      try {
        const providersResp = await fetch(
          `https://api.printify.com/v1/catalog/blueprints/${bp.id}/print_providers.json`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (providersResp.ok) {
          providers = await providersResp.json();
        }
      } catch (e) {
        providers = [];
      }

      results.push({
        blueprint_id: bp.id,
        title: bp.title,
        brand: bp.brand,
        model: bp.model,
        description: bp.description,
        print_providers: providers.map((p) => ({ id: p.id, title: p.title }))
      });
    }

    return res.status(200).json({
      total_phone_case_blueprints: results.length,
      total_catalog_blueprints_scanned: allBlueprints.length,
      blueprints: results
    });

  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}
