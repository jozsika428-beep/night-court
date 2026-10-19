// Bot opponent. Uses building roles, so it can play either faction.
(function (NC) {
  var U = NC.util;
  var BUILD_ORDER = ['barracks', 'farm', 'farm', 'barracks2', 'farm', 'forge', 'tower', 'farm', 'tower'];

  function Bot(game, side) {
    this.g = game; this.side = side; this.diff = game.diff; this.timer = 0;
    this.nextBuild = 0; this.nextWave = this.diff.firstWave; this.waves = 0; this.log = [];
  }
  NC.Bot = Bot;
  var P = Bot.prototype;

  P.update = function (dt) {
    if (this.g.winner >= 0) return;
    this.timer -= dt;
    this.heroAbilities();
    if (this.timer > 0) return;
    this.timer = this.diff.think;
    this.think();
  };

  P.mine = function () { var s = this.side; return this.g.buildings.filter(function (b) { return b.owner === s && !b.dead; }); };
  P.army = function () { var s = this.side; return this.g.units.filter(function (u) { return u.owner === s && !u.dead; }); };
  P.roleOf = function (b) { return b.def.role; };

  P.think = function () {
    var g = this.g, S = g.sides[this.side], fac = S.faction, self = this, side = this.side;
    var mine = this.mine(), have = {};
    mine.forEach(function (b) { var r = b.def.role; if (r === 'farm2') r = 'farm'; have[r] = (have[r] || 0) + 1; });
    var fort = g.get(S.fortressId); if (!fort) return;
    var army = this.army();

    // 1) build order on base plots
    var target = null, need = {};
    for (var i = 0; i < BUILD_ORDER.length; i++) { var r = BUILD_ORDER[i]; need[r] = (need[r] || 0) + 1; if ((have[r] || 0) < need[r]) { target = r; break; } }
    var pendingCost = 0;
    if (target && g.t >= this.nextBuild) {
      var type = NC.byRole(fac, target), cost = NC.BUILDINGS[type].cost;
      var plot = g.plots.filter(function (p) { return p.base && p.owner === side && !g.get(p.buildingId); })[0];
      if (plot) {
        if (S.res >= cost) { var res = g.build(side, plot.id, type); if (typeof res !== 'string') { this.nextBuild = g.t + this.diff.buildDelay; this.log.push('build ' + type); } }
        else pendingCost = cost;
      }
    }
    // outpost economy: slaughterhouse/granary + a tower on harder levels
    g.outposts.forEach(function (op) {
      if (op.owner !== side || !op.plotIds.length || g.t < self.nextBuild) return;
      var free = op.plotIds.map(function (id) { return g.ents[id]; }).filter(function (p) { return !g.get(p.buildingId); });
      if (!free.length) return;
      var built = op.plotIds.length - free.length;
      var role = (built >= 1 && self.diff.upgrades) ? 'tower' : 'farm2';
      var type = NC.byRole(fac, role);
      if (S.res >= NC.BUILDINGS[type].cost + 50) { if (typeof g.build(side, free[0].id, type) !== 'string') { self.nextBuild = g.t + self.diff.buildDelay; self.log.push('outpost ' + type); } }
    });

    // 2) pay to level buildings and research upgrades
    if (this.diff.upgrades) {
      var forge = mine.filter(function (b) { return b.def.role === 'forge' && b.built >= 1 && !b.research; })[0];
      if (forge) ['melee', 'ranged', 'armor', 'frenzy'].some(function (k) { var up = NC.UPGRADES[k]; if (!S.upgrades[k] && forge.level >= up.level && S.res > up.cost + 150) return g.research(side, forge.id, k) === true; return false; });
      if (S.res > 700) {
        var lv = mine.filter(function (b) { return b.built >= 1 && b.level < 3 && b.def.role !== 'fortress' && b.def.role !== 'tower'; }).sort(function (a, b) { return a.level - b.level; })[0];
        if (lv) g.levelUp(side, lv.id);
      }
    }

    // 3) heroes
    if (g.t >= this.diff.heroAt) NC.FACTIONS[fac].heroes.forEach(function (h) { var st = g.heroStatus(side, h); if (!st.alive && st.wait <= 0 && S.res >= st.cost + 100) g.summonHero(side, h); });

    // 4) recruit
    var rax = mine.filter(function (b) { return b.def.trains && b.built >= 1 && b.queue.length < 2; });
    rax.forEach(function (b) {
      var opts = g.trainable(b).filter(function (o) { return !o.locked; });
      if (!opts.length) return;
      // prefer stronger units, but keep a mix
      var pick = opts[Math.floor(g.rand() * opts.length)];
      if (opts.length > 2 && g.rand() < 0.4) pick = opts[opts.length - 1];
      var c = NC.UNITS[pick.type].cost, reserve = (pendingCost && army.length >= 4) ? pendingCost : 0;
      if (S.pop < Math.min(NC.POP_CAP - 2, self.diff.maxArmy) && S.res - c >= reserve) g.train(side, b.id, pick.type);
    });

    // 5) army orders
    var enemy = 1 - side;
    var threats = g.units.filter(function (u) {
      if (u.owner !== enemy || u.dead) return false;
      if (U.d2(u, fort) < 480 * 480) return true;
      return mine.some(function (b) { return U.d2(u, b) < 260 * 260; });
    });
    if (threats.length) {
      var cx = 0, cy = 0; threats.forEach(function (u) { cx += u.x; cy += u.y; }); cx /= threats.length; cy /= threats.length;
      var defenders = army.filter(function (u) { return u.job !== 'wave' || U.d2(u, fort) < 700 * 700; });
      if (threats.length >= 4) defenders = army;
      g.orderUnits(side, defenders.filter(function (u) { return !u.tgt; }).map(function (u) { u.job = 'def'; return u.id; }), { type: 'amove', x: cx, y: cy });
      return;
    }
    army.forEach(function (u) { if (u.job === 'def' && u.order.type === 'idle') u.job = null; });

    // capture outposts: send a small squad to the nearest one we don't own
    var capturers = army.filter(function (u) { return u.job === 'capture'; });
    var ops = g.outposts.filter(function (o) { return o.owner !== side; }).sort(function (a, b) { return U.d2(a, fort) - U.d2(b, fort); });
    if (ops.length) {
      var goal = ops[0];
      var free = army.filter(function (u) { return !u.job && !u.hero && !u.flying && !U.hasTag(u.def, 'siege'); });
      var want = goal.owner === enemy ? 6 : 3;
      if (capturers.length < want && free.length) {
        var add = free.slice(0, want - capturers.length);
        add.forEach(function (u) { u.job = 'capture'; u.goal = goal.id; });
        capturers = capturers.concat(add);
      }
      capturers.forEach(function (u) { if (u.goal !== goal.id || u.order.type === 'idle') { u.goal = goal.id; if (U.d2(u, goal) > 60 * 60) g.orderUnits(side, [u.id], { type: 'amove', x: goal.x + (g.rand() - 0.5) * 80, y: goal.y + (g.rand() - 0.5) * 80 }); } });
    } else capturers.forEach(function (u) { u.job = null; });

    // attack waves
    var idle = army.filter(function (u) { return !u.job; });
    var waveSize = this.diff.wave + this.waves * 2;
    if (g.t >= this.nextWave && idle.length >= Math.min(waveSize, self.diff.maxArmy - 6)) {
      this.waves++; this.nextWave = g.t + this.diff.waveEvery;
      var keep = idle.length > 8 ? 2 : 0;
      idle.slice(keep).forEach(function (u) { u.job = 'wave'; });
      this.log.push('wave ' + this.waves + ' x' + (idle.length - keep));
      g.event(enemy, 'The enemy is attacking!', fort.x, fort.y, 'alert');
    }
    var wave = army.filter(function (u) { return u.job === 'wave'; });
    if (wave.length) {
      var tgt = this.waveTarget(wave);
      wave.forEach(function (u) { if (u.order.type === 'idle' && !u.tgt) g.orderUnits(side, [u.id], { type: 'amove', x: tgt.x + (g.rand() - 0.5) * 60, y: tgt.y + (g.rand() - 0.5) * 60 }); });
    }
  };

  // closest enemy outpost building first, otherwise the enemy fortress
  P.waveTarget = function (wave) {
    var g = this.g, side = this.side, enemy = 1 - side, cx = 0, cy = 0;
    wave.forEach(function (u) { cx += u.x; cy += u.y; }); cx /= wave.length; cy /= wave.length;
    var c = { x: cx, y: cy }, best = null, bd = 1e18;
    g.buildings.forEach(function (b) {
      if (b.owner !== enemy || b.dead) return;
      var p = b.plotId ? g.ents[b.plotId] : null;
      var w = (p && !p.base) ? 0.5 : (b.def.role === 'fortress' ? 1.2 : 1);
      var dd = U.d2(b, c) * w; if (dd < bd) { bd = dd; best = b; }
    });
    return best || g.get(g.sides[enemy].fortressId) || { x: 800, y: 1200 };
  };

  P.heroAbilities = function () {
    var g = this.g, side = this.side;
    g.units.forEach(function (u) {
      if (!u.hero || u.owner !== side || u.dead) return;
      u.def.abilities.forEach(function (ab, i) {
        if (u.abCd[i] > 0) return;
        var near = g.units.filter(function (o) { return o.owner !== side && !o.dead && U.d2(o, u) < 160 * 160; }).length;
        if (near >= 3 || (near >= 1 && u.hp < u.maxHp * 0.4)) g.useAbility(side, u.id, i);
      });
    });
  };
})(globalThis.NC = globalThis.NC || {});
