// Drawing: map, entities, effects, night tint, minimap.
(function (NC) {
  var W = NC.WORLD, A = NC.Assets;

  function Renderer(canvas, game, cam) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.g = game; this.cam = cam;
    this.bg = this.makeBackground(false);
    this.bgArt = false;
  }
  var TERRAIN = ['tile_grass', 'tile_mud', 'tile_water', 'tile_ford', 'prop_tree_oak', 'prop_tree_pine', 'prop_tree_dead', 'prop_reeds', 'prop_rock_flat', 'prop_rocks_cluster'];
  NC.Renderer = Renderer;
  var P = Renderer.prototype;

  P.makeBackground = function (art) {
    var g = this.g, cv = document.createElement('canvas'); cv.width = W.w; cv.height = W.h;
    var x = cv.getContext('2d'), rnd = NC.util.rng(42);
    function pat(k) { var i = art && A.sprite(k); return i ? x.createPattern(i, 'repeat') : null; }
    function prop(k, px, py, sz) { var i = art && A.sprite(k); if (!i) return false; x.drawImage(i, px - sz / 2, py - sz * 0.95, sz, sz); return true; }
    var grass = pat('tile_grass'), mud = pat('tile_mud'), water = pat('tile_water'), ford = pat('tile_ford');
    x.fillStyle = grass || '#1d261b'; x.fillRect(0, 0, W.w, W.h);
    if (grass) { x.fillStyle = 'rgba(10,16,12,0.25)'; x.fillRect(0, 0, W.w, W.h); }
    for (var i = 0; i < (grass ? 260 : 900); i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(40,55,35,' + (grass ? 0.18 : 0.5) + ')' : 'rgba(10,14,10,' + (grass ? 0.22 : 0.5) + ')'; x.beginPath(); x.arc(rnd() * W.w, rnd() * W.h, 10 + rnd() * 40, 0, 7); x.fill(); }
    // roads from each fortress to the fords and outposts
    x.strokeStyle = mud || 'rgba(90,75,55,0.55)'; x.globalAlpha = mud ? 0.8 : 1; x.lineWidth = 34; x.lineCap = 'round';
    var fm = (W.riverTop + W.riverBot) / 2;
    g.map.fortress.forEach(function (f) {
      W.fords.forEach(function (fd) { x.beginPath(); x.moveTo(f.x, f.y); x.quadraticCurveTo((f.x + fd.x1 + fd.x2) / 3, (f.y + fm) / 2, (fd.x1 + fd.x2) / 2, fm); x.stroke(); });
    });
    g.outposts.forEach(function (o) { var f = g.map.fortress[o.y > fm ? 0 : 1]; if (o.type === 'shrine') return; x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(o.x, o.y); x.stroke(); });
    x.globalAlpha = 1;
    if (mud) g.map.fortress.forEach(function (f) { x.fillStyle = mud; x.globalAlpha = 0.55; x.beginPath(); x.ellipse(f.x, f.y, 340, 250, 0, 0, 7); x.fill(); x.globalAlpha = 1; });
    // river
    var gr = x.createLinearGradient(0, W.riverTop - 20, 0, W.riverBot + 20);
    gr.addColorStop(0, '#2a3a30'); gr.addColorStop(0.15, '#0c2234'); gr.addColorStop(0.5, '#081a2a'); gr.addColorStop(0.85, '#0c2234'); gr.addColorStop(1, '#2a3a30');
    x.fillStyle = gr; x.beginPath(); x.moveTo(0, W.riverTop - 20);
    for (var xx = 0; xx <= W.w; xx += 40) x.lineTo(xx, W.riverTop - 8 + Math.sin(xx * 0.02) * 8);
    for (xx = W.w; xx >= 0; xx -= 40) x.lineTo(xx, W.riverBot + 8 + Math.sin(xx * 0.023 + 1) * 8);
    x.closePath(); x.fill();
    if (water) { x.save(); x.clip(); x.globalAlpha = 0.85; x.fillStyle = water; x.fillRect(0, W.riverTop - 30, W.w, W.riverBot - W.riverTop + 60); x.globalAlpha = 0.35; x.fillStyle = gr; x.fillRect(0, W.riverTop - 30, W.w, W.riverBot - W.riverTop + 60); x.restore(); }
    x.strokeStyle = 'rgba(120,160,190,0.12)'; x.lineWidth = 2;
    for (i = 0; i < 70; i++) { var wy = W.riverTop + 15 + rnd() * (W.riverBot - W.riverTop - 30), wx = rnd() * W.w; x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 15, wy - 4, wx + 30, wy); x.stroke(); }
    // fords: shallow sandy water with stones
    W.fords.forEach(function (fd) {
      x.fillStyle = ford || 'rgba(110,120,100,0.55)'; x.fillRect(fd.x1, W.riverTop - 10, fd.x2 - fd.x1, W.riverBot - W.riverTop + 20);
      if (ford) { for (var q = 0; q < 6; q++) prop('prop_rock_flat', fd.x1 + 15 + rnd() * (fd.x2 - fd.x1 - 30), W.riverTop + 20 + rnd() * (W.riverBot - W.riverTop - 30), 22 + rnd() * 14); }
      else { x.fillStyle = 'rgba(140,150,130,0.5)'; for (var k = 0; k < 40; k++) { x.beginPath(); x.arc(fd.x1 + rnd() * (fd.x2 - fd.x1), W.riverTop + rnd() * (W.riverBot - W.riverTop), 3 + rnd() * 6, 0, 7); x.fill(); } }
      x.strokeStyle = 'rgba(200,220,200,0.25)'; x.setLineDash([8, 8]); x.lineWidth = 2; x.strokeRect(fd.x1, W.riverTop - 10, fd.x2 - fd.x1, W.riverBot - W.riverTop + 20); x.setLineDash([]);
    });
    // trees, kept away from roads, bases, outposts, fords
    var keep = [].concat(g.map.fortress.map(function (f) { return { x: f.x, y: f.y, r: 400 }; }), g.outposts.map(function (o) { return { x: o.x, y: o.y, r: 150 }; }));
    for (i = 0; i < 260; i++) {
      var tx = rnd() * W.w, ty = rnd() * W.h;
      if (ty > W.riverTop - 40 && ty < W.riverBot + 40) continue;
      if (keep.some(function (k) { return (k.x - tx) * (k.x - tx) + (k.y - ty) * (k.y - ty) < k.r * k.r; })) continue;
      if (Math.abs(tx - 800) < 120 || (tx > 120 && tx < 420 && Math.abs(ty - 1200) < 380) || (tx > 1180 && tx < 1480 && Math.abs(ty - 1200) < 380)) continue;
      var tr = 10 + rnd() * 14, kind = rnd();
      if (art && prop(kind < 0.45 ? 'prop_tree_pine' : kind < 0.8 ? 'prop_tree_oak' : (kind < 0.92 ? 'prop_tree_dead' : 'prop_rocks_cluster'), tx, ty, tr * 4.5)) continue;
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(tx + 4, ty + 5, tr, 0, 7); x.fill();
      x.fillStyle = rnd() < 0.5 ? '#14200f' : '#1a2914'; x.beginPath(); x.arc(tx, ty, tr, 0, 7); x.fill();
    }
    if (art) for (i = 0; i < 70; i++) { var rx = rnd() * W.w; if (NC.util.fordAt(rx)) continue; prop('prop_reeds', rx, (rnd() < 0.5 ? W.riverTop + 6 : W.riverBot + 14), 34 + rnd() * 16); }
    x.font = 'italic bold 22px serif'; x.fillStyle = 'rgba(180,200,220,0.35)'; x.textAlign = 'center';
    x.fillText('B l a c k w a t e r', 1040, (W.riverTop + W.riverBot) / 2 + 8);
    return cv;
  };

  P.darkness = function () {
    var c = this.g.cycle(), n = NC.NIGHT_START, L = NC.DAY_LEN, fade = 15;
    if (c >= n + fade && c <= L - fade) return 1;
    if (c >= n && c < n + fade) return (c - n) / fade;
    if (c > L - fade) return (L - c) / fade;
    return 0;
  };

  P.draw = function (ui) {
    var g = this.g, ctx = this.ctx, cam = this.cam, dpr = cam.dpr, vw = cam.vw, vh = cam.vh, me = g.player;
    if (!this.bgArt && A.loaded && A.allReady(TERRAIN)) { this.bgArt = true; if (A.has('tile_grass')) this.bg = this.makeBackground(true); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0d0a'; ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (vw / 2 - cam.x * cam.z), dpr * (vh / 2 - cam.y * cam.z));
    ctx.drawImage(this.bg, 0, 0);
    var view = { x0: cam.x - vw / 2 / cam.z - 80, x1: cam.x + vw / 2 / cam.z + 80, y0: cam.y - vh / 2 / cam.z - 80, y1: cam.y + vh / 2 / cam.z + 80 };
    function vis(e) { return e.x > view.x0 && e.x < view.x1 && e.y > view.y0 && e.y < view.y1; }
    var facs = g.sides.map(function (s) { return NC.FACTIONS[s.faction]; });
    var t = g.t;
    // outposts
    g.outposts.forEach(function (o) {
      if (!vis(o)) return;
      var col = o.owner >= 0 ? facs[o.owner].color : '#999';
      ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      if (Math.abs(o.v) > 0.01 && Math.abs(o.v) < 1) { ctx.strokeStyle = o.v > 0 ? facs[0].color : facs[1].color; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, -Math.PI / 2, -Math.PI / 2 + Math.abs(o.v) * Math.PI * 2); ctx.stroke(); }
      var ospr = A.sprite(o.type === 'shrine' ? 'shrine' : o.type);
      if (ospr) ctx.drawImage(ospr, o.x - 70, o.y + 30 - 140 * 0.97, 140, 140);
      // flag pole
      var fx = ospr ? o.x + 58 : o.x, fy = ospr ? o.y + 10 : o.y;
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(fx - 2, fy - 50, 4, 52);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx + 2, fy - 50); ctx.lineTo(fx + 30, fy - 42 + Math.sin(t * 3) * 2); ctx.lineTo(fx + 2, fy - 32); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!ospr) ctx.fillText(o.type === 'shrine' ? '⛩️' : (o.type === 'village' ? '🏘️' : '🪦'), o.x - 22, o.y - 4);
      ctx.font = 'bold 12px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = '#eee';
      var lbl = o.name + (o.type === 'shrine' ? ' (+15% income)' : '');
      ctx.strokeText(lbl, o.x, o.y + o.r - 14); ctx.fillText(lbl, o.x, o.y + o.r - 14);
      if (o.blocked) { ctx.fillStyle = '#ffb0b0'; ctx.strokeText('Destroy its buildings to capture', o.x, o.y + o.r + 2); ctx.fillText('Destroy its buildings to capture', o.x, o.y + o.r + 2); }
    });
    // empty build plots
    g.plots.forEach(function (p) {
      if (!vis(p) || g.get(p.buildingId)) return;
      var mine = p.owner === me, sel = ui && ui.sel.plotId === p.id;
      ctx.globalAlpha = mine ? 0.9 : 0.35;
      ctx.fillStyle = sel ? 'rgba(255,215,0,0.25)' : 'rgba(0,0,0,0.35)'; ctx.strokeStyle = p.owner >= 0 ? facs[p.owner].color : '#888';
      ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      if (mine) { ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', p.x, p.y + 1); }
      ctx.globalAlpha = 1;
    });
    // corpses
    g.corpses.forEach(function (c) { if (!vis(c)) return; ctx.globalAlpha = 0.5 * (1 - c.t / 10); ctx.fillStyle = '#3a0a0a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 8, 5, 0.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
    // buildings
    g.buildings.forEach(function (b) {
      if (!vis(b)) return;
      if (ui && ui.sel.buildingId === b.id) { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 10, 0, 7); ctx.stroke(); if (b.def.attack) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(b.x, b.y, b.def.attack.range, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } }
      A.drawBuilding(ctx, b, facs[b.owner]);
      var w = b.r * 1.6, by = A.has(b.type) ? b.y + b.r * 0.8 - b.r * (b.def.role === 'fortress' ? 3.0 : 3.6 * ([0.8, 0.9, 1][b.level - 1] || 1)) * 0.9 : b.y - b.r - 12;
      if (b.hp < b.maxHp || b.built < 1) bar(ctx, b.x - w / 2, by, w, 5, b.hp / b.maxHp, b.owner === me ? '#5c5' : '#e44');
      if (b.built < 1) bar(ctx, b.x - w / 2, by + 7, w, 4, b.built, '#59f');
      else if (b.queue.length) bar(ctx, b.x - w / 2, by + 7, w, 4, b.trainT / NC.UNITS[b.queue[0]].time, '#fc4');
    });
    // units (ground then air)
    var sel = ui ? ui.sel.units : null;
    var list = g.units.filter(vis).sort(function (a, b) { return (a.flying - b.flying) || (a.y - b.y); });
    list.forEach(function (u) {
      if (sel && sel.has(u.id)) { ctx.strokeStyle = '#7f7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(u.x, u.y + 3, u.r + 6, (u.r + 6) * 0.7, 0, 0, 7); ctx.stroke(); }
      if (u.buffs.mist) { ctx.fillStyle = 'rgba(200,40,70,0.25)'; ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 14, 0, 7); ctx.fill(); }
      if (u.buffs.howl) { ctx.strokeStyle = 'rgba(255,200,90,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 5 + Math.sin(t * 10) * 2, 0, 7); ctx.stroke(); }
      if (u.def.aura) { ctx.strokeStyle = 'rgba(180,20,40,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.x, u.y, u.def.aura.radius, 0, 7); ctx.stroke(); }
      A.drawUnit(ctx, u, facs[u.owner], g.sides[u.owner].upgrades);
      var top = A.has(u.type) ? u.y + u.r * 0.7 - (A.sizes[u.type] || (u.hero ? 54 : Math.max(32, u.r * 3.3))) * 0.92 - (u.hero ? 14 : 2) : u.y - u.r - 8;
      if (u.hp < u.maxHp || u.hero) bar(ctx, u.x - u.r - 2, top - (u.hop || 0) - (u.flying ? 6 : 0), u.r * 2 + 4, 3.5, u.hp / u.maxHp, u.owner === me ? '#5d5' : '#e44');
    });
    // projectiles
    g.projectiles.forEach(function (p) {
      if (!vis(p)) return;
      var a = Math.atan2(p.ty - p.y, p.tx - p.x);
      if (p.kind === 'boulder' || p.kind === 'firebolt') {
        var tot = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, done = Math.hypot(p.x - p.sx, p.y - p.sy) / tot, h = Math.sin(Math.min(1, done) * Math.PI) * 40;
        ctx.fillStyle = p.kind === 'boulder' ? '#ddd6c0' : '#ff7020'; ctx.beginPath(); ctx.arc(p.x, p.y - h, 5, 0, 7); ctx.fill();
      } else {
        ctx.strokeStyle = p.kind === 'spark' ? '#fff8a0' : (p.kind === 'bolt' ? '#dfe8ff' : '#e8d8b0'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10); ctx.stroke();
      }
    });
    // effects
    g.effects.forEach(function (e) {
      var f = e.t / e.dur;
      if (e.type === 'ring') { ctx.strokeStyle = e.color; ctx.globalAlpha = 1 - f; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + 0.7 * f), 0, 7); ctx.stroke(); }
      else if (e.type === 'flash') { ctx.fillStyle = e.color; ctx.globalAlpha = 0.6 * (1 - f); ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.5 + 0.5 * f), 0, 7); ctx.fill(); }
      else if (e.type === 'boom') { ctx.fillStyle = '#ff9030'; ctx.globalAlpha = 0.6 * (1 - f); ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * f), 0, 7); ctx.fill(); }
      else if (e.type === 'heal') { ctx.fillStyle = '#8f8'; ctx.globalAlpha = 1 - f; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', e.x, e.y - 14 - f * 12); }
      else if (e.type === 'move') { ctx.strokeStyle = e.color || '#7f7'; ctx.globalAlpha = 1 - f; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 6 + f * 14, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
    // night tint (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var dk = this.darkness();
    if (dk > 0) { ctx.fillStyle = 'rgba(8,12,45,' + (0.3 * dk) + ')'; ctx.fillRect(0, 0, vw, vh); }
    else { ctx.fillStyle = 'rgba(255,220,150,0.05)'; ctx.fillRect(0, 0, vw, vh); }
    if (ui && ui.box) { var bx = ui.box; ctx.strokeStyle = '#7f7'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(120,255,120,0.12)'; ctx.fillRect(bx.x0, bx.y0, bx.x1 - bx.x0, bx.y1 - bx.y0); ctx.strokeRect(bx.x0, bx.y0, bx.x1 - bx.x0, bx.y1 - bx.y0); }
  };

  function bar(ctx, x, y, w, h, f, col) { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h); }

  P.drawMinimap = function (mc) {
    var g = this.g, x = mc.getContext('2d'), s = mc.width / W.w, cam = this.cam;
    x.drawImage(this.bg, 0, 0, mc.width, mc.height);
    var cols = g.sides.map(function (s) { return NC.FACTIONS[s.faction].color; });
    g.outposts.forEach(function (o) { x.fillStyle = o.owner >= 0 ? cols[o.owner] : '#aaa'; x.fillRect(o.x * s - 3, o.y * s - 3, 6, 6); });
    g.buildings.forEach(function (b) { x.fillStyle = cols[b.owner]; var r = b.def.role === 'fortress' ? 6 : 3; x.fillRect(b.x * s - r, b.y * s - r, r * 2, r * 2); });
    g.units.forEach(function (u) { x.fillStyle = u.owner === g.player ? '#ff5070' : '#ffe060'; x.fillRect(u.x * s - 1, u.y * s - 1, u.hero ? 3 : 2, u.hero ? 3 : 2); });
    x.strokeStyle = '#fff'; x.lineWidth = 1;
    x.strokeRect((cam.x - cam.vw / 2 / cam.z) * s, (cam.y - cam.vh / 2 / cam.z) * s, cam.vw / cam.z * s, cam.vh / cam.z * s);
  };
})(globalThis.NC = globalThis.NC || {});
