// Night Court - game data. All numbers in one place so they are easy to tune.
(function (NC) {
  NC.TITLE = 'Blood & Dawn';

  NC.WORLD = { w: 1600, h: 2400, riverTop: 1130, riverBot: 1270,
    fords: [{ x1: 170, x2: 370 }, { x1: 710, x2: 890 }, { x1: 1230, x2: 1430 }] };

  NC.POP_CAP = 50;          // per side, so ~100 units max on the map
  NC.DAY_LEN = 240;         // seconds for a full day+night
  NC.NIGHT_START = 130;     // within the cycle, night runs 130..240
  NC.START_CYCLE = 100;     // game starts late afternoon
  NC.XP_LEVELS = [0, 150, 450]; // xp needed for level 1,2,3
  NC.LEVEL_COST = [0, 200, 400]; // pay to jump to level 2 / 3
  NC.BASE_INCOME = 3;       // per second from your fortress

  NC.DIFFICULTY = {
    easy:      { name: 'Easy', maxArmy: 20,      think: 2.0, buildDelay: 16, income: 0.8, wave: 6,  waveEvery: 150, firstWave: 260, upgrades: false, startRes: 0,   heroAt: 300 },
    medium:    { name: 'Medium', maxArmy: 32,    think: 1.2, buildDelay: 10, income: 1.0, wave: 9,  waveEvery: 120, firstWave: 190, upgrades: true,  startRes: 0,   heroAt: 220 },
    hard:      { name: 'Hard', maxArmy: 42,      think: 0.8, buildDelay: 6,  income: 1.3, wave: 12, waveEvery: 95,  firstWave: 150, upgrades: true,  startRes: 200, heroAt: 160 },
    nightmare: { name: 'Nightmare', maxArmy: 50, think: 0.5, buildDelay: 3,  income: 1.7, wave: 16, waveEvery: 75,  firstWave: 120, upgrades: true,  startRes: 500, heroAt: 120 }
  };

  NC.FACTIONS = {
    night: { key: 'night', name: 'The Night Court', res: 'Blood', resIcon: '🩸', color: '#b3122e', dark: '#2a0610', light: '#f0d9c0',
      fortress: 'fortress', heroes: ['vael', 'grimfang'],
      upgrades: { melee: 'Sharp Fangs', ranged: 'Barbed Bones', armor: 'Bone Armor', frenzy: 'Blood Frenzy' } },
    dawn:  { key: 'dawn', name: 'The Dawn Order', res: 'Gold', resIcon: '🪙', color: '#e0b030', dark: '#3a2c08', light: '#ffffff',
      fortress: 'keep', heroes: ['ashen'],
      upgrades: { melee: 'Silver Edges', ranged: 'Blessed Bolts', armor: 'Plate Armor', frenzy: 'Holy Zeal' } }
  };

  // tags: undead, vampire, wolf, flying, siege, ranged, healer, holy, fire, silver
  NC.UNITS = {
    // ---- Night Court ----
    ghoul:   { name: 'Ghouls', faction: 'night', cost: 60, squad: 3, time: 5, hp: 70, dmg: 8, range: 16, cd: 0.9, speed: 58, r: 9, sight: 170, tags: ['undead'], desc: 'Cheap swarm. Heal by feeding on the fallen.' },
    archer:  { name: 'Bone Archers', faction: 'night', cost: 100, squad: 2, time: 6, hp: 50, dmg: 11, range: 150, cd: 1.5, speed: 50, r: 9, sight: 190, tags: ['undead', 'ranged'], proj: 'arrow', desc: 'Cheap, fragile ranged.' },
    thrall:  { name: 'Vampire Thrall', faction: 'night', cost: 120, squad: 1, time: 7, hp: 170, dmg: 18, range: 18, cd: 1.0, speed: 54, r: 11, sight: 170, tags: ['vampire'], drain: 0.35, desc: 'Elite sword. Drains life with each hit.' },
    werewolf:{ name: 'Werewolf', faction: 'night', cost: 140, squad: 1, time: 8, hp: 200, dmg: 22, range: 18, cd: 1.1, speed: 92, r: 12, sight: 200, tags: ['wolf'], desc: 'Fast shock troop. Stronger at night.' },
    bat:     { name: 'Bat Swarm', faction: 'night', cost: 80, squad: 2, time: 5, hp: 45, dmg: 5, range: 14, cd: 0.7, speed: 135, r: 9, sight: 260, tags: ['flying'], desc: 'Fast flying scout. Crosses the river anywhere.' },
    catapult:{ name: 'Bone Catapult', faction: 'night', cost: 240, squad: 1, time: 12, hp: 150, dmg: 55, range: 270, minRange: 60, cd: 4, speed: 30, r: 14, sight: 290, tags: ['siege', 'ranged', 'undead'], splash: 45, proj: 'boulder', desc: 'Siege. Smashes buildings from afar.' },
    // ---- Dawn Order ----
    torch:   { name: 'Torchbearers', faction: 'dawn', cost: 60, squad: 2, time: 5, hp: 85, dmg: 9, range: 16, cd: 0.9, speed: 55, r: 9, sight: 170, tags: ['fire'], bonus: { undead: 1.4 }, desc: 'Burns ghouls and the undead.' },
    crossbow:{ name: 'Crossbowmen', faction: 'dawn', cost: 100, squad: 2, time: 6, hp: 55, dmg: 12, range: 160, cd: 1.6, speed: 50, r: 9, sight: 190, tags: ['ranged', 'silver'], proj: 'bolt', bonus: { vampire: 1.3, wolf: 1.3 }, desc: 'Silver bolts hurt vampires and wolves.' },
    priest:  { name: 'Priest', faction: 'dawn', cost: 100, squad: 1, time: 7, hp: 70, dmg: 6, range: 120, cd: 1.5, speed: 50, r: 10, sight: 180, tags: ['healer', 'holy', 'ranged'], heal: 14, proj: 'spark', desc: 'Heals nearby allies.' },
    knight:  { name: 'Silver Knight', faction: 'dawn', cost: 150, squad: 1, time: 9, hp: 240, dmg: 20, range: 18, cd: 1.1, speed: 78, r: 13, sight: 190, tags: ['silver'], armor: 0.85, bonus: { vampire: 1.2, wolf: 1.2 }, desc: 'Armored cavalry.' },
    ballista:{ name: 'Fire Ballista', faction: 'dawn', cost: 240, squad: 1, time: 12, hp: 150, dmg: 55, range: 280, minRange: 60, cd: 4, speed: 30, r: 14, sight: 300, tags: ['siege', 'ranged', 'fire'], splash: 40, proj: 'firebolt', desc: 'Siege. Burns buildings.' },
    // ---- Heroes ----
    vael:    { name: 'Countess Vael', faction: 'night', hero: true, cost: 400, revive: 200, time: 0, hp: 650, dmg: 28, range: 22, cd: 1.0, speed: 62, r: 15, sight: 220, tags: ['vampire'], drain: 0.3, aura: { radius: 110, dps: 5 },
      abilities: [ { id: 'embrace', name: 'Dark Embrace', icon: '🦇', cd: 45, desc: 'For 12s, enemies that die near her rise as your Thralls.' },
                   { id: 'mist', name: 'Blood Mist', icon: '🌫️', cd: 35, desc: 'Takes 70% less damage and heals for 6s.' } ],
      desc: 'Drains life from enemies around her.' },
    grimfang:{ name: 'Grimfang', faction: 'night', hero: true, cost: 400, revive: 200, time: 0, hp: 760, dmg: 34, range: 20, cd: 1.0, speed: 96, r: 15, sight: 230, tags: ['wolf'],
      abilities: [ { id: 'howl', name: 'Howl', icon: '🐺', cd: 30, desc: 'Nearby allies +40% speed, +20% damage for 8s.' },
                   { id: 'leap', name: 'Leap', icon: '💥', cd: 18, desc: 'Leaps onto the nearest archer or foe and smashes the area.' } ],
      desc: 'Alpha werewolf. Leads the pack.' },
    ashen:   { name: 'Brother Ashen', faction: 'dawn', hero: true, cost: 400, revive: 200, time: 0, hp: 700, dmg: 26, range: 22, cd: 1.0, speed: 60, r: 15, sight: 220, tags: ['holy'], bonus: { undead: 1.3, vampire: 1.3 },
      abilities: [ { id: 'holy', name: 'Holy Light', icon: '☀️', cd: 28, desc: 'Burst of light that burns Night Court units.' } ],
      desc: 'Warrior priest of the Dawn.' }
  };

  // role is what the bot AI uses, so either faction can be played later.
  NC.BUILDINGS = {
    // ---- Night Court ----
    fortress:  { name: 'Fortress', faction: 'night', role: 'fortress', hp: 4000, r: 60, attack: { dmg: 16, range: 220, cd: 1.4, proj: 'arrow' }, income: NC.BASE_INCOME },
    crypt:     { name: 'Crypt', faction: 'night', role: 'barracks', cost: 200, time: 12, hp: 1200, r: 32, desc: 'Recruits Ghouls, Archers, Thralls, Catapults.',
                 trains: [['ghoul', 'archer'], ['thrall'], ['catapult']] },
    wolfden:   { name: 'Wolf Den', faction: 'night', role: 'barracks2', cost: 300, time: 15, hp: 1100, r: 32, desc: 'Recruits Werewolves and Bat Swarms.',
                 trains: [['bat', 'werewolf'], [], []] },
    altar:     { name: 'Blood Altar', faction: 'night', role: 'forge', cost: 250, time: 15, hp: 1000, r: 30, desc: 'Buy upgrades for your army.' },
    bloodfarm: { name: 'Blood Farm', faction: 'night', role: 'farm', cost: 150, time: 10, hp: 700, r: 28, income: [2.5, 3.5, 4.5], desc: 'Makes blood. Grows with use.' },
    slaughter: { name: 'Slaughterhouse', faction: 'night', role: 'farm2', cost: 260, time: 14, hp: 800, r: 30, income: [4, 5.5, 7], outpostOnly: true, desc: 'Makes lots of blood. Outposts only.' },
    ntower:    { name: 'Watchtower', faction: 'night', role: 'tower', cost: 200, time: 12, hp: 900, r: 24, attack: { dmg: 14, range: 210, cd: 1.2, proj: 'arrow' }, desc: 'Shoots nearby enemies.' },
    // ---- Dawn Order ----
    keep:      { name: 'Keep', faction: 'dawn', role: 'fortress', hp: 4000, r: 60, attack: { dmg: 16, range: 220, cd: 1.4, proj: 'bolt' }, income: NC.BASE_INCOME },
    barracks:  { name: 'Barracks', faction: 'dawn', role: 'barracks', cost: 200, time: 12, hp: 1200, r: 32, desc: 'Recruits Torchbearers, Crossbows, Priests, Ballistas.',
                 trains: [['torch', 'crossbow'], ['priest'], ['ballista']] },
    stables:   { name: 'Stables', faction: 'dawn', role: 'barracks2', cost: 300, time: 15, hp: 1100, r: 32, desc: 'Recruits Silver Knights.', trains: [['knight'], [], []] },
    forge:     { name: 'Forge', faction: 'dawn', role: 'forge', cost: 250, time: 15, hp: 1000, r: 30, desc: 'Buy upgrades for your army.' },
    mill:      { name: 'Mill', faction: 'dawn', role: 'farm', cost: 150, time: 10, hp: 700, r: 28, income: [2.5, 3.5, 4.5], desc: 'Makes gold.' },
    granary:   { name: 'Granary', faction: 'dawn', role: 'farm2', cost: 260, time: 14, hp: 800, r: 30, income: [4, 5.5, 7], outpostOnly: true, desc: 'Makes lots of gold. Outposts only.' },
    dtower:    { name: 'Tower', faction: 'dawn', role: 'tower', cost: 200, time: 12, hp: 900, r: 24, attack: { dmg: 14, range: 210, cd: 1.2, proj: 'bolt' }, desc: 'Shoots nearby enemies.' }
  };

  NC.UPGRADES = {
    melee:  { level: 1, cost: 200, time: 20, desc: '+20% melee damage' },
    ranged: { level: 1, cost: 200, time: 20, desc: '+20% ranged damage' },
    armor:  { level: 2, cost: 300, time: 25, desc: 'Take 20% less damage' },
    frenzy: { level: 3, cost: 400, time: 30, desc: '+15% speed and attack speed' }
  };

  NC.byRole = function (faction, role) {
    for (var k in NC.BUILDINGS) { var b = NC.BUILDINGS[k]; if (b.faction === faction && b.role === role) return k; }
    return null;
  };
})(globalThis.NC = globalThis.NC || {});
