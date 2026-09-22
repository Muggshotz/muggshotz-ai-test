# Gift Certificates — the plan

Written 22 Sep 2026, before a line of it exists. Alyx's design, in his words
where they were his: a gift certificate is **store credit on a ledger**. The
bill and the coin are pictures of it. Nothing is printed or issued; a code in
an email is the only thing the recipient carries, and the ledger is the only
thing that counts.

Status: **not built.** Art is in `art/` (Bud, 22 Sep 2026). Everything below
is what it takes, on the plumbing the site has today.

## What already exists that this stands on

| Piece | Where | What it gives us |
| --- | --- | --- |
| Dynamic Stripe pricing | `api/create-checkout-session.js` (`price_data`) | No Stripe product setup; a certificate is a session with an amount |
| Webhook branching | `api/stripe-webhook.js` (product / token pack / tier upgrade) | A fourth branch for "certificate paid" |
| Supabase lookups before pricing | `checkEmailDiscountEligibility()` in checkout | The shape of a redeem check, half written |
| Email | `api/send-verification.js` via Resend | The certificate goes out the same door |
| One-time email codes | `send-verification` / `verify-email` | The "something more than the code" if we want it |
| Token packs | `TOKEN_PACKS` in checkout: 1 token = 50¢ | The unit a leftover balance turns into |

## The hard constraint

Vercel allows this project **twelve serverless functions and every one is
taken** (see the note in `api/admin.js` — a thirteenth file fails every build
silently). Nothing here gets its own file:

- buying → inside `api/create-checkout-session.js` (a new `kind`)
- minting → inside `api/stripe-webhook.js` (a new branch)
- redeeming → inside `api/create-checkout-session.js` (a code on the order)
- admin → inside `api/admin.js` (new actions)

## The ledger

One new Supabase table, `gift_certificates`:

| column | note |
| --- | --- |
| `code` | primary key. 12 characters from a 32-symbol alphabet, e.g. `MUG-7K3Q-9DPX`. Unguessable. |
| `amount_cents` | what was bought |
| `balance_cents` | what is left. The certificate is spent when this reads 0. |
| `buyer_email`, `recipient_email`, `recipient_name`, `message` | from the purchase page |
| `stripe_session_id` | the payment that minted it |
| `issued_at` | — |
| `voided_at` | set by admin if a payment reverses or a code is reported stolen |

And a small log, `gift_certificate_uses`: `code`, `order_session_id`,
`cents_used`, `used_at`. Every redemption is written against an order, so a
wrongly spent certificate shows where the mug went.

**No expiry.** Federal law (CARD Act, 2009) forbids a sold certificate
expiring inside five years; California and others forbid expiry at all.
Promotional credit given away free may carry a clock; money the customer paid
may not. The terms carry one line on the small-balance cash refund a few
states require on request.

## Change makes itself

A $100 code spent on a $15 order becomes a $100 code with $85 left. The same
code works next time. No smaller denominations exist or are needed.

**The last dollar turns into tokens.** When a balance falls under $1, or on
request, it converts at the token rate (50¢ each, rounded UP so the recipient
never loses the odd cent) and the code closes at zero. So a certificate always
ends spent, and the recipient ends with drawings in hand.

## Denominations

What a buyer can purchase, not how change is given:

| Bill | Roughly covers |
| --- | --- |
| $25 | a Classic White with postage |
| $50 | any mug or cup, with change for tokens |
| $75 | a Tundra and a mug |
| $100 | a set, or two of the dear ones |

One bill design; the page draws the amount into the oval.

## The four pieces

1. **Buying.** A Gift Certificate tile on the product grid, Bud's bill as the
   picture. It skips the studio and goes to a short page: amount, recipient's
   name and email, a message, pay. Checkout makes a Stripe session flagged
   `kind: 'gift'` carrying amount and recipient in metadata.
2. **Minting.** On `checkout.session.completed` for a gift session, the
   webhook writes the ledger row, then emails the recipient the bill with the
   amount in the oval, the code in the rectangle, the message in the bottom
   box, and the buyer a receipt.
3. **Spending.** A box on `order.html`: *Have a gift certificate?* Checkout
   looks the code up, takes its balance off the **total** (product, postage
   and fees — decision below), and Stripe charges the difference. If the code
   covers the whole order, no card: a **no-card path** that today does not
   exist, since every order goes through Stripe. On confirmation the balance
   is reduced and the use logged.
4. **Looking after it.** In The Portal: list certificates, balances, buyer,
   recipient, uses; void and reissue.

## Friction versus loss — an open switch

Anyone who reads the email over a shoulder has the code. The lock is the
recipient's email, using the verification the site already runs. Three
settings, chosen later; the ledger is the same under all of them:

- **Open.** The code alone redeems. One tap for the honest recipient; a stolen
  code spends.
- **Locked.** Code plus a one-time code sent to the recipient's address, every
  time.
- **Middle road (leaning here).** Bound to the recipient's email at purchase;
  the one-time check is asked only when something looks off: a device that has
  never seen that email, a second attempt on a spent code, an order shipping to
  a different country from the buyer. The everyday case never sees a check.

Under every setting: the balance is never shown before the check passes, a few
attempts per hour per device, and admin can void and reissue.

## Decisions still open (Alyx's)

- The four amounts, or any amount typed.
- Dollars only, or dollars plus a few tokens so the recipient can draw before
  spending.
- Whether a certificate covers postage and fees or the product only.
- Who gets the email: recipient on payment, buyer only, or both. Scheduled
  delivery on a date is possible and is another piece.
- The friction switch above.

## Size

The largest build since the third door: order page, checkout, webhook, admin,
one table and one log, two emails, and the no-card path. Two to three
sessions with tests, and the tests matter more than usual, because this one
holds people's money.

## Art

`art/gift-certificate-bill-preview.png` — Bud's bill, revised 22 Sep 2026:
oval = amount, rectangle = redemption code, bottom box = message. 1594 px wide,
which is enough: it only ever appears on a screen.

`art/token-coin-preview.png` — the token as a coin, backdrop keyed out. Also
the replacement for the generic chip glyph in the credits meter.
