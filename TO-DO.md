# The to-do list

Started 24 Sep 2026, when the old lists ran out.

## This week

- [ ] **Flyers wired in** so printing can start and betas can be collected.
      The flyer/beta system already exists (flyer codes, campaigns, beta
      onboarding, commissions ledger in admin.html; see GO-LIVE.md). Read it
      first, then say what is there and what is missing.

## New categories — planned, not built

**The grid (Alyx, 24 Sep 2026): 28 tiles, seven even rows of four.** 24
products (Night-Buddy off the grid for now; the frosted glass mug not added),
then a last row of four: Artwork Only, Gift Certificate, Premades & Sets,
Pitch In. The grid is three across today (needles-studio.html, #productCard
.grid3); four across needs deciding for phones.


- **Premades & Sets**. Finished designs, nothing painted:
  pick, choose options, order. Holds:
  - Ewww Stew (the code already reserves an all-over print for it:
    `api/create-printify-order.js:727`; `lib/products-catalog.js:19` once
    called it the "Ewww Stew / Second Glance Funny line")
  - Lifeseyes
  - Christmas sets, Thanksgiving sets
  - Anniversary pairs, Valentine's Day pairs — "A Toast to Us"
  - **Gone Fishing** — made from the fishing magic mug image (Alyx, 24 Sep)
  - The SURPRISE!!! heat-reveal mugs, shown here as well as under Coffee
    Mugs → Smart Mug. The SURPRISE!!! panel (tiles with picture, price,
    choices) is the model for the whole line.
- **Pitch In**. A separate category: people pitch ideas, and earn a
  percentage on every one that is adopted and sold. Tapping it opens a short,
  clear explanation (draft 24 Sep: tell us the idea; if we make it, it goes in
  the shop; every sale pays you your %). **The reward (Alyx, 24 Sep): 5% plus
  10 free chips** when an idea is adopted, so the pitcher tests the idea
  themselves and reports back if anything doesn't work (Alyx: likely to buy
  their own item just to see). Still to say: 5% of the sale price, or of the
  profit.
  (Bug reports: see "Report a bug" below.)
  Gets people invested in the app; enough involvement may later support
  selling advertising. The flyer betas' commissions ledger and payouts may
  carry it — read that before designing anything new.
- **Report a bug — on every flow, for every customer** (Alyx, 24 Sep). Each
  legitimate bug reported earns a free chip; nobody pays for the spin that
  led them to a bug. Alyx: a built-in workforce testing the generator, at
  about $0.03 a bug ("even 1000 bugs is $30"). Needs a Report-a-bug button on
  every panel that sends the report (what they saw, where, their device) to
  Alyx; the chip can be granted from the admin page's existing chip grant.
  Only the FIRST report of a bug earns the chip (it gets fixed, and is no
  longer a bug). Delivery: Alyx wants it to reach him directly, a text
  preferred. The site can already send email (Resend, as the verification and
  flyer emails do); no text-message service is connected.
- **Optical Illusions** — an art style dressed as a tile in Art Style,
  templates for nearly every product (up to ~10 each, ~250 in all) plus a
  "suggest a template" box. Waits on the templates. Claude and Bud to agree
  the prompts; each template drawn at its product's own print shape.

## Waiting on Alyx or Bud

- Method C on wraparound-compare.html (paints without charging): delete or
  keep?

## Deferred

- A Printify-style placement editor.
- Researching more products.
- Night-Buddy (off the grid for now) * — US shipping ($19.29 first, $15.99 each extra) is more than
  the item ($14.95). Alyx: "The shipping should not be more than the item";
  may drop it.
- Frosted glass beer mug — not on the site; kept for later, if the liquid
  motif idea comes to something. Wholesale $23.83; US shipping $12.49 /
  $3.99 each extra (probe 24 Sep 2026).
- The coffee mug and travel cup rails in the panel checker
  (`flow-tests/verify-panel-checklist.js` skips them today).
