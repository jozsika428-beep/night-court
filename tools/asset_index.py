#!/usr/bin/env python3
"""Writes art3d_sets.json: which 3D model sets exist. The game reads this small file instead of probing
art3d_hd/manifest.json directly, so a missing HD set never causes a 404 in the browser console.
Run it after the artist adds or removes art3d_hd/manifest.json (the 3D test checks it is up to date)."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def scan():
    out = {}
    for key, d in (('std', 'art3d'), ('hd', 'art3d_hd')):
        p = os.path.join(ROOT, d, 'manifest.json'); ok = False
        try: json.load(open(p)); ok = True
        except Exception: pass
        out[key] = {'base': d + '/', 'available': ok}
    return out

if __name__ == '__main__':
    data = scan(); path = os.path.join(ROOT, 'art3d_sets.json')
    if '--check' in sys.argv:
        cur = json.load(open(path)) if os.path.exists(path) else None
        print('art3d_sets.json up to date' if cur == data else 'art3d_sets.json OUT OF DATE: run tools/asset_index.py'); sys.exit(0 if cur == data else 1)
    json.dump(data, open(path, 'w'), indent=1); print(path, data)
