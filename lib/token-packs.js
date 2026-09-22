// lib/token-packs.js
//
// The token packs, in one place (22 Sep 2026). Checkout sells from this table
// and the webhook credits from it. Before this the webhook never looked at
// which pack was bought and credited every purchase 5 tokens (4 if the email
// was already verified): the 50-cent buyer got five, the $5 buyer, who paid
// for twenty, also got five.
export const TOKEN_PACKS = {
  "1token":  { tokens: 1,  amountCents: 50,  label: "1 Token — 50¢" },
  "3tokens": { tokens: 3,  amountCents: 100, label: "3 Tokens — $1.00" },
  "20tokens":{ tokens: 20, amountCents: 500, label: "20 Tokens — $5.00" }
};
