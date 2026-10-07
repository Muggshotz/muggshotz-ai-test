// lib/card-bonus.js
//
// BUSINESS-CARD SPINS (Alyx, 24 Sep 2026: "a person who gets my web address by
// scanning a business card ... is gifted with five free spins"). The card's QR
// code carries ?card=<CODE>; the studio offers the spins, and they are paid out
// when the email is verified -- once per email address, never per device, so
// a private window or a second browser earns nothing (a new device starts at 0
// and cannot generate: needles-studio.html's Generate gate, get-balance.js).
//
// THE OFF SWITCH: set `on: false` on a code (or delete it) and push. A code
// that is off is refused everywhere at once: no offer, no email, no payout,
// even for a link sent before it was switched off (that one pays only the
// ordinary single bonus token for a verified email).
// A FLYER'S CODE (Alyx, 7 Oct 2026): pool names the flyer whose own free-try
// pool pays its spins (lib/free-pool.js: 300, bought back 50 a sale from that
// flyer's page, never another's), and page is where the verified visitor goes
// back to: the flyer's own page, whose "Got a better idea?" box sent them.
export const CARD_CODES = {
  MUGGSY: { spins: 5, on: true },   // Bud's business card, Sep 2026
  HALLOWEEN: { spins: 2, on: true, pool: 'halloween', page: '/halloween' },   // the Halloween flyer's box, Oct 2026
};

/** The active offer for a code, or null. Case-insensitive. */
export function cardOffer(code) {
  const k = String(code || '').trim().toUpperCase();
  const c = CARD_CODES[k];
  return c && c.on && c.spins > 0 ? { code: k, spins: c.spins, pool: c.pool || null, page: c.page || null } : null;
}

// A card claim is carried through the email round trip in the verification
// token itself -- "card.<CODE>.<random>" -- so no new database column is
// needed. A plain token (hex only) is the ordinary one-spin verification.
export function cardToken(code, random) { return `card.${code}.${random}`; }
export function cardFromToken(token) {
  const m = /^card\.([A-Z0-9]{2,20})\.[0-9a-f]{16,}$/.exec(String(token || ''));
  return m ? m[1] : null;
}

// The same address whatever its capitals (Bob@x.com is bob@x.com): an ilike
// pattern that matches only the address itself, its wildcards escaped.
export function likeExact(email) { return String(email || '').trim().replace(/[\\%_]/g, (c) => '\\' + c); }
