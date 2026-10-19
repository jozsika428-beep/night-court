# Night Court RTS: art pack v1

Original dark-fantasy art for the BFME-style phone RTS in `/workspace/game` (no Lord of the Rings names or art).
Follows `../DESIGN.md`: Night Court uses deep red, black and bone with cold blue moonlight; Dawn Order uses gold, white and steel.
Everything shares one style: painted, thick dark outlines, high 3/4 view. Open `concept_sheet.png` to see the whole pack.

## Drop-in
`manifest.json` already uses the format `js/assets.js` loads (`base`, `sprites`, `buildings{l1,l2,l3}`, `portraits`, `icons`).
Its keys match the ones in `js/config.js` (`ghoul`, `archer`, `thrall`, `werewolf`, `bat`, `catapult`, `torch`, `crossbow`, `priest`, `knight`, `ballista`, `vael`, `grimfang`, `ashen`, `fortress` ... `dtower`).
The game will start using the sprites as soon as it fetches `art/manifest.json`.
Keys for units and buildings the game doesn't have yet are already included: `brute`, `bloodknight`, `banshee`, `wraith`, `gargoyle`, `abomination`, `cultist`, `witchhunter`, `gravecaller`, `bansheequeen`, `inquisitor`, `sunpriestess`, `charnel`, `chapel`.
Neutral outposts: `village`, `graveyard`, `shrine`, `ruin`. Map art: `prop_*` and `tile_*`.
`manifest.files[]` lists every file with its size in pixels, size in bytes, kind, faction, level, anchor, facing and notes.

## Folders
| folder | contents | size |
|---|---|---|
| `units/` | 19 unit sprites `<faction>_<unit>.png` (13 Night, 6 Dawn). A 1px faction-colour outline is baked in. | 64×64 |
| `units/src/` | clean sources without the outline | 128×128 |
| `heroes/` | 7 hero sprites (Vael, Grimfang, Gravecaller, Banshee Queen, Brother Ashen, Iron Inquisitor, Sun Priestess) | 80×80 (`src/` 160) |
| `portraits/` | 7 square hero portraits with opaque painted backgrounds | 512×512 |
| `buildings/` | 16 buildings × levels 1/2/3 `<faction>_<building>_l<N>.png`, plus 4 `neutral_*` outposts | 256×256 (`src/` 512) |
| `ui/` | `res_blood`, `res_gold`, `upg_silver_armor`, `upg_bone_armor`, `upg_fangs`, `upg_silver_weapons`, `upg_faster_recruit`, `badge_level_1/2/3`; `team_ring_night/dawn` (64×32) | 64×64 |
| `terrain/` | Blackwater Fords seamless tiles: `tile_water`, `tile_ford`, `tile_grass`, `tile_mud` (128, plus `_256`) | 128 / 256 |
| `terrain/props/` | `rocks_cluster`, `rock_flat`, `tree_pine`, `tree_oak`, `tree_dead`, `reeds` | 128×128 |
| `_src/` | the raw generated sheets (green or magenta chroma background) | 1280×720 |
| `tools/` | `process_sprites.py` (chroma key, slice, trim, fit), `make_ui_terrain_portraits.py`, `build_sheet_manifest.py` | |

## Anchors and facing
- Every sprite has a transparent background and sits **bottom-centre**: feet or base at x = 0.5·w, y ≈ 0.96·h (buildings 0.97·h).
  Right now `assets.js` draws sprites centred on (x, y). That works, but sprites will look a bit high; to fix it, draw at `y - s*0.46`.
- Night Court sprites face **down-right** and Dawn Order sprites face **down-left**, so the armies face each other. Flip with `scale(-1,1)` for the other direction.
- Flying or hovering units (bat swarm, gargoyle, banshee, wraith rider, banshee queen) have no shadow drawn in. The engine's `u.flying` shadow covers that.
- Each building level fills its own 256px canvas. To show growth, draw L1 at about 80%, L2 at about 90% and L3 at 100%.
- Level badges are meant to sit at the top-right of a building or unit (bronze I, silver II, gold III).

## Regenerate
`python3 tools/process_sprites.py && python3 tools/make_ui_terrain_portraits.py && python3 tools/build_sheet_manifest.py`
(this needs `scipy`, installed with `pip install --user --break-system-packages scipy`)

## Known gaps (v1)
- Each unit has one static pose: no walk, attack or death frames, and no 8-direction sets.
- No shore or edge transition tiles between water, ford, grass and mud. The tiles are plain fills.
- No Night or Dawn versions of captured outposts yet. Use the faction Blood Farm, Granary, Charnel House or Tower sprites, or a team flag.
- No projectile or effect sprites (bolts, boulders, blood mist, holy light), and no ability icons (howl, leap, mist, embrace).
- Unit sprites have no upgrade variants (silver tips, bone armor). Use the engine overlays or the upgrade icons.
