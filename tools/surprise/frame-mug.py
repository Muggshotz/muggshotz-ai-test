# A HOLIDAY MUG IN A FRAME (Alyx, 3 Oct 2026: the Halloween frame "could be
# somewhat universal", offered on every Halloween mug). Lays a finished
# frame -- a 2475 x 1155 PNG with a see-through middle, art/surprise/<frame>.png
# -- over a mug's finished prints, and writes the framed mug's files:
#   <name>-one-print.png, <name>-one-print-left.png  (what is printed)
#   wrap/<name>-one.jpg                              (the shelf's turning mug)
#   reveal/<name>-one.jpg and -left                  (reveal-jpgs.py)
#   <name>-one-coldhot.jpg                           (coldhot.py)
# The picture under the frame fades 4% into white at every edge first (Alyx:
# "apply some small fade to the image. Perhaps 3 to 5%"): Bud's frame stops a
# hair short of the edge, and the white that shows there is the hot mug's own.
# The left-handed print is the left-handed picture framed, never the framed
# right one rolled -- rolled, the frame's sides would meet in the middle.
#   python3 tools/surprise/frame-mug.py <name> [<frame>] [<scale>] [blend]   (frame: halloween-frame-one)
# blend (Alyx, 6 Oct 2026: "sharp edges particularly as you were going towards
# the center. These should be blended towards black"): for a design painted
# as two scenes on black, each scene's four edges are melted into the black
# over MELT px, so no picture stops on a straight cut inside the frame.
# <scale>, below 1, shrinks the whole picture evenly about its centre onto
# black before it is framed, for a design whose painted words run under the
# frame (Goes Right Through Me, Bud's lettering, 5 Oct 2026: at 0.87 every
# letter of both hands' captions is clear of it). Nothing is cropped or stretched.
import sys, os, subprocess
import numpy as np
from PIL import Image
name = sys.argv[1]
frame_name = sys.argv[2] if len(sys.argv) > 2 else 'halloween-frame-one'
SCALE = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
BLEND = len(sys.argv) > 4 and sys.argv[4] == 'blend'
FADE = 0.04
MELT = 70
frame = Image.open(f'art/surprise/{frame_name}.png').convert('RGBA')

def melt_scenes(art):
    # Each half's scene is the rectangle where the picture is not black: the
    # columns and rows whose brightest 5% is above near-black. Inside it, a
    # ramp from black at its edge to the full picture MELT px in.
    a = np.asarray(art).astype(np.float32); h, w, _ = a.shape; mx = a.max(2)
    k = np.zeros((h, w), np.float32)
    for x0, x1 in ((0, w // 2), (w // 2, w)):
        cols = np.percentile(mx[:, x0:x1], 95, axis=0) > 20
        if not cols.any(): continue
        c = np.where(cols)[0]; cl, cr = x0 + c[0], x0 + c[-1] + 1
        rows = np.percentile(mx[:, cl:cr], 95, axis=1) > 20
        r = np.where(rows)[0]; rt, rb = r[0], r[-1] + 1
        yy = np.arange(rt, rb)[:, None]; xx = np.arange(cl, cr)[None, :]
        dist = np.minimum(np.minimum(yy - rt, rb - 1 - yy), np.minimum(xx - cl, cr - 1 - xx))
        t = np.clip(dist / MELT, 0, 1)
        k[rt:rb, cl:cr] = t * t * (3 - 2 * t)
    # The painted words are never dimmed: a caption often starts at the very
    # top of its scene. White, and Bud's caption orange, kept at full strength.
    import cv2
    hsv = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2HSV)
    words = (a.min(2) > 195) | ((hsv[..., 0] >= 5) & (hsv[..., 0] <= 22) & (hsv[..., 1] > 150) & (hsv[..., 2] > 190))
    words = cv2.GaussianBlur(cv2.dilate(words.astype(np.uint8) * 255, np.ones((5, 5), np.uint8)).astype(np.float32) / 255, (0, 0), 1.5)
    k = np.maximum(k, words)
    return Image.fromarray((a * k[..., None]).astype(np.uint8))

def framed(src):
    art = Image.open(src).convert('RGB')
    if SCALE < 1:
        sw, sh = round(art.size[0] * SCALE), round(art.size[1] * SCALE)
        mat = Image.new('RGB', art.size, (0, 0, 0))
        mat.paste(art.resize((sw, sh), Image.LANCZOS), ((art.size[0] - sw) // 2, (art.size[1] - sh) // 2))
        art = mat
    if BLEND: art = melt_scenes(art)
    if frame.size != art.size: f = frame.resize(art.size, Image.LANCZOS)
    else: f = frame
    a = np.asarray(art).astype(float); h, w, _ = a.shape
    y = np.arange(h)[:, None]; x = np.arange(w)[None, :]
    d = np.minimum(np.minimum(y, h - 1 - y) / (h * FADE), np.minimum(x, w - 1 - x) / (w * FADE)).clip(0, 1)
    d = d * d * (3 - 2 * d)
    out = Image.fromarray((a * d[..., None] + 255 * (1 - d[..., None])).astype(np.uint8)).convert('RGBA')
    out.alpha_composite(f)
    return out.convert('RGB')

here = os.path.dirname(os.path.abspath(__file__))
for hand in ('', '-left'):
    framed(f'art/surprise/{name}-print{hand}.png').save(f'art/surprise/{name}-one-print{hand}.png')
    print(f'{name}-one-print{hand}.png')
one = Image.open(f'art/surprise/{name}-one-print.png').convert('RGB')
one.save(f'art/surprise/wrap/{name}-one.jpg', quality=88, optimize=True)
# The shelf's flat picture and the tray's tile, cut as holiday-mug.py and
# fit-set-print.py cut them for the unframed mug.
one.resize((1050, 490), Image.LANCZOS).save(f'art/surprise/show/{name}-one.jpg', quality=86, optimize=True)
W1, H1 = one.size; tx = (W1 // 2 - H1) // 2
one.crop((tx, 0, tx + H1, H1)).resize((360, 360), Image.LANCZOS).save(f'art/options/surprise-{name}-one.jpg', quality=84, optimize=True)
subprocess.run([sys.executable, f'{here}/coldhot.py', f'art/surprise/{name}-one-print.png', f'art/surprise/{name}-one-coldhot.jpg'], check=True)
subprocess.run([sys.executable, f'{here}/reveal-jpgs.py', f'{name}-one'], check=True)
