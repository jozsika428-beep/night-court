// Unit voice lines (BFME style): your own units answer when selected, ordered, using abilities, and sometimes
// when they start fighting or die near the camera. Web Audio, files decoded on first use, one line at a time.
// Sets: voice/final/ (processed, when voice_sets.json says it exists) else voice/raw/, per unit falling back to raw.
(function (NC) {
  var ALIAS = { archer: 'bonearcher', crossbow: 'crossbowman', torch: 'torchbearer' }; // game key -> voice folder
  var GAP = 0.8;          // seconds of silence between two lines
  var FIGHT_EVERY = 14, DEATH_EVERY = 8;

  function Voice() {
    this.lines = {}; this.base = {}; this.buf = {}; this.loading = {}; this.last = {};
    this.vol = +(localStorage.getItem('nc_voice_vol') || 80); this.muted = localStorage.getItem('nc_voice_mute') === '1';
    this.busyUntil = 0; this.fightT = -99; this.deathT = -99; this.ext = 'ogg';
    this.calls = []; this.plays = []; // for tests: every request, and every line actually started
    var a = document.createElement('audio');
    this.ext = a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a'; // older iOS Safari: AAC copies
    this.ready = this.loadIndex();
    this.unlockOnTap();
  }
  var P = Voice.prototype;

  P.loadIndex = function () {
    var self = this;
    var get = function (u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    return get('voice_sets.json').then(function (sets) {
      self.finalM4a = !!(sets && sets.final && sets.final.m4a);
      var hasFinal = sets && sets.final && sets.final.available;
      return Promise.all([get('voice/raw/index.json'), hasFinal ? get('voice/final/index.json') : null]);
    }).then(function (r) {
      var pick = function (idx) { var o = {}; if (idx) for (var k in idx) if (k !== '_meta' && idx[k] && typeof idx[k] === 'object') o[k] = idx[k]; return o; };
      self.raw = pick(r[0]); self.fin = pick(r[1]);
      self.choose(); self.loaded = true;
    });
  };
  // final/ wins per unit; units it lacks stay on raw/. Safari without Opus needs .m4a copies, so it uses final/
  // only once final/ has them (voice_sets.json "m4a"), otherwise raw/.
  P.choose = function () {
    var useFin = this.ext === 'ogg' || this.finalM4a; this.lines = {}; this.base = {};
    for (var k in this.raw) { this.lines[k] = this.raw[k]; this.base[k] = 'voice/raw/'; }
    if (useFin) for (var k2 in this.fin) { this.lines[k2] = this.fin[k2]; this.base[k2] = 'voice/final/'; }
  };

  // iOS Safari only lets audio start inside a user gesture: create/resume the context on the first tap
  P.unlockOnTap = function () {
    var self = this, evs = ['pointerdown', 'touchend', 'click', 'keydown'];
    var go = function () {
      if (!self.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        try { self.ctx = new AC(); } catch (e) { return; }
        self.gain = self.ctx.createGain(); self.gain.connect(self.ctx.destination); self.applyVolume();
      }
      if (self.ctx.state !== 'running') self.ctx.resume();
      try { var s = self.ctx.createBufferSource(); s.buffer = self.ctx.createBuffer(1, 1, 22050); s.connect(self.gain); s.start(0); } catch (e) {}
      if (self.ctx.state === 'running') evs.forEach(function (e) { document.removeEventListener(e, go, true); });
    };
    evs.forEach(function (e) { document.addEventListener(e, go, true); });
  };
  P.setVolume = function (v) { this.vol = Math.max(0, Math.min(100, v)); localStorage.setItem('nc_voice_vol', String(this.vol)); this.applyVolume(); };
  P.setMuted = function (m) { this.muted = !!m; localStorage.setItem('nc_voice_mute', m ? '1' : '0'); this.applyVolume(); };
  P.applyVolume = function () { if (this.gain) this.gain.gain.value = this.muted ? 0 : Math.pow(this.vol / 100, 1.5); };

  P.key = function (type) { return this.lines[type] ? type : (ALIAS[type] && this.lines[ALIAS[type]] ? ALIAS[type] : null); };
  P.has = function (type, ev) { var k = this.key(type); return !!(k && this.lines[k][ev] && this.lines[k][ev].length); };

  // random line, never the same one twice in a row
  P.pick = function (k, ev) {
    var list = this.lines[k][ev], n = list.length, last = this.last[k + ev], i = Math.floor(Math.random() * n);
    if (n > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.last[k + ev] = i; return list[i];
  };
  P.url = function (k, file) { var f = this.base[k] + file; return this.ext === 'm4a' ? f.replace(/\.ogg$/i, '.m4a') : f; };
  P.decode = function (url) {
    var self = this;
    if (this.buf[url]) return Promise.resolve(this.buf[url]);
    if (this.loading[url]) return this.loading[url];
    return (this.loading[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { self.ctx.decodeAudioData(ab, res, rej); }); })
      .then(function (b) { self.buf[url] = b; return b; })
      .catch(function (e) {
        delete self.loading[url];
        if (self.ext === 'ogg' && /\.ogg$/.test(url)) { self.ext = 'm4a'; self.choose(); self.failed = url; } // decoder refused Opus: AAC from now on
        throw e;
      }));
  };

  // ask for a line; dropped if another line is playing (global cooldown) or the unit has none (heroes for now)
  P.say = function (type, ev, why) {
    var now = performance.now() / 1000;
    this.calls.push({ type: type, ev: ev, why: why || '', t: now }); if (this.calls.length > 50) this.calls.shift();
    var k = this.key(type);
    if (!k || !this.has(type, ev) || !this.ctx || this.muted || this.vol <= 0) return false;
    if (now < this.busyUntil) return false;
    var line = this.pick(k, ev), url = this.url(k, line.file), self = this;
    this.busyUntil = now + 2.5; // held until we know the clip length
    this.decode(url).then(function (b) {
      var t = performance.now() / 1000;
      if (t - now > 0.7) { self.busyUntil = 0; return; } // arrived too late to still make sense
      var s = self.ctx.createBufferSource(); s.buffer = b; s.connect(self.gain); s.start();
      self.busyUntil = t + b.duration + GAP;
      self.plays.push({ type: type, ev: ev, file: url, text: line.text }); if (self.plays.length > 50) self.plays.shift();
    }).catch(function () { self.busyUntil = 0; });
    return true;
  };

  // ---------- game hooks ----------
  // one speaker for a group: a hero (with lines) first, else the most common type that has lines
  P.speaker = function (units, ev) {
    var c = {}, best = null, n = 0, self = this;
    for (var i = 0; i < units.length; i++) { var u = units[i]; if (u.hero && self.has(u.type, ev)) return u.type; c[u.type] = (c[u.type] || 0) + 1; }
    for (var t in c) if (c[t] > n && self.has(t, ev)) { n = c[t]; best = t; }
    return best;
  };
  P.attach = function (game, ui, cam) {
    var self = this; this.g = game; this.ui = ui; this.cam = cam; this.prevSel = new Set(); this.alive = new Map(); this.fighting = new Set();
    var me = game.player;
    var units = function (ids) { var out = []; ids.forEach(function (id) { var u = game.get(id); if (u && u.kind === 'unit') out.push(u); }); return out; };
    // orders the player gives through the UI (not the bot, not automatic rally moves)
    var tapWith = ui.tapWith;
    ui.tapWith = function () { this._voiceTap = true; try { return tapWith.apply(this, arguments); } finally { this._voiceTap = false; } };
    var order = game.orderUnits;
    game.orderUnits = function (side, ids, cmd) {
      var r = order.apply(this, arguments);
      if (side === me && ui._voiceTap && r) { var ev = cmd.type === 'attack' ? 'attack' : 'move', t = self.speaker(units(ids), ev); if (t) self.say(t, ev, 'order'); }
      return r;
    };
    var ability = game.useAbility;
    game.useAbility = function (side, uId) {
      var r = ability.apply(this, arguments);
      if (r === true && side === me) { var u = game.get(uId); if (u) self.say(u.type, 'ability', 'ability'); }
      return r;
    };
  };
  // once per frame: selection changes, fights starting, deaths
  P.update = function () {
    if (!this.g) return;
    var g = this.g, me = g.player, ui = this.ui, cam = this.cam, now = performance.now() / 1000, self = this;
    var sel = ui.sel.units, gained = false;
    sel.forEach(function (id) { if (!self.prevSel.has(id)) gained = true; });
    if (gained && sel.size) { var us = []; sel.forEach(function (id) { var u = g.get(id); if (u && u.owner === me) us.push(u); }); var t = this.speaker(us, 'select'); if (t) this.say(t, 'select', 'select'); }
    this.prevSel = new Set(sel);
    var seen = new Map(), inView = function (u) { return cam && cam.inView ? cam.inView(u.x, u.y) : true; };
    for (var i = 0; i < g.units.length; i++) {
      var u = g.units[i]; if (u.owner !== me) continue;
      seen.set(u.id, u);
      var fights = !!u.tgt;
      if (fights && !this.fighting.has(u.id) && now - this.fightT > FIGHT_EVERY && inView(u) && Math.random() < 0.35 && this.has(u.type, 'attack')) { this.fightT = now; this.say(u.type, 'attack', 'fight'); }
      if (fights) this.fighting.add(u.id); else this.fighting.delete(u.id);
    }
    this.alive.forEach(function (u, id) {
      if (seen.has(id) || u.hp > 0 && g.get(id)) return;
      self.fighting.delete(id);
      if (u.hero) self.say(u.type, 'death', 'hero death');
      else if (now - self.deathT > DEATH_EVERY && inView(u) && Math.random() < 0.3 && self.has(u.type, 'death')) { self.deathT = now; self.say(u.type, 'death', 'death'); }
    });
    this.alive = seen;
  };

  NC.Voice = Voice;
})(globalThis.NC = globalThis.NC || {});
