# Face It — plate build sheet

For the two new templates that need artwork. The third, **Mug Shot**, needs none:
its wall, chart, placards and cords are drawn in code at print size
(`faceit-templates.js`). Nothing to draw for that one.

Every number here is live in `faceit-templates.js`. If a plate is painted to
different proportions the compositing will not line up, so treat these as the
spec rather than as suggestions. To see any of it before you commit to artwork,
open **`faceit-bench.html`** — it previews and calibrates both templates at true
size against stand-in plates.

---

## Canvas

| Surface | Pixels | Ratio |
|---|---|---|
| Coffee mug wrap | **2475 × 1155** | 2.14:1 |
| 14oz travel handle | 1995 × 930 | 2.15:1 |

Build at the mug size. The 14oz is near enough the same shape that one
composition serves both. These are measured from Printify's `variants.json`, not
estimated from product photos.

**Both current references are the wrong shape.** The lineup art is ~1.75:1 and
the Rushmore strip ~2.96:1. Neither crops to 2.14:1 without losing something
that matters — see the crop rules below.

## The handle eats both ends

On a wraparound the left and right edges of the art **meet at the handle**. The
middle third of the strip is the front of the mug; the outer ~5% at each end is
effectively not seen.

So: **nothing that matters goes near either end.** On the lineup this is not a
detail — in the reference the customer's empty slot is at the far right, which
puts the one figure they bought the mug for directly on the handle seam, half on
each side, with the alien and the granny across the front.

**Move the empty slot to the centre of the lineup.** Customer flanked by the
biker and granny on one side, the alien and the dog on the other.

## Crop rules

Crop budget comes off the **foreground** — the desk, the detectives, the empty
sky. Never off the headroom.

- **The Lineup:** the alien's head must stay clear of the top chart line with air
  above it. He is the only one in the lineup who doesn't fit the chart, and that
  is the joke. Trimming the top to make the ratio work kills it.
- **The 5th Face:** the carved headline must not be trimmed into the sky, and the
  fifth position needs blank unworked rock with room around it.

---

## The Lineup — `lineup.webp`

Transparent WebP. One flat plate, no layers needed.

**What the plate carries:** the room, the stage, the lamps, the six existing
characters, the foreground, and the full height chart with its numbers.

**What it must NOT carry:** any figure in the customer's slot. Not a silhouette,
not a ghost, not a placeholder. Leave that position as clean background — wall,
chart and floor continuing through it. The customer's figure is generated
separately and composited in on top, so anything painted there shows through
behind them.

**Three positions must match the code exactly** (fractions of the 1155px height):

| Reference | Fraction | At 1155px |
|---|---|---|
| The **7'6"** chart line | 0.080 | y = 92 |
| The **3'0"** chart line | 0.572 | y = 661 |
| The **floor** — where feet meet the stage | 0.900 | y = 1040 |

Chart runs **3'0" to 7'6" in 6" steps**, labelled both sides, as in the
reference. The customer's real height maps onto these lines: a 5'4" customer and
a 6'4" customer come out visibly different heights because the arithmetic says
so. If the chart on the plate does not sit at these numbers, every customer is
the wrong height.

**Lighting to match:** flat, slightly cool, from overhead lamps. The generated
figure is lit to this description, so a plate lit warmly or from the side will
read as pasted-on no matter what the prompt says.

---

## The 5th Face — `mount_rushmore.webp`

Opaque WebP. No transparency needed anywhere — this one is not composited, the
model repaints the whole picture using the plate as reference.

**What the plate carries:** four finished presidents, the carved
**LET'S JUST FACE IT** headline, sky, clouds, pines, rock.

**The fifth position is blank unworked rock.** No face, no silhouette, no marker
of any kind — just mountain where a fifth head could be carved. The earlier
version with a specific person already carved there is wrong twice over: the AI
would have to erase a detailed head before carving a new one, and a head-shaped
hole only fits a head that shape.

Composed at 2475 × 1155 with the fifth position toward the centre-right rather
than hard against the edge, for the handle reason above.

---

## When a plate is ready

Drop the file in the repo root and remove `awaitingArt: true` from that
template's entry in `faceit-templates.js`. That flag is the only thing keeping
these two out of the customer-facing grid; everything else is wired and tested.
