# 3D asset spec (binding, from the coder)

- Format: glTF 2.0 `.glb`, one file per model. Y-up, 1 unit = 1 m, model faces **+Z**. Origin at the feet centre; for buildings, the footprint centre on the ground.
- Sizes: infantry ~1.8 m tall, werewolves and brutes ~2.4 m, heroes ~2.2 m, siege ~3 m long. Buildings fit an **8x8 m plot**, with L1/L2/L3 as separate files.
- Budgets: infantry **1.5k tris max**, heroes **3k**, buildings **5k per level**, props **500**. One texture per model, 1024 max (512 preferred), or vertex colours. Skinned models: max **30 bones**, **4 weights per vertex**. No Draco; meshopt is fine. Whole first batch under about **15 MB**.
- Animation clips named exactly `Idle`, `Walk`, `Attack`, `Death`, plus optional `Run` and `Ability`. Idle, Walk and Run loop.
- Put the recolourable part on a material named exactly **"Team"**; the code tints it.
- manifest.json uses config.js keys, in this format:
  `{ "key": { "file": "units/ghoul.glb", "faction": "night", "scale": 1, "height": 1.8, "clips": {"idle":"Idle","walk":"Walk","attack":"Attack","death":"Death"} } }`
  Buildings get `"levels": ["l1.glb","l2.glb","l3.glb"]`. Check /workspace/game/js/config.js for the exact keys.
- Licences and credits go in art3d/CREDITS.md.
