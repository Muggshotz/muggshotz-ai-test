# A HOLIDAY MUG LAID INTO THE SET'S FRAME (Alyx, 28 Sep 2026: "you could fix
# some of these by just adjusting the fade to the exact criteria that you've
# laid out for bud. And then recopying the frame").
#   compose-set.py frame                       -> art/surprise/set-frame.png (from Bud's frame)
#   compose-set.py <design> <out right.png> <out left.png> [<captions.json>]
# captions.json (optional): the words, typeset by the build rather than
# painted - {"punch": {"top": "...", "bottom": "..."}, "setup": {...}}; each
# "top" is a heading, each "bottom" a caption; "\n" breaks a line.
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
import os
# The fade into the black middle: FADE in from the black at a scene's
# mid-height, CORNER at its top and bottom rows (equal = a straight fade).
# Alyx chose curved, 28 Sep 2026 ("the curved is better than the straight");
# COMPOSE_FADE=straight or gentle rebuilds the trial styles.
_STYLE = os.environ.get('COMPOSE_FADE', 'curved')
FADE, CORNER = {'straight': (round(W * .045), round(W * .045)),
                'gentle':   (round(W * .06),  round(W * .10)),
                'curved':   (round(W * .045), round(W * .16))}[_STYLE]
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
    fr = Image.merge('RGBA', (*sharp.split(), out.split()[3]))
    # THE MIDDLE ORNAMENTS (Alyx, 28 Sep 2026): "coming down in a triangle
    # almost like a stalactite" from the top rail and "coming up" from the
    # bottom one, over the black middle; then "thinner ... a little bit more
    # elegant and a little bit more long". Bud painted the pair side by side
    # on one transparent canvas (art/surprise/set-frame-middle.png): the
    # hanging one on the left, the rising one on the right. Each is cut out
    # by its own shape, both scaled by the same amount (the hanging one to
    # ORN_LEN px long) in premultiplied colour, centred on the print, and
    # slid UNDER the frame: the hanging one's top at the top rail's upper
    # edge, the rising one's base 10 px above the bottom rail's lower edge (its
    # branch then sits on the rail as the top one's hangs under it), so the
    # rail covers where each joins it.
    import glob, cv2
    mids = sorted(glob.glob('art/surprise/set-frame-middle.*'))
    if mids:
        ORN_LEN = int(os.environ.get('COMPOSE_ORN_LEN', 480))
        m = np.asarray(Image.open(mids[0]).convert('RGBA')).astype(float)
        n, lab, st, _ = cv2.connectedComponentsWithStats((m[..., 3] > 8).astype(np.uint8), 8)
        pieces = sorted((i for i in range(1, n) if st[i][4] > 2000), key=lambda i: st[i][0])
        under = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        k = ORN_LEN / st[pieces[0]][3]
        for i, where in zip(pieces, ('top', 'bottom')):
            x, y, w, h = st[i][:4]
            own = cv2.dilate((lab == i).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
            c = m[y:y + h, x:x + w].copy()
            c[..., 3] *= own[y:y + h, x:x + w]
            ow, oh = round(w * k), round(h * k)
            pm = np.dstack([c[..., :3] * c[..., 3:] / 255, c[..., 3]])
            chans = [np.asarray(Image.fromarray(pm[..., k].astype(np.float32), 'F').resize((ow, oh), Image.LANCZOS))
                     for k in range(4)]
            al2 = np.clip(chans[3], 0, 255)
            rgb2 = np.dstack([np.clip(ch * 255 / np.maximum(al2, 1), 0, 255) for ch in chans[:3]])
            piece = Image.fromarray(np.dstack([rgb2, al2]).astype(np.uint8), 'RGBA')
            px = (W - ow) // 2
            py = 16 if where == 'top' else 1088 - oh
            under.alpha_composite(piece, (px, py))
            print(f'middle ornament ({where}): {ow} x {oh} at {px},{py}')
        fr = Image.alpha_composite(under, fr)
    fr.save(FRAME_OUT, optimize=True)
    print(f'{FRAME_OUT}: {100 * (al > 127).mean():.1f}% of the print is frame')
    sys.exit()

src, out_r, out_l = sys.argv[1:4]
import json
CAPS = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
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
    # to fill it instead, trimming at most 10% of its height, mostly from the bottom,
    # rather than leaving a sliver beside the rail to fade (Black Friday's
    # "a day to reflect" lost its "a" to that fade).
    h, w = img.shape[:2]; s = min(zw / w, zh / h, 1.25)
    # A trim of height comes off the bottom (the foreground), keeping the
    # top whole: that is where the painted clocks and signs are.
    cover = max(zw / w, zh / h)
    if cover > s and (h * cover - zh) <= 0.10 * zh and (w * cover - zw) <= 0.07 * zw:
        big = np.asarray(Image.fromarray(img.astype(np.uint8)).resize((round(w * cover), round(h * cover)), Image.LANCZOS)).astype(float)
        bh, bw = big.shape[:2]; y0 = min((bh - zh) // 2, round(0.012 * bh)); x0 = (bw - zw) // 2
        return big[y0:y0 + zh, x0:x0 + zw]
    return np.asarray(Image.fromarray(img.astype(np.uint8)).resize((round(w * s), round(h * s)), Image.LANCZOS)).astype(float)

# THE WORDS (Alyx, 28 Sep 2026: Bud "forgot to put the captions on them
# but ... you could probably do it even better than him"). Typeset in the
# room the frame leaves clear, measured off set-frame.png: under the top
# rail between the corner leaves (from y 100), and above the bottom corner
# pumpkins (to y 1000), and never into a scene's fade into the black middle.
# Cream letters, a dark brown outline and a soft shadow, sized to fit.
from PIL import ImageDraw, ImageFont
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
# (x from, x to) by side and band: the bottom corners' pumpkins reach further in
# than the top corners' leaves. The words may run over a scene's fade into the
# black - they are drawn after it, so they stay whole.
ROOM = {('left', 'top'): (190, MID0 - 20), ('left', 'bottom'): (250, MID0 - 20),
        ('right', 'top'): (MID1 + 20, 2290), ('right', 'bottom'): (MID1 + 20, 2230)}
TOP_BAND, BOTTOM_BAND = (100, 215), (780, 1000)
# NO BLACK MIDDLE (Alyx, 28 Sep 2026, a trial: "just have the image extend
# ... forgo the black fade altogether and just frame the whole thing").
# COMPOSE_LAYOUT=rail: each scene fills its half, meeting at the centre under
# a rail cut from the frame's own top rail, the vines over it; butt: the
# same with no rail, the vines alone over the join. fade (the default) is the
# black middle.
LAYOUT = os.environ.get('COMPOSE_LAYOUT', 'fade')
# narrow: the black middle kept, but only COMPOSE_BLACK of the width (Alyx:
# "we're going to need some black fade, but not nearly that much ... keep
# them separated"); each scene enlarged to fill the rest, fading into it.
NB = float(os.environ.get('COMPOSE_BLACK', .06))
NM0, NM1 = round(W * (.5 - NB / 2)), round(W * (.5 + NB / 2))
# white1 / white2 (Alyx, 29 Sep 2026: "get rid of the black and do it as if
# it's all gonna be imprinted on a white background, because ultimately it
# is"): everything on white, the scenes soft-edged into it; white1 inside the
# one big frame, white2 in a frame of its own each, the frame rebuilt at that
# size from Bud's corners and rails. COMPOSE_FRAME names a frame without the
# middle vines (a trial).
if LAYOUT in ('white1', 'white2'):
    ROOM = {('left', 'top'): (IX0 + 280, W // 2 - 110), ('left', 'bottom'): (IX0 + 330, W // 2 - 110),
            ('right', 'top'): (W // 2 + 110, IX1 - 280), ('right', 'bottom'): (W // 2 + 110, IX1 - 330)}
if LAYOUT == 'white2':                                    # clear of each frame's own corner leaves
    ROOM = {('left', 'top'): (190, W // 2 - 190), ('left', 'bottom'): (260, W // 2 - 260),
            ('right', 'top'): (W // 2 + 190, W - 190), ('right', 'bottom'): (W // 2 + 260, W - 260)}
if LAYOUT == 'narrow':
    ROOM = {('left', 'top'): (190, NM0 - 30), ('left', 'bottom'): (250, NM0 - 30),
            ('right', 'top'): (NM1 + 30, 2290), ('right', 'bottom'): (NM1 + 30, 2230)}
elif LAYOUT in ('rail', 'butt'):
    ROOM = {('left', 'top'): (190, W // 2 - 50), ('left', 'bottom'): (250, W // 2 - 50),
            ('right', 'top'): (W // 2 + 50, 2290), ('right', 'bottom'): (W // 2 + 50, 2230)}
def fit_size(text, x0, x1, y0, y1, biggest):
    lines = text.split('\n'); d = ImageDraw.Draw(Image.new('L', (8, 8))); size = biggest
    while size > 20:
        f = ImageFont.truetype(FONT, size); sw = max(2, size // 11)
        wd = max(d.textbbox((0, 0), l, font=f, stroke_width=sw)[2] for l in lines)
        if wd <= x1 - x0 and int(size * 1.18) * len(lines) <= y1 - y0: break
        size -= 2
    return size
BIGGEST = {'top': 92, 'bottom': 60}
# A heading, or a caption, is the same size on both scenes: the smaller of
# the two sizes that fit.
PAIR = {}
for key, (y0, y1) in (('top', TOP_BAND), ('bottom', BOTTOM_BAND)):
    got = [fit_size(CAPS[who][key], *ROOM[(side, key)], y0, y1, BIGGEST[key])
           for who in ('punch', 'setup') for side in ('left', 'right') if CAPS.get(who, {}).get(key)]
    if got: PAIR[key] = min(got)
def words(out, caps, side):
    if not caps: return out
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    for key, (y0, y1), biggest in (('top', TOP_BAND, 92), ('bottom', BOTTOM_BAND, 60)):
        text = caps.get(key)
        if not text: continue
        x0, x1 = ROOM[(side, key)]
        lines = text.split('\n')
        size = PAIR.get(key, fit_size(text, x0, x1, y0, y1, biggest))
        f = ImageFont.truetype(FONT, size); sw = max(2, size // 11); lh = int(size * 1.18)
        top = y0 + ((y1 - y0) - lh * len(lines)) // 2 if key == 'top' else y1 - lh * len(lines)
        shadow = Image.new('L', im.size, 0); sd = ImageDraw.Draw(shadow)
        for i, l in enumerate(lines):
            w = sd.textbbox((0, 0), l, font=f, stroke_width=sw)[2]
            sd.text(((x0 + x1 - w) // 2 + 3, top + i * lh + 4), l, font=f, fill=255, stroke_width=sw + 3, stroke_fill=255)
        shadow = shadow.filter(ImageFilter.GaussianBlur(6))
        im = Image.composite(Image.new('RGB', im.size, (10, 5, 0)), im, shadow.point(lambda v: int(v * 0.75)))
        d = ImageDraw.Draw(im)
        for i, l in enumerate(lines):
            w = d.textbbox((0, 0), l, font=f, stroke_width=sw)[2]
            d.text(((x0 + x1 - w) // 2, top + i * lh), l, font=f, fill=(247, 236, 210), stroke_width=sw, stroke_fill=(42, 24, 12))
    return np.asarray(im).astype(float)

def cover(img, zw, zh):
    # Enlarged evenly until it fills the place, the spare trimmed: from the
    # sides equally, and from the top and bottom 40 : 60.
    h, w = img.shape[:2]; k = max(zw / w, zh / h)
    bw, bh = round(w * k), round(h * k)
    big = np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((bw, bh), Image.LANCZOS)).astype(float)
    x0, y0 = (bw - zw) // 2, round((bh - zh) * .4)
    return big[y0:y0 + zh, x0:x0 + zw]

def middle_rail():
    # A length of the frame's own top rail, turned upright.
    strip = frame[10:44, 700:700 + (IY1 - IY0) + 20]
    return np.rot90(strip, 3)

def compose(left_img, right_img, left_caps=None, right_caps=None):
    out = np.full((H, W, 3), 255.0)
    out[IY0:IY1, IX0:IX1] = 0
    zh = IY1 - IY0
    if LAYOUT in ('white1', 'white2'):
        out = np.full((H, W, 3), 255.0)
        plain = np.asarray(Image.open(os.environ.get('COMPOSE_FRAME', FRAME_OUT)).convert('RGBA')).astype(float)
        FEATHER, GAP = 70, 40
        def soft(img, x0, x1, y0, y1):
            # The scene fitted into its box, its edges melting into the white:
            # a stand-in for the vignettes Bud will paint.
            w, h = x1 - x0, y1 - y0; im = cover(img, w, h)
            xs, ys = np.arange(w), np.arange(h)
            k = ss(np.minimum(xs, w - 1 - xs) / FEATHER)[None, :] * ss(np.minimum(ys, h - 1 - ys) / FEATHER)[:, None]
            out[y0:y1, x0:x1] = im * k[..., None] + out[y0:y1, x0:x1] * (1 - k[..., None])
        if LAYOUT == 'white1':
            soft(left_img, IX0 + 60, W // 2 - GAP, IY0 + 60, IY1 - 60)
            soft(right_img, W // 2 + GAP, IX1 - 60, IY0 + 60, IY1 - 60)
            out = words(out, left_caps, 'left'); out = words(out, right_caps, 'right')
            fr = plain
        else:
            # Two frames: Bud's corners (600 x 440 of the print, where his
            # leaves reach) scaled by K, the plain rails between them stretched.
            K, CW, CH = 0.72, 600, 440
            def piece(y0, y1, x0, x1, w, h):
                a = plain[y0:y1, x0:x1]; pm = np.dstack([a[..., :3] * a[..., 3:] / 255, a[..., 3]])
                ch = [np.asarray(Image.fromarray(pm[..., i].astype(np.float32), 'F').resize((w, h), Image.LANCZOS)) for i in range(4)]
                al = np.clip(ch[3], 0, 255); return np.dstack([np.clip(c * 255 / np.maximum(al, 1), 0, 255) for c in ch[:3]] + [al])
            def panel(pw, ph):
                cw, chh = round(CW * K), round(CH * K); f = np.zeros((ph, pw, 4))
                f[:chh, :cw] = piece(0, CH, 0, CW, cw, chh); f[:chh, pw - cw:] = piece(0, CH, W - CW, W, cw, chh)
                f[ph - chh:, :cw] = piece(H - CH, H, 0, CW, cw, chh); f[ph - chh:, pw - cw:] = piece(H - CH, H, W - CW, W, cw, chh)
                f[:chh, cw:pw - cw] = piece(0, CH, 1000, 1100, pw - 2 * cw, chh); f[ph - chh:, cw:pw - cw] = piece(H - CH, H, 1000, 1100, pw - 2 * cw, chh)
                f[chh:ph - chh, :cw] = piece(470, 560, 0, CW, cw, ph - 2 * chh); f[chh:ph - chh, pw - cw:] = piece(470, 560, W - CW, W, cw, ph - 2 * chh)
                return f
            M = 30                                            # white round each frame, and between them
            pw, ph = W // 2 - M - M // 2, H
            fr = np.zeros((H, W, 4))
            for x in (M, W // 2 + M // 2):
                fr[:, x:x + pw] = panel(pw, ph)
            t = round(20 * K) + 12                            # inside the rail
            soft(left_img, M + t, M + pw - t, t + 4, H - t - 4)
            soft(right_img, W // 2 + M // 2 + t, W // 2 + M // 2 + pw - t, t + 4, H - t - 4)
            out = words(out, left_caps, 'left'); out = words(out, right_caps, 'right')
        a = fr[..., 3:] / 255
        out = fr[..., :3] * a + out * (1 - a)
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    if LAYOUT == 'narrow':
        nf, nc = NB * W * .35, NB * W * 1.1               # the fade: at mid-height, at the top and bottom rows
        for img, x0, x1, inner in ((left_img, IX0, NM0, 'right'), (right_img, NM1, IX1, 'left')):
            im = cover(img, x1 - x0, zh); w = x1 - x0
            xs = np.arange(x0, x1)
            ys = (np.arange(zh) + 0.5) / zh * 2 - 1
            reach = nf + (nc - nf) * np.abs(ys) ** 2.2
            dist = (x1 - xs[None, :]) if inner == 'right' else (xs[None, :] - x0)
            out[IY0:IY1, x0:x1] = im * ss(dist / reach[:, None])[:, :, None]
        out = words(out, left_caps, 'left'); out = words(out, right_caps, 'right')
        a = frame[..., 3:] / 255
        out = frame[..., :3] * a + out * (1 - a)
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    if LAYOUT != 'fade':
        out[IY0:IY1, IX0:W // 2] = cover(left_img, W // 2 - IX0, zh)
        out[IY0:IY1, W // 2:IX1] = cover(right_img, IX1 - W // 2, zh)
        out = words(out, left_caps, 'left'); out = words(out, right_caps, 'right')
        if LAYOUT == 'rail':
            r = middle_rail(); rh, rw = r.shape[:2]; x, y = W // 2 - rw // 2, IY0 - 10
            a = r[..., 3:] / 255
            out[y:y + rh, x:x + rw] = r[..., :3] * a + out[y:y + rh, x:x + rw] * (1 - a)
        a = frame[..., 3:] / 255
        out = frame[..., :3] * a + out * (1 - a)
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    for img, x0, x1, inner in ((left_img, IX0, MID0, 'right'), (right_img, MID1, IX1, 'left')):
        im = fit(img, x1 - x0, zh); h, w = im.shape[:2]
        y = IY0 + (zh - h) // 2
        x = x1 - w if inner == 'right' else x0                # the inner edge on the black
        xs = np.arange(x, x + w)
        # THE FADE ROUNDS INTO THE CORNERS (Alyx, 28 Sep 2026: "your fade is
        # just too straight up and down. Compared to how we used to do it").
        # Bud's own paintings fade the inner edge in a curve, the way a
        # vignette does: narrow at the scene's middle, sweeping further in at
        # its top and bottom, so each scene reads as a rounded window onto
        # the black rather than a straight cut. The fade starts FADE in from
        # the black at mid-height and CORNER in at the top and bottom rows.
        ys = (np.arange(h) + 0.5) / h * 2 - 1                  # -1 top .. 1 bottom
        reach = FADE + (CORNER - FADE) * np.abs(ys) ** 2.2        # per row: how far in it starts
        edge = MID0 if inner == 'right' else MID1
        dist = (edge - xs[None, :]) if inner == 'right' else (xs[None, :] - edge)
        k = ss(dist / reach[:, None])
        # A scene narrower (or shorter) than its place leaves black between it
        # and the rail; its edge there melts into that black instead of
        # stopping hard. Where it reaches the rail, the rail is its edge.
        if (x1 - x0) - w > 4:
            k = k * (ss((xs - x) / EDGE) if inner == 'right' else ss((x + w - 1 - xs) / EDGE))[None, :]
        kyv = np.ones(h)
        if zh - h > 4:
            yy = np.arange(h); kyv = ss(yy / EDGE) * ss((h - 1 - yy) / EDGE)
        out[y:y + h, x:x + w] = im * k[:, :, None] * kyv[:, None, None]
    out = words(out, left_caps, 'left'); out = words(out, right_caps, 'right')
    a = frame[..., 3:] / 255
    out = frame[..., :3] * a + out * (1 - a)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

compose(punch, setup, CAPS.get('punch'), CAPS.get('setup')).save(out_r, optimize=True)
compose(setup, punch, CAPS.get('setup'), CAPS.get('punch')).save(out_l, optimize=True)
print(f'{src}: scenes {punch.shape[1]}x{punch.shape[0]} and {setup.shape[1]}x{setup.shape[0]} ({"Bud remake" if white_edged else "older, framed" if framed else "older"})')
