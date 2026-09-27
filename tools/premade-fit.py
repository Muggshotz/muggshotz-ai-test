# PREMADE SLOTS: puts one finished design into its category.
#   python3 tools/premade-fit.py <category> <key> <artist's file>
# Makes <dir>/print/<key>.jpg at the product's exact print size and
# <dir>/show/<key>.jpg at the page's size, trimming the artist's file evenly
# to the print's shape (never stretched). Then add {key:'<key>',label:'...'}
# to the category's items in needles-studio.html (PREMADE_CATEGORIES).
# The categories here must match PREMADE_CATEGORIES: folder, print size, page size.
import sys, os
from PIL import Image
CATEGORIES = {
    'welcome-mats': ('art/unwelcome', (4650, 2850), (900, 552)),   # the doormat
    'placemats':    ('art/placemats', (5610, 3839), (900, 616)),   # the neoprene placemat
}
cat, key, src = sys.argv[1:4]
folder, (pw, ph), (sw, sh) = CATEGORIES[cat]
im = Image.open(src).convert('RGB')
w, h = im.size
r = pw / ph
if w / h > r:
    nw = round(h * r); box = ((w - nw) // 2, 0, (w - nw) // 2 + nw, h)
else:
    nh = round(w / r); box = (0, (h - nh) // 2, w, (h - nh) // 2 + nh)
c = im.crop(box)
trim = (w - (box[2] - box[0])) + (h - (box[3] - box[1]))
os.makedirs(f'{folder}/print', exist_ok=True); os.makedirs(f'{folder}/show', exist_ok=True)
c.resize((pw, ph), Image.LANCZOS).save(f'{folder}/print/{key}.jpg', quality=93)
c.resize((sw, sh), Image.LANCZOS).save(f'{folder}/show/{key}.jpg', quality=84, optimize=True)
print(f'{cat}/{key}: {w}x{h} -> print {pw}x{ph}, page {sw}x{sh}; trimmed {trim}px ({100*trim/max(w,h):.1f}%)')
if max(w / pw, h / ph) < 0.99: print(f'  note: the artist\'s file is smaller than the print; it was enlarged {pw / (box[2]-box[0]):.2f}x')
