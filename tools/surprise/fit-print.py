# SURPRISE!!! print fitter: <original> <name>. White margins off; only the
# pure-black middle is taken out (as much as the mug's 2475 x 1155 needs, or
# all of it); any shortfall made up with black above and below; every edge
# of the art faded into black; right- and left-handed prints; a square tile round the reveal.
import sys
from PIL import Image
import numpy as np
src, name = sys.argv[1:3]
W, H = 2475, 1155
a = np.asarray(Image.open(src).convert('RGB')).astype(int)
nw = a.min(axis=2) < 235
rows = np.where(nw.mean(axis=1) > 0.5)[0]; cols = np.where(nw.mean(axis=0) > 0.5)[0]
band = a[rows.min() + 2:rows.max() - 1, cols.min() + 2:cols.max() - 1]
# Plain black rows above and below the scenes are margin too: trim them so
# the scenes, not the margin, fill the mug's height.
rmax = np.percentile(band.max(axis=2), 99, axis=1)
lit = np.where(rmax > 14)[0]
band = band[lit.min():lit.max() + 1]
bh, bw = band.shape[:2]
p99 = np.percentile(band.max(axis=2), 99, axis=0)
d = np.where(p99 <= 14)[0]; runs = []; s = q = d[0]
for x in d[1:]:
    if x != q + 1: runs.append((s, q)); s = x
    q = x
runs.append((s, q)); r0, r1 = max(runs, key=lambda r: r[1] - r[0])
need = max(0, bw - round(bh * W / H)); cut = min(need, r1 - r0 + 1)
x0 = min(max((r0 + r1 + 1) // 2 - cut // 2, r0), r1 + 1 - cut); x1 = x0 + cut
assert band[:, x0:x1].max() <= 40, ('art in the cut', band[:, x0:x1].max())
L, R = band[:, :x0].astype(float), band[:, x1:].astype(float)
# All the black taken: the two scenes would meet edge to edge in a hard line,
# so fade each one's inner edge into black like its outer ones.
if cut >= r1 - r0 + 1:
    e = round((L.shape[1] + R.shape[1]) * 0.04); t = np.clip(np.arange(e) / e, 0, 1); t = t * t * (3 - 2 * t)
    L[:, -e:] *= t[::-1][None, :, None]; R[:, :e] *= t[None, :, None]
art = np.concatenate([L, R], axis=1); ah, aw = art.shape[:2]
tw, th = (W, round(W * ah / aw)) if aw / ah > W / H else (round(H * aw / ah), H)
art = np.asarray(Image.fromarray(art.astype(np.uint8)).resize((tw, th), Image.LANCZOS)).astype(float)
def ramp(n, e):
    t = np.clip(np.arange(n) / e, 0, 1); return t * t * (3 - 2 * t)
ey, ex = round(th * 0.07), round(tw * 0.04)
art *= (np.minimum(ramp(th, ey), ramp(th, ey)[::-1])[:, None] * np.minimum(ramp(tw, ex), ramp(tw, ex)[::-1])[None, :])[:, :, None]
out = np.zeros((H, W, 3)); y = (H - th) // 2; x = (W - tw) // 2; out[y:y + th, x:x + tw] = art
out = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
# RIGHT-HANDED IS THE PRINT TURNED HALF ROUND (Alyx, 24 Sep 2026: "We made
# that template exactly backward"). Held by the handle in the right hand, the
# side facing the drinker is the print's RIGHT half, so the opener (painted on
# the left of the original) goes there; the left-handed print is as painted.
Image.fromarray(np.roll(np.asarray(out), W // 2, axis=1)).save(f'art/surprise/{name}-print.png', optimize=True)
out.save(f'art/surprise/{name}-print-left.png', optimize=True)
o = np.asarray(out).astype(int); right = o[:, W // 2:]
c2 = np.where(right.max(axis=2).mean(axis=0) > 25)[0]; cx = W // 2 + int((c2.min() + c2.max()) / 2)
tx = max(0, min(W - H, cx - H // 2)); out.crop((tx, 0, tx + H, H)).resize((360, 360), Image.LANCZOS).save(f'art/options/surprise-{name}.jpg', quality=84, optimize=True)
print(f'{name}: band {bw}x{bh}, black {r0}-{r1} ({r1-r0+1}), needed {need}, cut {cut}; art {tw}x{th} = {100*th/H:.0f}% of the mug height')
