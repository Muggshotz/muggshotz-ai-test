# The to-do list

Started 24 Sep 2026, when the old lists ran out.

## This week

- [ ] **Flyers wired in** so printing can start and betas can be collected.
      The flyer/beta system already exists (flyer codes, campaigns, beta
      onboarding, commissions ledger in admin.html; see GO-LIVE.md). Read it
      first, then say what is there and what is missing.

## New categories — planned, not built

- **The pre-made line** (name to come). Finished designs, nothing painted:
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
- **Sense** — a category. What goes in it: to be described by Alyx.
- **Your ideas, your cut** (working name). A separate category: people submit
  ideas, and earn a percentage on every one that is adopted and developed.
  Gets people invested in the app; enough involvement may later support
  selling advertising. The flyer betas' commissions ledger and payouts may
  carry it — read that before designing anything new.
- **Optical Illusions** — an art style dressed as a tile in Art Style,
  templates for nearly every product (up to ~10 each, ~250 in all) plus a
  "suggest a template" box. Waits on the templates. Claude and Bud to agree
  the prompts; each template drawn at its product's own print shape.

## Waiting on Alyx or Bud

- Night-Buddy, Warm Glow: its price. (Full Colour is $14.95, Alyx's price.)
- Method C on wraparound-compare.html (paints without charging): delete or
  keep?

## Deferred

- A Printify-style placement editor.
- Researching more products.
- Night-Buddy * — US shipping ($19.29 first, $15.99 each extra) is more than
  the item ($14.95). Alyx: "The shipping should not be more than the item";
  may drop it.
- Frosted glass beer mug — not on the site; kept for later, if the liquid
  motif idea comes to something. Wholesale $23.83; US shipping $12.49 /
  $3.99 each extra (probe 24 Sep 2026).
- The coffee mug and travel cup rails in the panel checker
  (`flow-tests/verify-panel-checklist.js` skips them today).
