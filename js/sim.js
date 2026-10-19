// Core game simulation. No drawing or DOM here, so it can be tested in node.
(function (NC) {
  var W = NC.WORLD;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
  function dist(a, b) { return Math.sqrt(d2(a, b)); }
  function hasTag(def, t) { return !!(def.tags && def.tags.indexOf(t) >= 0); }
  function sideOfY(y) { return y <= W.riverTop ? -1 : (y >= W.riverBot ? 1 : 0); }
  function fordAt(x) { for (var i = 0; i < W.fords.length; i++) { var f = W.fords[i]; if (x >= f.x1 && x <= f.x2) return f; } return null; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  NC.util = { dist: dist, d2: d2, hasTag: hasTag, clamp: clamp, sideOfY: sideOfY, fordAt: fordAt, rng: rng };

  function Game(opts) {
    opts = opts || {};
    this.rand = rng(opts.seed || ((Date.now() % 1e6) | 0));
    this.diffKey = opts.difficulty || 'medium';
    this.diff = NC.DIFFICULTY[this.diffKey];
    this.mapKey = opts.map || 'blackwater';
    this.map = NC.MAPS[this.mapKey];
    this.t = 0; this.nextId = 1;
    this.units = []; this.buildings = []; this.plots = []; this.outposts = [];
    this.projectiles = []; this.effects = []; this.corpses = []; this.events = [];
    this.ents = {}; this.winner = -1; this.player = 0;
    var facs = opts.factions || ['night', 'dawn'];
    var self = this;
    this.sides = facs.map(function (f, i) {
      var s = { id: i, faction: f, res: 500, incomeMult: 1, upgrades: {}, heroes: {}, rally: null, pop: 0,
        stats: { kills: 0, lost: 0, earned: 0 }, isBot: i !== 0, lastAlert: -99, shrine: false };
      NC.FACTIONS[f].heroes.forEach(function (h) { s.heroes[h] = { id: null, summoned: false, deadAt: -999 }; });
      if (s.isBot) { s.incomeMult = self.diff.income; s.res += self.diff.startRes; }
      return s;
    });
    this._loadMap();
    this.updateDayNight();
  }
  NC.Game = Game;
  var P = Game.prototype;

  P.mirror = function (side, x, y) { return side === 0 ? { x: x, y: y } : { x: W.w - x, y: W.h - y }; };

  P._loadMap = function () {
    var m = this.map, self = this;
    this.sides.forEach(function (s, i) {
      var f = m.fortress[i];
      var fort = self.addBuilding(NC.FACTIONS[s.faction].fortress, i, f.x, f.y, null, true);
      s.fortressId = fort.id;
      s.rally = { x: f.x, y: f.y + (i === 0 ? -270 : 270) };
      m.basePlots.forEach(function (o) {
        var dx = i === 0 ? o[0] : -o[0], dy = i === 0 ? o[1] : -o[1];
        self.addPlot(f.x + dx, f.y + dy, i, true, null);
      });
    });
    m.outposts.forEach(function (o) {
      var op = { id: self.nextId++, kind: 'outpost', name: o.name, type: o.type, x: o.x, y: o.y, r: 95, owner: -1, v: 0, bonus: o.bonus || 0, plotIds: [] };
      self.ents[op.id] = op; self.outposts.push(op);
      o.plots.forEach(function (p) { op.plotIds.push(self.addPlot(o.x + p[0], o.y + p[1], -1, false, op.id).id); });
    });
  };

  P.addPlot = function (x, y, owner, base, outpostId) {
    var p = { id: this.nextId++, kind: 'plot', x: x, y: y, r: 30, owner: owner, base: base, outpostId: outpostId, buildingId: null };
    this.ents[p.id] = p; this.plots.push(p); return p;
  };

  P.event = function (side, text, x, y, kind) { this.evSeq = (this.evSeq || 0) + 1; this.events.push({ seq: this.evSeq, t: this.t, side: side, text: text, x: x, y: y, kind: kind || 'info' }); };
  P.fx = function (type, x, y, opt) { var e = { type: type, x: x, y: y, t: 0, dur: (opt && opt.dur) || 0.5 }; for (var k in opt) e[k] = opt[k]; this.effects.push(e); return e; };
  P.get = function (id) { var e = this.ents[id]; return e && !e.dead ? e : null; };
  P.cycle = function () { return (NC.START_CYCLE + this.t) % NC.DAY_LEN; };
  P.updateDayNight = function () { this.isNight = this.cycle() >= NC.NIGHT_START; };

  // ---------- entities ----------
  P.addBuilding = function (type, owner, x, y, plot, instant) {
    var def = NC.BUILDINGS[type];
    var b = { id: this.nextId++, kind: 'building', type: type, def: def, owner: owner, x: x, y: y, r: def.r,
      maxHp: def.hp, hp: instant ? def.hp : def.hp * 0.25, built: instant ? 1 : 0, level: 1, xp: 0,
      queue: [], trainT: 0, research: null, cd: 0, plotId: plot ? plot.id : null, lastHit: -99 };
    this.ents[b.id] = b; this.buildings.push(b);
    if (plot) plot.buildingId = b.id;
    return b;
  };

  P.spawnUnit = function (type, owner, x, y, rank) {
    var def = NC.UNITS[type];
    var u = { id: this.nextId++, kind: 'unit', type: type, def: def, owner: owner, x: x, y: y, r: def.r,
      hp: def.hp, maxHp: def.hp, cd: this.rand() * 0.5, rank: rank || 1, face: owner === 0 ? -Math.PI / 2 : Math.PI / 2,
      order: { type: 'idle' }, anchor: { x: x, y: y }, tgt: null, scanT: this.rand() * 0.5, buffs: {}, job: null,
      hero: !!def.hero, abCd: [], flying: hasTag(def, 'flying'), lastHit: -99, auraT: 0 };
    u.maxHp = u.hp = def.hp * (1 + 0.12 * (u.rank - 1));
    if (def.abilities) u.abCd = def.abilities.map(function () { return 0; });
    this.ents[u.id] = u; this.units.push(u);
    return u;
  };

  P.popOf = function (side) { var n = 0; for (var i = 0; i < this.units.length; i++) if (this.units[i].owner === side && !this.units[i].dead) n++; return n; };

  // ---------- player / bot commands (return true or an error string) ----------
  P.buildOptions = function (side, plot) {
    var fac = this.sides[side].faction, out = [];
    for (var k in NC.BUILDINGS) {
      var d = NC.BUILDINGS[k];
      if (d.faction !== fac || d.role === 'fortress') continue;
      if (plot.base && d.outpostOnly) continue;
      if (!plot.base && ['farm', 'farm2', 'tower'].indexOf(d.role) < 0) continue;
      out.push(k);
    }
    return out;
  };

  P.build = function (side, plotId, type) {
    var plot = this.get(plotId), d = NC.BUILDINGS[type], s = this.sides[side];
    if (!plot || plot.kind !== 'plot') return 'No plot';
    if (plot.owner !== side) return 'Not your land';
    if (plot.buildingId && this.get(plot.buildingId)) return 'Plot taken';
    if (!d || this.buildOptions(side, plot).indexOf(type) < 0) return 'Cannot build that here';
    if (s.res < d.cost) return 'Not enough ' + NC.FACTIONS[s.faction].res.toLowerCase();
    s.res -= d.cost;
    var b = this.addBuilding(type, side, plot.x, plot.y, plot, false);
    this.event(side, 'Building ' + d.name, plot.x, plot.y);
    return b;
  };

  P.trainable = function (b) {
    var out = [], tr = b.def.trains; if (!tr) return out;
    for (var l = 0; l < 3; l++) tr[l].forEach(function (t) { out.push({ type: t, level: l + 1, locked: b.level < l + 1 }); });
    return out;
  };

  P.train = function (side, bId, type) {
    var b = this.get(bId), s = this.sides[side];
    if (!b || b.owner !== side) return 'No building';
    if (b.built < 1) return 'Still building';
    var opt = this.trainable(b).filter(function (o) { return o.type === type; })[0];
    if (!opt) return 'Cannot recruit that here';
    if (opt.locked) return 'Needs building level ' + opt.level;
    if (b.queue.length >= 5) return 'Queue full';
    var d = NC.UNITS[type];
    if (s.res < d.cost) return 'Not enough ' + NC.FACTIONS[s.faction].res.toLowerCase();
    s.res -= d.cost; b.queue.push(type);
    return true;
  };

  P.levelUp = function (side, bId) {
    var b = this.get(bId), s = this.sides[side];
    if (!b || b.owner !== side || b.def.role === 'fortress') return 'Cannot level';
    if (b.level >= 3) return 'Max level';
    if (b.built < 1) return 'Still building';
    var c = NC.LEVEL_COST[b.level];
    if (s.res < c) return 'Not enough ' + NC.FACTIONS[s.faction].res.toLowerCase();
    s.res -= c; b.xp = Math.max(b.xp, NC.XP_LEVELS[b.level]); this._checkLevel(b);
    return true;
  };

  P.research = function (side, bId, key) {
    var b = this.get(bId), s = this.sides[side], up = NC.UPGRADES[key];
    if (!b || b.owner !== side || b.def.role !== 'forge') return 'Need an upgrade building';
    if (b.built < 1) return 'Still building';
    if (!up) return 'Unknown';
    if (s.upgrades[key]) return 'Already done';
    if (b.research) return 'Busy';
    if (this.buildings.some(function (o) { return o.owner === side && o.research && o.research.key === key; })) return 'Already researching';
    if (b.level < up.level) return 'Needs level ' + up.level;
    if (s.res < up.cost) return 'Not enough ' + NC.FACTIONS[s.faction].res.toLowerCase();
    s.res -= up.cost; b.research = { key: key, t: 0 };
    return true;
  };

  P.heroStatus = function (side, key) {
    var s = this.sides[side], h = s.heroes[key]; if (!h) return null;
    var alive = h.id && this.get(h.id);
    var wait = Math.max(0, h.deadAt + 20 - this.t);
    return { alive: !!alive, unit: alive || null, cost: h.summoned ? NC.UNITS[key].revive : NC.UNITS[key].cost, revive: h.summoned, wait: wait };
  };

  P.summonHero = function (side, key) {
    var s = this.sides[side], st = this.heroStatus(side, key);
    if (!st) return 'Unknown hero';
    if (st.alive) return 'Already on the field';
    if (st.wait > 0) return 'Ready in ' + Math.ceil(st.wait) + 's';
    if (this.popOf(side) >= NC.POP_CAP) return 'Army is full';
    if (s.res < st.cost) return 'Not enough ' + NC.FACTIONS[s.faction].res.toLowerCase();
    s.res -= st.cost;
    var f = this.get(s.fortressId);
    var u = this.spawnUnit(key, side, f.x, f.y + (side === 0 ? -f.r - 20 : f.r + 20), 1);
    s.heroes[key].id = u.id; s.heroes[key].summoned = true;
    this.orderUnits(side, [u.id], { type: 'move', x: s.rally.x, y: s.rally.y });
    this.event(side, u.def.name + (st.revive ? ' has returned!' : ' joins the battle!'), u.x, u.y, 'hero');
    return u;
  };

  P.orderUnits = function (side, ids, cmd) {
    var self = this, us = ids.map(function (id) { return self.get(id); }).filter(function (u) { return u && u.kind === 'unit' && u.owner === side; });
    if (!us.length) return 0;
    var n = us.length, cols = Math.ceil(Math.sqrt(n)), sp = 26;
    // closest units take the front slots
    us.sort(function (a, b) { return d2(a, cmd) - d2(b, cmd); });
    us.forEach(function (u, i) {
      if (cmd.type === 'attack') { u.order = { type: 'attack', targetId: cmd.targetId }; u.tgt = cmd.targetId; return; }
      var r = Math.floor(i / cols), c = i % cols;
      var ox = (c - (cols - 1) / 2) * sp, oy = (r - (Math.ceil(n / cols) - 1) / 2) * sp;
      var p = self.fixPoint(cmd.x + ox, cmd.y + oy, u.flying);
      u.order = { type: cmd.type, x: p.x, y: p.y }; u.tgt = null;
    });
    return us.length;
  };

  // keep a point on the map and out of deep water
  P.fixPoint = function (x, y, flying) {
    x = clamp(x, 20, W.w - 20); y = clamp(y, 20, W.h - 20);
    if (!flying && sideOfY(y) === 0 && !fordAt(x)) {
      var best = null, bd = 1e9;
      W.fords.forEach(function (f) { var fx = clamp(x, f.x1 + 12, f.x2 - 12), dd = Math.abs(fx - x); if (dd < bd) { bd = dd; best = fx; } });
      var ty = y < (W.riverTop + W.riverBot) / 2 ? W.riverTop - 14 : W.riverBot + 14;
      if (bd < Math.abs(ty - y) + 60) x = best; else y = ty;
    }
    return { x: x, y: y };
  };

  P.useAbility = function (side, uId, idx) {
    var u = this.get(uId); if (!u || u.owner !== side || !u.hero) return 'No hero';
    var ab = u.def.abilities[idx]; if (!ab) return 'No ability';
    if (u.abCd[idx] > 0) return 'Not ready';
    var ok = this['ab_' + ab.id](u);
    if (ok !== true) return ok || 'Nothing to target';
    u.abCd[idx] = ab.cd;
    return true;
  };

  P.ab_embrace = function (u) { u.buffs.embrace = 12; u.embraceLeft = 5; this.fx('ring', u.x, u.y, { r: 170, color: '#b3122e', dur: 0.8 }); return true; };
  P.ab_mist = function (u) { u.buffs.mist = 6; this.fx('ring', u.x, u.y, { r: 60, color: '#d04060', dur: 0.8 }); return true; };
  P.ab_howl = function (u) {
    var self = this;
    this.units.forEach(function (o) { if (o.owner === u.owner && !o.dead && d2(o, u) < 230 * 230) o.buffs.howl = 8; });
    this.fx('ring', u.x, u.y, { r: 230, color: '#ffcc66', dur: 0.9 });
    return true;
  };
  P.ab_leap = function (u) {
    var best = null, bd = 340 * 340, bestR = null, bdr = 340 * 340;
    for (var i = 0; i < this.units.length; i++) {
      var o = this.units[i]; if (o.dead || o.owner === u.owner || o.owner < 0) continue;
      var dd = d2(o, u); if (dd > bd && dd > bdr) continue;
      if (hasTag(o.def, 'ranged') && dd < bdr) { bdr = dd; bestR = o; }
      if (dd < bd) { bd = dd; best = o; }
    }
    var t = bestR || best; if (!t) return 'No enemy in reach';
    u.leap = { fx: u.x, fy: u.y, tx: t.x, ty: t.y, t: 0, dur: 0.45 };
    u.tgt = t.id;
    return true;
  };
  P.ab_holy = function (u) {
    var self = this, hit = 0;
    this.units.slice().forEach(function (o) {
      if (o.dead || o.owner === u.owner || o.owner < 0 || d2(o, u) > 160 * 160) return;
      var nf = self.sides[o.owner].faction === 'night';
      self.damage(o, nf ? 90 : 35, u.owner, u); hit++;
    });
    this.fx('flash', u.x, u.y, { r: 160, color: '#fff3b0', dur: 0.7 });
    return true;
  };

  // ---------- combat ----------
  P.dmgMult = function (u) {
    var s = this.sides[u.owner], m = 1 + 0.15 * (u.rank - 1);
    var ranged = hasTag(u.def, 'ranged');
    if (!u.hero) { if (ranged && s.upgrades.ranged) m *= 1.2; if (!ranged && s.upgrades.melee) m *= 1.2; }
    if (hasTag(u.def, 'wolf') && this.isNight) m *= 1.3;
    if (hasTag(u.def, 'vampire') && !this.isNight) m *= 0.8;
    if (u.buffs.howl) m *= 1.2;
    return m;
  };
  P.speedOf = function (u) {
    var s = this.sides[u.owner], m = 1;
    if (s.upgrades.frenzy) m *= 1.15;
    if (u.buffs.howl) m *= 1.4;
    if (hasTag(u.def, 'wolf') && this.isNight) m *= 1.15;
    if (!u.flying && sideOfY(u.y) === 0) m *= 0.7; // wading through a ford
    return u.def.speed * m;
  };

  P.damage = function (t, amount, attackerOwner, src) {
    if (!t || t.dead) return 0;
    var d = amount;
    if (src && src.def && src.def.bonus && t.kind === 'unit') for (var tag in src.def.bonus) if (hasTag(t.def, tag)) d *= src.def.bonus[tag];
    if (t.kind === 'building') {
      d *= (src && src.def && hasTag(src.def, 'siege')) ? 3 : (src && src.kind === 'building' ? 0.5 : 0.6);
    } else {
      if (this.sides[t.owner] && this.sides[t.owner].upgrades.armor && !t.hero) d *= 0.8;
      if (t.def.armor) d *= t.def.armor;
      if (t.buffs.mist) d *= 0.3;
    }
    t.hp -= d; t.lastHit = this.t;
    if (src && src.kind === 'unit' && !src.dead && src.def.drain) src.hp = Math.min(src.maxHp, src.hp + d * src.def.drain);
    if (t.owner >= 0 && attackerOwner !== t.owner) {
      var s = this.sides[t.owner];
      if (t.kind === 'building' && this.t - s.lastAlert > 20) { s.lastAlert = this.t; this.event(t.owner, 'Your ' + t.def.name + ' is under attack!', t.x, t.y, 'alert'); }
      // fight back if hit while idle
      if (t.kind === 'unit' && !t.tgt && t.order.type !== 'move' && src && !src.dead && src.owner !== t.owner) t.tgt = src.id;
    }
    if (t.hp <= 0) this.kill(t, attackerOwner);
    return d;
  };

  P.kill = function (t, killer) {
    if (t.dead) return; t.dead = true; t.hp = 0;
    var self = this;
    if (killer >= 0 && killer !== t.owner) this.sides[killer].stats.kills++;
    if (t.kind === 'unit') {
      this.sides[t.owner].stats.lost++;
      this.corpses.push({ x: t.x, y: t.y, t: 0, owner: t.owner, type: t.type });
      if (t.hero) { var h = this.sides[t.owner].heroes[t.type]; h.id = null; h.deadAt = this.t; this.event(t.owner, t.def.name + ' has fallen!', t.x, t.y, 'alert'); if (killer >= 0) this.event(killer, 'Enemy hero ' + t.def.name + ' slain!', t.x, t.y, 'good'); }
      this.units.forEach(function (o) {
        if (o.dead || o.owner === t.owner || o.owner < 0) return;
        if (o.type === 'ghoul' && d2(o, t) < 80 * 80) o.hp = Math.min(o.maxHp, o.hp + 20); // ghouls feed
        if (o.buffs.embrace && o.embraceLeft > 0 && d2(o, t) < 170 * 170 && !t.hero && self.popOf(o.owner) < NC.POP_CAP) {
          o.embraceLeft--; var n = self.spawnUnit('thrall', o.owner, t.x, t.y, 1); n.hp = n.maxHp * 0.6;
          self.fx('ring', t.x, t.y, { r: 25, color: '#b3122e', dur: 0.6 });
        }
      });
    } else if (t.kind === 'building') {
      this.fx('boom', t.x, t.y, { r: t.r * 1.6, dur: 1.0 });
      if (t.plotId) { var p = this.ents[t.plotId]; if (p && p.buildingId === t.id) p.buildingId = null; }
      if (t.def.role === 'fortress') {
        this.winner = 1 - t.owner;
        this.event(-1, this.winner === this.player ? 'Victory!' : 'Defeat', t.x, t.y, 'end');
      } else this.event(t.owner, 'Your ' + t.def.name + ' was destroyed', t.x, t.y, 'alert');
    }
  };

  P.findTarget = function (u, radius) {
    var best = null, bs = 1e18, siege = hasTag(u.def, 'siege'), r2 = radius * radius;
    for (var i = 0; i < this.units.length; i++) {
      var o = this.units[i]; if (o.dead || o.owner === u.owner) continue;
      var dd = d2(o, u); if (dd > r2) continue;
      var score = dd * (siege ? 4 : 1) + (o.leap ? 1e6 : 0);
      if (score < bs) { bs = score; best = o; }
    }
    for (var j = 0; j < this.buildings.length; j++) {
      var b = this.buildings[j]; if (b.dead || b.owner === u.owner) continue;
      var dd2 = Math.max(0, dist(b, u) - b.r); dd2 *= dd2; if (dd2 > r2) continue;
      var sc = dd2 * (siege ? 0.25 : 3) + (siege ? 0 : 2000);
      if (sc < bs) { bs = sc; best = b; }
    }
    return best;
  };

  P.attack = function (u, t) {
    var def = u.def, s = this.sides[u.owner], cd = def.cd;
    if (s.upgrades.frenzy && !u.hero) cd /= 1.15;
    u.cd = cd;
    u.face = Math.atan2(t.y - u.y, t.x - u.x);
    var dmg = def.dmg * this.dmgMult(u);
    if (def.heal) {
      // priests: heal a hurt friend in range instead of attacking if one exists
      var f = this.hurtAlly(u, def.range + 20);
      if (f) { f.hp = Math.min(f.maxHp, f.hp + def.heal); this.fx('heal', f.x, f.y, { dur: 0.6 }); return; }
    }
    if (def.proj) this.projectiles.push({ x: u.x, y: u.y, sx: u.x, sy: u.y, tid: t.id, tx: t.x, ty: t.y, kind: def.proj, dmg: dmg, splash: def.splash || 0, owner: u.owner, src: u, speed: def.splash ? 300 : 520 });
    else { this.damage(t, dmg, u.owner, u); u.swing = 0.15; }
  };

  P.hurtAlly = function (u, range) {
    var best = null, bv = 0.95;
    for (var i = 0; i < this.units.length; i++) { var o = this.units[i]; if (o.dead || o.owner !== u.owner || o === u) continue; var f = o.hp / o.maxHp; if (f < bv && d2(o, u) < range * range) { bv = f; best = o; } }
    return best;
  };

  // ---------- movement ----------
  P.waypoint = function (u, tx, ty) {
    if (u.flying) return { x: tx, y: ty };
    var s = sideOfY(u.y), ts = sideOfY(ty);
    var mid = (W.riverTop + W.riverBot) / 2;
    if (s === 0) {
      var f = fordAt(u.x);
      if (!f) { var nf = this.nearestFord(u.x, u.x); return { x: clamp(u.x, nf.x1 + 14, nf.x2 - 14), y: u.y }; }
      if (ts === 0 && fordAt(tx) === f) return { x: tx, y: ty };
      if (ts === 0) ts = ty < mid ? -1 : 1;
      return { x: clamp(tx, f.x1 + 14, f.x2 - 14), y: ts < 0 ? W.riverTop - 12 : W.riverBot + 12 };
    }
    if (ts === s) return { x: tx, y: ty };
    if (ts === 0 && fordAt(tx)) { var f0 = fordAt(tx); var ex = clamp(u.x, f0.x1 + 14, f0.x2 - 14); if (Math.abs(ex - u.x) < 4) return { x: tx, y: ty }; return { x: ex, y: s < 0 ? W.riverTop - 6 : W.riverBot + 6 }; }
    var fd = this.nearestFord(u.x, tx);
    var fx = clamp((u.x + tx) / 2, fd.x1 + 16, fd.x2 - 16);
    var bankY = s < 0 ? W.riverTop - 6 : W.riverBot + 6;
    if (Math.abs(u.x - fx) < 10 && Math.abs(u.y - bankY) < 30) return { x: fx, y: s < 0 ? W.riverTop + 30 : W.riverBot - 30 };
    return { x: fx, y: bankY };
  };
  P.nearestFord = function (x, tx) {
    var best = W.fords[0], bd = 1e9;
    W.fords.forEach(function (f) { var c = clamp((x + tx) / 2, f.x1, f.x2); var dd = Math.abs(x - c) + Math.abs(tx - c); if (dd < bd) { bd = dd; best = f; } });
    return best;
  };
  P.moveToward = function (u, tx, ty, dt) {
    var w = this.waypoint(u, tx, ty);
    var dx = w.x - u.x, dy = w.y - u.y, dd = Math.sqrt(dx * dx + dy * dy);
    if (dd < 0.5) return;
    var step = Math.min(dd, this.speedOf(u) * dt);
    u.x += dx / dd * step; u.y += dy / dd * step; u.face = Math.atan2(dy, dx); u.moving = true;
  };

  // ---------- main tick ----------
  P.update = function (dt) {
    if (this.winner >= 0) return;
    this.t += dt;
    this.updateDayNight();
    var i, self = this;
    for (i = 0; i < this.sides.length; i++) this.sides[i].pop = this.popOf(i);
    // shrine bonus
    this.sides.forEach(function (s) { s.shrine = self.outposts.some(function (o) { return o.type === 'shrine' && o.owner === s.id; }); });
    for (i = 0; i < this.buildings.length; i++) if (!this.buildings[i].dead) this.updateBuilding(this.buildings[i], dt);
    for (i = 0; i < this.units.length; i++) if (!this.units[i].dead) this.updateUnit(this.units[i], dt);
    this.updateProjectiles(dt);
    this.updateOutposts(dt);
    this.separate();
    this.units = this.units.filter(function (u) { if (u.dead) delete self.ents[u.id]; return !u.dead; });
    this.buildings = this.buildings.filter(function (b) { if (b.dead) delete self.ents[b.id]; return !b.dead; });
    this.effects = this.effects.filter(function (e) { e.t += dt; return e.t < e.dur; });
    this.corpses = this.corpses.filter(function (c) { c.t += dt; return c.t < 10; });
    if (this.events.length > 60) this.events.splice(0, this.events.length - 60);
  };

  P.incomeOf = function (b) {
    var d = b.def; if (!d.income || b.built < 1) return 0;
    var base = typeof d.income === 'number' ? d.income : d.income[b.level - 1];
    var s = this.sides[b.owner];
    return base * s.incomeMult * (s.shrine ? 1.15 : 1);
  };
  P.totalIncome = function (side) { var self = this, n = 0; this.buildings.forEach(function (b) { if (b.owner === side && !b.dead) n += self.incomeOf(b); }); return n; };

  P._checkLevel = function (b) {
    while (b.level < 3 && b.xp >= NC.XP_LEVELS[b.level]) {
      b.level++; var old = b.maxHp; b.maxHp = b.def.hp * (1 + 0.15 * (b.level - 1)); b.hp += b.maxHp - old;
      this.event(b.owner, b.def.name + ' reached level ' + b.level + '!', b.x, b.y, 'good');
      this.fx('ring', b.x, b.y, { r: b.r + 20, color: '#ffd700', dur: 1 });
    }
  };

  P.updateBuilding = function (b, dt) {
    var d = b.def, s = this.sides[b.owner];
    if (b.built < 1) {
      b.built = Math.min(1, b.built + dt / d.time);
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.75 * dt / d.time);
      if (b.built >= 1) this.event(b.owner, d.name + ' is ready', b.x, b.y, 'good');
      return;
    }
    var inc = this.incomeOf(b);
    if (inc) { s.res += inc * dt; s.stats.earned += inc * dt; if (d.role !== 'fortress') b.xp += inc * dt; }
    if (d.role !== 'fortress') { b.xp += 0.3 * dt; this._checkLevel(b); }
    // training
    if (b.queue.length) {
      if (s.pop < NC.POP_CAP) b.trainT += dt * (1 + 0.15 * (b.level - 1));
      var ud = NC.UNITS[b.queue[0]];
      if (b.trainT >= ud.time) {
        b.trainT = 0; var type = b.queue.shift();
        var n = Math.min(ud.squad, NC.POP_CAP - s.pop), dir = b.owner === 0 ? -1 : 1;
        for (var k = 0; k < n; k++) {
          var u = this.spawnUnit(type, b.owner, b.x + (k - (n - 1) / 2) * 20, b.y + dir * (b.r + 14), b.level);
          var rp = this.fixPoint(s.rally.x + (this.rand() - 0.5) * 120, s.rally.y + (this.rand() - 0.5) * 60, u.flying);
          u.order = { type: 'amove', x: rp.x, y: rp.y };
        }
        s.pop += n;
        b.xp += ud.cost / 2; this._checkLevel(b);
      }
    }
    if (b.research) {
      var up = NC.UPGRADES[b.research.key];
      b.research.t += dt;
      if (b.research.t >= up.time) {
        s.upgrades[b.research.key] = true; b.xp += up.cost / 2; this._checkLevel(b);
        this.event(b.owner, 'Upgrade done: ' + NC.FACTIONS[s.faction].upgrades[b.research.key], b.x, b.y, 'good');
        b.research = null;
      }
    }
    if (d.attack) {
      b.cd -= dt;
      if (b.cd <= 0) {
        var best = null, bd = d.attack.range * d.attack.range;
        for (var i = 0; i < this.units.length; i++) { var o = this.units[i]; if (o.dead || o.owner === b.owner) continue; var dd = d2(o, b); if (dd < bd) { bd = dd; best = o; } }
        if (best) {
          b.cd = d.attack.cd;
          var dmg = d.attack.dmg * (1 + 0.25 * (b.level - 1));
          this.projectiles.push({ x: b.x, y: b.y - b.r * 0.5, sx: b.x, sy: b.y, tid: best.id, tx: best.x, ty: best.y, kind: d.attack.proj, dmg: dmg, splash: 0, owner: b.owner, src: b, speed: 520 });
          if (d.role === 'tower') { b.xp += dmg * 0.4; this._checkLevel(b); }
        }
      }
    }
  };

  P.updateUnit = function (u, dt) {
    u.moving = false;
    for (var k in u.buffs) { u.buffs[k] -= dt; if (u.buffs[k] <= 0) delete u.buffs[k]; }
    for (var a = 0; a < u.abCd.length; a++) if (u.abCd[a] > 0) u.abCd[a] = Math.max(0, u.abCd[a] - dt);
    if (u.swing) u.swing = Math.max(0, u.swing - dt);
    u.cd -= dt;
    if (u.hero) u.hp = Math.min(u.maxHp, u.hp + 2 * dt);
    if (u.buffs.mist) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.04 * dt);
    if (u.leap) {
      var L = u.leap; L.t += dt; var f = Math.min(1, L.t / L.dur);
      u.x = L.fx + (L.tx - L.fx) * f; u.y = L.fy + (L.ty - L.fy) * f; u.hop = Math.sin(f * Math.PI) * 30;
      if (f >= 1) {
        u.leap = null; u.hop = 0; var self = this;
        this.units.slice().forEach(function (o) { if (!o.dead && o.owner !== u.owner && d2(o, u) < 75 * 75) self.damage(o, 70, u.owner, u); });
        this.fx('ring', u.x, u.y, { r: 75, color: '#ff8844', dur: 0.5 });
        var p = this.fixPoint(u.x, u.y, false); u.x = p.x; u.y = p.y;
        u.order = { type: 'idle' }; u.anchor = { x: u.x, y: u.y };
      }
      return;
    }
    if (u.def.aura) {
      u.auraT -= dt;
      if (u.auraT <= 0) {
        u.auraT = 0.5; var tot = 0, ar = u.def.aura.radius, sf = this;
        this.units.slice().forEach(function (o) { if (!o.dead && o.owner !== u.owner && d2(o, u) < ar * ar) tot += sf.damage(o, u.def.aura.dps * 0.5, u.owner, null); });
        if (tot) u.hp = Math.min(u.maxHp, u.hp + tot);
      }
    }
    var o = u.order, t = null;
    if (o.type === 'attack') {
      t = this.get(o.targetId);
      if (!t) { u.order = { type: 'idle' }; u.anchor = { x: u.x, y: u.y }; u.tgt = null; }
    } else if (o.type !== 'move') {
      t = u.tgt ? this.get(u.tgt) : null;
      if (t && dist(t, u) - (t.r || 0) > u.def.sight * 1.4) t = null;
      if (t && o.type === 'idle' && dist(t, u.anchor) > 320) t = null;
      u.scanT -= dt;
      if (!t || u.scanT <= 0) { u.scanT = 0.5; var nt = this.findTarget(u, u.def.sight); if (nt) t = nt; }
      if (u.def.heal && !t) { var h = this.hurtAlly(u, u.def.sight); if (h) t = h; }
      u.tgt = t ? t.id : null;
    }
    if (t) {
      var gap = dist(t, u) - (t.r || 0) - u.r;
      if (gap <= u.def.range) { if (u.cd <= 0) { if (t.owner === u.owner) { u.cd = u.def.cd; t.hp = Math.min(t.maxHp, t.hp + u.def.heal); this.fx('heal', t.x, t.y, { dur: 0.6 }); } else this.attack(u, t); } }
      else this.moveToward(u, t.x, t.y, dt);
      return;
    }
    if (o.type === 'move' || o.type === 'amove') {
      if (d2(u, o) < 64) { u.order = { type: 'idle' }; u.anchor = { x: o.x, y: o.y }; }
      else this.moveToward(u, o.x, o.y, dt);
    } else if (d2(u, u.anchor) > 400) this.moveToward(u, u.anchor.x, u.anchor.y, dt);
  };

  P.updateProjectiles = function (dt) {
    var self = this;
    this.projectiles = this.projectiles.filter(function (p) {
      var t = self.get(p.tid);
      if (t) { p.tx = t.x; p.ty = t.y; }
      var dx = p.tx - p.x, dy = p.ty - p.y, dd = Math.sqrt(dx * dx + dy * dy), step = p.speed * dt;
      if (dd > step) { p.x += dx / dd * step; p.y += dy / dd * step; return true; }
      p.x = p.tx; p.y = p.ty;
      if (p.splash) {
        self.fx('boom', p.x, p.y, { r: p.splash, dur: 0.4 });
        self.units.slice().forEach(function (o) { if (!o.dead && o.owner !== p.owner && d2(o, p) < p.splash * p.splash) self.damage(o, p.dmg * 0.6, p.owner, p.src); });
        self.buildings.slice().forEach(function (b) { if (!b.dead && b.owner !== p.owner && dist(b, p) < p.splash + b.r) self.damage(b, p.dmg, p.owner, p.src); });
      } else if (t) self.damage(t, p.dmg, p.owner, p.src);
      return false;
    });
  };

  P.updateOutposts = function (dt) {
    var self = this;
    this.outposts.forEach(function (op) {
      var n = [0, 0];
      self.units.forEach(function (u) { if (!u.dead && !u.flying && u.owner >= 0 && d2(u, op) < op.r * op.r) n[u.owner]++; });
      var ownerHasBuildings = op.owner >= 0 && op.plotIds.some(function (pid) { var p = self.ents[pid]; return p.buildingId && self.get(p.buildingId); });
      var rate = 0.05, prev = op.owner;
      if (n[0] && !n[1]) { if (!(op.owner === 1 && ownerHasBuildings)) op.v = Math.min(1, op.v + rate * Math.min(n[0], 6) * dt); }
      else if (n[1] && !n[0]) { if (!(op.owner === 0 && ownerHasBuildings)) op.v = Math.max(-1, op.v - rate * Math.min(n[1], 6) * dt); }
      else if (!n[0] && !n[1]) { var home = op.owner === 0 ? 1 : (op.owner === 1 ? -1 : 0); op.v += clamp(home - op.v, -0.05 * dt, 0.05 * dt); }
      op.blocked = ownerHasBuildings && ((op.owner === 1 && n[0]) || (op.owner === 0 && n[1]));
      if (op.v >= 1) op.owner = 0; else if (op.v <= -1) op.owner = 1;
      else if ((op.owner === 0 && op.v <= 0) || (op.owner === 1 && op.v >= 0)) op.owner = -1;
      if (op.owner !== prev) {
        op.plotIds.forEach(function (pid) { self.ents[pid].owner = op.owner; });
        if (op.owner >= 0) { self.event(op.owner, op.name + ' captured!', op.x, op.y, 'good'); self.event(1 - op.owner, 'Enemy took ' + op.name, op.x, op.y, 'alert'); }
        else if (prev >= 0) self.event(prev, op.name + ' was lost', op.x, op.y, 'alert');
      }
    });
  };

  P.separate = function () {
    var us = this.units, n = us.length, i, j;
    for (i = 0; i < n; i++) {
      var a = us[i]; if (a.dead || a.leap) continue;
      for (j = i + 1; j < n; j++) {
        var b = us[j]; if (b.dead || b.leap || a.flying !== b.flying) continue;
        var dx = b.x - a.x, dy = b.y - a.y, rr = (a.r + b.r) * 0.85;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        var dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < rr) { if (dd < 0.01) { dx = 1; dy = 0; dd = 1; } var push = (rr - dd) / 2, px = dx / dd * push, py = dy / dd * push; a.x -= px; a.y -= py; b.x += px; b.y += py; }
      }
    }
    for (i = 0; i < n; i++) {
      var u = us[i]; if (u.dead || u.flying || u.leap) continue;
      for (j = 0; j < this.buildings.length; j++) {
        var bd = this.buildings[j], ddx = u.x - bd.x, ddy = u.y - bd.y, r = bd.r + u.r - 4, d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < r) { if (d < 0.01) { ddx = 0; ddy = 1; d = 1; } u.x = bd.x + ddx / d * r - ddy / d * 2; u.y = bd.y + ddy / d * r + ddx / d * 2; }
      }
      u.x = clamp(u.x, 10, W.w - 10); u.y = clamp(u.y, 10, W.h - 10);
      if (sideOfY(u.y) === 0 && !fordAt(u.x)) {
        var f = this.nearestFord(u.x, u.x), fx = clamp(u.x, f.x1 + 2, f.x2 - 2);
        var bank = u.y < (W.riverTop + W.riverBot) / 2 ? W.riverTop : W.riverBot;
        if (Math.abs(fx - u.x) < Math.abs(bank - u.y)) u.x = fx; else u.y = bank;
      }
    }
  };
})(globalThis.NC = globalThis.NC || {});
