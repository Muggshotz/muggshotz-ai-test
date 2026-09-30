# SUITCASE PREMADES: the shelf's files for each faded suitcase design.
#   python3 tools/suitcase-premade.py [<key> ...]   (default: every art/suitcases/faded/*.jpg)
# From art/suitcases/faded/<key>.jpg (tools/suitcase-fade.cjs makes it) this writes
#   art/suitcases/print/<key>-<Size>.jpg  one per size, trimmed evenly to that
#       size's exact print shape (Printify blueprint 624 / provider 81 placeholders,
#       read live 30 Sep 2026). The three cases are slightly different shapes and
#       the order server fits a file INSIDE the print area and pads with white
#       (buildSingleImage), so each size gets its own shape: no white strip.
#       Kept at the design's own resolution; the server scales it to the print.
#   art/suitcases/show/<key>.jpg  the picture on the shelf, 600 x 800.
import sys, os, glob
from PIL import Image
SIZES = {'Small': (5433, 7323), 'Medium': (6260, 8504), 'Large': (7217, 9561)}
SHOW = (600, 800)
keys = sys.argv[1:] or sorted(os.path.basename(f)[:-4] for f in glob.glob('art/suitcases/faded/*.jpg') if not f.endswith('all-12.jpg'))
os.makedirs('art/suitcases/print', exist_ok=True); os.makedirs('art/suitcases/show', exist_ok=True)
def fit(im, r):
    w, h = im.size
    if w / h > r: nw = round(h * r); return im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = round(w / r); return im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
for k in keys:
    im = Image.open(f'art/suitcases/faded/{k}.jpg').convert('RGB')
    for size, (pw, ph) in SIZES.items():
        fit(im, pw / ph).save(f'art/suitcases/print/{k}-{size}.jpg', quality=94)
    fit(im, SHOW[0] / SHOW[1]).resize(SHOW, Image.LANCZOS).save(f'art/suitcases/show/{k}.jpg', quality=85, optimize=True)
    print(k)
