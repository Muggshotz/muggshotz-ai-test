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
#   python3 tools/surprise/frame-mug.py <name> [<frame>] [<scale>]   (frame: halloween-frame-one)
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
FADE = 0.04
frame = Image.open(f'art/surprise/{frame_name}.png').convert('RGBA')

def framed(src):
    art = Image.open(src).convert('RGB')
    if SCALE < 1:
        sw, sh = round(art.size[0] * SCALE), round(art.size[1] * SCALE)
        mat = Image.new('RGB', art.size, (0, 0, 0))
        mat.paste(art.resize((sw, sh), Image.LANCZOS), ((art.size[0] - sw) // 2, (art.size[1] - sh) // 2))
        art = mat
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
Image.open(f'art/surprise/{name}-one-print.png').save(f'art/surprise/wrap/{name}-one.jpg', quality=88, optimize=True)
subprocess.run([sys.executable, f'{here}/coldhot.py', f'art/surprise/{name}-one-print.png', f'art/surprise/{name}-one-coldhot.jpg'], check=True)
subprocess.run([sys.executable, f'{here}/reveal-jpgs.py', f'{name}-one'], check=True)
