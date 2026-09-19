# Two companion plates — prompts for Bud

Mirror Mirror and The Court Painter are each a single-sex painting. A man who
picks the mirror gets his face above a burgundy gown; a woman who picks the
painter gets painted as a king. Each needs its companion so the customer can
pick the figure that matches, the way Home Sweet Home already works.

Both must come back at **1086 × 1448** (3:4 portrait), same as their partners.

---

## PLATE 1 — Mirror Mirror, the male companion

Copy everything between the lines.

---

A richly painted storybook oil painting, warm candlelit interior, 3:4 portrait
orientation.

A MAN stands with his BACK FULLY TO US in the foreground, facing a large ornate
gilded mirror. We never see his face — only the back of his head and shoulders.
He is dressed for a grand period evening: a deep bottle-green or midnight-blue
velvet frock coat with gold braid at the collar and cuffs, dark hair tied at the
nape with a black ribbon. He is well built and stands squarely, unhurried.
(The hair and build here are only a starting point — the merge repaints the back
of this figure to match each customer. What must be right in the plate is the
costume, the placement and the framing, because those stay.)

The mirror is tall and oval, in an extravagantly carved gilt frame of scrolling
acanthus leaves. Carved into the crest at the very top of the frame is a
WOMAN'S FACE, golden, larger than life, WINKING — one eye closed, a warm
knowing smile. She is the spirit of the mirror and she is in on the joke. Make
her prominent and unmistakable; she is the most important detail in the picture
after the reflection.

In the mirror's glass is HIS REFLECTION, and it is flattering him: a handsome,
dignified, confident man in three-quarter view, warmly and generously lit, the
face clear and large in the glass and turned slightly toward us. Leave the
reflected face simple and unobstructed — no beard covering the jaw, no hat, no
hand near the face.

The room: a gentleman's dressing chamber. A branched candelabra with lit candles
at the left casting warm golden light. Behind, stone walls hung with a dark
patterned tapestry. On the table beside the mirror, a crystal decanter and
glass, folded leather gloves, a pocket watch on a chain, a few old books.

Palette: deep golds, warm amber candlelight, rich greens and burgundy shadows.
Painterly oil technique with visible brushwork, storybook illustration feel,
romantic and slightly magical. Warm, generous, inviting — never cold, never
modern, no photographic look.

---

**Keep constant with the existing plate:** the winking golden female face in the
crest, the candlelight, the gilt oval mirror, the painterly storybook style, the
warm palette. It must read as the same enchanted mirror in a different room.

**Why the carved face stays a woman:** she is the flatterer, and the flattery
has to come from someone other than the customer. If she changed sex to match
whoever bought it she would start reading as a second reflection — the image you
see in yourself rather than the image someone else has of you, which is the trap
we already rejected once.

---

## PLATE 2 — The Court Painter, the female companion

Copy everything between the lines.

---

A richly painted oil painting of a Baroque artist's studio, 3:4 portrait
orientation, warm daylight from tall windows at the left.

In the foreground at the left, a PAINTER stands with their BACK TO US, stepped
back from a large easel to consider the finished work. We never see the
painter's face. They wear a paint-stained brown leather apron over loose white
shirtsleeves, dark breeches and boots, hair tied back with a black ribbon,
a loaded palette in one hand and a brush in the other.

On the easel is a completed GRAND STATE PORTRAIT OF A WOMAN, filling most of the
frame. She is painted as a queen: a white ermine-lined crimson velvet mantle
over a gold-embroidered gown, a jewelled DIADEM or small coronet set in her
dressed hair, a pearl and sapphire necklace, a pale blue sash across the body.
One hand rests on a golden sceptre. Beside her on a draped table sits a crown on
a cushion. Behind her, a great stone column and an arched window opening onto a
distant Renaissance river city under a bright sky.

Her painted face is composed, serene and commanding — unhurried, certain of
itself, lit the way a master lights a patron worth keeping. Three-quarter view,
turned slightly toward the viewer. Keep the face clear and unobstructed: nothing
crossing it, no veil, no hand near it.

CLIPPED TO THE TOP RIGHT OF THE EASEL, at the very same spot as before: a small
ORDINARY MODERN SNAPSHOT of the same woman — plain, unflattering, everyday
clothes, flat lighting, blank wall behind, slightly tilted where it hangs from
its clip. This little photograph is the punchline of the whole picture and must
be clearly visible, with crisp straight edges and a white border. Keep it the
same size and the same position on the easel as in the existing painting.

The studio around them: a marble bust on a plinth at the left, a tall window
with small leaded panes, a globe, jars of brushes, a paint-spattered work table
with a crumpled white cloth, a patterned carpet, shelves of books in shadow.

Palette: warm ochres, deep crimson, cream and gold, soft daylight. Painterly
oil technique, visible brushwork, Old Master feel. Not photographic.

---

**Keep constant with the existing plate:** the painter turned away at the left,
the easel angle, the studio props, the small clipped snapshot in the TOP RIGHT
corner of the easel, the palette and light. It must read as the same studio on a
different afternoon.

**Note for me, not for Bud:** the existing plate carries hand-measured corner
coordinates for the clipped snapshot (`photoQuad`). The companion will need its
own measured the same way, so this plate costs one extra step the mirror
companion does not. Asking Bud to keep the snapshot in the same place keeps that
measurement close, but it still has to be taken.

---

## Not a Bud job: the figure follows the customer

Alyx, Sep 2026: *"the person standing looking in the mirror should approximate
the pose of the person in the picture, except it would show what it looked like
from behind."*

Right, and it cannot come from Bud — Bud paints one plate for every customer and
has never seen any of them. It is a merge-time instruction, and it now lives in
`mirrorPrompt`: the back of the figure is repainted to the customer's hair,
build, age and carriage, while the costume, placement and framing stay exactly
as painted.

Worth being precise about what the model is being asked for. A silhouette can be
computed — same viewpoint, detail discarded. A back view is inferred: the nape,
the crown, the fall of hair behind the ear are invented. That is acceptable here
and nowhere else in the roster, because this figure is not the identity slot.
The reflection carries the whole recognition burden, and nobody can check a
back. It does not have to be provably them; it only has to stop being somebody
else.

This does not retire the companion plates. The merge changes the person, not the
wardrobe — a gown repainted to a frock coat is most of the picture and would
cost the plate its quality. The two compose: the companion plate supplies the
right clothes, the merge supplies the right person.
