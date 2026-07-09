// api/phone-case-catalog.js
// Pulls every phone case blueprint from Printify's catalog and returns
// a clean list of supported phone models, blueprint IDs, and print providers.
// This does NOT place orders or touch customer data — read-only catalog lookup.

// Allow this function up to 30 seconds to run — the ?action=models path
// makes many outbound calls to Printify and can exceed the 10s default.
export const config = {
  maxDuration: 30
};

// Hardcoded from a prior full catalog scan (blueprint id -> provider id).
// Printify rarely adds/removes phone case blueprints, so this avoids
// re-scanning 1691 catalog items and 26 provider lookups on every request.
// If you ever suspect this list is stale, re-run this file with no
// query params to get a fresh scan, then update this list.
const PHONE_CASE_BLUEPRINT_PROVIDERS = [
  { blueprint_id: 268, provider_id: 1, title: 'Slim Phone Cases' },
  { blueprint_id: 269, provider_id: 1, title: 'Tough Phone Cases' },
  { blueprint_id: 370, provider_id: 23, title: 'Flexi Cases' },
  { blueprint_id: 371, provider_id: 23, title: 'Snap Cases' },
  { blueprint_id: 421, provider_id: 23, title: 'Tough Cases' },
  { blueprint_id: 477, provider_id: 23, title: 'Biodegradable Cases' },
  { blueprint_id: 529, provider_id: 23, title: 'Clear Cases' },
  { blueprint_id: 841, provider_id: 88, title: 'Impact-Resistant Cases' },
  { blueprint_id: 849, provider_id: 88, title: 'Slim Cases' },
  { blueprint_id: 886, provider_id: 88, title: 'Clear Impact-Resistant Cases' },
  { blueprint_id: 1022, provider_id: 23, title: 'Phone Case With Card Holder' },
  { blueprint_id: 1230, provider_id: 23, title: 'Flip Cases' },
  { blueprint_id: 1273, provider_id: 88, title: 'Magnetic Impact-Resistant Cases' },
  { blueprint_id: 1487, provider_id: 23, title: 'Magnetic Clear Impact Cases' },
  { blueprint_id: 1521, provider_id: 23, title: 'Tough Magnetic Cases' },
  { blueprint_id: 1658, provider_id: 90, title: 'Colorful Phone Cases' },
  { blueprint_id: 5369, provider_id: 23, title: 'PU Leather Phone Cases (Engraving)' }
];

function classifyModel(title) {
  const t = title.toLowerCase();
  if (t.includes('iphone')) return 'iPhone';
  if (t.includes('samsung') || t.includes('galaxy')) return 'Samsung Galaxy';
  return 'Other';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PRINTIFY_CATALOG_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'PRINTIFY_CATALOG_TOKEN not configured' });
  }

  if (req.query.action === 'models') {
    try {
      const fetches = PHONE_CASE_BLUEPRINT_PROVIDERS.map(async (bp) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(
            `https://api.printify.com/v1/catalog/blueprints/${bp.blueprint_id}/print_providers/${bp.provider_id}/variants.json`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              signal: controller.signal
            }
          );
          clearTimeout(timeoutId);
          if (!resp.ok) return { case_type: bp.title, models: [] };
          let data;
          try {
            data = await resp.json();
          } catch (parseErr) {
            return { case_type: bp.title, models: [] };
          }
          const models = Array.isArray(data.variants) ? data.variants.map((v) => v.title).filter(Boolean) : [];
          return { case_type: bp.title, models };
        } catch (e) {
          return { case_type: bp.title, models: [] };
        }
      });

      const perCaseResults = await Promise.allSettled(fetches).then((settled) =>
        settled.map((s) => (s.status === 'fulfilled' ? s.value : { case_type: 'unknown', models: [] }))
      );

      const uniqueModels = new Map();
      for (const result of perCaseResults) {
        for (const model of result.models) {
          if (!uniqueModels.has(model)) {
            uniqueModels.set(model, {
              model,
              category: classifyModel(model),
              available_in: []
            });
          }
          uniqueModels.get(model).available_in.push(result.case_type);
        }
      }

      const allModels = Array.from(uniqueModels.values()).sort((a, b) => a.model.localeCompare(b.model));
      const iphoneCount = allModels.filter((m) => m.category === 'iPhone').length;
      const samsungCount = allModels.filter((m) => m.category === 'Samsung Galaxy').length;
      const otherCount = allModels.filter((m) => m.category === 'Other').length;

      return res.status(200).json({
        total_unique_models: allModels.length,
        iphone_models: iphoneCount,
        samsung_models: samsungCount,
        other_models: otherCount,
        case_types_scanned: PHONE_CASE_BLUEPRINT_PROVIDERS.length,
        models: allModels
      });
    } catch (err) {
      return res.status(500).json({ error: 'Unexpected error building model list', details: err.message });
    }
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
