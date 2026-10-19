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
- `units/`: ghoul, thrall, werewolf, archer, bat, bloodknight, catapult, crossbow, knight, priest, torch, ballista
  - **Infantry** (ghoul, thrall, werewolf, archer, crossbow, priest, torch): 950 tris each.
  - **bat:** a 7-bat swarm with 22 bones and 700 tris. It is a flyer: the origin sits on the ground under the swarm and the bats hover about 1.0–2.6 m up. Walk is the fly loop, and in Death the bats fall to the ground.
  - **catapult / ballista:** siege engines about 3 m long, with no skeleton. Each one animates rigid nodes (the body, the arm or bolt, and the wheels). Clips are Idle, Walk (wheels roll), Attack and Death.
    - Every moving node is keyed in every clip, so switching clips always resets the pose.
    - In the ballista's Attack, the bolt flies about 6 m forward and then reappears.
- `heroes/`: vael, grimfang, ashen
- `buildings/`:
  - Night: fortress, crypt, bloodfarm, wolfden, altar, slaughter, ntower, each as `<key>_l1/l2/l3.glb`
  - Dawn: keep, barracks, mill, stables, forge, granary, dtower, also `_l1/l2/l3.glb`
  - Every level fits within 8×8 m (the mill includes its sail sweep) and stays under 5k tris.
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

## Measurements
`manifest.json` heights and footprints come from `_scripts/audit.py`, which reads the exported glb files directly.
- Skinned models are measured in the Idle pose at frame 0.
- Static and node-animated models are measured at the maximum over all animation frames. For buildings this includes the mill's sail sweep.
- The Glow material's emissive colour is constant per model (KHR_materials_emissive_strength), so vertex colours don't affect emission.

## Three.js usage
```js
const g = await new GLTFLoader().loadAsync('art3d/' + m.file);
g.scene.traverse(o => { if (o.material?.name === 'Team') { o.material = o.material.clone(); o.material.color.set(teamHex); } });
const mixer = new THREE.AnimationMixer(g.scene);
const idle = mixer.clipAction(THREE.AnimationClip.findByName(g.animations, m.clips.idle)).play();
```
Use `SkeletonUtils.clone()` for skinned instances, and set `material.vertexColors` (GLTFLoader already sets it when COLOR_0 is present).
