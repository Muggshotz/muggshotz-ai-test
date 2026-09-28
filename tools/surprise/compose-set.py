# A HOLIDAY MUG LAID INTO THE SET'S FRAME (Alyx, 28 Sep 2026: "you could fix
# some of these by just adjusting the fade to the exact criteria that you've
# laid out for bud. And then recopying the frame").
#   compose-set.py frame                       -> art/surprise/set-frame.png
#   compose-set.py <design> <out right.png> <out left.png>
# <design> is right-handed: the punchline on its LEFT half.
#
# In layers, bottom to top:
#   white   -- everything outside the frame's line, as the hot mug shows white
#              wherever nothing is printed;
#   black   -- inside the line;
#   scenes  -- the design's two scenes, each filling its place in the fade plan
#              (the punchline's to 41% of the width, black 41%-56%, the setup's
#              from 56%), fading into the black middle over the plan's 4% and
#              nowhere else;
#   frame   -- the autumn frame, on top, sharp, never faded: "frames ... should
#              always go on top of fade ... they provide an excuse for sharp
#              edges" (Alyx). It is lifted once from Power's Out, whose frame
#              is the crispest: its line, and the pumpkins, wheat and leaves in
#              its corners, cut out by colour into an alpha channel.
# A scene is only ever scaled, evenly both ways, to fill its place; nothing is
# cropped but the old border line round the older designs' scenes. The
# left-handed print is the same with the two scenes swapped.
import sys, numpy as np
from PIL import Image, ImageFilter
W, H = 2475, 1155
FRAME_SRC = 'art/surprise/thanksgiving-power-out-print.png'
FRAME_OUT = 'art/surprise/set-frame.png'
# The frame's line, measured on FRAME_SRC: top 14-19, bottom 1108-1118,
# left 13-18, right 2457-2462. Inside it:
IX0, IX1, IY0, IY1 = 19, 2457, 20, 1108
MID0, MID1 = round(W * .41), round(W * .56)            # the solid black
FADE = round(W * .04)                                  # each scene's fade into it
PAD = round(W * .014)                                  # a scene stops this far short of the frame's sides,
                                                       # melting into the black there, so no lettering
                                                       # ends up under the frame ("Stand back, everybo")
def ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def load(p): return np.asarray(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)).astype(float)

if sys.argv[1] == 'frame':
    T = load(FRAME_SRC)
    sat = T.max(axis=2) - T.min(axis=2)
    ys, xs = np.mgrid[0:H, 0:W]
    line = ((ys >= 11) & (ys <= 22)) | ((ys >= 1105) & (ys <= 1121)) | ((xs >= 10) & (xs <= 21)) | ((xs >= 2454) & (xs <= 2465))
    corner = np.minimum.reduce([np.hypot(xs - cx, ys - cy) for cx, cy in ((0, 0), (W, 0), (0, H), (W, H))]) < 190
    m = (sat > 60) & (line | corner)
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.0))).astype(float)
    Image.fromarray(np.dstack([T, m]).astype(np.uint8), 'RGBA').save(FRAME_OUT, optimize=True)
    print(f'{FRAME_OUT}: {100 * (m > 127).mean():.1f}% of the print is frame')
    sys.exit()

src, out_r, out_l = sys.argv[1:4]
S = load(src)
mx = S.max(axis=2)
col = np.percentile(mx[int(H * .2):int(H * .8)], 95, axis=0)
mid = np.where(col[int(W * .25):int(W * .75)] < 14)[0] + int(W * .25)
g0, g1 = int(mid.min()), int(mid.max()) + 1
white_edged = S[:6].mean() > 200 and S[:, :6].mean() > 200
# An older design with the old border: a coloured line running straight across
# the top of its black middle, about 14px down. Only those are trimmed of it.
framed = ((S.max(axis=2) - S.min(axis=2))[8:26, g0:g1] > 60).mean(axis=1).max() > 0.5

def scene(x0, x1):
    if white_edged:
        # Bud's remakes: his white band fades to black round a black inside;
        # the scene is what sits within it, taken from a little higher up
        # because his lettering starts inside the band. The band is taken back
        # out of those rows: it is a fade to white of strength a, read down his
        # black middle, so what lies under it is (seen - 255a) / (1 - a).
        lt = S.mean(axis=2)
        rows = np.where(lt[:, W // 2] < 10)[0]; by0, by1 = int(rows.min()), int(rows.max()) + 1
        bx0 = int(np.argmax(lt[by0 + 5, :W // 4] < 10)); bx1 = W - int(np.argmax(lt[by0 + 5, ::-1][:W // 4] < 10))
        x0, x1 = max(x0, bx0), min(x1, bx1); y0, y1 = max(0, by0 - round(H * .05)), by1
        sc = S[y0:y1, x0:x1].copy()
        a = (S[y0:by0, W // 2].mean(axis=1) / 255.0)[:, None, None]
        top = (sc[:by0 - y0] - 255 * a) / np.maximum(1 - a, 1e-3)
        sc[:by0 - y0] = np.where(a < 0.6, np.clip(top, 0, 255), 0)
        return sc
    # The older ones: the lit block on black, less the old border line (at
    # about 14px in) along its outer side, top and bottom, where there is one.
    c = np.percentile(mx[:, x0:x1], 95, axis=0) > 30; r = np.percentile(mx[:, x0:x1], 95, axis=1) > 30
    xs, ys = np.where(c)[0], np.where(r)[0]
    t = round(W * 0.012) if framed else 0
    L0, L1 = x0 + xs.min(), x0 + xs.max() + 1
    x0, x1 = (L0 + t, L1) if x0 == 0 else (L0, L1 - t)
    return S[ys.min() + t:ys.max() + 1 - t, x0:x1]

punch, setup = scene(0, g0), scene(g1, W)
frame = np.asarray(Image.open(FRAME_OUT).convert('RGBA')).astype(float)

def fit(img, zw, zh):
    h, w = img.shape[:2]; s = min(zw / w, zh / h, 1.25)
    return np.asarray(Image.fromarray(img.astype(np.uint8)).resize((round(w * s), round(h * s)), Image.LANCZOS)).astype(float)

def compose(left_img, right_img):
    out = np.full((H, W, 3), 255.0)
    out[IY0:IY1, IX0:IX1] = 0
    zh = IY1 - IY0
    for img, x0, x1, inner in ((left_img, IX0 + PAD, MID0, 'right'), (right_img, MID1, IX1 - PAD, 'left')):
        im = fit(img, x1 - x0, zh); h, w = im.shape[:2]
        y = IY0 + (zh - h) // 2
        x = x1 - w if inner == 'right' else x0                # the inner edge on the black
        xs = np.arange(x, x + w)
        k = ss((MID0 - xs) / FADE) if inner == 'right' else ss((xs - MID1) / FADE)
        k = k * (ss((xs - x) / PAD) if inner == 'right' else ss((x + w - 1 - xs) / PAD))
        out[y:y + h, x:x + w] = im * k[None, :, None]
    a = frame[..., 3:] / 255
    out = frame[..., :3] * a + out * (1 - a)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

compose(punch, setup).save(out_r, optimize=True)
compose(setup, punch).save(out_l, optimize=True)
print(f'{src}: scenes {punch.shape[1]}x{punch.shape[0]} and {setup.shape[1]}x{setup.shape[0]} ({"Bud remake" if white_edged else "older, framed" if framed else "older"})')
