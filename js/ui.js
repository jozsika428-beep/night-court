// HUD, bottom action panel, toasts, tap handling.
(function (NC) {
  var A = NC.Assets, U = NC.util;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function UI(game, cam, hooks) {
    this.g = game; this.cam = cam; this.hooks = hooks || {};
    this.sel = { units: new Set(), buildingId: null, plotId: null };
    this.mode = 'amove'; this.boxMode = false; this.box = null;
    this.sig = ''; this.lastSeq = game.evSeq || 0; this.lastTap = { t: 0, type: null };
    this.panel = $('panel'); this.panelDown = false;
    var self = this;
    this.panel.onpointerdown = function () { self.panelDown = true; };
    this.panel.onpointerup = this.panel.onpointercancel = function () { setTimeout(function () { self.panelDown = false; }, 50); };
    this.panel.onclick = function (e) { var b = e.target.closest('[data-a]'); if (b && !b.disabled) self.action(b.dataset.a, b.dataset.v); };
    $('h-pause').onclick = function () { self.hooks.pause && self.hooks.pause(); };
    this.me = game.sides[game.player]; this.fac = NC.FACTIONS[this.me.faction];
  }
  NC.UI = UI;
  var P = UI.prototype;

  P.toast = function (text, kind) {
    var box = $('toasts'), d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = text;
    box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3500);
  };
  P.say = function (r) { if (typeof r === 'string') this.toast(r, 'alert'); };

  P.myUnits = function () { var me = this.g.player; return this.g.units.filter(function (u) { return u.owner === me; }); };
  P.clear = function () { this.sel.units = new Set(); this.sel.buildingId = null; this.sel.plotId = null; };

  // ----- taps on the map -----
  P.tap = function (wx, wy) {
    var g = this.g, me = g.player, z = this.cam.z, tol = Math.max(10, 18 / z);
    var p = { x: wx, y: wy };
    function nearest(list, extra) { var best = null, bd = 1e9; list.forEach(function (e) { var d = U.dist(e, p) - e.r - extra; if (d < bd) { bd = d; best = e; } }); return bd <= 0 ? best : null; }
    // units are drawn a little above their feet, so test the body a bit higher too
    var up = g.units.map(function (u) { return u; });
    var hitU = nearest(up, tol) || nearest(up.map(function (u) { return { x: u.x, y: u.y - u.r * 1.4, r: u.r, ref: u }; }), tol);
    if (hitU && hitU.ref) hitU = hitU.ref;
    var hitB = nearest(g.buildings, 4);
    var hasSel = this.sel.units.size > 0;
    if (hitU && hitU.owner === me) {
      var now = performance.now();
      if (now - this.lastTap.t < 380 && this.lastTap.type === hitU.type) this.selectType(hitU.type);
      else { this.clear(); this.sel.units.add(hitU.id); }
      this.lastTap = { t: now, type: hitU.type };
      return;
    }
    var enemy = (hitU && hitU.owner !== me) ? hitU : (hitB && hitB.owner !== me ? hitB : null);
    if (enemy && hasSel) {
      g.orderUnits(me, Array.from(this.sel.units), { type: 'attack', targetId: enemy.id });
      g.fx('move', enemy.x, enemy.y, { color: '#f55', dur: 0.5 });
      return;
    }
    if (hitB && hitB.owner === me && !hasSel) { this.clear(); this.sel.buildingId = hitB.id; return; }
    var plot = nearest(g.plots.filter(function (pl) { return pl.owner === me && !g.get(pl.buildingId); }), 6);
    if (plot && !hasSel) { this.clear(); this.sel.plotId = plot.id; return; }
    if (hitB && hitB.owner === me && hasSel) { this.clear(); this.sel.buildingId = hitB.id; return; }
    if (hasSel) {
      g.orderUnits(me, Array.from(this.sel.units), { type: this.mode, x: wx, y: wy });
      g.fx('move', wx, wy, { color: this.mode === 'move' ? '#7cf' : '#7f7', dur: 0.5 });
      return;
    }
    if (enemy && enemy.kind === 'building') { this.clear(); this.sel.buildingId = enemy.id; return; }
    this.clear();
  };
  P.selectBox = function (x0, y0, x1, y1) {
    var s = new Set(); this.myUnits().forEach(function (u) { if (u.x >= x0 && u.x <= x1 && u.y >= y0 - u.r && u.y <= y1 + u.r) s.add(u.id); });
    this.clear(); this.sel.units = s; if (this.boxMode) this.boxMode = false;
    if (!s.size) this.toast('No units in the box');
  };
  P.selectType = function (type) { var s = new Set(), c = this.cam, hw = c.vw / 2 / c.z, hh = c.vh / 2 / c.z; this.myUnits().forEach(function (u) { if (u.type === type && Math.abs(u.x - c.x) < hw && Math.abs(u.y - c.y) < hh) s.add(u.id); }); this.clear(); this.sel.units = s; };
  P.selectArmy = function () { var s = new Set(); this.myUnits().forEach(function (u) { s.add(u.id); }); this.clear(); this.sel.units = s; if (!s.size) this.toast('You have no army yet. Build a Crypt on a + plot.'); else this.centerOn(this.centroid(s)); };
  P.centroid = function (ids) { var g = this.g, x = 0, y = 0, n = 0; ids.forEach(function (id) { var u = g.get(id); if (u) { x += u.x; y += u.y; n++; } }); return n ? { x: x / n, y: y / n } : null; };
  P.centerOn = function (p) { if (!p) return; this.cam.x = p.x; this.cam.y = p.y; this.cam.clamp(); };

  // ----- panel buttons -----
  P.action = function (a, v) {
    var g = this.g, me = g.player, r;
    switch (a) {
      case 'army': this.selectArmy(); break;
      case 'heroes': {
        var hs = this.myUnits().filter(function (u) { return u.hero; });
        if (hs.length) { this.clear(); var s = this.sel.units; hs.forEach(function (u) { s.add(u.id); }); this.centerOn(this.centroid(s)); }
        else { this.clear(); this.sel.buildingId = this.me.fortressId; this.centerOn(g.get(this.me.fortressId)); this.toast('Summon a hero at your Fortress'); }
        break; }
      case 'home': this.centerOn(g.get(this.me.fortressId)); break;
      case 'mode': this.mode = this.mode === 'amove' ? 'move' : 'amove'; this.toast(this.mode === 'amove' ? 'Attack-move: units fight anything on the way' : 'Move: units ignore enemies until they arrive'); break;
      case 'box': this.boxMode = !this.boxMode; if (this.boxMode) this.toast('Drag on the map to draw a selection box'); break;
      case 'clear': this.clear(); break;
      case 'build': r = g.build(me, this.sel.plotId, v); if (typeof r === 'string') this.say(r); else { this.clear(); this.sel.buildingId = r.id; } break;
      case 'train': this.say(g.train(me, this.sel.buildingId, v)); break;
      case 'level': r = g.levelUp(me, this.sel.buildingId); this.say(r); break;
      case 'research': this.say(g.research(me, this.sel.buildingId, v)); break;
      case 'hero': r = g.summonHero(me, v); if (typeof r === 'string') this.say(r); else { this.clear(); this.sel.units.add(r.id); } break;
      case 'ability': { var parts = v.split(':'); this.say(g.useAbility(me, +parts[0], +parts[1])); break; }
      case 'rally': { var f = g.get(this.me.fortressId); this.toast('New units gather in front of your Fortress'); break; }
    }
    this.sig = ''; this.refresh(true);
  };

  function btn(a, v, ico, label, sub, opt) {
    opt = opt || {};
    return '<button class="b' + (opt.on ? ' on' : '') + (opt.off ? ' off' : '') + '" data-a="' + a + '"' + (v != null ? ' data-v="' + esc(v) + '"' : '') + (opt.dis ? ' disabled' : '') + (opt.id ? ' id="' + opt.id + '"' : '') + '>' +
      ico + '<span>' + esc(label) + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + (opt.cd ? '<span class="cd">' + opt.cd + '</span>' : '') + '</button>';
  }
  function ico(k, f) { return A.iconHTML(k, f); }

  P.panelHTML = function () {
    var g = this.g, me = g.player, S = this.me, fac = this.fac, resN = fac.res.toLowerCase(), self = this;
    var res = S.res, h = '', b = '';
    var common = btn('army', null, '<span class="ico">⚔️</span>', 'Army') + btn('heroes', null, ico(fac.heroes[0]), 'Heroes') + btn('box', null, '<span class="ico">▢</span>', 'Box select', null, { on: this.boxMode }) + btn('home', null, '<span class="ico">🏰</span>', 'Home');
    // drop dead units from selection
    this.sel.units.forEach(function (id) { if (!g.get(id)) self.sel.units.delete(id); });
    if (this.sel.buildingId && !g.get(this.sel.buildingId)) this.sel.buildingId = null;
    if (this.sel.plotId && g.get(this.sel.plotId) && (g.get(g.get(this.sel.plotId).buildingId) || g.get(this.sel.plotId).owner !== me)) this.sel.plotId = null;

    if (this.sel.units.size) {
      var counts = {}, heroes = [];
      this.sel.units.forEach(function (id) { var u = g.get(id); counts[u.def.name] = (counts[u.def.name] || 0) + 1; if (u.hero) heroes.push(u); });
      h = '<b>' + this.sel.units.size + ' selected</b>: ' + Object.keys(counts).map(function (k) { return counts[k] + ' ' + k; }).join(', ') + ' <small>- tap ground to ' + (this.mode === 'amove' ? 'attack-move' : 'move') + ', tap an enemy to attack</small>';
      heroes.slice(0, 2).forEach(function (u) {
        u.def.abilities.forEach(function (ab, i) {
          var cd = u.abCd[i] > 0 ? Math.ceil(u.abCd[i]) + 's' : '';
          b += btn('ability', u.id + ':' + i, '<span class="ico">' + ab.icon + '</span>', ab.name, esc(u.def.name.split(' ').pop()), { cd: cd, dis: !!cd });
        });
      });
      b += btn('mode', null, '<span class="ico">' + (this.mode === 'amove' ? '⚔️' : '🏃') + '</span>', this.mode === 'amove' ? 'Attack-move' : 'Move only', 'tap to switch', { on: this.mode === 'move' });
      b += btn('army', null, '<span class="ico">⚔️</span>', 'All army') + btn('box', null, '<span class="ico">▢</span>', 'Box', null, { on: this.boxMode }) + btn('clear', null, '<span class="ico">✖</span>', 'Deselect');
    } else if (this.sel.plotId) {
      var plot = g.get(this.sel.plotId);
      h = '<b>Empty plot</b> - choose what to build' + (plot.base ? '' : ' (outpost: economy and towers only)');
      g.buildOptions(me, plot).forEach(function (k) { var d = NC.BUILDINGS[k]; b += btn('build', k, ico(k), d.name, d.cost + ' ' + resN + '<br>' + esc(d.desc || ''), { off: res < d.cost }); });
      b += btn('clear', null, '<span class="ico">✖</span>', 'Close');
    } else if (this.sel.buildingId) {
      var B = g.get(this.sel.buildingId), d = B.def, mine = B.owner === me;
      var lvlTxt = d.role === 'fortress' ? '' : ' ' + '★'.repeat(B.level) + ' <small>(level ' + B.level + ')</small>';
      h = '<b>' + (mine ? '' : 'Enemy ') + esc(d.name) + '</b>' + lvlTxt + ' <small>HP <span id="lv-hp"></span></small>';
      if (B.built < 1) h += '<br>Building... <span id="lv-built"></span>';
      else if (d.role !== 'fortress' && B.level < 3) h += '<div class="xpbar"><i id="lv-xp"></i></div><small>Gains XP when used. Next level unlocks more.</small>';
      if (mine && B.built >= 1) {
        if (d.income) h += '<br><small>Makes ' + g.incomeOf(B).toFixed(1) + ' ' + resN + '/sec</small>';
        if (d.trains) {
          g.trainable(B).forEach(function (o) {
            var ud = NC.UNITS[o.type];
            b += btn('train', o.type, ico(o.type), ud.name + (ud.squad > 1 ? ' x' + ud.squad : ''), o.locked ? '🔒 needs level ' + o.level : ud.cost + ' ' + resN, { off: o.locked || res < ud.cost });
          });
          if (B.queue.length) h += '<br>Queue: <span class="queue">' + B.queue.map(function (q) { return A.glyph(q); }).join(' ') + '</span> <small id="lv-train"></small>';
        }
        if (d.role === 'forge') {
          ['melee', 'ranged', 'armor', 'frenzy'].forEach(function (k) {
            var up = NC.UPGRADES[k], done = S.upgrades[k], busy = B.research && B.research.key === k;
            b += btn('research', k, ico(k, S.faction), fac.upgrades[k], done ? '✔ done' : busy ? 'researching...' : (B.level < up.level ? '🔒 level ' + up.level : up.cost + ' - ' + up.desc), { off: done || busy || B.level < up.level || res < up.cost, on: done });
          });
          h += '<br><small>Upgrades show on your units: red blade, gold dot, white ring, red glow.</small>';
        }
        if (d.role === 'fortress') {
          fac.heroes.forEach(function (k) {
            var st = g.heroStatus(me, k), ud = NC.UNITS[k];
            var sub = st.alive ? 'on the field' : st.wait > 0 ? 'back in ' + Math.ceil(st.wait) + 's' : (st.revive ? 'revive ' : '') + st.cost + ' ' + resN;
            b += btn('hero', k, ico(k), ud.name, sub, { off: st.alive || st.wait > 0 || res < st.cost });
          });
          h += '<br><small>Heroes are strong single units with special powers. ' + NC.BASE_INCOME + ' ' + resN + '/sec from the Fortress.</small>';
        }
        if (d.role !== 'fortress' && B.level < 3) b += btn('level', null, '<span class="ico">⬆️</span>', 'Level up now', NC.LEVEL_COST[B.level] + ' ' + resN, { off: res < NC.LEVEL_COST[B.level] });
      }
      b += btn('clear', null, '<span class="ico">✖</span>', 'Close');
    } else {
      h = 'Tap a <b>＋ plot</b> to build. Capture <b>flags</b> for more land. Destroy the enemy Keep to win.';
      b = common;
    }
    return '<div class="head">' + h + '</div><div class="btns">' + b + '</div>';
  };

  // only rebuild the panel when something visible changed, and never mid-tap
  P.refresh = function (force) {
    var g = this.g, B = this.sel.buildingId && g.get(this.sel.buildingId);
    var html = this.panelHTML();
    if ((force || !this.panelDown) && html !== this.sig) { this.panel.innerHTML = html; this.sig = html; }
    if (B) {
      var e;
      if ((e = $('lv-hp'))) e.textContent = Math.ceil(B.hp) + '/' + Math.ceil(B.maxHp);
      if ((e = $('lv-built'))) e.textContent = Math.floor(B.built * 100) + '%';
      if ((e = $('lv-xp'))) { var lo = NC.XP_LEVELS[B.level - 1], hi = NC.XP_LEVELS[B.level]; e.style.width = Math.min(100, (B.xp - lo) / (hi - lo) * 100) + '%'; }
      if ((e = $('lv-train')) && B.queue.length) e.textContent = Math.floor(B.trainT / NC.UNITS[B.queue[0]].time * 100) + '%';
    }
  };

  P.hud = function () {
    var g = this.g, S = this.me, fac = this.fac;
    var inc = g.totalIncome(g.player);
    $('h-res').innerHTML = A.iconHTML(fac.res.toLowerCase()).replace('class="ico"', 'class="ico" style="width:18px;height:18px;vertical-align:-3px"') + ' ' + Math.floor(S.res) + ' <small>+' + inc.toFixed(1) + '/s</small>';
    $('h-pop').innerHTML = '👥 ' + S.pop + '/' + NC.POP_CAP;
    var c = g.cycle(), night = g.isNight, left = night ? NC.DAY_LEN - c : NC.NIGHT_START - c;
    $('h-time').innerHTML = (night ? '🌙' : '☀️') + ' <small>' + Math.ceil(left) + 's</small>';
    // events -> toasts
    var self = this;
    g.events.forEach(function (ev) { if (ev.seq > self.lastSeq) { self.lastSeq = ev.seq; if (ev.side === g.player && ev.kind !== 'info') self.toast(ev.text, ev.kind); } });
  };
})(globalThis.NC = globalThis.NC || {});
