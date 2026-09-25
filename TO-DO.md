# The to-do list

Started 24 Sep 2026, when the old lists ran out.

## This week

- [x] **Flyers wired in** (25 Sep): a beta's featured product now reaches
      the flyer and the landing page. lib/flyer-products.js holds each
      product's headline, pitch, three steps and picture, priced from the
      catalog; flyer-sheet.html prints product flyers (two to a page, the
      smart mug's COLD -> HOT strip full width) when the Foxhole's link names
      the product; start.html asks the code (get-balance) what its beta sells
      and pitches that; the Foxhole's product dropdowns come from the catalog
      (action=flyer-products). supabase/flyer-core.sql defines the tables and
      the two functions the code always called but the repo never held.
      **Open:** whether the live project has `fn_credit_commission` and
      `fn_beta_available_balance` (Supabase -> Database -> Functions); if not,
      run flyer-core.sql (GO-LIVE step 1). No flyer sale credits without them.
      Stories are written for 19 products; the rest print the generic words
      with no picture -- add a story in lib/flyer-products.js to give one.
      The 40oz travel mug has no product photo in the repo, so its flyer has
      no picture yet.

- **TROMPE-L'ŒIL button** (Alyx and Bud, 25 Sep; waits for "begin"). A button
  beside the description box on every product panel. Pressing it sends Bud's
  instructions (prompts/trompe-loeil.md, verbatim, with the product's name
  filled in) straight to the generator; the customer never sees them, only
  the result. No photo: rides the describe-only lane, one token. First result
  on a mouse pad: a stone well shaft seen from above, so the pad is a hole in
  the desk and the mouse sits over it. Alyx: "through pushing this button we
  will educate the American public what this phrase actually means."

- **"Hmm... seems like I'm forgetting something"** (Alyx, 25 Sep): a category
  of mouse pad premades, each a thing you should be doing instead of sitting
  at the computer: a washing machine mid-cycle (Bud's trompe-l'oeil result,
  the mouse going round on the drum), a skillet on the stove about to burn,
  a hot plate, an open textbook or homework, laundry, "anything that signals
  what you probably should be doing instead of wasting all this time on the
  computer." Goes in with Premades & Sets.

- **The Unwelcome Mat** (Alyx, 25 Sep): a category of doormat premades from
  the trompe-l'oeil prompt: eyes peering up from beneath the boards, the
  snarling dog, a trapdoor with the bolt drawn, a manhole with the cover off,
  a pit, "anything we can think of." Bud's first result: WELCOME cut from a
  wooden dock over clear water, the missing boards where the letters are
  (its W and last E run off the mat's edges; watch the letters at the edges
  on a doormat). Bud then made nine (25 Sep): dock over water, dog through
  the boards, rope bridge, cracked ice, crocodile, open manhole, lava pit,
  shark at a pier, spike pit. The dock and the manhole have their lettering
  cut at the edges; the rest are print-ready. Goes in with Premades & Sets.

- **Every product that can spin, spins** (Alyx, 25 Sep: "The carousel is my
  jam"). The suitcase joined the mugs, cups and stein on the 3D mockup (V380).
  Still on Printify's photos: coasters, phone cases, tote, puzzle, poster,
  doormat, ornament, stein excepted, and the rest. Each needs a drawn body.

- **Flyers for single products** (Alyx, 24 Sep): beautifully imagined flyers
  that show one product's flow and the model simply; the smart mug first
  (its COLD -> HOT pictures already tell the story). Done for the smart mug
  (above); the words for the other products are first drafts.
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

- **The Square walk-through (Alyx, 24 Sep 2026: "a test that must be run
  from order to purchase just using the Square pipeline alone").** Sandbox
  keys are in and the switch works; nothing has yet gone through Square's
  real sandbox end to end. When it is run: (1) Foxhole -> Switch to Square;
  (2) studio -> 3 Tokens $1.00 -> Square's page -> test card
  4111 1111 1111 1111 -> back on the studio, and the Vercel log shows
  "Ignored a SANDBOX Square payment" (the webhook's signature and our
  redirect both proven); (3) Foxhole -> Mint a $25 sandbox gift card ->
  order page -> the number in the gift box -> pay: the card pays first and
  the card box appears for the rest; (4) Switch back to Stripe. Until this
  has run, the Square track is proven only against stand-ins.

- **Muggsy on gift.html.** The page offers Needles, Chipper and Sly (their
  cards carry no amount; the number is laid on). Muggsy joins the moment
  Bud's card arrives without the "$50" on it (BRIEF-GIFT-CARDS.md).

## Waiting on Alyx or Bud

- The bug-report email address (Alyx is making a dedicated one).


## Deferred

- A Printify-style placement editor.
- Researching more products.
- Night-Buddy (off the grid since 24 Sep 2026; the option card, prompt and
  checkout stay for its return) * — US shipping ($19.29 first, $15.99 each extra) is more than
  the item ($14.95). Alyx: "The shipping should not be more than the item";
  may drop it.
- Frosted glass beer mug — not on the site; kept for later, if the liquid
  motif idea comes to something. Wholesale $23.83; US shipping $12.49 /
  $3.99 each extra (probe 24 Sep 2026).
- The coffee mug and travel cup rails in the panel checker
  (`flow-tests/verify-panel-checklist.js` skips them today).
