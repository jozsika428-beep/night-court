#!/usr/bin/env python3
"""Writes art3d_sets.json (which 3D model sets exist) and voice_sets.json (voice/raw, voice/final). The game reads this small file instead of probing
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

def scan_voice():
    out = {}
    for key in ('raw', 'final'):
        p = os.path.join(ROOT, 'voice', key, 'index.json'); ok = False; m4a = False
        try:
            d = json.load(open(p)); ok = True
            files = [l['file'] for u, evs in d.items() if u != '_meta' and isinstance(evs, dict) for ls in evs.values() for l in ls]
            m4a = bool(files) and all(os.path.exists(os.path.join(ROOT, 'voice', key, f[:-4] + '.m4a')) for f in files)
        except Exception: pass
        out[key] = {'base': 'voice/' + key + '/', 'available': ok, 'm4a': m4a}  # m4a: AAC copies for Safari without Opus
    return out

if __name__ == '__main__':
    bad = 0
    for name, data in (('art3d_sets.json', scan()), ('voice_sets.json', scan_voice())):
        if name == 'art3d_sets.json' and '--voice-only' in sys.argv: continue
        path = os.path.join(ROOT, name)
        if '--check' in sys.argv:
            cur = json.load(open(path)) if os.path.exists(path) else None
            print(name + (' up to date' if cur == data else ' OUT OF DATE: run tools/asset_index.py')); bad += cur != data
        else: json.dump(data, open(path, 'w'), indent=1); print(path, data)
    sys.exit(1 if bad else 0)
