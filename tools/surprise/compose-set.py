# A HOLIDAY MUG LAID INTO THE SET'S FRAME (Alyx, 28 Sep 2026: "you could fix
# some of these by just adjusting the fade to the exact criteria that you've
# laid out for bud. And then recopying the frame").
#   compose-set.py frame                       -> art/surprise/set-frame.png (from Bud's frame)
#   compose-set.py <design> <out right.png> <out left.png>
# <design> is right-handed: the punchline on its LEFT half.
#
# In layers, bottom to top:
#   white   -- everything outside the frame's line, as the hot mug shows white
#              wherever nothing is printed;
#   black   -- inside the line;
#   scenes  -- the design's two scenes, each filling its place in the fade plan
#              (the punchline's to 42.5% of the width, black 42.5%-57.5%, the
#              setup's from 57.5%: the black centred opposite the handle), fading into the black middle over the plan's 4% and
#              nowhere else;
#   frame   -- the autumn frame, on top, sharp, never faded: "frames ... should
#              always go on top of fade ... they provide an excuse for sharp
#              edges" (Alyx). Bud painted it alone with a transparent middle
#              (art/surprise/set-frame-bud.webp, 1836 x 857, 28 Sep 2026); it
#              is brought to the print's 2475 x 1155 in premultiplied colour so
#              no dark fringe comes in from its transparent pixels, lightly
#              sharpened, and laid on last. The scenes run right up to its rail
#              and under it: the rail is the edge.
# A scene is only ever scaled, evenly both ways, to fill its place; nothing is
# cropped but the old border line round the older designs' scenes. The
# left-handed print is the same with the two scenes swapped.
import sys, numpy as np
from PIL import Image, ImageFilter
W, H = 2475, 1155
FRAME_SRC = 'art/surprise/set-frame-bud.webp'
FRAME_OUT = 'art/surprise/set-frame.png'
# Bud's rail at 2475 x 1155, measured: top 16-36, bottom 1075-1098, left 20-38,
# right 2439-2456. The black and the scenes start halfway under it:
IX0, IX1, IY0, IY1 = 29, 2448, 26, 1087
MID0, MID1 = round(W * .425), round(W * .575)          # the solid black, centred on the side opposite the handle
FADE = round(W * .04)                                  # each scene's fade into it
PAD = round(W * .012)                                  # the rail's own width: a scene is fitted inside
                                                       # the rail, so no lettering ends up under it
                                                       # ("Stand back, everybo")
EDGE = 45                                              # a scene's soft edge where it stops short of the rail
def ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def load(p): return np.asarray(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)).astype(float)

if sys.argv[1] == 'frame':
    a = np.asarray(Image.open(FRAME_SRC).convert('RGBA')).astype(float)
    pm = a.copy(); pm[..., :3] *= a[..., 3:] / 255
    ch = [np.asarray(Image.fromarray(pm[..., i].astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(float) for i in range(4)]
    al = np.clip(ch[3], 0, 255); rgb = np.stack(ch[:3], -1)
    rgb = np.where(al[..., None] > 0, np.clip(rgb * 255 / np.maximum(al[..., None], 1), 0, 255), 0)
    out = Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')
    sharp = out.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
    Image.merge('RGBA', (*sharp.split(), out.split()[3])).save(FRAME_OUT, optimize=True)
    print(f'{FRAME_OUT}: {100 * (al > 127).mean():.1f}% of the print is frame')
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
    # Fitted whole; but a scene only a hair off its place's shape is enlarged
    # to fill it instead, trimming at most 7% of its height top and bottom,
    # rather than leaving a sliver beside the rail to fade (Black Friday's
    # "a day to reflect" lost its "a" to that fade).
    h, w = img.shape[:2]; s = min(zw / w, zh / h, 1.25)
    cover = max(zw / w, zh / h)
    if cover > s and (h * cover - zh) <= 0.07 * zh and (w * cover - zw) <= 0.07 * zw:
        big = np.asarray(Image.fromarray(img.astype(np.uint8)).resize((round(w * cover), round(h * cover)), Image.LANCZOS)).astype(float)
        bh, bw = big.shape[:2]; y0 = (bh - zh) // 2; x0 = (bw - zw) // 2
        return big[y0:y0 + zh, x0:x0 + zw]
    return np.asarray(Image.fromarray(img.astype(np.uint8)).resize((round(w * s), round(h * s)), Image.LANCZOS)).astype(float)

def compose(left_img, right_img):
    out = np.full((H, W, 3), 255.0)
    out[IY0:IY1, IX0:IX1] = 0
    zh = IY1 - IY0
    for img, x0, x1, inner in ((left_img, IX0, MID0, 'right'), (right_img, MID1, IX1, 'left')):
        im = fit(img, x1 - x0, zh); h, w = im.shape[:2]
        y = IY0 + (zh - h) // 2
        x = x1 - w if inner == 'right' else x0                # the inner edge on the black
        xs = np.arange(x, x + w)
        k = ss((MID0 - xs) / FADE) if inner == 'right' else ss((xs - MID1) / FADE)
        # A scene narrower (or shorter) than its place leaves black between it
        # and the rail; its edge there melts into that black instead of
        # stopping hard. Where it reaches the rail, the rail is its edge.
        if (x1 - x0) - w > 4:
            k = k * (ss((xs - x) / EDGE) if inner == 'right' else ss((x + w - 1 - xs) / EDGE))
        kyv = np.ones(h)
        if zh - h > 4:
            yy = np.arange(h); kyv = ss(yy / EDGE) * ss((h - 1 - yy) / EDGE)
        out[y:y + h, x:x + w] = im * k[None, :, None] * kyv[:, None, None]
    a = frame[..., 3:] / 255
    out = frame[..., :3] * a + out * (1 - a)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

compose(punch, setup).save(out_r, optimize=True)
compose(setup, punch).save(out_l, optimize=True)
print(f'{src}: scenes {punch.shape[1]}x{punch.shape[0]} and {setup.shape[1]}x{setup.shape[0]} ({"Bud remake" if white_edged else "older, framed" if framed else "older"})')
