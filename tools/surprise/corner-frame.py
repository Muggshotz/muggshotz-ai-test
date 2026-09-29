# A WHOLE FRAME FROM ONE CORNER (Bud, 29 Sep 2026: the Valentine frame as a
# single top-left corner, roses and hearts on gold rods, transparent). The
# corner is mirrored into the other three and the plain rods are stretched
# between them, so one painting makes a frame of any size: the whole print
# (One frame) or each half (A frame each side).
#   corner-frame.py <corner.png> <out.png> <width> <height> [rod_in_px] [scale]
# rod_in_px: how far in from the edge the rods' centre lines run (default 46,
# which keeps the leaves that reach outside the rods on the canvas).
# scale: the corner's size on the print (default 0.48 of Bud's 1254 px).
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
W, H = int(sys.argv[3]), int(sys.argv[4])
ROD_IN = float(sys.argv[5]) if len(sys.argv) > 5 else 46
K = float(sys.argv[6]) if len(sys.argv) > 6 else 0.48
c = np.asarray(Image.open(src).convert('RGBA')).astype(float)
al = c[..., 3]
# The rods, measured: the top rod's rows at its far end, the left rod's columns at its foot.
rows = [y for y in range(0, c.shape[0] // 2) if al[y, -40] > 128]
cols = [x for x in range(0, c.shape[1] // 2) if al[-40, x] > 128]
ry, rx = (rows[0] + rows[-1]) / 2, (cols[0] + cols[-1]) / 2
# The corner's decoration, and a margin of plain rod after it.
dx = int(np.nonzero((al[int(ry) + 30:, int(rx) + 30:] > 40).any(0))[0].max() + rx + 30) + 50
dy = int(np.nonzero((al[int(ry) + 30:, int(rx) + 30:] > 40).any(1))[0].max() + ry + 30) + 50
corner = c[:dy, :dx]
top_rod = c[int(ry) - 30:int(ry) + 31, -120:-20]        # plain rod, lengthways
left_rod = c[-120:-20, int(rx) - 30:int(rx) + 31]
BW, BH, IN = round(W / K), round(H / K), ROD_IN / K     # built at Bud's scale, then brought down
big = np.zeros((BH, BW, 4))
def paste(img, x, y):
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(BW, x + w), min(BH, y + h)
    if x1 <= x0 or y1 <= y0: return
    part = img[y0 - y:y1 - y, x0 - x:x1 - x]; a = part[..., 3:] / 255
    region = big[y0:y1, x0:x1]
    region[..., :3] = part[..., :3] * a + region[..., :3] * (1 - a)
    region[..., 3:] = part[..., 3:] + region[..., 3:] * (1 - a)
def stretch(img, w, h):
    pm = np.dstack([img[..., :3] * img[..., 3:] / 255, img[..., 3]])
    ch = [np.asarray(Image.fromarray(pm[..., i].astype(np.float32), 'F').resize((w, h), Image.BILINEAR)) for i in range(4)]
    a = np.clip(ch[3], 0, 255); return np.dstack([np.clip(x * 255 / np.maximum(a, 1), 0, 255) for x in ch[:3]] + [a])
ox, oy = round(IN - rx), round(IN - ry)                 # where the top-left corner goes
# The rods first, the full length; the corners over them.
# Each rod runs knob to knob: from one corner's rod centre line to the other's.
L, T = round(IN), round(BW - 2 * IN)
paste(stretch(top_rod, T, top_rod.shape[0]), L, round(IN - 30))
paste(stretch(top_rod, T, top_rod.shape[0])[::-1], L, round(BH - IN - 31))
V = round(BH - 2 * IN)
paste(stretch(left_rod, left_rod.shape[1], V), round(IN - 30), L)
paste(stretch(left_rod, left_rod.shape[1], V)[:, ::-1], round(BW - IN - 31), L)
paste(corner, ox, oy)
paste(corner[:, ::-1], BW - ox - corner.shape[1], oy)
paste(corner[::-1], ox, BH - oy - corner.shape[0])
paste(corner[::-1, ::-1], BW - ox - corner.shape[1], BH - oy - corner.shape[0])
res = stretch(big, W, H)
Image.fromarray(res.astype(np.uint8), 'RGBA').save(out, optimize=True)
print(f'{out}: {W} x {H}, corner {round(dx * K)} x {round(dy * K)} on the print, rods {round(IN * K)} px in')
