# SURPRISE!!! holiday-set print fitter:
#   fit-set-print.py <right-handed painting> <name> [<left-handed painting>]
#
# The set designs (lib/surprise-sets.js) are painted whole, at the mug's own
# shape (2475 x 1155, 2.14:1), frame and all, with the punchline on the LEFT
# half: held in the right hand, the right half faces the drinker first and
# the left half is what they turn to. So unlike fit-print.py nothing is
# trimmed, cut or faded: the painting is only brought to the print's pixels.
#
# Left-handed is Bud's own painting of the other layout (punchline on the
# right) when there is one; without it, the right-handed print turned half
# round (rolled by half its width), as fit-print.py does for the singles.
#
# Also writes the tile, a square round the punchline, as the singles' tiles
# are (verify-smart-mug.js holds every tile to its print's left half).
import sys
from PIL import Image
import numpy as np
W, H = 2475, 1155
right_src, name = sys.argv[1:3]
left_src = sys.argv[3] if len(sys.argv) > 3 else None

def fit(path):
    im = Image.open(path).convert('RGB')
    r = im.size[0] / im.size[1]
    assert abs(r - W / H) < 0.01, f'{path} is {im.size[0]}x{im.size[1]} ({r:.3f}:1), not the mug\'s {W / H:.3f}:1'
    return im.resize((W, H), Image.LANCZOS)

right = fit(right_src)
right.save(f'art/surprise/{name}-print.png', optimize=True)
left = fit(left_src) if left_src else Image.fromarray(np.roll(np.asarray(right), W // 2, axis=1))
left.save(f'art/surprise/{name}-print-left.png', optimize=True)
tx = (W // 2 - H) // 2
right.crop((tx, 0, tx + H, H)).resize((360, 360), Image.LANCZOS).save(f'art/options/surprise-{name}.jpg', quality=84, optimize=True)
print(f'{name}: right from {right_src}; left from {left_src or "the right-handed print, rolled"}')
