// lib/prodigi-phone-case-catalog.js
//
// RELOCATED (July 2026) from api/prodigi-phone-case-catalog.js — moved
// here to free up a serverless function slot (Vercel Hobby plan caps at
// 12 functions in api/, and this project hit that limit). Not currently
// wired to any live endpoint. Content is otherwise UNCHANGED and fully
// working — reactivate later by moving this file back into api/ (or by
// importing its exported logic into another endpoint) once there's
// headroom, or once Prodigi pricing/catalog comparison becomes an
// active priority again.
//
// Looks up phone case model support from Prodigi.
// Unlike Printify, Prodigi has no public "list all products" API endpoint —
// so this uses a static snapshot extracted from Prodigi's official CSV export
// (dashboard.prodigi.com -> Download CSV), stored in /lib/prodigi-phone-cases-data.js.
//
// Original usage (when live as an API route):
// GET /api/prodigi-phone-case-catalog?action=models
//   -> returns every phone case model in the snapshot, grouped by brand
//
// GET /api/prodigi-phone-case-catalog?action=search&q=iphone+15
//   -> returns models matching a search term (case-insensitive)

import { PRODIGI_PHONE_CASES } from './prodigi-phone-cases-data.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action || 'models';

  if (action === 'search') {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) {
      return res.status(400).json({ error: 'Missing ?q= search term' });
    }
    const matches = PRODIGI_PHONE_CASES
      .filter(([sku, description]) => description.toLowerCase().includes(q))
      .map(([sku, description, category]) => ({ sku, description, category }));

    return res.status(200).json({
      query: q,
      total_matches: matches.length,
      matches
    });
  }

  // Default: action=models — full grouped list
  const byCategory = {};
  for (const [sku, description, category] of PRODIGI_PHONE_CASES) {
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push({ sku, description });
  }

  const summary = Object.fromEntries(
    Object.entries(byCategory).map(([cat, list]) => [cat, list.length])
  );

  return res.status(200).json({
    total_phone_case_skus: PRODIGI_PHONE_CASES.length,
    source: 'Static snapshot from Prodigi CSV export, taken 2026-07-09. Not a live API call.',
    counts_by_brand: summary,
    models_by_brand: byCategory
  });
}
