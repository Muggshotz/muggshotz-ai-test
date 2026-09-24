# The to-do list

Started 24 Sep 2026, when the old lists ran out.

## This week

- [ ] **Flyers wired in** so printing can start and betas can be collected.
      The flyer/beta system already exists (flyer codes, campaigns, beta
      onboarding, commissions ledger in admin.html; see GO-LIVE.md). Read it
      first, then say what is there and what is missing.

- **Flyers for single products** (Alyx, 24 Sep): beautifully imagined flyers
  that show one product's flow and the model simply; the smart mug first
  (its COLD -> HOT pictures already tell the story).
- **Protecting the smart-mug idea** (Alyx: "appropriately patented"). The
  colour-changing mug itself is a stock Printify product; what is Alyx's is
  the use of it (opener facing the drinker, punchline behind, the SURPRISE!!!
  name). Ask a patent/trademark attorney what can be protected; a trademark
  on the name is the usual first step.

- **The SURPRISE!!! panel** (Alyx, 24 Sep, "will probably take some focused
  attention"): (1) the three-mug COLD → HOT advertisement at the TOP of the
  panel, before the templates -- today a plain black mug sits there and the
  COLD → HOT picture only shows after a template is tapped, so nobody sees
  what the mug does; (2) drop the line "Who is it for? The surprise faces
  them as they hold it." (the hand tiles stay); (3) a "make up your own"
  tile with a short kit (what an opener and a punchline are, examples) and
  the space to type theirs -- painting a two-part print from their words is
  new. Alyx also says the example pictures shown on tapping are "the wrong
  stuff"; which ones is not known yet -- ask for a screenshot.
- **The Square track, part two**: selling the physical Square gift card on
  the site (card + stamp + envelope on the price), an admin mail queue, and
  activation when the packer types the card's number. Part one (both tracks
  wired, gift cards charged on the page, the admin switch) is built:
  SQUARE-SETUP.md. Sales tax is not charged on the Square track -- decide
  before ordinary sales move onto it.

## The spark — SURPRISE!!! mugs for podcast hosts

Hidden templates (like Candace's, ?surprise=i-know), gifted by Alyx to hosts
who keep a coffee mug on camera. Gift only: no selling their likeness or
using their face or reaction in our ads without their permission. Each needs
art (opener left, punchline right, black between) and a link name.

- Candace Owens — "I don't KNOW know..." / "But I know..." (live: i-know)
- Joe Rogan — "This juice?" / "...was definitely worth the squeeze." (his
  saying: the juice is not worth the squeeze)
- Dave Smith, Baron Coleman, Tucker Carlson, Oprah — ideas to come

## New categories — planned, not built

**The grid (Alyx, 24 Sep 2026): 28 tiles, seven even rows of four.** 24
products (Night-Buddy off the grid for now; the frosted glass mug not added),
then a last row of four: Artwork Only, Gift Certificate, Premades & Sets,
Pitch In. The grid is three across today (needles-studio.html, #productCard
.grid3); four across on phones too (Alyx, 24 Sep).


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
- **Pitch In**. Alyx (24 Sep): "I intend for this to become The People's
  App" -- the customers invent the products, test them, find the bugs, and
  share in what sells. A separate category: people pitch ideas, and earn a
  percentage on every one that is adopted and sold. Tapping it opens a short,
  clear explanation (draft 24 Sep: tell us the idea; if we make it, it goes in
  the shop; every sale pays you your %). **The reward (Alyx, 24 Sep): 5% plus
  10 free chips** when an idea is adopted, so the pitcher tests the idea
  themselves and reports back if anything doesn't work (Alyx: likely to buy
  their own item just to see). 5% of the PROFIT, not the sale price (Alyx:
  "5% of the gross could get messy") -- the catalog's estimatedProfit, the
  same base and the same 5% the flyer betas earn at the Muggshotz tier
  (lib/flyer-tiers.js: rate 0.05).
  **One year per item, from its born-on date** (Alyx, 24 Sep; first said in
  perpetuity, then capped): the inventor earns 5% net on each item for one
  year from the day that item goes on sale, after which the business owns it
  outright -- the ITEM, not the category. The inventor holds a 5% net stake
  in the CATEGORY: every new item added to it, including designs the business
  adds itself, gets its own born-on date and expiry date (one year later) and
  pays the inventor 5% for its year. (Each item stores both dates and its
  category's inventor.)
  **Every refusal gets an explanation** (Alyx, 24 Sep) of why the idea was not
  taken up, as detailed as the pitch warrants: a partial bulwark against
  complaints and accusations about unused suggestions. Customer-facing terms:
  draft in PITCH-IN-TERMS.md.
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
  flyer emails do); no text-message service is connected. Plan (24 Sep):
  reports go by email to a new address Alyx makes just for them. When he
  sends it, send one test report there first: the site mails from
  onboarding@resend.dev, which may only deliver to the Resend account's own
  address.
- **Optical Illusions** — an art style dressed as a tile in Art Style,
  templates for nearly every product (up to ~10 each, ~250 in all) plus a
  "suggest a template" box. Waits on the templates. Claude and Bud to agree
  the prompts; each template drawn at its product's own print shape.

## Waiting on Alyx or Bud

- The bug-report email address (Alyx is making a dedicated one).

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
