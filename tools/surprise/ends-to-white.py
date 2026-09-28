# A SET DESIGN'S EDGES, BLACK TO WHITE (Alyx, 28 Sep 2026). The magic mug is
# white under a black coating that clears when it is hot, so everything the
# print does not reach shows white when hot -- "the three quarter inches on
# either side of the handle" above all. A design has to fade to WHITE at its
# edges to meet that ("bud has it right and the other nine need to change");
# the black between the setup and the punchline is printed and stays black.
#   ends-to-white.py <print.png> <out.png>
# Near the edges only (EDGE_X in from each end, EDGE_Y from top and bottom),
# what is dark -- the black margin and the scene's own fade into it, read off a
# blurred luminance so shadows inside a scene are left alone -- is lifted to
# white in proportion to how dark it is and how near the edge. Nothing is
# moved, cropped or repainted.
import sys, numpy as np, cv2
from PIL import Image
EDGE_X, EDGE_Y, DARK = 190, 150, 95.0
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(float)
H, W = a.shape[:2]
def ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
x = np.arange(W)[None, :]; y = np.arange(H)[:, None]
wx = ss(1 - np.minimum(x, W - 1 - x) / EDGE_X)
wy = ss(1 - np.minimum(y, H - 1 - y) / EDGE_Y)
near = np.maximum(wx, wy)
lum = cv2.GaussianBlur(a.mean(axis=2), (0, 0), 18)
dark = ss(1 - lum / DARK)
k = (near * dark)[..., None]
res = a + (255 - a) * k
Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(out, optimize=True)
print(f'{out}: edges lifted to white ({EDGE_X}px ends, {EDGE_Y}px top and bottom)')
