// ONE asset map for the whole game. Every unit, building, portrait and icon is looked up here.
// If art/manifest.json exists, its sprites replace the placeholder shapes key by key.
// See ART_GUIDE.md for the manifest format.
(function (NC) {
  var A = NC.Assets = {
    // placeholder look per key: shape, fill colour, short label, emoji glyph for menus
    map: {
      ghoul:    { shape: 'circle',  fill: '#6f7f4f', label: 'Gh', glyph: '🧟' },
      archer:   { shape: 'tri',     fill: '#d8cfb4', label: 'Ar', glyph: '🏹' },
      thrall:   { shape: 'square',  fill: '#8a1426', label: 'Th', glyph: '🗡️' },
      werewolf: { shape: 'diamond', fill: '#6b5038', label: 'Ww', glyph: '🐺' },
      bat:      { shape: 'bat',     fill: '#4a3060', label: 'Bt', glyph: '🦇' },
      catapult: { shape: 'rect',    fill: '#8a7a60', label: 'Ct', glyph: '💀' },
      torch:    { shape: 'circle',  fill: '#e07020', label: 'Tb', glyph: '🔥' },
      crossbow: { shape: 'tri',     fill: '#b8c4d0', label: 'Cb', glyph: '🎯' },
      priest:   { shape: 'circle',  fill: '#fff6d0', label: 'Pr', glyph: '✝️' },
      knight:   { shape: 'diamond', fill: '#d4dce6', label: 'Kn', glyph: '🐎' },
      ballista: { shape: 'rect',    fill: '#b05020', label: 'Bl', glyph: '🏹' },
      vael:     { shape: 'star',    fill: '#c0102a', label: 'Vael', glyph: '🧛‍♀️' },
      grimfang: { shape: 'star',    fill: '#7a5a3a', label: 'Grim', glyph: '🐺' },
      ashen:    { shape: 'star',    fill: '#ffe080', label: 'Ashen', glyph: '☀️' },
      fortress: { shape: 'castle',  fill: '#3a1220', label: 'Fortress', glyph: '🏰' },
      crypt:    { shape: 'house',   fill: '#4a3a50', label: 'Crypt', glyph: '⚰️' },
      wolfden:  { shape: 'house',   fill: '#5a4430', label: 'Wolf Den', glyph: '🐺' },
      altar:    { shape: 'house',   fill: '#701020', label: 'Altar', glyph: '🩸' },
      bloodfarm:{ shape: 'farm',    fill: '#5a2028', label: 'Farm', glyph: '🌾' },
      slaughter:{ shape: 'farm',    fill: '#802028', label: 'Slaughter', glyph: '🔪' },
      ntower:   { shape: 'tower',   fill: '#3a2a30', label: 'Tower', glyph: '🗼' },
      keep:     { shape: 'castle',  fill: '#8a7a50', label: 'Keep', glyph: '🏰' },
      barracks: { shape: 'house',   fill: '#7a6a4a', label: 'Barracks', glyph: '⚔️' },
      stables:  { shape: 'house',   fill: '#806040', label: 'Stables', glyph: '🐎' },
      forge:    { shape: 'house',   fill: '#606870', label: 'Forge', glyph: '⚒️' },
      mill:     { shape: 'farm',    fill: '#a08840', label: 'Mill', glyph: '🌾' },
      granary:  { shape: 'farm',    fill: '#b09040', label: 'Granary', glyph: '🏚️' },
      dtower:   { shape: 'tower',   fill: '#9a9080', label: 'Tower', glyph: '🗼' },
      // icons
      blood: { glyph: '🩸' }, gold: { glyph: '🪙' }, pop: { glyph: '👥' }, day: { glyph: '☀️' }, night: { glyph: '🌙' },
      melee: { glyph: '🦷' }, ranged: { glyph: '🏹' }, armor: { glyph: '🛡️' }, frenzy: { glyph: '💢' },
      embrace: { glyph: '🦇' }, mist: { glyph: '🌫️' }, howl: { glyph: '📯' }, leap: { glyph: '💥' }, holy: { glyph: '☀️' }
    },
    sprites: {},    // key -> [Image, ...] (index = level-1 for buildings)
    portraits: {},  // key -> url
    icons: {},      // key -> url
    sizes: {},
    loaded: false
  };

  function img(src) { var i = new Image(); i.src = src; return i; }
  function ready(i) { return i && i.complete && i.naturalWidth > 0; }

  // Load art/manifest.json if the artist has dropped one in. Missing file = placeholders.
  A.load = function (done) {
    if (typeof fetch === 'undefined') { done && done(); return; }
    fetch('art/manifest.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (m) {
      var base = m.base || 'art/';
      var add = function (k, v) {
        if (typeof v === 'string') v = [v];
        else if (v && !Array.isArray(v)) v = [v['1'] || v.l1, v['2'] || v.l2, v['3'] || v.l3].filter(Boolean);
        var lm = /^(.*)_([123])$/.exec(k); // also accept "crypt_2" style keys
        if (lm) { var arr = A.sprites[lm[1]] = A.sprites[lm[1]] || []; arr[+lm[2] - 1] = img(base + v[0]); return; }
        A.sprites[k] = v.map(function (p) { return img(base + p); });
      };
      var sp = m.sprites || m.units || {};
      if (m.buildings) for (var b in m.buildings) add(b, m.buildings[b]);
      for (var k in sp) add(k, sp[k]);
      for (var p in (m.portraits || {})) A.portraits[p] = base + m.portraits[p];
      for (var c in (m.icons || {})) A.icons[c] = base + m.icons[c];
      for (var s in (m.sizes || {})) A.sizes[s] = m.sizes[s];
      A.loaded = true; done && done();
    }).catch(function () { done && done(); });
  };

  A.sprite = function (key, level) {
    var arr = A.sprites[key]; if (!arr) return null;
    var i = arr[Math.min(arr.length, level || 1) - 1] || arr[0];
    return ready(i) ? i : null;
  };

  // HTML for a button icon: artist icon/portrait if present, else emoji.
  A.iconHTML = function (key, faction) {
    var url = A.portraits[key] || (faction && A.icons[key + '_' + faction]) || A.icons[key];
    if (url) return '<img class="ico" src="' + url + '" alt="">';
    var m = A.map[key]; return '<span class="ico">' + (m && m.glyph ? m.glyph : '•') + '</span>';
  };
  A.iconImgs = {};
  A.iconImg = function (key) {
    var url = A.icons[key]; if (!url) return null;
    var i = A.iconImgs[key] || (A.iconImgs[key] = img(url));
    return ready(i) ? i : null;
  };
  A.ready = ready;
  // all listed sprite keys loaded (or failed)? used to build the terrain once
  A.allReady = function (keys) { return keys.every(function (k) { var a = A.sprites[k]; return !a || a.every(function (i) { return !i || i.complete; }); }); };
  A.has = function (k) { return !!(A.sprites[k] && A.sprites[k][0] && ready(A.sprites[k][0])); };
  A.glyph = function (key) { var m = A.map[key]; return m && m.glyph ? m.glyph : ''; };

  function shapePath(ctx, shape, r) {
    ctx.beginPath();
    switch (shape) {
      case 'tri': ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, r * 0.75); ctx.lineTo(-r * 0.95, r * 0.75); ctx.closePath(); break;
      case 'square': ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); break;
      case 'rect': ctx.rect(-r, -r * 0.7, r * 2, r * 1.4); break;
      case 'diamond': ctx.moveTo(0, -r * 1.1); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.1); ctx.lineTo(-r, 0); ctx.closePath(); break;
      case 'bat': ctx.moveTo(0, -r * 0.4); ctx.lineTo(r * 1.2, -r * 0.8); ctx.lineTo(r * 0.7, r * 0.5); ctx.lineTo(0, r * 0.2); ctx.lineTo(-r * 0.7, r * 0.5); ctx.lineTo(-r * 1.2, -r * 0.8); ctx.closePath(); break;
      case 'star': for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); break;
      default: ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
  }

  // Draw a unit. opts: { faction colours, upgrades, selected, night }
  A.drawUnit = function (ctx, u, fac, ups) {
    var m = A.map[u.type] || {}, r = u.r, spr = A.sprite(u.type, 1);
    ctx.save(); ctx.translate(u.x, u.y - (u.hop || 0));
    if (u.flying) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r + 10, r * 0.8, r * 0.35, 0, 0, 7); ctx.fill(); ctx.translate(0, -6); }
    // ownership disc
    var ring = spr && A.iconImg('ring_' + fac.key);
    if (spr) {
      if (ring) ctx.drawImage(ring, -r * 1.5, r * 0.7 - r * 0.75, r * 3, r * 1.5);
      else { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.strokeStyle = fac.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 1.3, r * 0.6, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    } else {
      ctx.fillStyle = fac.dark; ctx.strokeStyle = fac.color; ctx.lineWidth = ups.armor && !u.hero ? 3.5 : 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, 7); ctx.fill(); ctx.stroke();
    }
    var cy = spr ? r * 0.7 : 0, ry = spr ? 0.5 : 1;   // ring centre and squash (flat ellipse under sprites)
    if (ups.armor && !u.hero) { ctx.strokeStyle = '#e8e8f0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, cy, r + 4.5, (r + 4.5) * ry, 0, 0, 7); ctx.stroke(); }
    if (ups.frenzy && !u.hero) { ctx.strokeStyle = 'rgba(255,60,60,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, cy, r + 7, (r + 7) * ry, 0, 0, 7); ctx.stroke(); }
    if (spr) {
      // artist sprites: feet at bottom-centre (0.96h); Night faces right, Dawn faces left
      var sz = A.sizes[u.type] || (u.hero ? 54 : Math.max(32, r * 3.3));
      var faceRight = Math.cos(u.face) >= 0, nativeRight = fac.key !== 'dawn';
      var feet = r * 0.7;
      ctx.save(); ctx.translate(0, feet);
      if (faceRight !== nativeRight) ctx.scale(-1, 1);
      ctx.drawImage(spr, -sz / 2, -sz * 0.96, sz, sz);
      ctx.restore();
      if (u.swing) { ctx.strokeStyle = fac.light; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.cos(u.face) * r, Math.sin(u.face) * r, 5, 0, 7); ctx.stroke(); }
    } else {
      ctx.save(); if (u.type !== 'bat' && m.shape !== 'star') ctx.rotate(0); 
      shapePath(ctx, m.shape, r * (u.hero ? 1.05 : 0.85)); ctx.fillStyle = m.fill || '#888'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); ctx.restore();
      // facing tick
      ctx.strokeStyle = fac.light; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.cos(u.face) * r * 0.7, Math.sin(u.face) * r * 0.7); ctx.lineTo(Math.cos(u.face) * (r + 5 + (u.swing ? 5 : 0)), Math.sin(u.face) * (r + 5 + (u.swing ? 5 : 0))); ctx.stroke();
      ctx.fillStyle = (m.fill && /^#(f|e|d|c|b)/i.test(m.fill)) ? '#111' : '#fff';
      ctx.font = 'bold ' + (u.hero ? 9 : 8) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.hero ? m.label[0] : m.label, 0, u.hero ? 1 : 0.5);
    }
    // upgrade markers: blade (melee), arrow dot (ranged)
    var ranged = u.def.tags.indexOf('ranged') >= 0;
    var top = spr ? r * 0.7 - (A.sizes[u.type] || Math.max(32, r * 3.3)) * 0.9 + r : 0; // shift markers up to the sprite's head
    if (!u.hero && ups.melee && !ranged) { ctx.fillStyle = '#ff3040'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 0.6, top - r - 6); ctx.lineTo(r + 4, top - r + 2); ctx.lineTo(r * 0.4, top - r + 1); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (!u.hero && ups.ranged && ranged) { ctx.fillStyle = '#ffe040'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-r * 0.8, top - r * 0.8, 3, 0, 7); ctx.fill(); ctx.stroke(); }
    // rank chevrons (units from levelled buildings)
    if (u.rank > 1) { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5; for (var i = 0; i < u.rank - 1; i++) { var yy = (spr ? r * 1.25 : r + 4) + i * 3.5; ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(0, yy + 3); ctx.lineTo(4, yy); ctx.stroke(); } }
    if (u.hero) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; var ny = spr ? -(A.sizes[u.type] || 54) * 0.96 + r * 0.7 - 4 : -r - 10; ctx.strokeText(m.label, 0, ny); ctx.fillText(m.label, 0, ny); }
    ctx.restore();
  };

  A.drawBuilding = function (ctx, b, fac) {
    var m = A.map[b.type] || {}, r = b.r, spr = A.sprite(b.type, b.def.role === 'fortress' ? 3 : b.level);
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.globalAlpha = b.built < 1 ? 0.55 : 1;
    if (!spr) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(4, 6, r * 1.05, r * 0.9, 0, 0, 7); ctx.fill(); }
    if (spr) {
      var full = A.sizes[b.type] || r * (b.def.role === 'fortress' ? 3.0 : 3.6), sc = [0.8, 0.9, 1][b.level - 1] || 1;
      if (b.def.role === 'fortress') sc = 1;
      var s = full * sc, base = r * 0.8;
      ctx.drawImage(spr, -s / 2, base - s * 0.97, s, s);
    }
    else {
      ctx.fillStyle = m.fill || '#555'; ctx.strokeStyle = fac.color; ctx.lineWidth = 3;
      if (m.shape === 'castle') {
        ctx.beginPath(); ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); ctx.fill(); ctx.stroke();
        for (var i = 0; i < 4; i++) { var cx = (i % 2 ? 1 : -1) * r * 0.8, cy = (i < 2 ? -1 : 1) * r * 0.8; ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, 7); ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, 7); ctx.fillStyle = fac.color; ctx.fill();
      } else if (m.shape === 'tower') {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, 7); ctx.fillStyle = fac.color; ctx.fill();
      } else if (m.shape === 'farm') {
        ctx.beginPath(); ctx.rect(-r * 0.9, -r * 0.6, r * 1.8, r * 1.2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; for (var j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(j * r * 0.3, -r * 0.5); ctx.lineTo(j * r * 0.3, r * 0.5); ctx.stroke(); }
      } else {
        ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.2); ctx.lineTo(0, -r * 0.95); ctx.lineTo(r * 0.85, -r * 0.2); ctx.lineTo(r * 0.85, r * 0.75); ctx.lineTo(-r * 0.85, r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.font = Math.round(r * 0.75) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (m.glyph) ctx.fillText(m.glyph, 0, m.shape === 'castle' ? 0 : r * 0.1);
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = '#fff';
    var badge = b.def.role !== 'fortress' && A.iconImg('badge_' + b.level);
    var lbl = (m.label || b.def.name) + (b.def.role !== 'fortress' && !badge ? ' ' + '★'.repeat(b.level) : '');
    ctx.strokeText(lbl, 0, r + 12); ctx.fillText(lbl, 0, r + 12);
    if (badge) ctx.drawImage(badge, r * 0.6, -r * 1.5, 24, 24);
    ctx.restore();
  };
})(globalThis.NC = globalThis.NC || {});
