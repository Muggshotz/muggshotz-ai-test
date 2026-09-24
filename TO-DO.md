# The to-do list

Started 24 Sep 2026, when the old lists ran out. Newest plans at the top of
each section. What is done moves to the bottom, briefly; the details live in
the commits.

## This week — before the flyers go out

- [ ] **Order the business cards** (Alyx, in Printify). Print Pigeons' boxed
      cards, 100, laminated, front and back. The product is saved as a draft
      in Printify; order it from **Orders** as a manual order, not Publish.
      Print files: `art/business-card/muggshotz-card-front.png` and
      `-back.png`, also at
      https://muggshotz-ai-test.vercel.app/art/business-card/muggshotz-card-front.png
- [ ] **The sister test**: someone new scans the card, gets the "5 free spins"
      panel, enters a fresh email, the email arrives, and the studio then
      shows 5 chips. Tells us whether the verification email reaches real
      people: it is sent from `onboarding@resend.dev`, the email service's
      test sender (`api/send-verification.js`). If it does not arrive, the
      sender needs Alyx's own domain set up before any flyer goes out.
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

- The breakup template's real name ("We Need to Talk" is a placeholder).
- The frosted glass stein's price.
- Method C on wraparound-compare.html (paints without charging): delete or
  keep?
- A sending address of Alyx's own for the free-spin emails (the email service,
  Resend), if the sister test says so.

## Deferred

- A Printify-style placement editor.
- Researching more products.
- Night-Buddy.
- The coffee mug and travel cup rails in the panel checker
  (`flow-tests/verify-panel-checklist.js` skips them today).

## Done lately (23–24 Sep)

- SURPRISE!!! smart mug: 8 templates plus Ready? with six other sides (girl
  and twins made in-house), right-handed prints facing the opener, a
  COLD → HOT picture for every print, the new Will You Marry Me?, the hidden
  "I Don't Know" mug (?surprise=i-know).
- Business cards: Your Card (details typed, never painted; Printify's cut and
  safe lines); the real card, front and back, with a working QR code.
- Business-card spins: ?card=MUGGSY, 5 spins paid on a verified email, once
  per address; off switch in `lib/card-bonus.js`.
- Doormat prints full, no white sides. Front page forwards to the studio;
  the old generator kept at excelsior.html.
