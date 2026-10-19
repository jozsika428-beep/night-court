// Boot: main menu, game loop, pause and end screens. Runs the 3D view (js3d/) unless ?2d=1 or WebGL fails.
(function (NC) {
  function $(id) { return document.getElementById(id); }
  var touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  var state = { map: 'blackwater', diff: localStorage.getItem('nc_diff') || 'medium', gfx: localStorage.getItem('nc_gfx') || (touch ? 'low' : 'high') };
  var want3d = !/[?&]2d=1/.test(location.search);
  var mode = null; // '3d' or '2d' for the current match
  var game, bot, ren, ui, input, cam, cam2d, cam3d, world, input3d, running = false, paused = false, acc = 0, last = 0, mmT = 0, uiT = 0;
  var STEP = 1 / 30;

  document.title = NC.TITLE; $('title').textContent = NC.TITLE;
  if (!want3d) { $('viewlink').textContent = 'Switch to the 3D view'; $('viewlink').href = location.pathname; $('gfx-wrap').classList.add('hidden'); }

  function menu() {
    var m = '';
    for (var k in NC.MAPS) { var mp = NC.MAPS[k]; m += '<div class="card' + (mp.playable ? (state.map === k ? ' sel' : '') : ' soon') + '" data-map="' + k + '">' + (mp.playable ? '' : '<span class="tag">Coming soon</span>') + '<b>' + mp.name + '</b><small>' + mp.desc + '</small></div>'; }
    $('maps').innerHTML = m;
    var d = ''; for (var k2 in NC.DIFFICULTY) d += '<button data-diff="' + k2 + '" class="' + (state.diff === k2 ? 'sel' : '') + '">' + NC.DIFFICULTY[k2].name + '</button>';
    $('diffs').innerHTML = d;
    $('gfx').innerHTML = '<button data-gfx="low" class="' + (state.gfx === 'low' ? 'sel' : '') + '">Low <small>(faster)</small></button><button data-gfx="high" class="' + (state.gfx === 'high' ? 'sel' : '') + '">High <small>(shadows)</small></button>';
  }
  $('maps').onclick = function (e) { var c = e.target.closest('[data-map]'); if (c && NC.MAPS[c.dataset.map].playable) { state.map = c.dataset.map; menu(); } };
  $('diffs').onclick = function (e) { var c = e.target.closest('[data-diff]'); if (c) { state.diff = c.dataset.diff; localStorage.setItem('nc_diff', state.diff); menu(); } };
  $('gfx').onclick = function (e) { var c = e.target.closest('[data-gfx]'); if (c) { state.gfx = c.dataset.gfx; localStorage.setItem('nc_gfx', state.gfx); menu(); } };

  // ---- wait for the 3D module (or give up and use 2D) ----
  var failed3d = false;
  window.addEventListener('nc3d-failed', function () { failed3d = true; });
  $('play').onclick = function () {
    if (!want3d || failed3d) return start(false);
    if (NC.three) return start(true);
    var btn = $('play'); btn.textContent = 'Loading 3D...';
    var done = false, t = setTimeout(function () { finish(false); }, 8000);
    function finish(ok) { if (done) return; done = true; clearTimeout(t); btn.textContent = '▶ Play'; start(ok); }
    window.addEventListener('nc3d-ready', function () { finish(true); }, { once: true });
    window.addEventListener('nc3d-failed', function () { finish(false); }, { once: true });
  };

  function Camera() { this.x = 800; this.y = 2000; this.z = 1; this.minZ = 0.3; this.maxZ = 2.2; this.dpr = 1; this.vw = 1; this.vh = 1; }
  Camera.prototype.clamp = function () {
    var W = NC.WORLD, hw = this.vw / 2 / this.z, hh = this.vh / 2 / this.z;
    this.x = Math.max(Math.min(hw, W.w / 2), Math.min(W.w - Math.min(hw, W.w / 2), this.x));
    this.y = Math.max(Math.min(hh, W.h / 2) - 60, Math.min(W.h - Math.min(hh, W.h / 2) + 160, this.y));
  };

  function resize() {
    if (!cam) return;
    cam.dpr = Math.min(window.devicePixelRatio || 1, 2); cam.vw = window.innerWidth; cam.vh = window.innerHeight;
    if (mode === '3d') { world.resize(); cam.clamp(); return; }
    var c = $('view');
    c.width = Math.round(cam.vw * cam.dpr); c.height = Math.round(cam.vh * cam.dpr);
    cam.minZ = Math.max(0.25, Math.min(cam.vw / NC.WORLD.w, cam.vh / NC.WORLD.h));
    cam.clamp();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  function setup3d() {
    var T = NC.three;
    cam3d = cam3d || new T.Camera3D(NC);
    if (world && world.gfx !== state.gfx) { // graphics changed: new WebGL context on a fresh canvas
      if (input3d) input3d.destroy(); input3d = null; world.dispose();
      var old = $('view3d'), fresh = old.cloneNode(false); old.parentNode.replaceChild(fresh, old); world = null;
    }
    if (!world) world = new T.World3D($('view3d'), cam3d, NC, state.gfx);
    return cam3d;
  }

  function start(use3d) {
    $('menu').classList.add('hidden'); $('game').classList.remove('hidden'); $('overlay').classList.add('hidden');
    $('toasts').innerHTML = '';
    game = new NC.Game({ difficulty: state.diff, map: state.map });
    bot = new NC.Bot(game, 1);
    var f = game.get(game.sides[0].fortressId);
    if (use3d) {
      try { cam = setup3d(); mode = '3d'; } catch (e) { console.warn('3D failed, using 2D', e); use3d = false; failed3d = true; }
    }
    $('view3d').classList.toggle('hidden', !use3d); $('view').classList.toggle('hidden', !!use3d); $('rot').classList.toggle('hidden', !use3d);
    if (use3d) {
      resize(); cam.x = f.x; cam.y = f.y - 110; cam.z = 1; cam.yaw = cam.yawTarget = 0; cam.clamp();
      world.setGame(game); ren = world;
      ui = new NC.UI(game, cam, { pause: pause });
      if (input3d) input3d.destroy();
      input3d = new NC.three.Input3D($('view3d'), cam, ui, world);
      $('rot-l').onclick = function () { cam.rotateBy(-Math.PI / 4); };
      $('rot-r').onclick = function () { cam.rotateBy(Math.PI / 4); };
    } else {
      mode = '2d'; cam2d = cam2d || new Camera(); cam = cam2d; resize();
      cam.z = Math.max(0.45, Math.min(1.1, Math.min(cam.vw, cam.vh * 0.8) / 520)); cam.x = f.x; cam.y = f.y - 90; cam.clamp();
      ren = new NC.Renderer($('view'), game, cam);
      ui = new NC.UI(game, cam, { pause: pause });
      if (!input) input = new NC.Input($('view'), cam, ui); else { input.cam = cam; input.ui = ui; }
      if (want3d) ui.toast('3D view not available here, using the 2D view', 'alert');
    }
    $('minimap').onpointerdown = function (e) { var r = this.getBoundingClientRect(); cam.x = (e.clientX - r.left) / r.width * NC.WORLD.w; cam.y = (e.clientY - r.top) / r.height * NC.WORLD.h; cam.clamp(); };
    ui.toast('Build on the ＋ plots. Start with a Crypt and a Blood Farm.', 'hero');
    running = true; paused = false; acc = 0; last = performance.now();
    window.NC_GAME = game; window.NC_BOT = bot; window.NC_CAM = cam; window.NC_VIEW = mode; window.NC_WORLD = mode === '3d' ? world : null; window.NC_UI = ui; // for tests
    ui.refresh(true);
  }

  function overlay(html) { $('overlay-box').innerHTML = html; $('overlay').classList.remove('hidden'); }
  function pause() {
    paused = true;
    overlay('<h2>Paused</h2><p>' + NC.MAPS[state.map].name + ' - ' + NC.DIFFICULTY[state.diff].name + (mode === '3d' ? ' - 3D ' + state.gfx : ' - 2D') + '</p><button id="o-res">▶ Resume</button><button id="o-restart">↻ Restart</button><button id="o-menu">☰ Main menu</button>');
    $('o-res').onclick = function () { paused = false; $('overlay').classList.add('hidden'); last = performance.now(); };
    $('o-restart').onclick = function () { start(mode === '3d'); }; $('o-menu').onclick = toMenu;
  }
  function toMenu() { running = false; $('overlay').classList.add('hidden'); $('game').classList.add('hidden'); $('menu').classList.remove('hidden'); menu(); }
  function endScreen() {
    var won = game.winner === game.player, s = game.sides[game.player], m = Math.floor(game.t / 60), sec = Math.floor(game.t % 60);
    overlay('<h2>' + (won ? '🏆 Victory!' : '💀 Defeat') + '</h2><p>' + (won ? 'The Dawn Order\'s Keep has fallen.' : 'Your Fortress was destroyed.') + '</p><p>Time ' + m + 'm ' + sec + 's<br>Enemies slain: ' + s.stats.kills + '<br>Units lost: ' + s.stats.lost + '<br>' + NC.FACTIONS[s.faction].res + ' earned: ' + Math.floor(s.stats.earned) + '</p><button id="o-again">↻ Play again</button><button id="o-menu">☰ Main menu</button>');
    $('o-again').onclick = function () { start(mode === '3d'); }; $('o-menu').onclick = toMenu;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    var dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (!paused && game.winner < 0) {
      acc += dt;
      var steps = 0;
      while (acc >= STEP && steps < 6) { bot.update(STEP); game.update(STEP); acc -= STEP; steps++; }
      if (steps === 6) acc = 0;
      if (game.winner >= 0) setTimeout(endScreen, 1200);
    }
    ren.draw(ui);
    if (mode === '3d') window.__fps = world.fps;
    mmT -= dt; if (mmT <= 0) { mmT = 0.25; ren.drawMinimap($('minimap')); }
    uiT -= dt; if (uiT <= 0) { uiT = 0.15; ui.hud(); ui.refresh(); }
  }

  menu();
  NC.Assets.load(function () {
    if (ren && mode === '2d') ren.bgArt = false;
    var P = NC.Assets.portraits;
    $('banner').innerHTML = ['vael', 'grimfang'].filter(function (k) { return P[k]; }).map(function (k) { return '<img src="' + P[k] + '" alt="">'; }).join('');
  });
  requestAnimationFrame(frame);
  NC.start = start; // for automated tests
})(globalThis.NC = globalThis.NC || {});
