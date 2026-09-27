# ONE HOLIDAY MUG, READY FOR ITS SHELF (Alyx, 27 Sep 2026: "PLACING
# INDIVIDUAL MUGS MAKES IT EASIER FOR US TO DESIGN NEW ADDITIONS ... We can
# just plug and play").
#   python3 tools/surprise/holiday-mug.py <artist's painting> <name> [<left-handed painting>]
# Makes every file a holiday mug needs, in art/surprise/ and art/options/:
#   <name>-print.png, <name>-print-left.png, the tile   (fit-set-print.py)
#   <name>-coldhot.jpg                                  (coldhot.py)
#   show/<name>.jpg: the design laid flat, setup then punchline (the
#   left-handed print), 1050 x 490, the shelf's picture of it. One picture of
#   the design, as a mat is shown; how the mug works (cold, hot, turned round)
#   is How it works' job, never the shelf's (Alyx, 27 Sep 2026).
# Then one line, {key, label, file}, in the holiday's designs in
# lib/surprise-sets.js and the same line in needles-studio.html's
# SURPRISE_SETS (flow-tests/verify-surprise-sets.js holds the two together).
import sys, os, subprocess
from PIL import Image
src, name = sys.argv[1:3]
left = sys.argv[3:4]
here = os.path.dirname(os.path.abspath(__file__))
subprocess.run([sys.executable, f'{here}/fit-set-print.py', src, name, *left], check=True)
subprocess.run([sys.executable, f'{here}/coldhot.py', f'art/surprise/{name}-print.png', f'art/surprise/{name}-coldhot.jpg'], check=True)
os.makedirs('art/surprise/show', exist_ok=True)
Image.open(f'art/surprise/{name}-print-left.png').convert('RGB').resize((1050, 490), Image.LANCZOS).save(f'art/surprise/show/{name}.jpg', quality=86, optimize=True)
print(f'{name}: show/{name}.jpg (1050 x 490)')
