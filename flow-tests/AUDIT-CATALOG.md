# Needles' Studio Flow Audit — Working Catalog
Branch: `claude/needles-flow-audit` (off main @ 04e31e1). Nothing merged.

## SECRET SAUCE INVENTORY — READ-ONLY, verified untouched at handback

All AI prompt/description assembly. No edits permitted; bugs touching these get flagged, not fixed.

**needles-studio.html**
| Lines (approx) | What |
|---|---|
| 3961–3975 | `PANORAMA_FADE_INSTRUCTION_CENTER/LEFT/RIGHT`, `UNIFORM_EDGE_FADE_INSTRUCTION` |
| 4877–4885 | Face It merge prompts (watercolor text-template variant + plain face-merge variant) |
| 5159–5165 | Good Morning window/doorway composite prompt |
| 5389–5395 | Cover Me magazine-cover merge prompt |
| 8220+ | `getProductRules(p)` product-target strings |
| 9114–9269 | Main generator prompt assembly: `customerIdea`, TEXT RULE, `likenessDesc`, wrap/panel/poster/phone COMPOSITION lines, `windowSillCompositionLine`, fade lines, `referenceLine`, identity-preservation block |
| 9513–9531 | Panel-continuation prompts ("Continue this scene to the left/right") |

**api/generate.js**
| Lines (approx) | What |
|---|---|
| 240–274 | `panoramaPrompt` |
| 398–466 | `panelContinuationPrompt`, `backgroundInstruction`, `currentDesignInstruction`, `chromaKeyInstruction`, `finalPrompt` assembly |

Note: `skipEdgeFade = true` hardcode (line ~9157) is FLOW logic adjacent to prompts —
treated as read-only too since flipping it changes which prompt lines are emitted.

## ISSUES FOUND

### CRITICAL
**I-1. `generation-active` dim/lock never clears on the plain generator path — checkout unreachable for 8 of 9 products and all of Track 2.**
`startNeedlesStage()` adds `generation-active` to `<body>`; CSS locks every card except `#uploadPhotoCard` (`pointer-events:none`). The three prop flows (Cover Me / Face It / Good Morning) remove it in their success handlers. The plain `generate()` success path (greeting card, post-it, tote, suitcase, puzzle, poster, phone case, travel cups, mug description-only, ALL of Track 2) never does. Proven via Playwright: after any successful plain generation, "Continue to Order" (in `#positionHolderCard`) is unclickable — real click times out. Customer soft-locked; only reload escapes. Likely the mechanism behind the live report "everything is subdued, there is no button anywhere."

**I-2. Track 2 dead end: product guard bounces customer onto a locked product grid.**
`generate()` with no product selected shows "Please select a product above first" and scrolls to `#productCard` — but leaves `idea-focus` on the body, whose CSS makes the product grid `pointer-events:none`. Proven: real click on a product tile times out; `product` stays null; repeat forever. The intended path (tapping the "satisfied" prompt → `product-focus`) unlocks the same tiles — the guard just never performs that same transition.

### HIGH
**I-3. Post-generation hard-ceiling timer (added earlier today, 2af38fc) truncates healthy finales.**
Armed flat at 20s from generation-complete; the natural remaining show (rest of current clip + 3 finale clips + fade + zoom) runs ~21–23s. On fast generations it *reliably* cuts the finale short and logs a console error on perfectly healthy runs. Should be a progress-watchdog (re-armed on each clip advance; fires only when advancement actually stalls) tied to the true invariant: the approve callback is still owed.

**I-4. Safety-net blind spot: an orphaned approve callback is unrecoverable.**
Both the 30s forced-finale timer and the hard ceiling no-op once `needlesPhase==='stopped'`; `needlesFinishPresentation()` early-returns in that state too. Anything that force-stops the stage (e.g. `stopNeedlesStage` from a concurrent path) after generation completes strands the customer with no approve buttons and no remaining net. Candidate mechanism for the live "waited 2 minutes, button never showed" report.

### MEDIUM
**I-5. Magazine asset filename is literally URL-encoded on disk: `Vanity%20Fair_512x683.webp`.**
Catalog references `Vanity Fair_512x683.webp` (space). Loads on Vercel only through path-normalization coincidence; 404s on any strict static server. Fragile-by-accident.

**I-6. Stale approve UI during redo.** After "No — Let's Try Another" (which does NOT regenerate — it invites an idea edit), the previous approve row stays visible; under I-1's stale dim, the customer's idea box is click-locked while `keepTweaking()` scroll-focuses it. Mostly resolved by fixing I-1; noting the interaction.

### LOW / LEAN CLEANUP
**I-7.** `designByDescriptionChecked` is permanently false (checkbox removed); dead branch in `pickDesignMethod()`.
**I-8.** Unreachable Coming-Soon else-branch in `goToDesignMethodScreen()` (all three methods route to real screens) + stale comment claiming Home Sweet Home is a placeholder + Coming-Soon card copy referencing removed "Design By Description" control.
**I-9.** Poster "pick your size first" guard in `generate()` unreachable (poster options ship with defaults preselected).

### VERIFIED WORKING (no action)
Every product tile responds · mug 11oz/15oz size overlay → 3 styles ($17.95/$17.95/$19.95 — n.b. the remembered "$17.95" lives here) → 10 colors → mockup → Design Method · Cover Me 20 magazines, generate → approve → panel screen (Center-off default, Turn Center On free, per-panel controls) → Done → Printify mockup lightbox (multi-angle, reorder, counter) → Return → Checkout → order.html with email capture · Face It 20 tiles incl. both text-templates (empty-text guard message works) · Good Morning 20 windows, guards work · decline-props → Continue → description-only → Edge Fade → guided Generate → approve (full path works) · phone model search (client-side, Enter resolves + confirm box) · travel-cup variant list incl. "ONLY WHITE IN STOCK" badge, variant→style reorder · poster options incl. framed pricing + frame color reveal · realistic-timing full run: zero console errors, approve at +23s after Done.

## OPEN QUESTIONS (taste calls — not decided unilaterally)
**Q-1.** Track 1, non-mug products: the idea box lives in a snap-collapsed section — customers can generate without ever seeing where to type their idea (default caricature prompt kicks in). Surface the idea box for these products, or is idea-optional the intent?
**Q-2.** After fixing I-1, the plain flow has no reveal-stage dim at all (prop flows swap to a `*reveal-focus` dim). Match the prop flows' treatment, or leave undimmed?
**Q-3.** "🔧 No — Let's Try Another" label implies an automatic re-spin; actual behavior is "edit your idea, then hit Generate again." Re-label, or change behavior?
**Q-4.** The needles show enforces ~18s of beginning clips even when generation returns instantly, and the finale plays ~18s after "Done in X.Xs" is already displayed. Intended showmanship, or worth a fast-path?
**Q-5.** Poster card copy ("you pick everything BEFORE generating") vs. preselected defaults that allow immediate generation with zero interaction.
