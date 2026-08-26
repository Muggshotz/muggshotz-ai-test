# SESSION HANDOFF — Muggshotz / Needles' Studio
Written 2026-08-26 by the outgoing Claude Code session, for the incoming one.
Owner: Alyx (voice-to-text user — expect phonetic typos; read charitably, confirm before acting on anything ambiguous).

## Why the session switched
Alyx is changing this environment's **network policy** on claude.ai so the sandbox can reach
`muggshotz-ai-test.vercel.app` directly (currently 403 at the proxy). First thing to do when
you read this: **test it** —
`curl -sS "https://muggshotz-ai-test.vercel.app/api/admin?action=printify-catalog&path=catalog/blueprints/596/print_providers.json"`
If that returns JSON, you have live read-only access to Printify's catalog through The Portal's
relay (server-side token, GET-only, no secrets on your side). Use it for the data-gathering below.

## State of the repo
- `main` = live site (Vercel auto-deploys it). Contains: all of tonight's mug-flow fixes, the
  full flow-audit fixes (merged with Alyx's explicit authorization), the guided-rail spotlight
  rework. Zero known console errors on the mug path.
- Branch **`claude/phone-suitcase-flows`** — UNMERGED, awaiting Alyx's word. Wires phone cases
  and suitcases through to the Printify mockup (buildMockupRequestBody branches + a new
  mandatory suitcase size card). Playwright-verified. Do not merge without explicit authorization.
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
4. Coasters — ❌ NOT in the UI or catalog at all; needs Printify data (Portal export from
   The Portal page listed candidates: Corkwood Coaster Set #510, Coasters #994, #1247,
   Ceramic Coaster #1523)
5. Suitcases — ✅ built, on the UNMERGED branch

**Next build queue (Alyx's explicit ask):** Photo Puzzle, Photo Poster, Tote Bag — all three
have complete catalog data in `lib/products-catalog.js` (photo-puzzle: blueprint 596/provider
80, 4 piece-count variants; poster + tote already have entries). Then coasters + mouse pads
once data is fetched (mouse pads: nothing in repo; look up via relay `?action=search&keyword=`
on `/api/printify-catalog` or the admin relay path). Post-it and Greeting Card sit on the
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
