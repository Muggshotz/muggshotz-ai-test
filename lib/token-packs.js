// lib/token-packs.js
//
// The token packs, in one place (22 Sep 2026). Checkout sells from this table
// and the webhook credits from it. Before this the webhook never looked at
// which pack was bought and credited every purchase 5 tokens (4 if the email
// was already verified): the 50-cent buyer got five, the $5 buyer, who paid
// for twenty, also got five.
// THE 50c PACK IS GONE (Alyx, 24 Sep 2026): the processor's fixed 30c made
// the fee line 37c on a 50c token, 74% on top of the price ("it just don't
// seem right"), and Square will not take a card payment under $1.00 at all.
// The smallest pack is now the dollar one.
// THE DOLLAR PACK IS 3 FOR $1.33 (Alyx, 24 Sep 2026): the 5c handling fee
// is waived on it, so the dollar plus the processor's 2.9% + 30c comes to
// $1.33 exactly on Stripe (a penny more on Square's rate). Marketed as
// "3 for $1.33"; the fee line says what it is.
export const TOKEN_PACKS = {
  // feeCents fixes the fee line on BOTH tracks: Square's rate would make it
  // 34c, and Alyx eats that penny ("we eat the penny on the Square rate").
  "3tokens": { tokens: 3,  amountCents: 100, label: "3 Tokens — $1.00", noHandlingFee: true, feeCents: 33 },
  "20tokens":{ tokens: 20, amountCents: 500, label: "20 Tokens — $5.00" }
};
