# Muggshotz — "Face It" backdrop artwork

**Two files needed.** Both are edits and recompositions of artwork that already
exists — not new concepts. The look is signed off; what's needed is the right
shape and one specific change to each.

---

## How these get used (worth 60 seconds — it explains every constraint below)

Each file is a **backdrop**. The customer's photo becomes a figure that our
software generates separately and drops **on top of** the backdrop, into a space
you leave empty for it.

So the backdrop is everything *except* the subject. Whatever is painted in that
empty space will end up behind the customer's figure, showing around their
edges. It has to be clean background — wall, floor, rock — continuing straight
through.

Both files wrap around a coffee mug.

---

## Canvas: 2475 × 1155 px

Both files, exactly. That's the printable wrap area of an 11oz mug, measured
from the printer's own spec. **This is not negotiable** — it's the physical
surface.

Both current references are the wrong shape and will need recomposing:

| | Current | Needed |
|---|---|---|
| Lineup | ~1.75:1 | **2.14:1** |
| Rushmore | ~2.96:1 | **2.14:1** |

### The handle eats both ends

The left and right edges of the artwork **meet each other at the mug handle**.
The middle of the file is the front of the mug — the part people actually see.

Keep anything important out of the **outer 5% at each end**. It disappears
around the handle.

### Where the crop budget comes from

When you recompose to 2.14:1, take it off the **foreground** — the desk, the
empty sky. **Never off the headroom.** Specifically:

- **The alien's head must stay clear above the top chart line, with air above
  it.** He's the only one who doesn't fit the chart and that's the whole joke.
  Trimming the top to make the ratio work kills it.
- **The Rushmore headline must not be clipped into the sky.**

---

## File 1 — The Lineup  →  `lineup.webp`

**Start from:** your existing lineup image (biker, granny, alien, scruffy guy,
athlete, dog).

**Three changes:**

1. **Move the empty slot to the middle of the lineup.** It's currently at the
   far right, which puts it directly on the mug handle — the customer would be
   sawn in half down the seam, with the alien and the granny across the front of
   the mug instead. Put the customer between the others: biker and granny on one
   side, alien and dog on the other.

2. **Leave that slot completely empty.** No silhouette, no ghost, no
   placeholder shape. Just the room continuing through — wall, chart lines and
   floor, as if nobody were standing there. Anything painted there shows up
   behind the customer.

3. **Crop the foreground out** (the desk, the back-of-head detectives) to gain
   the height for 2.14:1. If you'd rather keep them, that's fine — but then they
   need to come as a **separate file with a transparent background**, so we can
   layer them in front of the customer. One or the other, not baked in.

**Keep:** the existing cast exactly as they are, the height chart with its
numbers, the lighting, the overhead lamps, the stage.

**Format:** WebP, **no transparency** (except the optional foreground file).

---

## File 2 — The 5th Face  →  `mount_rushmore.webp`

**Start from:** your Rushmore mug design.

**Two changes:**

1. **Remove the fifth carved head entirely** — the fellow in the cap and
   sunglasses. Patch the space with **blank, unworked rock**: natural mountain
   face, the kind of surface a head could be carved out of, matching the
   surrounding stone and lighting. No face, no outline, no marker of any kind.
   That's where the customer gets carved in.

2. **Bring that blank area in off the right edge** so it sits centred in the
   right-hand third of the file, roughly 80% across. Right now it runs to the
   edge, which is the handle.

**Keep:** the four presidents, the carved **LET'S JUST FACE IT** headline, the
sky, the pines, the rock.

**Format:** WebP, no transparency.

---

## What you do NOT need to match

**Don't chase exact pixel positions for the height chart.** Compose the lineup
so it looks right — we calibrate our measurements to your artwork, not the other
way round. Put the chart where it belongs visually and we'll line up to it.

The one thing to keep sensible: the chart should read **3'0" at the bottom to
7'6" at the top in 6" steps**, with the numbers legible at both ends, and the
floor where feet meet the stage clearly visible. Beyond that, your call.

---

## Delivering

Two files, named exactly:

- `lineup.webp`
- `mount_rushmore.webp`

(plus `lineup_foreground.webp` only if you keep the detectives as a separate
transparent layer)

Layered source files are welcome alongside if you have them — makes later
tweaks cheaper — but the two flattened WebPs are what's needed.

## Questions worth raising before you start

- If the lineup cast can't be rearranged cleanly from the existing render and
  needs regenerating, flag it first — we'd rather discuss it than lose the
  granny.
- If cropping the foreground doesn't get you to 2.14:1 without hurting the
  composition, say so and we'll look at it together.
