# THE HEAT REVEAL'S PICTURES (Alyx, 29 Sep 2026: the first play "will just sit
# there for 30 seconds"). The 3D mug's reveal waited on the full print, a
# 2475 x 1155 PNG of two to three and a half megabytes. It loads this instead:
# the right-handed print at two thirds size as a JPEG, about a quarter of a
# megabyte, plenty for a mug a few hundred pixels across on screen.
#   reveal-jpgs.py [name ...]   (no names: every art/surprise/*-print.png)
# Run it for every new design, after its -print.png is made. A left-handed
# print (-print-left.png) gets its own, reveal/<name>-left.jpg: the design
# panel's mug shows the hand chosen.
import glob, os, sys
from PIL import Image
names = sys.argv[1:] or [os.path.basename(p)[:-len('-print.png')] for p in sorted(glob.glob('art/surprise/*-print.png'))]
os.makedirs('art/surprise/reveal', exist_ok=True)
for n in names:
    for src, out in ((f'art/surprise/{n}-print.png', f'art/surprise/reveal/{n}.jpg'),
                     (f'art/surprise/{n}-print-left.png', f'art/surprise/reveal/{n}-left.jpg')):
        if not os.path.exists(src): continue
        Image.open(src).convert('RGB').resize((1650, 770), Image.LANCZOS).save(out, quality=86, optimize=True, progressive=True)
        print(f'{out}: {os.path.getsize(out) // 1024} KB')
