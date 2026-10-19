// HUD, bottom action panel, toasts, tap handling.
(function (NC) {
  var A = NC.Assets, U = NC.util;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function UI(game, cam, hooks) {
    this.g = game; this.cam = cam; this.hooks = hooks || {};
    this.sel = { units: new Set(), buildingId: null, plotId: null };
    this.mode = 'amove'; this.boxMode = false; this.more = false; this.box = null;
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
    this.tapWith(wx, wy, hitU, hitB);
  };
  // shared by the 2D and 3D views: 3D resolves hits by raycast, then calls this
  P.tapWith = function (wx, wy, hitU, hitB) {
    var g = this.g, me = g.player, p = { x: wx, y: wy };
    function nearest(list, extra) { var best = null, bd = 1e9; list.forEach(function (e) { var d = U.dist(e, p) - e.r - extra; if (d < bd) { bd = d; best = e; } }); return bd <= 0 ? best : null; }
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
  P.selectWhere = function (fn) { var s = new Set(); this.myUnits().forEach(function (u) { if (fn(u)) s.add(u.id); }); this.clear(); this.sel.units = s; if (this.boxMode) this.boxMode = false; if (!s.size) this.toast('No units in the box'); };
  P.selectType = function (type) { var s = new Set(), c = this.cam, hw = c.vw / 2 / c.z, hh = c.vh / 2 / c.z; this.myUnits().forEach(function (u) { if (u.type === type && (c.inView ? c.inView(u.x, u.y) : (Math.abs(u.x - c.x) < hw && Math.abs(u.y - c.y) < hh))) s.add(u.id); }); this.clear(); this.sel.units = s; };
  P.selectArmy = function () { var s = new Set(); this.myUnits().forEach(function (u) { s.add(u.id); }); this.clear(); this.sel.units = s; if (!s.size) this.toast('You have no army yet. Build a Crypt on a + plot.'); else this.centerOn(this.centroid(s)); };
  P.centroid = function (ids) { var g = this.g, x = 0, y = 0, n = 0; ids.forEach(function (id) { var u = g.get(id); if (u) { x += u.x; y += u.y; n++; } }); return n ? { x: x / n, y: y / n } : null; };
  P.centerOn = function (p) { if (!p) return; this.cam.x = p.x; this.cam.y = p.y; this.cam.clamp(); };

  // ----- panel buttons -----
  P.action = function (a, v) {
    var g = this.g, me = g.player, r;
    if (a !== 'more') this.more = false; // the More row closes after any choice
    switch (a) {
      case 'army': this.selectArmy(); break;
      case 'heroes': {
        var hs = this.myUnits().filter(function (u) { return u.hero; });
        if (hs.length) { this.clear(); var s = this.sel.units; hs.forEach(function (u) { s.add(u.id); }); this.centerOn(this.centroid(s)); }
        else { this.clear(); this.sel.buildingId = this.me.fortressId; this.centerOn(g.get(this.me.fortressId)); this.toast('Summon a hero at your Fortress'); }
        break; }
      case 'home': this.centerOn(g.get(this.me.fortressId)); break;
      case 'mode': this.mode = this.mode === 'amove' ? 'move' : 'amove'; this.toast(this.mode === 'amove' ? 'Attack-move: units fight anything on the way' : 'Move: units ignore enemies until they arrive'); break;
      case 'box': this.boxMode = !this.boxMode; this.more = false; if (this.boxMode) this.toast('Drag on the map to draw a selection box'); break;
      case 'clear': this.clear(); this.more = false; break;
      case 'more': this.more = !this.more; break;
      case 'stop': this.sel.units.forEach(function (id) { var u = g.get(id); if (u) { u.order = { type: 'idle' }; u.tgt = null; } }); break;
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
    return '<button class="b' + (opt.cls ? ' ' + opt.cls : '') + (opt.on ? ' on' : '') + (opt.off ? ' off' : '') + '" data-a="' + a + '"' + (v != null ? ' data-v="' + esc(v) + '"' : '') + (opt.dis ? ' disabled' : '') + (opt.id ? ' id="' + opt.id + '"' : '') + ' aria-label="' + esc(label) + '">' +
      ico + '<span>' + esc(label) + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + (opt.cd ? '<span class="cd">' + opt.cd + '</span>' : '') + '</button>';
  }
  function ico(k, f) { return A.iconHTML(k, f); }
  // small line icons (pure SVG, gold via currentColor) for the command buttons
  var SVG = {
    attack: '<path d="M4 4l9 9M4 4v4M4 4h4M20 4l-9 9M20 4v4M20 4h-4M8 15l-3 3 1 1 3-3M16 15l3 3-1 1-3-3"/>',
    move: '<path d="M5 12h12M12 6l6 6-6 6"/>',
    stop: '<path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7z"/><path d="M9 9h6v6H9z"/>',
    army: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 10l3 3 3-3"/>',
    heroes: '<path d="M4 18h16M5 18l-1-10 5 4 3-7 3 7 5-4-1 10"/>',
    home: '<path d="M4 21V9h3v3h3V9h4v3h3V9h3v12zM10 21v-4h4v4"/>',
    box: '<path d="M4 4h4M12 4h4M20 4v4M20 12v4M20 20h-4M12 20H8M4 20v-4M4 12V8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    upgrade: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
    build: '<path d="M14 4l6 6-3 3-6-6zM12 9l-8 8 3 3 8-8"/>'
  };
  function svg(k) { return '<svg class="ico svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SVG[k] + '</svg>'; }
  NC.svgIcon = svg;
  // icon-only command button (caption kept tiny for clarity, screen readers get the full label)
  function cmd(a, v, k, label, opt) { opt = opt || {}; opt.cls = 'cmd'; return btn(a, v, svg(k), label, null, opt); }

  P.panelHTML = function () {
    var g = this.g, me = g.player, S = this.me, fac = this.fac, resN = fac.res.toLowerCase(), self = this;
    var res = S.res, h = '', b = '';
    // rarely used commands live behind one 'More' button
    var more = function (extra) { return cmd('more', null, 'more', 'More', { on: self.more }) + (self.more ? '<div class="more">' + extra + '</div>' : ''); };
    var common = cmd('army', null, 'army', 'Army') + cmd('heroes', null, 'heroes', 'Heroes') + cmd('home', null, 'home', 'Home') + more(cmd('box', null, 'box', 'Box select', { on: this.boxMode }));
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
      b += cmd('mode', null, this.mode === 'amove' ? 'attack' : 'move', this.mode === 'amove' ? 'Attack' : 'Move', { on: this.mode === 'move' });
      b += cmd('stop', null, 'stop', 'Stop') + cmd('clear', null, 'close', 'Deselect');
      b += more(cmd('army', null, 'army', 'All army') + cmd('box', null, 'box', 'Box', { on: this.boxMode }) + cmd('home', null, 'home', 'Home'));
    } else if (this.sel.plotId) {
      var plot = g.get(this.sel.plotId);
      h = '<b>Empty plot</b> - choose what to build' + (plot.base ? '' : ' (outpost: economy and towers only)');
      g.buildOptions(me, plot).forEach(function (k) { var d = NC.BUILDINGS[k]; b += btn('build', k, ico(k), d.name, d.cost + ' ' + resN + '<br>' + esc(d.desc || ''), { off: res < d.cost }); });
      b += cmd('clear', null, 'close', 'Close');
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
        if (d.role !== 'fortress' && B.level < 3) b += btn('level', null, svg('upgrade'), 'Level up', NC.LEVEL_COST[B.level] + ' ' + resN, { off: res < NC.LEVEL_COST[B.level] });
      }
      b += cmd('clear', null, 'close', 'Close');
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
