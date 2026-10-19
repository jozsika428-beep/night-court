#!/usr/bin/env python3
"""Web versions of the title art (art/title/ -> title/): WebP + JPG fallback, each under ~400 KB.
Makes every version found (v2, v3, ...): title_<v>_portrait.*, title_<v>_landscape.*, and logo_<v>.webp/png
(logo cropped to its content, black kept for mix-blend 'screen'). Which version the game shows: NC.TITLE_ART in js/config.js."""
import glob, os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'art', 'title'), os.path.join(ROOT, 'title')
LIMIT = 400 * 1024
os.makedirs(OUT, exist_ok=True)

def save_small(im, base, fmts=('webp', 'jpg')):
    for fmt in fmts:
        for q in (82, 76, 70, 64, 58, 52):
            p = f'{base}.{fmt}'
            if fmt == 'webp': im.save(p, 'WEBP', quality=q, method=6)
            else: im.convert('RGB').save(p, 'JPEG', quality=q, optimize=True, progressive=True)
            if os.path.getsize(p) <= LIMIT: break
        print(os.path.relpath(p, ROOT), im.size, os.path.getsize(p) // 1024, 'KB q', q)

for f in sorted(glob.glob(os.path.join(SRC, '*'))):
    n = os.path.basename(f); m = re.match(r'(title|logo)_(v\d+)(?:_(portrait|landscape))?_\d+x\d+\.png$', n)
    if not m: continue
    kind, ver, orient = m.groups(); im = Image.open(f).convert('RGB')
    if kind == 'title': save_small(im, os.path.join(OUT, f'title_{ver}_{orient}'))
    else:
        # crop the logo to its glowing content (plus a margin); keep it smallish for the menu
        g = im.convert('L').point(lambda v: 255 if v > 28 else 0); bb = g.getbbox()
        if bb:
            pad = 16; bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)); im = im.crop(bb)
        if im.width > 960: im = im.resize((960, round(im.height * 960 / im.width)), Image.LANCZOS)
        save_small(im, os.path.join(OUT, f'logo_{ver}'), ('webp', 'jpg'))
