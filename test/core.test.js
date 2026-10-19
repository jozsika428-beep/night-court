// Headless tests for the core game logic. Run: node test/core.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
['config', 'maps', 'sim', 'ai'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8'), { filename: f + '.js' }));
const NC = globalThis.NC;
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ok  ' + msg); } else { fail++; console.log('  FAIL ' + msg); } }
function run(g, secs, bots) { const dt = 1 / 30; for (let i = 0; i < secs * 30; i++) { (bots || []).forEach(b => b.update(dt)); g.update(dt); } }
const basePlot = (g, s) => g.plots.filter(p => p.base && p.owner === s && !g.get(p.buildingId));

console.log('Economy');
{
  const g = new NC.Game({ difficulty: 'medium', seed: 1 });
  const r0 = g.sides[0].res; run(g, 10);
  ok(Math.abs(g.sides[0].res - r0 - 30) < 1, 'fortress gives 3 blood/sec (got ' + (g.sides[0].res - r0).toFixed(1) + ')');
  const b = g.build(0, basePlot(g, 0)[0].id, 'bloodfarm');
  ok(typeof b === 'object' && g.sides[0].res < r0 + 30, 'can build a Blood Farm and it costs blood');
  ok(typeof g.build(0, basePlot(g, 1)[0].id, 'crypt') === 'string', 'cannot build on enemy plots');
  ok(typeof g.build(0, basePlot(g, 0)[0].id, 'slaughter') === 'string', 'Slaughterhouse is outpost-only');
  run(g, 11);
  ok(b.built === 1, 'farm finishes building');
  const r1 = g.sides[0].res; run(g, 10);
  ok(Math.abs(g.sides[0].res - r1 - 55) < 1.5, 'farm adds 2.5/sec (10s gain ' + (g.sides[0].res - r1).toFixed(1) + ')');
  run(g, 60);
  ok(b.level === 2, 'farm levels up from producing (level ' + b.level + ', xp ' + b.xp.toFixed(0) + ')');
  ok(g.incomeOf(b) === 3.5, 'level 2 farm makes more (3.5/sec)');
}

console.log('Recruiting and levels');
{
  const g = new NC.Game({ seed: 2 }); g.sides[0].res = 5000;
  const c = g.build(0, basePlot(g, 0)[0].id, 'crypt'); run(g, 13);
  ok(g.train(0, c.id, 'thrall') === 'Needs building level 2', 'Thralls locked at level 1');
  ok(g.train(0, c.id, 'ghoul') === true, 'can queue Ghouls');
  run(g, 6);
  ok(g.units.filter(u => u.type === 'ghoul' && u.owner === 0).length === 3, 'one Ghoul order gives a squad of 3');
  ok(c.xp >= 30, 'crypt gains xp from recruiting');
  ok(g.levelUp(0, c.id) === true && c.level === 2, 'pay to level up to 2');
  ok(g.train(0, c.id, 'thrall') === true, 'Thralls unlocked at level 2');
  run(g, 8);
  const th = g.units.find(u => u.type === 'thrall');
  ok(th && th.rank === 2, 'units from a level 2 building get rank 2');
  const alt = g.build(0, basePlot(g, 0)[0].id, 'altar'); run(g, 16);
  ok(g.research(0, alt.id, 'armor') === 'Needs level 2', 'Bone Armor needs altar level 2');
  ok(g.research(0, alt.id, 'melee') === true, 'research Sharp Fangs');
  run(g, 21);
  ok(g.sides[0].upgrades.melee === true, 'upgrade finished');
}

console.log('Combat');
{
  const g = new NC.Game({ seed: 3 });
  const a = g.spawnUnit('ghoul', 0, 400, 1600), b = g.spawnUnit('torch', 1, 430, 1600);
  run(g, 3);
  ok(a.hp < a.maxHp && b.hp < b.maxHp, 'units fight when close');
  const dmgDone = a.maxHp - a.hp, dmgTaken = b.maxHp - b.hp;
  ok(dmgDone > dmgTaken, 'torchbearers beat ghouls one on one (fire bonus vs undead)');
  run(g, 20);
  ok(a.dead || b.dead, 'someone dies');
  const g2 = new NC.Game({ seed: 4 });
  const th = g2.spawnUnit('thrall', 0, 400, 1600); th.hp = 100; const tg = g2.spawnUnit('knight', 1, 425, 1600);
  run(g2, 2);
  ok(th.hp > 60, 'thrall life-drain keeps it alive');
  // river: a ground unit ordered across must use a ford
  const g3 = new NC.Game({ seed: 5 });
  const w = g3.spawnUnit('ghoul', 0, 550, 1500); let wet = [];
  g3.orderUnits(0, [w.id], { type: 'move', x: 550, y: 900 });
  for (let i = 0; i < 30 * 40; i++) { g3.update(1 / 30); if (w.y > NC.WORLD.riverTop && w.y < NC.WORLD.riverBot) wet.push(w.x); }
  ok(w.y < 920, 'ghoul crosses the river (y=' + w.y.toFixed(0) + ')');
  ok(wet.length > 0 && wet.every(x => NC.util.fordAt(x)), 'and only wades through a ford');
  const bat = g3.spawnUnit('bat', 0, 550, 1500); g3.orderUnits(0, [bat.id], { type: 'move', x: 550, y: 900 }); run(g3, 7);
  ok(bat.y < 920 && Math.abs(bat.x - 550) < 30, 'bats fly straight over the river');
  // siege
  const g4 = new NC.Game({ seed: 6 }); g4.sides[1].res = 1000;
  const mill = g4.build(1, basePlot(g4, 1)[0].id, 'mill'); mill.built = 1; mill.hp = mill.maxHp;
  const cat = g4.spawnUnit('catapult', 0, mill.x, mill.y + 200);
  run(g4, 12);
  ok(mill.hp < mill.maxHp * 0.6, 'catapult wrecks buildings');
}

console.log('Heroes');
{
  const g = new NC.Game({ seed: 7 }); g.sides[0].res = 2000;
  const v = g.summonHero(0, 'vael');
  ok(v && v.type === 'vael', 'summon Countess Vael');
  ok(g.summonHero(0, 'vael') === 'Already on the field', 'only one Vael');
  v.x = 400; v.y = 1600; v.order = { type: 'idle' }; v.anchor = { x: 400, y: 1600 };
  for (let i = 0; i < 6; i++) g.spawnUnit('torch', 1, 420 + i * 5, 1620);
  ok(g.useAbility(0, v.id, 0) === true, 'Dark Embrace activates');
  ok(g.useAbility(0, v.id, 0) === 'Not ready', 'then goes on cooldown');
  run(g, 15);
  ok(g.units.some(u => u.type === 'thrall' && u.owner === 0), 'fallen enemies rise as Thralls');
  const gf = g.summonHero(0, 'grimfang'); gf.x = 1000; gf.y = 1600;
  const arch = g.spawnUnit('crossbow', 1, 1200, 1600);
  ok(g.useAbility(0, gf.id, 1) === true, 'Grimfang leaps');
  run(g, 0.6); ok(Math.abs(gf.x - 1200) < 40, 'and lands on the crossbowman');
  v.hp = 1; g.damage(v, 50, 1, null);
  ok(v.dead && g.summonHero(0, 'vael').startsWith('Ready in'), 'dead hero waits before revive');
  run(g, 21); ok(typeof g.summonHero(0, 'vael') === 'object', 'revive for ' + NC.UNITS.vael.revive);
}

console.log('Outposts');
{
  const g = new NC.Game({ seed: 8 });
  const op = g.outposts[0];
  for (let i = 0; i < 4; i++) g.spawnUnit('ghoul', 0, op.x + i * 10, op.y);
  run(g, 7);
  ok(op.owner === 0, op.name + ' captured by standing near it');
  const pl = g.ents[op.plotIds[0]];
  ok(pl.owner === 0 && typeof g.build(0, pl.id, 'slaughter') === 'object', 'can build a Slaughterhouse on it');
}

console.log('Bot');
['easy', 'medium', 'hard', 'nightmare'].forEach(d => {
  const g = new NC.Game({ difficulty: d, seed: 9 }); const bot = new NC.Bot(g, 1);
  let crossed = 0, hit = false;
  const fort0 = g.get(g.sides[0].fortressId);
  for (let i = 0; i < 30 * 480; i++) {
    bot.update(1 / 30); g.update(1 / 30);
    if (i % 30 === 0) { crossed = Math.max(crossed, g.units.filter(u => u.owner === 1 && u.y > NC.WORLD.riverBot).length); if (fort0.hp < fort0.maxHp) hit = true; }
  }
  const bs = g.buildings.filter(b => b.owner === 1);
  ok(bs.length >= 4, d + ': bot built ' + bs.length + ' buildings (' + bs.map(b => b.type).join(',') + ')');
  ok(g.outposts.some(o => o.owner === 1), d + ': bot captured an outpost');
  ok(bot.waves >= 1 && crossed >= 3, d + ': bot sent ' + bot.waves + ' wave(s), up to ' + crossed + ' units on your side');
  ok(hit, d + ': bot reached and hit your fortress (hp ' + fort0.hp.toFixed(0) + ')');
});

console.log('Bot vs bot (balance check)');
{
  const g = new NC.Game({ difficulty: 'medium', seed: 11 }); const b0 = new NC.Bot(g, 0), b1 = new NC.Bot(g, 1);
  b0.diff = NC.DIFFICULTY.medium; g.sides[0].incomeMult = 1;
  let t = 0; while (g.winner < 0 && t < 3600) { b0.update(1 / 30); b1.update(1 / 30); g.update(1 / 30); t += 1 / 30; }
  console.log('  info winner=' + g.winner + ' after ' + (t / 60).toFixed(1) + ' min, kills N/D ' + g.sides[0].stats.kills + '/' + g.sides[1].stats.kills + ', units ' + g.units.length);
  ok(g.units.length <= 100, 'unit cap holds');
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
