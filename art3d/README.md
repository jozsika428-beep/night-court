# Night Court vs Dawn Order — 3D asset pack v1

These are glTF 2.0 `.glb` models for the Three.js mobile build. The binding rules are in `SPEC.md`, and every model follows them:
- **Axes and scale:** Y-up, 1 unit = 1 m, models face +Z.
- **Origin:** at the feet centre. For buildings, at the footprint centre on the ground.
- **Materials:** vertex colours only, so there are **no textures** on models and no Draco compression.
  - **Body:** vertex colours.
  - **Team:** white vertex colour × the faction colour. Tint `material.color` here in code.
  - **Metal:** metallic parts.
  - **Glow:** emissive eyes, blood, holy light and fire.
- **Clips:** `Idle`, `Walk`, `Run`, `Attack`, `Death`, and `Ability` on heroes and the archer. Idle, Walk and Run loop.
- **Rigs:** at most 30 bones and 4 weights per vertex.

## Layout
- `units/`: ghoul, thrall, werewolf, archer, bloodknight, crossbow, knight, priest, torch
- `heroes/`: vael, grimfang, ashen
- `buildings/`:
  - Night: fortress, crypt, bloodfarm, ntower, each as `<key>_l1/l2/l3.glb`
  - Dawn: keep, barracks, mill, dtower, also `_l1/l2/l3.glb`
  - Neutral: outpost_plot, watchtower
  - The mill sails spin through a looping `Idle` clip.
- `props/`: Blackwater Fords props, all under 500 tris. pine_a, pine_b, oak, dead_tree, rock_large, rock_tall, rocks_small, reeds, stump.
- `terrain/`:
  - Tileable 512 px textures: grass, mud, ford and water `.jpg`.
  - `materials.json` with colour, roughness, opacity and repeat in metres. Water is meant to be a transparent plane over a mud or ford bed.
- `manifest.json`: keys match `js/config.js`.
  - Units and heroes have `file`, `faction`, `scale`, `height` and a `clips` map.
  - Buildings have `dir` plus `levels: [l1, l2, l3]`, with per-level tris and footprint.
  - Prop keys start with `prop_`, terrain keys with `terrain_`.
- `previews/`: one render per model. `preview_sheet.png` is the contact sheet.
- `_scripts/`: the Blender build scripts, for reproducibility.
  - Example run: `blender -b --python buildings.py -- all`

## Three.js usage
```js
const g = await new GLTFLoader().loadAsync('art3d/' + m.file);
g.scene.traverse(o => { if (o.material?.name === 'Team') { o.material = o.material.clone(); o.material.color.set(teamHex); } });
const mixer = new THREE.AnimationMixer(g.scene);
const idle = mixer.clipAction(THREE.AnimationClip.findByName(g.animations, m.clips.idle)).play();
```
Use `SkeletonUtils.clone()` for skinned instances, and set `material.vertexColors` (GLTFLoader already sets it when COLOR_0 is present).
