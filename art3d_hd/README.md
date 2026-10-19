# art3d_hd — HD model set

`manifest.json` uses the same keys as `art3d/manifest.json`. Each entry adds `lod.far`; buildings use a per-level array. A key missing here falls back to `art3d`. Levels that have no HD file yet point to `../../art3d/...`, and `hdLevels` marks which levels are HD.

- Units are 2.6k tris, 1024 albedo, with a far LOD of about 700 tris at 256. Heroes are 7–7.5k tris, 2048 albedo plus a 1024 normal map, with a far LOD of 1.5k at 512. Buildings are about 9k tris, 1024 albedo plus normal, with a far LOD of about 2k at 512.
- Textures are KTX2 (ETC1S colour, UASTC normal) with meshopt geometry. JPG/PNG copies of every model are in `_jpg/` (same paths) in case KTX2 is turned off.
- Materials: `Body`, `Team` (greyscaled texture × baseColorFactor, so the code's tint works) and `Glow` (emissive windows, torches and braziers). Team-mask PNGs for characters are in `*/textures/*_teammask.png`.
- Rigs use the Quaternius Man skeleton (30 bones, 4 weights per vertex), the same in the near and far files. The clips are Idle, Walk, Run, Attack and Death, plus Ability on heroes.
- Orientation follows SPEC: Y-up, metres, faces +Z, origin at the feet or footprint centre.
- `raw/`, `concepts/` and `_cfg/` are the working sources (TRELLIS/TripoSR meshes, FLUX concepts, build configs). They are not referenced by the manifest.
- To rebuild one model: `python3 /workspace/tools3d/hd/roster.py <name> build`, then `/workspace/tools3d/hd/finalize.sh` and `python3 /workspace/tools3d/hd/manifest.py`.

## Cavalry (knight, bloodknight) — added 12:50 CEST
The Man rig can't carry horse + rider, so the HD mesh (FLUX concept -> TripoSR -> same bake/decimate as the other units) is aligned to the std model (`tools3d/hd/align_cav.py`: PCA yaw, low-slice leg fit) and skinned to the **std horse+rider skeleton** by weight transfer from the std mesh (`tools3d/hd/xfer_rig.py`, plus rules: rider -> Torso, head -> Head; rules in `_cfg/<n>_rules.json`). Same 30 bones and the same Idle/Walk/Run/Attack/Death clips as std, on both the HD and far LODs. 3.0k / 0.8k tris, 1024 / 256 albedo, KTX2 + meshopt. Preview: previews/batchC_cavalry_sheet.png.
