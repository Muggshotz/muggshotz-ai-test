# The Square track — setting it up

Built 24 Sep 2026. The shop can take money through Stripe (the default) or
Square. Both are fully wired for every checkout: product orders, baskets,
chips, the $5 reservation, gift certificates, beta tier upgrades. Square
exists for the physical gift cards: Square prints them, and only Square can
charge them.

## What the code does

- **The switch** is on admin.html ("Payment track"). Stripe unless you move
  it. It is a row in Supabase (`site_settings.payment_rail`), so it flips
  from a phone without a redeploy. If Square's keys are missing, the switch
  is ignored and Stripe carries on.
- **A Square gift card** typed into the gift box on order.html sends that
  order through Square whatever the switch says. The card pays first, by its
  number; if it does not cover the order, Square's card box appears on the
  page for the rest (Square's own hosted page cannot take Square gift
  cards, so this part has to be on our page). A card that covers the whole
  order pays it with no bank card at all, and no card fee.
- **The fee line** says the track's rate: Stripe 2.9% + 30¢, Square 3.3% +
  30¢ (Square's Free plan; Plus is 2.9% for $49 a month — change
  `SQUARE_FEE_RATE` in lib/payment-rail.js if you move up). Plus the 5¢
  handling fee on both.
- **Sales tax:** Stripe works it out on its page (automatic tax). Square's
  page does not, and the on-page path does not either. A Square sale is
  charged without tax today. Decide before switching the shop onto Square
  for ordinary sales.
- **Sandbox first.** With sandbox keys, payments go through Square's test
  system and nothing is printed, credited or emailed — the same rule the
  webhook applies to Stripe test-mode events. Swap to production keys when
  the flow has been walked once.
- **Twelve functions, still.** Square's webhook arrives at
  `/api/square-webhook`, which vercel.json rewrites onto the Stripe webhook
  function; it tells them apart by signature header. The gift card lookup
  is in `get-balance`, the rest-on-a-card payment in
  `create-checkout-session`, the switch in `admin`.

## What Vercel needs (Settings → Environment Variables)

```
SQUARE_ENV=sandbox
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
SQUARE_APPLICATION_ID=
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_WEBHOOK_URL=https://muggshotz-ai-test.vercel.app/api/square-webhook
```

Set `SQUARE_ENV=production` and swap in the production values of the same
five when going live.

## Where the values come from (Square Developer Dashboard)

1. https://developer.squareup.com/apps — **+ Create app** (or open the one
   you have). Name it anything; "Muggshotz" is fine.
2. In the app, the **Credentials** page has a **Sandbox / Production**
   toggle at the top. Start on **Sandbox**.
   - **Sandbox Application ID** → `SQUARE_APPLICATION_ID`
   - **Sandbox Access Token** → `SQUARE_ACCESS_TOKEN`
3. **Locations** page (left menu): the location's **ID** → `SQUARE_LOCATION_ID`.
4. **Webhooks** → **Subscriptions** → **Add subscription**:
   - URL: `https://muggshotz-ai-test.vercel.app/api/square-webhook`
   - Events: **payment.updated** (that is all the code listens for)
   - Save, then open it: **Signature key** → `SQUARE_WEBHOOK_SIGNATURE_KEY`
5. Supabase → SQL Editor: run `supabase/site-settings.sql` again (it adds
   the `payment_rail` column; safe to re-run).
6. Redeploy (any push does it). admin.html's Payment track box then reads
   "Square is set up (sandbox keys)".

## Walking it once (sandbox)

- Square's sandbox test card: `4111 1111 1111 1111`, any future date, any
  CVV, any postcode.
- A sandbox gift card: Square Dashboard (sandbox) → Gift Cards → create a
  digital one with a balance; its number is the GAN to type into the gift
  box on order.html.
- Flip the switch to Square, buy a chip pack, land back on the studio: the
  payment shows in the sandbox dashboard; the site's log says "Ignored a
  SANDBOX Square payment".

## Not built yet

- Selling the physical card on the site (the card, the stamp and the
  envelope on the price; an admin mail queue; the packer types the card's
  number as it goes in the envelope and the site activates it with the
  amount through Square). Planned as the next piece.
