# SESSION HANDOFF — Muggshotz / Needles' Studio
Rewritten 2026-08-27 after a very long session. Supersedes the 2026-08-26 version.
Owner: Alyx (voice-to-text — expect phonetic typos; read charitably, confirm anything ambiguous).

## Read this first: three lessons that cost real time today

**1. A comment is not the code.** The old version of this file, and a comment block in
`lib/products-catalog.js`, both described behaviour that had been replaced months earlier. Acting
on them produced confident, wrong statements to Alyx twice (a "$0 shipping bug" that does not
exist, and a relay endpoint that 405s). **Read the code before repeating any claim from a
comment, including from THIS file.**

**2. "Clear them by name" is a recurring bug in this codebase.** Three separate spotlight bugs
today had the identical shape: a function removed specific `*-focus` classes by name, so any
class added later survived and dimmed the wrong thing.
- `startNeedlesStage()` removed only `final-generate-focus` → `product-focus` survived into
  generation and veiled the whole Needles easel at 35% opacity.
- `resetEverythingFreshStart()` removed three by name → new option spotlights would have survived.
- Naming a class `idea-spotlight` instead of `ideafirst-focus` would have made it invisible to
  both suffix sweeps.
All three are now blanket sweeps on the `-focus` suffix. **Any new spotlight class MUST end in
`-focus`.**

**3. Baseline every fix against the build Alyx is running, BEFORE trusting it.** Every bug fixed
today was first reproduced by running the new test against `origin/main`. That caught two tests
that would otherwise have passed vacuously, and proved a "bug" in the 14oz travel mug was
actually a wrong assumption in my own test.

## Portal / network access
Working. The sandbox reaches `muggshotz-ai-test.vercel.app` directly.
`curl -sS "https://muggshotz-ai-test.vercel.app/api/admin?action=printify-catalog&path=catalog/blueprints/596/print_providers.json"`

- **Catalog reads (GET, unauthenticated):** `api/admin.js?action=printify-catalog&path=…`, whitelisted
  to four catalog paths by `isAllowedPrintifyPath()`. **Search is NOT one of them** — search,
  providers and variants live on `/api/printify-catalog?action=search|providers|variants`.
- **Cost probe (POST, admin password):** `{action:'cost-probe', password, blueprintId, printProviderId}`
  returns real per-variant WHOLESALE plus the shipping table. Printify's catalog API carries no
  cost at all, so the probe creates a throwaway draft product, reads costs off it, and deletes it
  in a `finally`. Probe products are titled `ZZ_COST_PROBE_DELETE_ME <bp>/<prov>` so any orphan is
  obvious. **Never move this to the GET relay** — catalog GETs need no auth, so that would publish
  wholesale pricing to anyone who found the URL.

## Testing (`flow-tests/`) — 14 suites
Serve the repo first: `python3 -m http.server 8788 --directory <repo> --bind 127.0.0.1`.
Chromium is preinstalled at `/opt/pw-browsers/chromium` — use `executablePath`, do NOT
`playwright install`. `npm install playwright` in a scratch dir and copy the harness there.

`harness.js` stubs EVERY `/api/*` call (zero real spend), plus Google Fonts and
`images.printify.com` (the travel grid renders one `<img>` per variant from it; unstubbed that is
four ERR_CONNECTION_RESET console errors per run that look like a product fault and are not).

| suite | covers |
|---|---|
| `verify-fixes.js` | the original 8 regression checks (mug rail, watchdog, spotlight handoffs) |
| `verify-option-spotlight.js` | one lit card at every rail step, relay, reset sweep |
| `verify-approve-handoff.js` | Continue to Order lit/in-view, description required, rail order |
| `verify-auto-mockup.js` | every single-image product fetches its mockup on approve |
| `verify-idea-confirm.js` | description confirm goes forward; stage never veiled |
| `verify-gimmick-gate.js` | gimmicks limited to mug + travel cup |
| `verify-wraparound.js` | Wraparound on both rails: panorama vs per-panel engine, outage fallback, 403 no-retry, mug thirds vs travel-cup uncut, 40oz exclusion |
| `verify-price-parity.js` | **no browser** — order.html vs catalog price drift. **Run it from the repo root** (`node flow-tests/verify-price-parity.js`), not from the scratch copy: it reads `order.html` and `lib/products-catalog.js` by relative path and ENOENTs anywhere else. |
| `verify-poster.js` `verify-puzzle.js` `verify-tote.js` `verify-phone-suitcase.js` `verify-coaster-mousepad.js` `verify-travel.js` | per-product flows |

**Fixtures ARE committed now** (`test-photo.jpg`, `fake-generated.jpg`, `fake-mockup.jpg`) — they
were missing before, which made the whole harness unrunnable from a fresh clone.

**Gotchas that produce false failures:**
- `resetEverythingFreshStart()` opens a `window.confirm()`. Playwright auto-DISMISSES dialogs, so
  a reset test must `page.once('dialog', d => d.accept())` first.
- `page.fill('#ideaDesc')` FOCUSES the textarea, which fires `showIdeaBoxIntroIfNeeded()` — a
  once-per-session MODAL that then swallows the next click. Call `dismissAlerts(page)` after.
- A full sweep takes several minutes. Tell Alyx that before going quiet on one.

## The rail, as it now stands
Alyx's model, in their words: **"pick the damn product"** means finish the product — size, colour,
model — THEN the image. Bouncing a customer out to the artwork and back for the size is exactly
what not to do.

```
product → its options (all of them) → description → Generate → real mockup → order
```

- **Spotlight**: each option card lights when its product is picked and hands off when its choice
  is made. Dim-only, no `pointer-events` lock — a dim is a guide, not a cage, so deliberate
  detours stay clickable.
- **Two tracks**: the two-track system exists ONLY to host the three gimmick templates (Cover Me,
  Face It, Home Sweet Home), and those only fit **coffee mugs and travel cups**. Every other
  product is silently routed to the description path and never shown the panels.
  `PRODUCTS_WITH_GIMMICKS` in needles-studio.html; gated at `showDesignMethodCard()`, the single
  door every route passes through. Alyx explicitly declined a Photo/Poster exception: "nobody
  really wants a poster of them on the cover of Newsweek."
- **Description is mandatory** for every print-onto-object product (`PRODUCTS_NEEDING_IDEA`).
  Left blank, prompt assembly silently substitutes a generic caricature line, so the customer pays
  tokens for an image nobody described. That is how a suitcase run came back as an Oval Office
  scene. The guard fires LAST, after the product is settled.
- **Mockups fire automatically on approve** (`PRODUCTS_AUTO_MOCKUP`). They used to sit behind the
  "Continue to Order" button — `continueToRealMockup()` IS the mockup — which reads like checkout,
  so nobody would guess a preview was there. Mug and travel cup are excluded; they already fetch
  by their own routes and would double up.

## Products
Live and working end-to-end: **mug, travel cups (6 variants), phone case, suitcase, tote bag,
photo puzzle, photo/poster, coasters, mouse pad.**
On the grid with NO catalog entry (generate art, cannot be ordered): **greeting card, post-it.**

### Wholesale (live cost probe, 2026-08-26) — margins BEFORE Stripe
Stripe takes 2.9% + 30c of the **whole sale**, so a high price with a thin margin is the worst
combination: the fee scales with price, the margin does not.

| product | wholesale | retail | profit |
|---|---|---|---|
| mug 11oz / 15oz | $7.71 / $8.78 | $17.95 | $10.24 / $9.17 |
| phone case (iPhone 11–17) | $11.04 | $19.95 | $8.91 |
| phone case (5/5s, 6/6s, S6) | $15.77–$17.87 | $19.95 | $2.08–$4.18 |
| coasters, set of 4 | $19.79 | $29.95 | $10.16 |
| mouse pad 9x8 | $4.88 | $9.95 | $5.07 |
| puzzle 96 / 252 / 500 / 1000 | $35.07 / $33.62 / $38.29 | $40.95 / $38.95 / $43.95 | ~$5.33–$5.88 |
| poster 9x11 → 11x14 | $5.64–$9.98 | $11.95–$14.95 | $4.97–$6.31 |
| poster 16x20 / 18x24 / 24x36 | $16.18 / $20.18 / $32.21 | $19.95 / $24.95 / $34.95 | $3.77 / $4.77 / **$2.74** |
| suitcase S / M / L | $144.93 / $162.64 / $180.35 | $169.95 / $194.95 / $214.95 | $25.02 / $32.31 / $34.60 |
| **Vacuum Thermal Tumbler 40oz** | $13.69 | $24.95 | $11.26 (**$9.58 after Stripe**) |
| travel mug 40oz **insulated** | $39.29 | $44.95 | $5.66 (**$3.84 after Stripe**) |

**Two price ladders deliberately DECREASE. Do not "fix" them:**
- Puzzle: 96 pcs costs MORE than 252 pcs ($35.07 vs $33.62) — short runs are dearer. This was
  flipped once today on the assumption it was an error; the probe disproved it and it was reverted.
- Poster: 11x17 ($7.97) costs less than the smaller 11x14 ($9.98).

**Alyx's pricing philosophy:** *"I am not greedy… a quality product at a fair price."* Too much
margin hurts affordability and desirability. The app runs on its own steam, so every sale is
profit; the only question is how fast. Printify guarantees the goods, so damage is replaced at
their cost, not ours. Thin margins on large formats are a deliberate choice: *"it hurts nothing to
offer them. They cannot buy them if they don't want them."*

**Seasonal note:** drop coasters to ~$24.95 around Christmas to land under $25 for Secret Santa
(still $5.16 clear). Alyx wants phone cases under $20 for the same reason — already done.

### The two 40oz tumblers (2026-08-27) — they are not the same product
Alyx found a 40oz that genuinely wraps. It was already sitting in the catalog as
`travel-mug-40oz-vacuum` (bp **1715** / **Smart Printee 90**), entered by an earlier session,
never surfaced in the studio, and written off in this handoff as a leftover to scratch. **That was
wrong.** Verified against the live API, not the comment beside it:

| | placeholders | wholesale | US ship | net after Stripe |
|---|---|---|---|---|
| Vacuum Thermal 40oz (1715/90) | **one**, `front` 3710x2817 — a full wrap | $13.69 | $19.39 / $17.99 | **$9.58** @ $24.95 |
| Insulated 40oz (1498/217) | **four** — mug_front/back 900x1200, drinkware_front/back 825x1200 | $39.29 | $7.59 / $2.99 | **$3.84** @ $44.95 |

The insulated one's handle splits its body into separate faces, which is why it is `front-back`
and why no amount of generator work will ever make it wrap. Priced per Alyx: *"just figure to make
a $9 profit… that way the customer gets a really good bargain."* $24.95 → customer pays **$44.34
all-in**, against **$52.54** for the insulated cup that nets us a third as much.

**Two things still open on it:**
- **Decoration is `uv`, not sublimation** — a different printer and ink system from every other
  product in the catalog. UV DTF tumbler wraps are an established process, but we have never run
  one. **Order a sample before promoting it.**
- **US shipping is $19.39**, the highest in the catalog by a wide margin, and the customer sees it
  as its own line — 78% of the product price on a $24.95 cup. The all-in total still wins; the
  optics are real.
- Colour hexes are still best-guess: Printify's variants endpoint exposes only colour **names** for
  this blueprint, no swatches. Not fixable through the API.

**Consider retiring the insulated 40oz rather than carrying both** — the worse product cannibalises
the better one, and it is the thinnest real margin in the catalog after the 24x36 poster.

### Poster provider history (do not undo)
Posters ran on blueprint 1079 / **Prima Printing**, which has **NO US shipping profile at all**.
US orders fell to REST_OF_THE_WORLD at **$31.79 a poster** against $6.99 for a mug — a $12.95
poster cost $44.74 delivered, so posters were effectively unsellable domestically. Moved to
**Printed Simply (852/73)**, US shipping $6.79, Matte-only (hence no finish choice).

**Frames removed.** Print Pigeons charged $57.87 to frame an 18x24 whose print costs about a
dollar — the frame alone was $56.82. Retail $61.95 cleared ~$2 after Stripe. Alyx: *"for $61
they'll probably make their own frame."* `resolvePhotoPosterSelection()` still has a framed
branch; it is simply unreachable.

## Wraparound — unshelved, and how it runs now (2026-08-27)
Wraparound had been pulled from customer view entirely (commit `3695c8a`) because neither engine
behind it was sellable: the per-panel method (Center, then Left/Right as "continue this scene"
edits) drifted at the seams, and the Gemini one-shot panorama that fixes that by construction
could not run at all on a free-tier key. **Alyx funded the Gemini key**, the panorama was measured
live, and Wraparound is back for **coffee mugs and travel cups**.

**Why the panorama works and gpt-image-2 never could:** gpt-image-2 is hard-capped at three sizes,
the widest being 1536x1024 (1.5:1). A mug's print area is 2475x1155 (2.14:1). Nothing fixes a 43%
gap. `gemini-2.5-flash-image` takes an arbitrary `imageConfig.aspectRatio`; at `21:9` it returns
~2.29:1 — about a 7% crop.

| | shape | who uses it |
|---|---|---|
| `leftUrl` / `centerUrl` / `rightUrl` | three equal thirds | coffee mug (three print panels) |
| `panoramaUrl` | the whole uncut image | travel cups (one continuous wrap) |

Both come back from the **same single call** — `{action:'wraparoundPanorama'}` in `api/generate.js`.
One extra upload is far cheaper than a second generation, and it lets the caller pick its own
shape instead of the backend guessing from a product name it does not have.

**Three things that are deliberate, not oversights:**
- **There is no opt-in checkbox any more.** `useGeminiPanorama` is gone. A customer cannot judge
  which engine drew their mug, so offering the choice was an internal flag wearing a customer-
  facing hat. Wraparound *means* the panorama.
- **A panorama outage falls back to the per-panel engine instead of throwing.** Throwing was right
  while it was an experiment the customer could untick; it is the product now, and an outage must
  not strand someone who picked a valid option. **A 403 (out of credits) is NOT an outage and must
  never fall through** — that path would generate, and charge, a second time. Pinned by
  `mugWraparoundOutOfCreditsDoesNotRetry`.
- **The 40oz still never sees the option.** Its handle physically breaks the front face, so there
  is no continuous surface to wrap. That is a fact about the cup, not the generator; funding
  Gemini does not change it.

**Bug found the moment it came off the shelf:** the wraparound notice reads *"describe your idea
for us in the box above"* — and the box above was collapsed to zero height, off-screen, because
`ideaCard` lives inside `edgeFadeIdeaSection` and nothing on that route expanded it.
`snapExpandThrough('designMethodCard')` could not have: **`designMethodCard` is not in
`SNAP_ORDER`, so that call returns immediately and does nothing.** Fixed in
`showDesignMethodCard()`, which now expands and hands off to the idea box on that path.

**Pricing is unchanged and already wired:** `WRAPAROUND_SET_SURCHARGE = 3` in
`create-checkout-session.js`, applied only when `isWraparoundSet` — which `goToOrder()` sets for
**mugs only**. Travel-cup wraparound carries no surcharge (it is one image either way, so it costs
no more to make). Not touched; flagged for Alyx if they want it revisited.

**"Travel cup" is not one shape.** Measured live from Printify's placeholders, not guessed:

| cup | print area | ratio | engine |
|---|---|---|---|
| 20oz (bp 353) | 2795x2100 | 1.33:1 | single-image (1.5:1) |
| 32oz Gator (bp 1235) | 3384x1937 | 1.75:1 | single-image (1.5:1) |
| 14oz handle (bp 1160) | 1995x930 | 2.15:1 | **panorama** |
| 30oz Tundra (bp 1662) | 3634x1039 | 3.50:1 | **panorama** |
| coffee mug | 2475x1155 | 2.14:1 | **panorama** (three thirds) |

The panorama prompt places the subject in the **centre third**, so at ratio R that third is `R/3 : 1`
— a workable portrait frame at 2.15 (0.72:1), a useless vertical sliver at 1.33 (0.44:1). A 21:9
image letterboxed into a 4:3 wrap would also leave the art on barely half the cup's height. So
`wrapIsPanoramic()` gates the panorama at `PANORAMA_MIN_WRAP_RATIO = 2.0`; narrower wraps keep the
single-image path they already had. **Wraparound is still offered on every one of them** — only the
engine differs, which is not something a customer can see. `verify-wraparound.js` pins both the
ratio table and the threshold, so an edit by eye fails before a customer gets a letterboxed cup.

**Known limit, not yet addressed:** Gemini returns roughly 1536x672 for the whole panorama, so a
mug panel arrives ~512x672 against a ~825x1155 print slot. `buildWraparoundImage()` already
lanczos-upscales into the print canvas, so adding a second upscale in `generate.js` would only
resample twice. The real ceiling is Gemini's native output size. **Worth eyeballing on a physical
proof before promoting Wraparound anywhere prominent.**

## Structural things worth knowing
- **`order.html` keeps its OWN copy of every price**, separate from `lib/products-catalog.js`
  which is what `create-checkout-session.js` actually bills from. Phone cases had already drifted
  ($24.95 on the page, $19.95 in the catalog), and coasters/mouse pads had no branch there at all
  so they would have been priced as MUGS. `verify-price-parity.js` now fails on any mismatch.
- **`buildMockupRequestBody()` is a hardcoded if-chain** and a missing branch returns `null`
  SILENTLY — the product generates art, looks healthy, and never mockups. Three products were in
  exactly that state at the start of today. **Recommended (not built):** make it table-driven so a
  new single-image product is a data entry and a missing one fails loudly.
- **Shipping is correct as-is.** `shippingCost: 0` in the catalog is a FALLBACK. Real shipping is
  looked up live per destination at checkout (`lib/printify-shipping.js`) and added as its own
  "Shipping & Handling" line, alongside Stripe's `automatic_tax`. Customer pays product + markup +
  shipping + tax. **This is not a bug — the old comment saying otherwise has been corrected.**

## Secret sauce (read-only — flag, never edit)
All AI prompt/description assembly. `getProductRules()` in needles-studio.html has no entry for
**coasters or mouse pads**, so both fall through to its generic default. It works, but a tailored
line for a 4" coaster and a 9x8 mouse pad would likely produce better art. **Flagged for Alyx,
deliberately not edited.**

## Testing the live site — Incognito does NOT work
`getDeviceId()` mints the device id into `localStorage`; Incognito destroys it on close, so every
Incognito session is a NEW device, and `api/get-balance.js` never creates a row for an unknown
device. Result: zero credits, permanently, and topping one up funds a ghost.

**Correct approach:** a separate persistent Chrome PROFILE. Stable device id — grant it tokens once
via admin.html and it sticks. The page prints the device id bottom-left on screen.

**Cache-busting for Alyx:** give them a URL with a `?v=N` they have not used before, e.g.
`https://muggshotz-ai-test.vercel.app/needles-studio.html?v=8`. The number is meaningless to the
server (it always serves the newest build) — it only has to differ from last time. Alyx has used
v=3, v=4 and v=7. **Always tell them the number when announcing a push.**

## Open items
- **`ADMIN_PASSWORD`**: `api/admin.js` still has `process.env.ADMIN_PASSWORD || '$Noneya6611$'` —
  a hardcoded fallback, in git history. Raised with Alyx, who reasonably declined to act: the repo
  is private with 0 collaborators, and the worst case is someone granting themselves free tokens.
  **Do not re-raise unless the repo goes public or gains collaborators.**
- **Greeting card + post-it** need catalog entries before they can be ordered.
- **`travel-mug-40oz-vacuum` is now live** — see "The two 40oz tumblers" above. It was NOT a
  leftover; it is the only 40oz we sell that can actually wrap, and it nets two and a half times
  what the insulated one does. Still needs a **sample print** before promotion (UV decoration).
- **FIXED 2026-08-27: order.html was missing two travel cups.** The 32oz Gator and 30oz Tundra
  were sellable in the studio but absent from `order.html`'s own `TRAVEL_MUG_CATALOG`, which is
  the table its tiles are built from. Not a crash — `selectedTravelProductKey` starts null on that
  page and is only set by clicking a tile there, so the customer's cup silently vanished and they
  picked a different one, correctly charged for a product they never chose. `verify-price-parity.js`
  now checks travel variants three ways (studio↔order presence, studio↔catalog presence, price
  agreement) and was proven against a re-broken copy before being trusted.
- **24x36 poster** is the thinnest margin in the catalog (~$1.43 after Stripe). Kept on Alyx's
  call; $39.95 would clear $7.58 if it ever needs rescuing.
- Alyx works in **real time, one bug at a time**, from live runs with screenshots. Expect reports
  mid-turn. Fix them one at a time, verify, push, and **tell them the version number**.
