# Blood & Dawn
Original dark-fantasy real-time strategy game for phone browsers, in the style of classic base-building RTS games.
You play **The Night Court** (vampires, werewolves, ghouls) against a bot playing **The Dawn Order** (human hunters).

Play: open `index.html` from any static web server (GitHub Pages works). No install, no build step, no server code.
- Default is the **3D view** (Three.js r180, vendored in `vendor/three/`, ES modules + import map).
- **Classic 2D view**: add `?2d=1` to the URL (also linked on the menu). The game also falls back to 2D by itself if WebGL or the 3D module fails.
- Menu option **Graphics: Low / High**. Low = pixel ratio capped at 1.5, no shadows, no antialias, half-res ground texture. High = pixel ratio up to 2, shadows, antialias, water waves.

## 3D view
- Scale: **1 sim unit = 0.1 m**. The 1600 x 2400 map is 160 m x 240 m. Sim x -> world X, sim y -> world Z, Y is up. The player's side is at +Z (near the camera at start).
- Units are drawn 1.6x life size (`UNIT_VIS` in `js3d/world3d.js`) so they read on a phone.
- Camera: angled RTS camera. Drag to pan, pinch to zoom, two-finger twist or the ⟲ ⟳ buttons to rotate (Q/E or the mouse wheel on desktop). It gets flatter as you zoom in.
- Picking: buildings are hit by raycast; units by their on-screen body (feet to head); ground taps by a ray onto the ground plane.
- Models: `art3d/manifest.json` (glTF .glb, Y-up, metres, faces +Z, origin at feet, clips Idle/Walk/Attack/Death/(Run, Ability), material "Team" gets tinted). Any key without a model uses a low-poly placeholder (one instanced draw call per unit type).
- HD models: menu **Models: Standard / HD** (saved; `?hd=1` forces HD). HD reads `art3d_hd/manifest.json` (same keys) and falls back to `art3d/` for any key it lacks. Whether the HD set exists comes from `art3d_sets.json`; **run `python3 tools/asset_index.py` after the HD manifest appears** (until then the button says "HD (coming soon)").
- LOD: an entry may have `"lod": {"far": "file.glb"}` (or a list per building level; same skeleton and clip names). High graphics swaps near/far by camera distance (far beyond 55 m, near again inside 45 m; buildings x1.5) and carries the running clips over; Low graphics only loads the far model. Far models animate every other frame when zoomed out.
- Textures: KTX2/Basis (transcoder vendored in `vendor/three/addons/libs/basis/`), Meshopt geometry, WebP/PNG/JPG. Normal maps are dropped on Low; anisotropy 4 on High, 1 on Low. Test fixture: `test/fixtures/hd/` (`?hdset=test/fixtures/hd/&hd=1`).
- Files: `js3d/boot3d.js` (startup), `camera3d.js`, `world3d.js` (scene, terrain, lighting, entity sync), `models3d.js` (glTF loading + placeholders), `input3d.js` (touch).

## Files
- `index.html`, `style.css`: page, menus, HUD
- `js/config.js`: all units, buildings, upgrades, difficulty numbers (rename the game via `NC.TITLE`)
- `js/maps.js`: map layouts (Blackwater Fords playable; Ruins of Velmoor and The Ashen Steppe "coming soon")
- `js/assets.js`: the ONE asset map. Loads `art/manifest.json`, falls back to coloured shapes per key
- `js/sim.js`: game rules (economy, building levels, combat, river/fords, outposts, heroes, day/night)
- `js/ai.js`: the bot (builds, captures, recruits, attacks in waves, scales with difficulty)
- `js/render.js`, `js/input.js`, `js/ui.js`, `js/main.js`: drawing, touch controls, panels, game loop
- `test/core.test.js`: `node test/core.test.js` (headless rules + bot tests)
- `test/browser_test.py`: 2D view, headless Chrome at 390x844 and 844x390, screenshots to `screens/`
- `test/browser3d_test.py [url] [low|high]`: 3D view with SwiftShader WebGL: touch tap/drag/pinch/twist, raycast pick, ~100-unit fps run, `?2d=1` fallback, screenshots `screens/3d_*.png`
- `ART_GUIDE.md`: how sprites are drawn and how to add more

## Voice lines
- Your own units speak (BFME style): **select** (one line per group: a hero first, else the most common type), **move** (ground tap), **attack** (tap an enemy; sometimes when units start fighting, at most every 14 s), **ability** (hero abilities), **death** (heroes always; other units sometimes when near the camera). One line at a time with a 0.8 s gap, never the same line twice in a row. Code: `js/voice.js`.
- Audio: `voice/final/` is the main set, `voice/raw/` the fallback for units missing in final (folder names: `bonearcher`, `crossbowman`, `torchbearer` = archer, crossbow, torch). Heroes (`vael/`, `grimfang/`, `ashen/`) stay silent until their lines appear in `final/index.json`.
- Web Audio, each file decoded on first use; audio unlocks on the first tap (iOS). Menu: Voice volume + Mute (saved).
- Browsers without Ogg Opus (older iOS Safari) get `.m4a` (AAC) copies. **After the artist adds or changes lines, run:** `python3 tools/voice_m4a.py && python3 tools/asset_index.py --voice-only`, then commit `voice/` and push. Only `index.json`, `.ogg` and `.m4a` are shipped (TTS/FX tooling is git-ignored).

## Title art
- Loading screen (boot, and while 3D models load) and menu background come from `title/` (WebP with JPG fallback, each under 400 KB), made from the artist's PNGs in `art/title/` by `python3 tools/title_web.py`.
- One setting picks the versions: `NC.TITLE_ART` in `js/config.js` (now `{ loading: 'v3', menu: 'v2', logo: 'v2' }`). Portrait or landscape art is picked by screen orientation. When an image has a drawn loading bar (v2 portrait), the real bar is laid exactly over it; otherwise it sits in the clear bottom strip.
