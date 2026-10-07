# A DECAL MUG (Alyx and Bud, 29 Sep 2026: each side of the magic mug a decal
# on white rather than a scene painted to the edges; the hot mug is white
# wherever nothing is printed, so a decal has no edge to fight). Bud paints
# the setup and the punchline each on its own, transparent
# (art/surprise/decals/<name>-setup / -punch); this lays them on the 2475 x
# 1155 print, the punchline on the LEFT half and the setup on the RIGHT
# (right-handed; left-handed swaps them), in each of the frame choices the
# customer can switch between on the mug, like a prop:
#   <name>-print.png        No frame (the default)
#   <name>-one-print.png    One frame round everything
#   <name>-two-print.png    A frame round each side
# each with its -print-left.png, and for each the 3D mug's pictures
# (reveal-jpgs.py) and the cold -> hot picture (coldhot.py); and the tile,
# art/options/surprise-<name>.jpg, the punchline on white.
#   decal-mug.py <name> [frame]      frame: the frame's name, default valentine;
#                                    none builds the No frame print only
#   decal-mug.py <name> <frame> <setup>   the setup decal borrowed from another
#                                    design (Ready?'s six sides share one opener:
#                                    decals/ready-setup)
# WORDS IN THE SPACE (Alyx, 30 Sep 2026): the decals hug the handle ends, which
# leaves a gap each side of the centre line; a mug listed in
# art/surprise/decal-words.json gets its two words there, one centred in each
# gap, in script (Great Vibes, art/fonts, OFL), the same brown on every mug,
# as large as the narrower gap allows. The left word is on the left of the
# print in both hands, so the pair reads across the back of the mug.
import os, sys, subprocess, glob
from PIL import Image
W, H = 2475, 1155
name = sys.argv[1]
frame = sys.argv[2] if len(sys.argv) > 2 else 'valentine'
here = os.path.dirname(os.path.abspath(__file__))
SETUP_OF = sys.argv[3] if len(sys.argv) > 3 else None
# THE DECAL VERSION OF A PAINTED MUG (Alyx, 7 Oct 2026: "Decal versus no decal
# ... It's a style choice"): a name ending -decal builds that mug's decal
# files beside its painted ones, from the decals under the plain name.
DECALS_OF = name[:-len('-decal')] if name.endswith('-decal') else name
if SETUP_OF is None: SETUP_OF = DECALS_OF
def unwhite(im):
    # A decal delivered on solid white rather than transparent (Bud's
    # Thanksgiving ones, 29 Sep 2026): the white that reaches the canvas
    # edge becomes transparent, feathered at its border; white inside the
    # picture (a sign, a sheet of paper) is left alone.
    import numpy as np, cv2
    a = np.asarray(im).copy()
    if a[..., 3].min() < 250: return im               # already transparent
    near = (a[..., :3].min(axis=2) > 238).astype(np.uint8)
    n, lab = cv2.connectedComponents(near, connectivity=4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge)).astype(np.float32)
    bg = cv2.GaussianBlur(cv2.dilate(bg, np.ones((3, 3), np.uint8)), (0, 0), 1.2)
    a[..., 3] = np.clip(255 * (1 - bg), 0, 255).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')
def decal(side):
    f = glob.glob(f'art/surprise/decals/{SETUP_OF if side == "setup" else DECALS_OF}-{side}.*')[0]
    im = Image.open(f).convert('RGBA')
    im = unwhite(im)
    im = im.crop(im.getbbox())                        # the decal itself, its empty margin off
    # Some decals carry a faint, all but invisible haze out to the canvas
    # edges (the question mark's reaches ~150 px past the picture). It sets
    # the size, as it always has, but the VISIBLE picture is what is set
    # against the print's edge: vis is its left and right inset.
    a = im.split()[3].point(lambda v: 255 if v > 24 else 0)
    b = a.getbbox()
    return im, (b[0], im.width - b[2])
(punch, pin), (setup, sin) = decal('punch'), decal('setup')
def fit(im, bw, bh):
    k = min(bw / im.width, bh / im.height)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
# Each style: the box a decal fits in and how far each decal sits from its own
# end of the print (the ends meet at the handle), and the frame laid over it.
# PUSHED TO THE HANDLE ENDS (Alyx, 29 Sep 2026): centred in each half, a decal
# sat off-centre on its face of the mug, towards the middle of the print; each
# is 10% smaller than its box and set 15 px from its end (No frame), or just
# inside the rail when framed. The punchline hugs the left end, the setup the
# right.
import json
from PIL import ImageDraw, ImageFont
WORDS = json.load(open('art/surprise/decal-words.json')).get(name)
WORD_FONT, WORD_INK = 'art/fonts/GreatVibes-Regular.ttf', (122, 52, 18)
WORD_PAD = {'': 50, '-one': 70, '-two': 90}           # kept clear of the pictures and the centre rails
def set_words(out, lx, rx, sfx):
    if not WORDS: return
    d = ImageDraw.Draw(out); room = min(W // 2 - lx, rx - W // 2) - WORD_PAD[sfx]; size = 220
    while size > 60:
        f = ImageFont.truetype(WORD_FONT, size)
        if max(d.textbbox((0, 0), w, font=f)[2] for w in WORDS) <= room: break
        size -= 4
    f = ImageFont.truetype(WORD_FONT, size)
    for word, cx in ((WORDS[0], (lx + W // 2) // 2), (WORDS[1], (rx + W // 2) // 2)):
        bb = d.textbbox((0, 0), word, font=f)
        d.text((cx - (bb[2] - bb[0]) // 2 - bb[0], H // 2 - (bb[3] - bb[1]) // 2 - bb[1]), word, font=f, fill=WORD_INK)
SCALE = 0.90
# CLOSER TO THE CENTRE (Alyx, 7 Oct 2026, of the dentist mug: "move the images
# each about 8% closer towards the center"): a mug listed in
# art/surprise/decal-inset.json has each decal moved in from its end by that
# fraction of the print's width, in every frame choice and both hands.
INSET = round(W * json.load(open('art/surprise/decal-inset.json')).get(name, 0))
STYLES = {
    '':     dict(box=1040, edge=15, over=None),
    '-one': dict(box=900, edge=53, over=[(f'art/surprise/{frame}-frame-one.png', 0)]),
    '-two': dict(box=840, edge=72, over=[(f'art/surprise/{frame}-frame-half.png', 25), (f'art/surprise/{frame}-frame-half.png', W - 25 - 1200)]),
}
if frame == 'none': STYLES = {'': STYLES['']}
# A frame that comes in one piece only (halloween has no half frame) skips the
# choices it cannot make, rather than failing after the ones it can.
STYLES = {k: v for k, v in STYLES.items() if all(os.path.exists(f) for f, _ in (v['over'] or []))}
for sfx, st in STYLES.items():
    st = dict(st, edge=st['edge'] + INSET)
    for hand, ((left, lin), (right, rin)) in (('', ((punch, pin), (setup, sin))), ('-left', ((setup, sin), (punch, pin)))):
        out = Image.new('RGB', (W, H), 'white')
        b = round(st['box'] * SCALE)
        d = fit(left, b, b); k = d.width / left.width
        x = st['edge'] - round(lin[0] * k); out.paste(d, (x, H // 2 - d.height // 2), d)
        lx = x + d.width - round(lin[1] * k)              # the left picture's visible right edge
        d = fit(right, b, b); k = d.width / right.width
        x = W - st['edge'] - d.width + round(rin[1] * k); out.paste(d, (x, H // 2 - d.height // 2), d)
        rx = x + round(rin[0] * k)                        # the right picture's visible left edge
        set_words(out, lx, rx, sfx)
        for f, x in (st['over'] or []):
            fr = Image.open(f).convert('RGBA'); out.paste(fr, (x, 0), fr)
        p = f'art/surprise/{name}{sfx}-print{hand}.png'
        out.save(p, optimize=True); print(p)
    subprocess.run([sys.executable, f'{here}/reveal-jpgs.py', name + sfx], check=True)
    subprocess.run([sys.executable, f'{here}/coldhot.py', f'art/surprise/{name}{sfx}-print.png', f'art/surprise/{name}{sfx}-coldhot.jpg'], check=True)
tile = Image.new('RGB', (360, 360), 'white')
t = fit(punch, 330, 330); tile.paste(t, ((360 - t.width) // 2, (360 - t.height) // 2), t)
tile.save(f'art/options/surprise-{name}.jpg', quality=90, optimize=True)
print(f'art/options/surprise-{name}.jpg')
