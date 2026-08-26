# SESSION HANDOFF — Muggshotz / Needles' Studio
Written 2026-08-26 by the outgoing Claude Code session, for the incoming one.
Owner: Alyx (voice-to-text user — expect phonetic typos; read charitably, confirm before acting on anything ambiguous).

## Portal / network access — RESOLVED
Alyx's network-policy change WORKED. The sandbox now reaches `muggshotz-ai-test.vercel.app`
directly (was 403 at the proxy). Re-confirm with:
`curl -sS "https://muggshotz-ai-test.vercel.app/api/admin?action=printify-catalog&path=catalog/blueprints/596/print_providers.json"`
Live read-only Printify catalog access via The Portal's relay (server-side token, GET-only).

**Relay gotcha (corrected 2026-08-26):** the admin relay does NOT support search. `api/admin.js`
whitelists exactly four catalog paths (`isAllowedPrintifyPath`) and 405s everything else. Search,
providers, and variants live on `/api/printify-catalog?action=search|providers|variants`.

**Wholesale cost is NOT reachable.** Printify's catalog API carries no `cost` field; cost only
appears on products that already exist in the shop (`?action=product&productId=` returns
`cost`/`price` in cents). No puzzle product exists yet. Every product in `lib/products-catalog.js`
still has `shippingCost: 0` / `estimatedProfit: 0` — all placeholders, none real. The only real
datapoint found: the live mug product, 11oz cost $7.71 / listed $12.85, 15oz $8.78 / $14.63 (both
40% margin). Do NOT extrapolate that to other blueprints/providers. To get real puzzle costs:
read them off the Printify dashboard, or create a draft product for 596/80 and query it through
the existing relay. Do NOT widen the relay whitelist — catalog GETs are unauthenticated, so
allowing shop reads would publish wholesale costs.

## State of the repo
- `main` = live site (Vercel auto-deploys it). Contains: all of tonight's mug-flow fixes, the
  full flow-audit fixes (merged with Alyx's explicit authorization), the guided-rail spotlight
  rework. Zero known console errors on the mug path.
- Branch **`claude/phone-suitcase-flows`** — UNMERGED, awaiting Alyx's word. Wires phone cases
  and suitcases through to the Printify mockup (buildMockupRequestBody branches + a new
  mandatory suitcase size card). Playwright-verified. Do not merge without explicit authorization.
- Branch **`claude/handoff-portal-check-dro4je`** — Photo Puzzle + price flip: MERGED to main
  2026-08-26 with Alyx's explicit authorization. Branch then restarted from main for the
  Photo Poster + Tote Bag work.
- `claude/phone-suitcase-flows` — MERGED to main 2026-08-26, same authorization. The merge
  conflicted (11 hunks in needles-studio.html: puzzle and suitcase touch the same six places).
  Every hunk was "both sides added adjacent code" -> keep BOTH, never pick a side. Two needed
  real merging: the `finalGenerateGuidance` toggle must carry all three conditions (phone case
  OR puzzle OR suitcase — taking either side alone silently breaks the other product), and a
  naive union left `pickPuzzleSize()` unclosed because the shared tail after the hunk only
  closes one copy. If this pattern recurs, resolve by union + a hand-written bridge.
- Branch `claude/needles-flow-audit` — already merged into main; can be ignored.

## Standing rules (Alyx's, non-negotiable)
1. **Secret sauce is read-only**: all AI prompt/description assembly. Locations inventoried in
   `flow-tests/AUDIT-CATALOG.md`. Flag, never edit.
2. **Feature/fix work on a separate branch**; nothing merges to main without Alyx explicitly
   saying so. (Reversibility is the accepted safety model — git revert covers regrets.)
3. **No live money calls** — checkout/Stripe is intentionally unwired; all flows converge at a
   future single checkout point. Any flow failure BEFORE the order page is a bug; a stop at
   payment is by design.
4. **Playwright-verify everything** before handing back. Harness lives in `flow-tests/`
   (see below). Zero console errors is the bar.
5. **The guided-rail design philosophy** (Alyx's words, paraphrased): at every step exactly ONE
   lit point of engagement; everything else dimmed via the body-class system
   (`generation-active`, `*-focus`). Deliberate detours (e.g. the caption/add-text card) stay
   discoverable but must return the customer to the rail. Never remove a dim — hand the
   spotlight off to the next step. `clearAllFocusModes()` is the handoff helper.

## Product priority order & status
1. Coffee mugs — ✅ full rail works end-to-end (three props + description-only, panel screen,
   mockup lightbox, order handoff)
2. Travel mugs — ✅ works (variant → style flow); lighter test coverage than mugs
3. Phone cases — ✅ built, on the UNMERGED branch
4. Photo Puzzle — ✅ built this session, on `claude/handoff-portal-check-dro4je` (UNMERGED).
   Mandatory piece-count card (2x2 grid, 4 tiers) before Generate, mirroring the phone-case
   pattern; `buildMockupRequestBody` maps UI value `'puzzle'` → catalog key `'photo-puzzle'`
   (they differ — that translation is the whole trick). Server side needed ZERO changes:
   `colors: null` + per-size `variantId` means `resolveVariant()` hits its final branch and
   resolves straight off the catalog. All 4 variant IDs confirmed against LIVE Printify:
   96pcs=80317 (4724x3543), 252pcs=80318 (4724x3543), 500pcs=74740 (7200x5400),
   1000pcs=74741 (8400x6000).
   **PRICE FLIP (Alyx's explicit call, 2026-08-26):** 96pcs and 252pcs were $40.95/$38.95 —
   larger piece count cheaper. Alyx directed flipping them to $38.95/$40.95 so the ladder
   climbs, on the reasoning that it reads as better value and the differential is roughly a
   wash. This was done WITHOUT wholesale data (unreachable — see top of file), so it is an
   assumption, not a verified-safe change. If real costs ever show 96pcs costs more to make,
   revisit: the flip CUT that variant's price by $2.
5. Photo/Poster — ✅ COMPLETED this session. The UI already existed in full (framed vs unframed,
   size grid, orientation, finish, frame colour) and the SERVER already had a dedicated
   `photo-poster` branch (`start-mockup.js` -> `resolvePhotoPosterSelection`). The only missing
   piece was the client bridge: `photo-poster` appeared ZERO times in needles-studio.html, so
   `buildMockupRequestBody()` returned null and the mockup never fired — the identical dead-end
   puzzle had. Watch two things: `colorName` doubles as the FRAME COLOUR server-side and is sent
   null when unframed (so an unframed poster can never resolve against a frame variant); and
   every unframed `variantId` in the catalog is still null, so the live title-match fallback in
   `resolvePhotoPosterSelection` is load-bearing, not decorative. 3/3 verified.
6. Tote Bag — ✅ COMPLETED this session, and it was a bigger job than the queue implied.
   Tote had a colour card but NO size card at all, while the catalog carries three sizes at
   three prices with `colorsVaryBySize` (each size has its own variantIds). Added the size card
   + the mockup bridge. **Judgement call flagged for Alyx:** the colour card used to read
   "Optional", but `resolveVariant()` THROWS ("A color selection is required for this product")
   whenever a size entry carries colors, which tote's do — so an uncoloured tote could never
   have reached a mockup. Colour is now mandatory alongside size and the copy was reworded to
   match. If Alyx wants colour to genuinely stay optional, the fix is NOT to relax the guard
   (that just moves the crash server-side) — it needs a real default colour or a colour step
   later in the order flow. 4/4 verified.
7. Coasters — ❌ NOT in the UI or catalog at all; needs Printify data (Portal export from
   The Portal page listed candidates: Corkwood Coaster Set #510, Coasters #994, #1247,
   Ceramic Coaster #1523)
8. Suitcases — ✅ MERGED to main. Print dims now CONFIRMED
   against live Printify (they never had been): Small=72133 5433x7323, Medium=79350 6260x8504,
   Large=79351 7217x9561 — all three IDs and prices match the catalog.

**Next build queue (Alyx's explicit ask):** ~~Photo Puzzle~~ (DONE this session), then
**Photo Poster**, then **Tote Bag** — both already have complete catalog entries in
`lib/products-catalog.js`. Then coasters + mouse pads. Their data IS now fetchable (Portal
access works) — real candidates already confirmed live via
`/api/printify-catalog?action=search&keyword=`:
  - coaster → 9 matches, incl. **Cork Back Coaster #480**
  - mouse pad → 10 matches, incl. **Mouse Pad (EU) #442**
Neither has a catalog entry yet. NOTE: search is on `/api/printify-catalog`, NOT the admin
relay (the old note here was wrong — admin 405s it). Post-it and Greeting Card sit on the
product grid with NO catalog entries — they generate art but cannot mockup/order; needs data
+ catalog entries too.

## How hard is it to add a product? (answered for Alyx, 2026-08-26)
Three very different costs — do not quote one number:
1. **New variant of an existing type** (another travel mug, another tote colour, another
   poster size): ~10 lines in `lib/products-catalog.js` + ~6 lines in the studio's
   `TRAVEL_MUG_CATALOG`-style object. No new UI — the grids render themselves from the data.
2. **New model inside an existing product**: phone cases are the best case in the repo —
   models come from `api/phone-case-catalog.js` and are SEARCHED, not hardcoded, so this is a
   pure data change. A new suitcase size is one tile + one catalog line.
3. **A genuinely new product type** (what puzzle/poster/tote each were today): half a day.

The server side is the strong half and deserves credit: `resolveVariant()` is generic over
`sizes`/`colors` and falls back to a LIVE title-match when a `variantId` is null, so a product
can go live before anyone looks up numeric IDs. Photo Puzzle needed ZERO server changes.

**The friction is one specific thing:** `buildMockupRequestBody()` in needles-studio.html is a
hardcoded if-chain. Every product needs a hand-written branch, and a missing branch returns
`null` SILENTLY — the product generates art, looks completely healthy, and simply never
mockups. No error, no console warning. Three products were sitting in exactly that state at the
start of this session (puzzle, poster, tote); poster's UI AND server support were both already
complete and it was missing nothing but that branch.

**Recommended (NOT built — needs Alyx's go-ahead):** make `buildMockupRequestBody()`
table-driven — a per-product descriptor naming its catalog key and where size/colour come from
— so a new single-image product becomes a data entry, and a missing entry fails LOUDLY instead
of returning null. Most products already fit one of two shapes (single-image, three-slot-wrap).
Plus a cheap startup assertion that every product on the grid has both a catalog entry and a
mockup path; that one check would have caught all three dead-ends instantly.

## Testing harness (`flow-tests/`)
- `harness.js` — Playwright launcher: serves nothing itself; expects
  `python3 -m http.server 8788 --directory <repo> --bind 127.0.0.1`, stubs ALL `/api/*`
  endpoints (zero real spend), uploads a generated test photo, tracks console/page errors + 404s.
  Chromium is preinstalled at `/opt/pw-browsers/chromium` (use `executablePath`, do NOT
  `playwright install`). `npm install playwright` in a scratch dir; copy harness deps there.
- `verify-fixes.js` — 8 regression checks for the audit fixes (rail spotlight, Track 2 guard,
  stall watchdog incl. an injected force-stop, Vanity Fair asset, GM + description-only paths).
- `verify-phone-suitcase.js` — 4 checks for the unmerged branch.
- `verify-puzzle.js` — 4 checks for Photo Puzzle (guard, price ladder, full rail → mockup body,
  reset). 4/4 PASS, zero console/page errors.
- `verify-poster.js` — 3 checks (framed/unframed card toggle + size re-basing across the two
  trees, unframed body, framed body). 3/3 PASS.
- `verify-tote.js` — 4 checks (size guard, colour guard, full rail → mockup body, reset).
  4/4 PASS.
- **Fixtures are NOT committed.** `harness.js` readFileSync's `test-photo.jpg`,
  `fake-generated.jpg`, `fake-mockup.jpg` at load; they were missing. Regenerate with PIL
  (`pip install pillow`) — any plain JPEG works.
- `verify-travel.js` — 6 checks: all five travel variants driven to their mockup body
  (pinning productKey, sizeLabel, and single-image vs front-back body shape — the 40oz
  insulated is the ONLY front-back one), plus a catalog-parity check that the studio's
  `TRAVEL_MUG_CATALOG` has not drifted from the server's. 6/6 PASS. This closes the
  "travel-mug deep coverage offered but not done" item.
- **Printify CDN gotcha:** the travel variant grid renders one `<img>` per variant from
  `images.printify.com`, which is unreachable from the sandbox exactly like Google Fonts.
  `harness.js` now stubs it; unstubbed it produced four ERR_CONNECTION_RESET console errors
  per run that looked like a product fault and were not one.
- **Dialog gotcha:** `resetEverythingFreshStart()` opens a `window.confirm()` and returns early
  on dismiss. Playwright auto-DISMISSES dialogs, so any reset test must
  `page.once('dialog', d => d.accept())` first or it will falsely report "reset doesn't clear".
- `AUDIT-CATALOG.md` — full issue catalog, secret-sauce inventory (line numbers approximate
  after later edits — re-grep), VERIFIED-WORKING list, and open taste questions Q1–Q5 that
  Alyx has NOT yet answered (Q2 was answered: keep the rail, hand off spotlights).

## Findings this session that are NOT yet acted on
- **`travel-mug-40oz-vacuum` (Vacuum Thermal Tumbler, 40oz) is unreachable.** It has a full
  entry in `lib/products-catalog.js` — blueprint 1715, provider 90, real variant IDs for 8+
  colours — but appears ZERO times in needles-studio.html, so it is not in the variant grid and
  cannot be bought. Its price is explicitly marked `// TODO — price is a placeholder, not a
  real pricing decision. "40oz": { price: 34.95 }`, which is why it was NOT added blind:
  surfacing it would ship a placeholder price. Needs Alyx to confirm a retail price, then it is
  a ~6-line addition to the studio's TRAVEL_MUG_CATALOG.
- **Coaster + mouse pad data is gathered and ready** (see below) but both need two decisions
  from Alyx that cannot be derived: WHICH blueprint, and the retail price.

## Coaster / mouse pad candidates (fetched live, 2026-08-26)
Coasters — 9 blueprints; strongest four, with provider and real variants:
  #510  Corkwood Coaster Set   prov 48 Colorway (SAME as tote)  1 variant 72872 Cork 3.75" sq, 1169x1169
  #2764 Hardboard Set of 4     prov 59 Imagine Your Photos (SAME as mugs) 1 variant 149519 4"x4", 1238x1238
  #480  Cork Back Coaster      prov 70 Printed Mint  2 variants: 71689 sq 3.75" 1200x1200, 74633 round 4" 1320x1320
  #1523 Ceramic Coaster        prov 23 WOYC  2 variants: 109346 round, 109347 square, both 1260x1260
Mouse pads — 10 blueprints; strongest three:
  #582  Mouse Pad              prov 99 Printify Choice / 70 Printed Mint  1 variant 71665 round, 2625x2625
  #608  Mouse Pad (Rectangle)  prov 28 District Photo  1 variant 71923 9"x8", 2925x2502
  #442  Mouse Pad (EU)         prov 30 OPT OnDemand — EU fulfilment, probably wrong for a US shop
Note the provider overlap: #510 shares tote's provider and #2764 shares the mugs' provider,
which is worth weighing for consolidated fulfilment.

## Cost probe (`action: 'cost-probe'`, added 2026-08-26)
`POST /api/admin` with `{action:'cost-probe', password, blueprintId, printProviderId}`.
Returns real per-variant WHOLESALE cost plus the shipping table.

Why it has to work this way: Printify's catalog API has no cost field at all — cost exists only
on a product that actually lives in the shop. So the probe creates a throwaway draft product,
reads the costs off it, and deletes it in a `finally` (reusing the same create/delete machinery
start-mockup.js and create-printify-order.js already use for temp mockup products). Probe
products are titled `ZZ_COST_PROBE_DELETE_ME <blueprint>/<provider>` so any orphan that
survives a hard failure is obvious in the shop.

Shipping is the easy half and needs NO product — Printify serves it from
`catalog/blueprints/{id}/print_providers/{pid}/shipping.json`; it just was not on the GET
whitelist.

**Never move this to the GET relay.** Catalog GETs are unauthenticated, so exposing costs there
would publish this shop's wholesale pricing to anyone who found the URL. It is POST + password
on purpose.

This is what unblocks the 15 products still sitting at `shippingCost: 0` / `estimatedProfit: 0`
— i.e. the reason checkout currently charges $0 shipping on every order.

## SECURITY — flagged, NOT changed
`api/admin.js` still has `const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '$Noneya6611$';`
— a hardcoded fallback password committed to the repo (and in git history). Its own comment
says to remove the fallback "once ADMIN_PASSWORD is confirmed set in Vercel". That was July
2026 and it is still there. It was NOT removed unilaterally because if the env var is not
actually set in Vercel, deleting the fallback locks Alyx out of admin instantly. **Action for
Alyx:** confirm ADMIN_PASSWORD is set in Vercel -> Settings -> Environment Variables, then the
fallback can be deleted safely — and the password should be rotated regardless, since it is in
git history.

## Open items
- Alyx has a 28-item stress-test list from the outgoing session and may return with failures:
  fix them one at a time, in real time, until each is gone (Alyx's stated working style).
- Suitcase print dimensions on blueprint 624 have never been seen against a REAL Printify
  mockup — first live mockup deserves scrutiny.
- Travel-mug deep coverage (each variant through checkout) offered but not yet done.
- `$17.95` trivia: it's the Trimmed/Accented mug style price — resolved, don't chase it again.

## Practical notes
- **DO NOT test in Incognito — this earlier advice was WRONG and cost Alyx real time.**
  `getDeviceId()` (needles-studio.html ~2436) mints the device id into `localStorage`, and
  Incognito destroys localStorage on close, so every Incognito session gets a BRAND NEW device
  id. `api/get-balance.js` never creates a customer row for an unknown device (its own line-6
  comment says so), so an Incognito device has zero credits permanently and topping it up just
  funds a ghost that vanishes on the next open. Incognito can never generate, by design.
  **Correct approach:** a separate persistent Chrome PROFILE (profile icon -> Add). Persistent
  localStorage means a stable device id — grant it tokens ONCE via admin.html and it sticks —
  and it still gives a cache fully separate from the main profile. The page prints the device
  id bottom-left on screen (`deviceIdDisplay`, ~line 606), so it can be read off and granted
  directly. For cache-busting prefer DevTools -> Network -> "Disable cache" (fresh on every
  load while DevTools is open) or a `?v=N` query string, over Ctrl+F5 gymnastics.
- Alyx's plan tier changed mid-week; long sessions survive, but context compactions happen —
  this file is the recovery anchor. Keep it updated at every major milestone (Alyx-authorized
  pushes to main only).
- The mug reveal show runs ~18s of intro clips minimum; "Done in X.Xs" appears well before the
  approve buttons — that's by design (showmanship), backed by a 12s progress watchdog.
