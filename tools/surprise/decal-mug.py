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
    return im.crop(im.getbbox())                      # the decal itself, its empty margin off
punch, setup = decal('punch'), decal('setup')
def fit(im, bw, bh):
    k = min(bw / im.width, bh / im.height)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
# Each style: the box a decal fits in, the centres of the two halves, and the
# frame laid over it.
STYLES = {
    '':     dict(box=(1040, 1040), cx=(619, 1856), cy=578, over=None),
    '-one': dict(box=(900, 900), cx=(640, 1835), cy=578, over=[(f'art/surprise/{frame}-frame-one.png', 0)]),
    '-two': dict(box=(840, 840), cx=(625, 1850), cy=578, over=[(f'art/surprise/{frame}-frame-half.png', 25), (f'art/surprise/{frame}-frame-half.png', W - 25 - 1200)]),
}
for sfx, st in STYLES.items():
    for hand, (left, right) in (('', (punch, setup)), ('-left', (setup, punch))):
        out = Image.new('RGB', (W, H), 'white')
        for im, cx in ((left, st['cx'][0]), (right, st['cx'][1])):
            d = fit(im, *st['box'])
            out.paste(d, (cx - d.width // 2, st['cy'] - d.height // 2), d)
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
