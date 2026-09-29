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
#   decal-mug.py <name> [frame]      frame: the frame's name, default valentine
import os, sys, subprocess, glob
from PIL import Image
W, H = 2475, 1155
name = sys.argv[1]
frame = sys.argv[2] if len(sys.argv) > 2 else 'valentine'
here = os.path.dirname(os.path.abspath(__file__))
def decal(side):
    f = glob.glob(f'art/surprise/decals/{name}-{side}.*')[0]
    im = Image.open(f).convert('RGBA')
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
SCALE = 0.90
STYLES = {
    '':     dict(box=1040, edge=15, over=None),
    '-one': dict(box=900, edge=53, over=[(f'art/surprise/{frame}-frame-one.png', 0)]),
    '-two': dict(box=840, edge=72, over=[(f'art/surprise/{frame}-frame-half.png', 25), (f'art/surprise/{frame}-frame-half.png', W - 25 - 1200)]),
}
for sfx, st in STYLES.items():
    for hand, ((left, lin), (right, rin)) in (('', ((punch, pin), (setup, sin))), ('-left', ((setup, sin), (punch, pin)))):
        out = Image.new('RGB', (W, H), 'white')
        b = round(st['box'] * SCALE)
        d = fit(left, b, b); k = d.width / left.width
        out.paste(d, (st['edge'] - round(lin[0] * k), H // 2 - d.height // 2), d)
        d = fit(right, b, b); k = d.width / right.width
        out.paste(d, (W - st['edge'] - d.width + round(rin[1] * k), H // 2 - d.height // 2), d)
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
