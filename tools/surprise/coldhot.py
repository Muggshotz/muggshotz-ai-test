# COLD -> HOT picture for a SURPRISE!!! template, built on the Proposal's
# original poster (kept as proposal-poster-base.jpg). Right-handed, the way
# the customer meets it: HOT is the side facing them as they hold the handle
# in their right hand (handle on the right, the print's right half, the
# opener); OTHER SIDE is the mug turned round (handle on the left, the left
# half, the punchline). Wrapped round the cylinder, darkened toward the edges,
# the plain cold mug's own shine laid back over the top.
# usage: coldhot.py <right-handed print.png> <out.jpg>
import sys, numpy as np, cv2
from PIL import Image, ImageFilter
PW, PH = 2475, 1155
GAP = 68.0            # degrees of the circumference left unprinted at the handle
BASE = sys.argv[3] if len(sys.argv) > 3 else 'art/surprise/proposal-poster-base.jpg'
orig = np.asarray(Image.open(BASE).convert('RGB')).astype(float) / 255
prn = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float) / 255
H, Wimg = orig.shape[:2]
base = orig.copy()
# THE HOT MUG TURNED ROUND, handle to the right: made from the plain COLD mug
# (no old print on it), mirrored, set where the HOT mug stood. Below the mug
# the table and the HOT label's own patch are mirrored too, and the label laid
# back the right way round, centred under the new mug.
SRC0, SRC1 = 15, 490          # the cold mug, its handle and a margin of table
D0 = 575                      # where the mirrored copy starts
D1 = D0 + (SRC1 - SRC0)
MUGROWS, FE = 336, 10
cold_flip = orig[:MUGROWS + FE, SRC0:SRC1][:, ::-1]
low_flip = orig[MUGROWS - FE:400, D0:D1][:, ::-1]
patch = np.concatenate([cold_flip[:MUGROWS - FE], np.zeros((0, D1 - D0, 3))], axis=0)
blend_rows = np.linspace(0, 1, 2 * FE)[:, None, None]
mid = cold_flip[MUGROWS - FE:MUGROWS + FE] * (1 - blend_rows) + low_flip[:2 * FE] * blend_rows
patch = np.concatenate([cold_flip[:MUGROWS - FE], mid, low_flip[2 * FE:]], axis=0)
# left: only 20px of clear table between the arrow and the old handle;
# right: clear table, a long blend
wx = np.ones(D1 - D0); wx[:20] = np.linspace(0, 1, 20); wx[-60:] = np.linspace(1, 0, 60)
base[:400, D0:D1] = orig[:400, D0:D1] * (1 - wx[None, :, None]) + patch * wx[None, :, None]
hot_x0, hot_x1 = D0 + (SRC1 - 1 - 445), D0 + (SRC1 - 1 - 156)
mug_c = (hot_x0 + hot_x1) / 2
lab = orig[334:400, 712:978]; shift = int(round(mug_c - 845))
fy = np.clip(np.minimum(np.arange(lab.shape[0]), np.arange(lab.shape[0])[::-1]) / 6, 0, 1)
fx = np.clip(np.minimum(np.arange(lab.shape[1]), np.arange(lab.shape[1])[::-1]) / 6, 0, 1)
fm = (fy[:, None] * fx[None, :])[..., None]
dst = base[334:400, 712 + shift:978 + shift]
base[334:400, 712 + shift:978 + shift] = dst * (1 - fm) + lab * fm
cold = dict(x0=156, x1=445)
def facing(frac, handle_right):
    # the print angle, from the handle round, that faces the camera
    return frac
MUGS = [dict(x0=hot_x0, x1=hot_x1, frac=0.75, handle_right=True),
        dict(x0=1276, x1=1550, frac=0.25, handle_right=False)]
TOP_C, TOP_B = 20.0, 6.0
BOT_C, BOT_B = 320.0, 13.0
def sample(u, v):
    inside = (u >= 0) & (u <= PW - 1) & (v >= 0) & (v <= PH - 1)
    uc, vc = np.clip(u, 0, PW - 1.001), np.clip(v, 0, PH - 1.001)
    x0, y0 = np.floor(uc).astype(int), np.floor(vc).astype(int); fx, fy = (uc - x0)[..., None], (vc - y0)[..., None]
    p = (prn[y0, x0] * (1 - fx) * (1 - fy) + prn[y0, x0 + 1] * fx * (1 - fy) + prn[y0 + 1, x0] * (1 - fx) * fy + prn[y0 + 1, x0 + 1] * fx * fy)
    return p * inside[..., None]
out = base.copy()
for m in MUGS:
    cx, R = (m['x0'] + m['x1']) / 2, (m['x1'] - m['x0']) / 2
    xs = np.arange(int(m['x0']) - 1, int(m['x1']) + 2)
    s = np.clip((xs - cx) / R, -1, 1); phi = np.arcsin(s)
    ytop = TOP_C + TOP_B * np.cos(phi) + 2; ybot = BOT_C + BOT_B * np.cos(phi) - 3
    ys = np.arange(0, H)[:, None]
    t = (ys - ytop[None, :]) / (ybot - ytop)[None, :]
    # the print runs left to right across the visible face; the mug is turned
    # so the chosen quarter of the print faces the camera
    u = m['frac'] * PW + np.degrees(phi) / (360 - GAP) * PW
    U = np.broadcast_to(u[None, :], t.shape); V = t * (PH - 1)
    col = sample(U, V) * (0.28 + 0.72 * np.cos(phi) ** 0.7)[None, :, None]
    ccx, cR = (cold['x0'] + cold['x1']) / 2, (cold['x1'] - cold['x0']) / 2
    cxs = np.clip(np.round(ccx + (-s if m['handle_right'] else s) * cR).astype(int), 0, Wimg - 1)
    shine = np.clip((orig[np.clip(ys, 0, H - 1), cxs[None, :]] - 0.03) * 1.6, 0, 1)
    col = 1 - (1 - col) * (1 - shine)
    inbody = (t >= 0) & (t <= 1) & (np.abs((xs - cx) / R) <= 1)[None, :]
    edge = np.clip((1 - np.abs((xs - cx) / R)) * R / 1.5, 0, 1)[None, :]
    tv = np.clip(np.minimum(t, 1 - t) * (ybot - ytop)[None, :] / 1.5, 0, 1)
    wgt = (inbody * edge * tv)[..., None]
    out[:, xs[0]:xs[-1] + 1] = out[:, xs[0]:xs[-1] + 1] * (1 - wgt) + col * wgt
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(sys.argv[2], quality=90, optimize=True)
