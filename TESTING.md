# Needles' Studio — the test kit

Alyx: "I grow mentally weary trying to devise different tests to run 40 or 50
times a day. I want you to define a mock scenario for me to emulate to run the
test so I can do it without thinking hard."

So nothing here needs inventing. Same photo, same words, every time. Copy and
paste. If a result differs from last time and nothing was changed, that
difference is real.

---

## The kit

**THE PHOTO** — always the same one: `Face camera.jpg`. Never swap it during a
test run. One variable at a time or the run tells you nothing.

**THE PROMPTS** — three, by name. Use the one a scenario calls for.

> **PROMPT A — "the CEO"** (the workhorse: scene change, props, lettering)
> ```
> Make him the smug CEO of Muggshotz, leaning back in a leather
> office chair with his feet up on a desk buried in coffee mugs,
> arms crossed, grinning like he owns the place. A neon sign on the
> wall behind him reads "MUGGSHOTZ".
> ```

> **PROMPT B — "the short one"** (fastest, for flow tests where the picture
> does not matter)
> ```
> Put him on a tiny red tricycle in a parade.
> ```

> **PROMPT C — "the quiet one"** (leave the box EMPTY — tests the free
> exact-transfer path, costs no chip)
> ```
> (type nothing at all)
> ```

**WHAT TO RECORD** — three things, every run: the seconds on "Done in", the
chip count before and after, and anything that made you hesitate.

---

## S1 — Artwork Only  *(never been run; do this one first)*

1. AI track → **Caricature Assassination** → Use This Style
2. **PROMPT A** → satisfied
3. Product grid → **Artwork Only** (last tile, bottom right)
4. GENERATE IMAGE → **Yes — Use This Design**

**Passes if:** no product screens appear at all — no size, no colour, no
panels, no mockup. You land on a screen with Save / Copy / Make Another.
Save downloads the picture. Copy pastes into a chat. Make Another returns to
the idea box.

**Fails if:** it asks about a product, or takes you to a mockup, or the
Save/Copy buttons hand you the easel instead of the artwork.

---

## S2 — Back buttons  *(Alyx's standing item)*

**PROMPT B**, any product. At EVERY screen: press Back once, then go forward
again by the normal route.

Screens to cover, in order: photo → track fork → art style → idea box →
product → size → style & colour → Fit Your Picture → edge/fade → mockup.

**Passes if:** Back lands on the screen before it, your work is still there,
and going forward again returns you to where you were.

**Fails if:** Back does nothing, skips two screens, loses a choice you had
made, or the forward route no longer works.

---

## S3 — Wraparound  *(Alyx's standing item)*

Run twice: once **coffee mug**, once **travel cup**.

1. Product → mug (or travel cup) → finish size, style, colour
2. Print Style → **Wraparound**
3. **PROMPT A** → GENERATE IMAGE
4. All the way to the mockup

**Passes if:** the three panels arrive as one continuous scene, the seams line
up, the mockup spins, and the picture wraps without a visible join.

**Note:** wraparound generates three times, so expect ~90 seconds, not 25.

---

## S4 — The fade at full strength  *(the cap was removed yesterday)*

1. **PROMPT B** → coffee mug → 15oz → any style and colour
2. Up to Three Panels → GENERATE → Yes
3. At Fade Edges choose **Faded**, then drag the slider to **100**
4. Open the 3D mockup

**Passes if:** 100 really does wash the picture almost entirely into the mug
colour — no stopping short — AND the 3D mug shows that same soft edge.

**Fails if:** the slider stops having any effect near 80, or the mug preview
shows a hard rectangle while the slider says faded.

---

## S5 — Right-to-left language  *(most fragile part of the twenty)*

1. Language picker, top left → **العربية** (Arabic) or **فارسی** (Farsi)
2. Walk to the product grid and back

**Passes if:** text flips to right-to-left, buttons and labels stay inside
their boxes, nothing overlaps, and the layout does not break.

**Then switch back to English** before any other scenario.

---

## S6 — The two auto-scrolls  *(asked for, never seen)*

1. **PROMPT B** → coffee mug → Up to Three Panels → GENERATE → Yes
2. At **Fit Your Picture**, do not touch anything. Watch.
3. At **Fade Edges**, same. Watch.

**Passes if:** each screen holds on its heading for a beat, then moves down to
the controls on its own — about 4 seconds on Fit Your Picture, about 3½ on
Fade Edges. Touching the screen cancels it, and that is correct.

---

## S7 — The free track  *(no chip spent; run it often)*

1. Upload → **I'll Supply My Own Finished Art**
2. Product → coffee mug → finish size, style, colour
3. **PROMPT C** (leave it empty) → GENERATE

**Passes if:** it offers to use the photo exactly as it is, names the product,
and costs **zero** chips. Decline and nothing is spent. Accept and the photo
goes through untouched.

**Known gap:** there is no resize tool on single-image products yet. On a mug
you will get Fit Your Picture; anywhere else you will get the fade and nothing
to shrink with. That is being built — not a new bug.

---

## Fast regression — the five-minute version

When you only want to know nothing is on fire:

1. **PROMPT B**, coffee mug, Up to Three Panels, generate, Yes, fade, mockup
2. Back button once at three screens along the way
3. Artwork Only with **PROMPT B**

Green on those three and the spine of the studio is intact.
