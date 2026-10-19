# Night Court (working title)
Original dark-fantasy real-time strategy game for phone browsers, in the style of classic base-building RTS games.
You play **The Night Court** (vampires, werewolves, ghouls) against a bot playing **The Dawn Order** (human hunters).

Play: open `index.html` from any static web server (GitHub Pages works). No install, no server code.

## Files
- `index.html`, `style.css`: page, menus, HUD
- `js/config.js`: all units, buildings, upgrades, difficulty numbers (rename the game via `NC.TITLE`)
- `js/maps.js`: map layouts (Blackwater Fords playable; Ruins of Velmoor and The Ashen Steppe "coming soon")
- `js/assets.js`: the ONE asset map. Loads `art/manifest.json`, falls back to coloured shapes per key
- `js/sim.js`: game rules (economy, building levels, combat, river/fords, outposts, heroes, day/night)
- `js/ai.js`: the bot (builds, captures, recruits, attacks in waves, scales with difficulty)
- `js/render.js`, `js/input.js`, `js/ui.js`, `js/main.js`: drawing, touch controls, panels, game loop
- `test/core.test.js`: `node test/core.test.js` (headless rules + bot tests)
- `test/browser_test.py`: headless Chrome at 390x844 and 844x390, checks for errors and saves screenshots to `screens/`
- `ART_GUIDE.md`: how sprites are drawn and how to add more
