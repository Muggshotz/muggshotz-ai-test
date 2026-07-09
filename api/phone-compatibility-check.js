// api/phone-compatibility-check.js
// Combined phone case compatibility checker.
// Searches BOTH Printify (live API scan) and Prodigi (static snapshot) for a
// given phone model search term, and returns a unified yes/no answer.
//
// GET /api/phone-compatibility-check?q=iphone+15
//   -> { query, supported, printify_matches: [...], prodigi_matches: [...] }

import { PRODIGI_PHONE_CASES } from '../lib/prodigi-phone-cases-data.js';

const PRINTIFY_BLUEPRINT_PROVIDERS = [
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

export const config = {
  maxDuration: 30
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing ?q= search term, e.g. ?q=iphone 15' });
  }

  const prodigiMatches = PRODIGI_PHONE_CASES
    .filter(([sku, description]) => description.toLowerCase().includes(q))
    .map(([sku, description, category]) => ({ supplier: 'Prodigi', sku, description, category }));

  let printifyMatches = [];
  const token = process.env.PRINTIFY_CATALOG_TOKEN;
  if (token) {
    try {
      const fetches = PRINTIFY_BLUEPRINT_PROVIDERS.map(async (bp) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(
            `https://api.printify.com/v1/catalog/blueprints/${bp.blueprint_id}/print_providers/${bp.provider_id}/variants.json`,
            {
              headers: { 'Authorization': `Bearer ${token}` },
              signal: controller.signal
            }
          );
          clearTimeout(timeoutId);
          if (!resp.ok) return [];
          const data = await resp.json();
          const variants = Array.isArray(data.variants) ? data.variants : [];
          return variants
            .filter((v) => v.title && v.title.toLowerCase().includes(q))
            .map((v) => ({ supplier: 'Printify', sku: v.id, description: v.title, category: bp.title }));
        } catch (e) {
          return [];
        }
      });
      const results = await Promise.allSettled(fetches);
      printifyMatches = results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => r.value);
    } catch (e) {
      printifyMatches = [];
    }
  }

  const totalMatches = prodigiMatches.length + printifyMatches.length;

  return res.status(200).json({
    query: q,
    supported: totalMatches > 0,
    total_matches: totalMatches,
    printify_matches: printifyMatches,
    prodigi_matches: prodigiMatches
  });
}
