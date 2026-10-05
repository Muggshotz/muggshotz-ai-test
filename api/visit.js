// THE VISITOR COUNT's door (Alyx, 5 Oct 2026). count-visit.js on each public
// page sends one note per browser per day; lib/visits.js counts it. Always
// answers 204, counted or not: nothing here may ever show a visitor an error.
import { recordVisit } from '../lib/visits.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  let body = req.body;
  // sendBeacon's note may arrive as text rather than parsed JSON.
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  await recordVisit(body, req.headers['user-agent']);
  return res.status(204).end();
}
