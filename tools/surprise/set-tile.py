# SURPRISE!!! holiday set tile: set-tile.py <set key> <file> <file> <file> <file>
# The set's four design tiles (art/options/surprise-<file>.jpg), two by two,
# as the set's own tile art/options/surprise-set-<key>.jpg (360 x 360).
import sys
from PIL import Image
key, files = sys.argv[1], sys.argv[2:6]
assert len(files) == 4, 'a set is four designs'
out = Image.new('RGB', (360, 360), 'black')
for i, f in enumerate(files):
    t = Image.open(f'art/options/surprise-{f}.jpg').convert('RGB').resize((178, 178), Image.LANCZOS)
    out.paste(t, ((i % 2) * 182, (i // 2) * 182))
out.save(f'art/options/surprise-set-{key}.jpg', quality=86, optimize=True)
print(f'surprise-set-{key}.jpg from {", ".join(files)}')
