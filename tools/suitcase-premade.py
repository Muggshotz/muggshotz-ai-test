# SUITCASE PREMADES, STEP 1: the unfaded files for each suitcase design.
#   python3 tools/suitcase-premade.py [<key> ...]   (default: every art/suitcases/flat/*.webp)
# From the artist's flat file, art/suitcases/flat/<key>.webp, this writes
#   art/suitcases/plain/<key>-<Size>.jpg  one per size, trimmed evenly to that
#       size's exact print shape (Printify blueprint 624 / provider 81 placeholders,
#       read live 30 Sep 2026). The three cases are slightly different shapes and
#       the order server fits a file INSIDE the print area and pads with white
#       (buildSingleImage), so each size gets its own shape: no white strip.
#       Kept at the design's own resolution; the server scales it to the print.
# These are what the shelf's fade slider fades. Step 2, tools/suitcase-fade.cjs,
# fades them at the default into art/suitcases/print/, and makes show/ and still/.
import sys, os, glob
from PIL import Image
SIZES = {'Small': (5433, 7323), 'Medium': (6260, 8504), 'Large': (7217, 9561)}
keys = sys.argv[1:] or sorted(os.path.basename(f)[:-5] for f in glob.glob('art/suitcases/flat/*.webp'))
os.makedirs('art/suitcases/plain', exist_ok=True)
def fit(im, r):
    w, h = im.size
    if w / h > r: nw = round(h * r); return im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = round(w / r); return im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
for k in keys:
    im = Image.open(f'art/suitcases/flat/{k}.webp').convert('RGB')
    for size, (pw, ph) in SIZES.items():
        fit(im, pw / ph).save(f'art/suitcases/plain/{k}-{size}.jpg', quality=94)
    print(k)
