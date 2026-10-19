#!/usr/bin/env python3
"""Makes AAC (.m4a) copies of every voice line listed in voice/raw/index.json and voice/final/index.json,
next to the .ogg files, for browsers that cannot play Ogg Opus (older iOS Safari). Needs ffmpeg.
Skips files whose .m4a is already newer than the .ogg. Covers voice/final/ (the main set) and voice/raw/ (fallback).
Re-run whenever the artist adds or changes lines (e.g. the hero folders vael/, grimfang/, ashen/), then refresh the
index and push:
    python3 tools/voice_m4a.py && python3 tools/asset_index.py --voice-only
To redo some units no matter the file dates (e.g. re-recorded heroes): --force vael grimfang ashen
(--force alone redoes everything).
If final/ ever lacks .m4a copies, iPhones without Opus support use the raw lines instead (voice_sets.json "m4a")."""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
made = skipped = missing = 0
FORCE = '--force' in sys.argv; ONLY = [a for a in sys.argv[1:] if not a.startswith('--')]
for sub in ('raw', 'final'):
    base = os.path.join(ROOT, 'voice', sub); idx = os.path.join(base, 'index.json')
    if not os.path.exists(idx): continue
    data = json.load(open(idx))
    for unit, events in data.items():
        if unit == '_meta' or not isinstance(events, dict): continue
        for ev, lines in events.items():
            for line in lines:
                src = os.path.join(base, line['file']); dst = src[:-4] + '.m4a'
                if not os.path.exists(src): print('missing', src); missing += 1; continue
                forced = FORCE and (not ONLY or unit in ONLY)
                if not forced and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): skipped += 1; continue
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-ar', '44100', '-movflags', '+faststart', dst], check=True)
                made += 1
print(f'm4a: {made} made, {skipped} up to date, {missing} missing source files')
sys.exit(1 if missing else 0)
