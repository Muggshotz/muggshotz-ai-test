# SURPRISE!!! set design, the other way round: swap-scenes.py <painting> <out.png>
# (Alyx, 26 Sep 2026: "why can't you just switch the artwork by sliding the
# picture on the left all the way to the right and ... the right to the left").
# The left-handed layout of a set design Bud painted only one way: the two
# scenes change places as whole blocks, nothing mirrored; the black middle
# stays in the middle; each scene's old frame-side edge, which now faces the
# middle, fades into the black; the frame's line and corner ornaments stay
# where the painting has them, and the ornaments that rode along on the
# scenes are taken off. Then fit-set-print.py <right> <name> <out.png>.
import sys, numpy as np, cv2
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(float); H, W = a.shape[:2]
def ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
m = a.max(2)
col = np.percentile(m[120:740], 95, axis=0)
# the two scenes: lit columns either side of the black middle
dark = np.where(col < 14)[0]; mid = dark[(dark > W * 0.3) & (dark < W * 0.7)]
L0, L1 = 18, mid.min(); R0, R1 = mid.max() + 1, W - 18
hsv0 = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(float)
H0, S0, V0 = hsv0[..., 0] * 2, hsv0[..., 1] / 255, hsv0[..., 2] / 255
orn0 = ((S0 > 0.40) & (V0 > 0.25) & (H0 > 5) & (H0 < 62)) | ((S0 > 0.5) & (V0 > 0.3) & ((H0 < 8) | (H0 > 340)))
orn0 = cv2.GaussianBlur(cv2.dilate(orn0.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(float), (0, 0), 2)
yy0, xx0 = np.mgrid[0:H, 0:W]
near = np.zeros((H, W))
for cx in (0, W):
    near = np.maximum(near, 1 - np.clip((np.abs(xx0 - cx) - 45) / 15, 0, 1))          # the old side of the frame
    for cy in (0, 812):
        near = np.maximum(near, 1 - np.clip((np.hypot(xx0 - cx, yy0 - cy) - 125) / 20, 0, 1))  # its corners
clean = a * (1 - orn0 * near)[..., None]
left, right = clean[:, L0:L1], clean[:, R0:R1]
new = np.zeros_like(a)
# right scene to the left, left scene to the right, each keeping its own height
new[:, L0:L0 + right.shape[1]] = right
new[:, R1 - left.shape[1]:R1] = left
# each scene's old frame-side edge now faces the black middle: fade it in
FE = 60
x = np.arange(W)
e1 = L0 + right.shape[1]; e2 = R1 - left.shape[1]
f = np.ones(W)
f[e1 - FE:e1] = ss(np.linspace(1, 0, FE)); f[e2:e2 + FE] = ss(np.linspace(0, 1, FE))
f[e1:e2] = 0
new *= f[None, :, None]
# the frame: its line and ornaments, from the original, laid over the top
hsv = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(float)
Hh, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
orn = (S > 0.45) & (V > 0.30) & (Hh > 8) & (Hh < 60)           # orange, amber, wheat
orn |= (S > 0.55) & (V > 0.35) & ((Hh < 8) | (Hh > 340)) & (V < 0.85)  # berries
orn = cv2.dilate(orn.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(float)
yy, xx = np.mgrid[0:H, 0:W]
bottom = 812
d = np.minimum.reduce([xx, W - 1 - xx, yy, bottom - yy])
band = 1 - ss((d - 34) / 10.0)
for cy in (0, bottom):
    for cx in (0, W):
        band = np.maximum(band, (1 - ss((np.hypot(xx - cx, yy - cy) - 130) / 25.0)) * orn)
line = 1 - ss((d - 22) / 6.0)           # the frame's own line and the black outside it
mask = np.clip(np.maximum(line, band * orn), 0, 1)
mask = cv2.GaussianBlur(mask, (0, 0), 1.2)
o = a * mask[..., None] + new * (1 - mask[..., None])
o[bottom + 4:] = a[bottom + 4:]
Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(out)
print('scenes', (L0, L1), (R0, R1))
