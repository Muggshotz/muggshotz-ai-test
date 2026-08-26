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
- Branch **`claude/handoff-portal-check-dro4je`** — UNMERGED. This session's work: Photo Puzzle
  wired end-to-end + the 96/252 price flip (see below). Playwright-verified, 4/4.
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
5. Coasters — ❌ NOT in the UI or catalog at all; needs Printify data (Portal export from
   The Portal page listed candidates: Corkwood Coaster Set #510, Coasters #994, #1247,
   Ceramic Coaster #1523)
6. Suitcases — ✅ built, on the UNMERGED `claude/phone-suitcase-flows`. Print dims now CONFIRMED
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
- **Fixtures are NOT committed.** `harness.js` readFileSync's `test-photo.jpg`,
  `fake-generated.jpg`, `fake-mockup.jpg` at load; they were missing. Regenerate with PIL
  (`pip install pillow`) — any plain JPEG works.
- **Dialog gotcha:** `resetEverythingFreshStart()` opens a `window.confirm()` and returns early
  on dismiss. Playwright auto-DISMISSES dialogs, so any reset test must
  `page.once('dialog', d => d.accept())` first or it will falsely report "reset doesn't clear".
- `AUDIT-CATALOG.md` — full issue catalog, secret-sauce inventory (line numbers approximate
  after later edits — re-grep), VERIFIED-WORKING list, and open taste questions Q1–Q5 that
  Alyx has NOT yet answered (Q2 was answered: keep the rail, hand off spotlights).

## Open items
- Alyx has a 28-item stress-test list from the outgoing session and may return with failures:
  fix them one at a time, in real time, until each is gone (Alyx's stated working style).
- Suitcase print dimensions on blueprint 624 have never been seen against a REAL Printify
  mockup — first live mockup deserves scrutiny.
- Travel-mug deep coverage (each variant through checkout) offered but not yet done.
- `$17.95` trivia: it's the Trimmed/Accented mug style price — resolved, don't chase it again.

## Practical notes
- Live-site testing must be in **Incognito** — stale cache has produced two false bug reports.
- Alyx's plan tier changed mid-week; long sessions survive, but context compactions happen —
  this file is the recovery anchor. Keep it updated at every major milestone (Alyx-authorized
  pushes to main only).
- The mug reveal show runs ~18s of intro clips minimum; "Done in X.Xs" appears well before the
  approve buttons — that's by design (showmanship), backed by a 12s progress watchdog.
