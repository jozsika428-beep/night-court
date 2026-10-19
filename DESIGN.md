# Night Court: design list (art brief)
Original dark-fantasy RTS for phones, played like BFME. No Lord of the Rings names or art.

## Factions
**The Night Court** (player): vampires, werewolves, ghouls and undead.
**The Dawn Order** (enemy bot, and later playable): human hunters.

## Night Court units
- Ghouls: cheap swarm infantry that eat the dead to heal.
- Vampire Thralls: elite swordsmen with life drain.
- Werewolves: fast shock troops, stronger at night.
- Alpha Brutes (level 2): break gates and walls.
- Blood Knights (level 3): mounted on bat-winged horses.
- Bone Archers: cheap, fragile ranged units.
- Bat Swarms: fast flying scouts.
- Banshees: wail that scares and slows enemies.
- Wraith Riders: ghost cavalry.
- Gargoyles: flyers that turn to stone to soak up damage.
- Flesh Abomination: slow siege tank.
- Bone Catapult: siege engine that throws corpses and spreads plague.
- Blood Cultists: healers who sacrifice their own health.

## Dawn Order units
Crossbowmen with silver bolts, Torchbearers that burn ghouls, Silver Knights, Priests who heal and weaken vampires, Witch Hunters, Fire Ballistas.

## Heroes (single units, abilities on cooldown, can be revived)
**Night Court**
- Countess Vael: life-drain aura, turns fallen enemies into thralls, blood mist.
- Grimfang (alpha werewolf): howl that speeds up the pack, leap onto archers, giant wolf form.
- The Gravecaller: raises the dead after fights, curses an area.
- Banshee Queen: mass fear scream.

**Dawn Order**
- Brother Ashen: holy light that burns and stuns undead, banner that stops his troops from breaking.
- The Iron Inquisitor: tank who charges and breaks walls.
- Sun Priestess: big heals.

## Buildings (3 levels, gaining XP by being used)
**Night Court:** Fortress, Crypt (barracks), Wolf Den, Blood Altar (upgrades), Blood Farm, Slaughterhouse, Charnel House, tower.
**Dawn Order:** Keep, Barracks, Stables, Forge, Chapel, Mill, Granary, tower.
- Level 1: basic units.
- Level 2: elite units and the first upgrades.
- Level 3: the strongest unit and the top upgrades. Farms make more at each level.
- Upgrades show on the units, for example silver-tipped weapons, bone armor and sharper fangs.

## Outposts (capturable spots on the map)
- Village: Blood Farm (Night) or Granary (Dawn).
- Graveyard: Charnel House (Night); Dawn can burn it down.
- Watchtower ruin: tower that shoots nearby enemies.
- Old shrine: a map-wide bonus for whoever holds it.

## Day and night cycle
Werewolves are stronger at night; vampires are weaker in daylight.

## Maps (1v1 against a bot: Easy, Medium, Hard, Nightmare)
1. Blackwater Fords: a river with shallow fords (inspired by the Fords of Isen). **Building this first.**
2. Ruins of Velmoor: a broken city split by a river, with bridges to hold (inspired by Osgiliath).
3. The Ashen Steppe: wide plains with many villages to capture (inspired by Rohan and Rhûn).

## Art notes for CandleStick
Each side needs its own look so ownership is clear at a glance: Night Court in deep red, black and bone, Dawn Order in gold, white and steel. Units must read at phone size, so use top-down or 3/4 view, clear silhouettes and roughly 64px sprites. Buildings need a version for each of the 3 levels. The game has one asset map (assets.js), so any sprite can be swapped in.
