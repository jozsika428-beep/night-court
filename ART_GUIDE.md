# Art guide (how the game uses `art/`)
The game reads `art/manifest.json` on start. Every key in it replaces the placeholder shape for that key; anything missing stays a placeholder, so art can arrive bit by bit.

- `sprites`: `key -> path` (units, heroes, outposts `village`/`graveyard`/`shrine`, terrain `tile_*` and `prop_*`).
- `buildings`: `key -> { l1, l2, l3 }` (an array or `key_2` style keys also work).
- `portraits`, `icons`: used on buttons and the menu. Faction variants: `<icon>_<faction>` (e.g. `melee_dawn`) win over the plain key.
- optional `sizes`: `key -> world pixels` to override draw size.

Drawing rules used by the engine:
- Units: feet at bottom-centre (0.96 h), drawn on a team ring (`ring_night`/`ring_dawn`), mirrored to face the way they move (Night art faces right, Dawn art faces left).
- Buildings: base at bottom-centre (0.97 h); level 1 drawn at 80%, level 2 at 90%, level 3 at 100%. The Fortress/Keep always uses its level-3 art. Level badge `badge_1..3` sits top-right.
- Upgrades are engine overlays: red blade (melee), gold dot (ranged), white ring (armor), red glow ring (frenzy). Rank chevrons under units trained in levelled buildings.
- Terrain: `tile_grass` base, `tile_mud` roads/bases, `tile_water` river, `tile_ford` fords, `prop_*` trees, reeds and rocks.
