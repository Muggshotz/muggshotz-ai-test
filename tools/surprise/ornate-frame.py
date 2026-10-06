# THE ORNATE FRAME (Alyx, 6 Oct 2026: every mug a decal, or faded to black and
# framed, "no hard edges with no frame and no fade"; for the Ornate set
# "something elegant and harmonious ... that does not compete with the design
# of the artwork"). Bud's Ornate paintings run their scrollwork straight off
# both ends of the print. This sets the painting just inside a thin gold
# double rule (the scrollwork's own gold, 229/153/48, a hairline inside a
# heavier line, the corners turned in), melts all four of its edges into the
# black over 60 px, and hands the result to holiday-mug.py as the painting
# for both hands (an Ornate mug is shown face on; the left hand prints the
# same picture). Then the tile is cut from the print's centre, where the
# subject is, as the Ornate and Silhouette tiles are.
#   python3 tools/surprise/ornate-frame.py <Bud's painting> <name>
# then node tools/surprise/mug-stills.cjs <name> for the shelf's still.
import sys, os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw
W, H = 2475, 1155
src, name = sys.argv[1:3]
here = os.path.dirname(os.path.abspath(__file__))
GOLD, GOLD2 = (229, 153, 48), (240, 186, 92)
M, OUT_W, GAP, IN_W, R = 38, 5, 10, 2, 30      # margin, outer rule, gap, inner rule, corner turn
FADE = 60

art = Image.open(src).convert('RGB')
inner = M + OUT_W + GAP + IN_W + 14             # black breathing room inside the hairline
aw, ah = W - 2 * inner, H - 2 * inner
k = max(aw / art.width, ah / art.height)
art = art.resize((round(art.width * k), round(art.height * k)), Image.LANCZOS)
l, t = (art.width - aw) // 2, (art.height - ah) // 2
art = art.crop((l, t, l + aw, t + ah))
a = np.ones((ah, aw), np.float32)
ramp = (np.arange(FADE) / FADE) ** 1.5
a[:, :FADE] *= ramp; a[:, -FADE:] *= ramp[::-1]; a[:FADE, :] *= ramp[:, None]; a[-FADE:, :] *= ramp[::-1][:, None]
art = Image.fromarray((np.asarray(art).astype(np.float32) * a[..., None]).astype(np.uint8))
canvas = Image.new('RGB', (W, H), 'black'); canvas.paste(art, (inner, inner))

S = 4                                            # the rules drawn 4x and brought down, for clean edges
fr = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(fr)
def rule(off, width, col):
    x0, y0, x1, y1 = off * S, off * S, (W - off) * S, (H - off) * S
    w, r = round(width * S), round((R - (off - M)) * S)
    for cx, cy, a0 in ((x0, y0, 0), (x1, y0, 90), (x1, y1, 180), (x0, y1, 270)):
        d.arc((cx - r, cy - r, cx + r, cy + r), a0, a0 + 90, fill=col, width=w)
    d.line((x0 + r, y0, x1 - r, y0), fill=col, width=w); d.line((x0 + r, y1, x1 - r, y1), fill=col, width=w)
    d.line((x0, y0 + r, x0, y1 - r), fill=col, width=w); d.line((x1, y0 + r, x1, y1 - r), fill=col, width=w)
rule(M + OUT_W / 2, OUT_W, GOLD)
rule(M + OUT_W + GAP + IN_W / 2, IN_W, GOLD2)
fr = fr.resize((W, H), Image.LANCZOS)
canvas.paste(fr, (0, 0), fr)

with tempfile.TemporaryDirectory() as tmp:
    p = os.path.join(tmp, 'framed.png'); canvas.save(p)
    subprocess.run([sys.executable, f'{here}/holiday-mug.py', p, name, p], check=True)
pr = Image.open(f'art/surprise/{name}-print.png').convert('RGB')
pr.crop(((W - H) // 2, 0, (W + H) // 2, H)).resize((360, 360), Image.LANCZOS).save(f'art/options/surprise-{name}.jpg', quality=86, optimize=True)
print(f'{name}: framed, tile from the centre')
