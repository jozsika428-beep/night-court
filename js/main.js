// Boot: main menu, game loop, pause and end screens.
(function (NC) {
  function $(id) { return document.getElementById(id); }
  var state = { map: 'blackwater', diff: localStorage.getItem('nc_diff') || 'medium' };
  var game, bot, ren, ui, input, cam, running = false, paused = false, acc = 0, last = 0, mmT = 0, uiT = 0;
  var STEP = 1 / 30;

  document.title = NC.TITLE; $('title').textContent = NC.TITLE;

  function menu() {
    var m = '';
    for (var k in NC.MAPS) { var mp = NC.MAPS[k]; m += '<div class="card' + (mp.playable ? (state.map === k ? ' sel' : '') : ' soon') + '" data-map="' + k + '">' + (mp.playable ? '' : '<span class="tag">Coming soon</span>') + '<b>' + mp.name + '</b><small>' + mp.desc + '</small></div>'; }
    $('maps').innerHTML = m;
    var d = ''; for (var k2 in NC.DIFFICULTY) d += '<button data-diff="' + k2 + '" class="' + (state.diff === k2 ? 'sel' : '') + '">' + NC.DIFFICULTY[k2].name + '</button>';
    $('diffs').innerHTML = d;
  }
  $('maps').onclick = function (e) { var c = e.target.closest('[data-map]'); if (c && NC.MAPS[c.dataset.map].playable) { state.map = c.dataset.map; menu(); } };
  $('diffs').onclick = function (e) { var c = e.target.closest('[data-diff]'); if (c) { state.diff = c.dataset.diff; localStorage.setItem('nc_diff', state.diff); menu(); } };
  $('play').onclick = function () { start(); };

  function Camera() { this.x = 800; this.y = 2000; this.z = 1; this.minZ = 0.3; this.maxZ = 2.2; this.dpr = 1; this.vw = 1; this.vh = 1; }
  Camera.prototype.clamp = function () {
    var W = NC.WORLD, hw = this.vw / 2 / this.z, hh = this.vh / 2 / this.z;
    this.x = Math.max(Math.min(hw, W.w / 2), Math.min(W.w - Math.min(hw, W.w / 2), this.x));
    this.y = Math.max(Math.min(hh, W.h / 2) - 60, Math.min(W.h - Math.min(hh, W.h / 2) + 160, this.y));
  };

  function resize() {
    if (!cam) return;
    var c = $('view');
    cam.dpr = Math.min(window.devicePixelRatio || 1, 2); cam.vw = window.innerWidth; cam.vh = window.innerHeight;
    c.width = Math.round(cam.vw * cam.dpr); c.height = Math.round(cam.vh * cam.dpr);
    cam.minZ = Math.max(0.25, Math.min(cam.vw / NC.WORLD.w, cam.vh / NC.WORLD.h));
    cam.clamp();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  function start() {
    $('menu').classList.add('hidden'); $('game').classList.remove('hidden'); $('overlay').classList.add('hidden');
    $('toasts').innerHTML = '';
    game = new NC.Game({ difficulty: state.diff, map: state.map });
    bot = new NC.Bot(game, 1);
    cam = cam || new Camera(); resize();
    var f = game.get(game.sides[0].fortressId);
    cam.z = Math.max(0.45, Math.min(1.1, Math.min(cam.vw, cam.vh * 0.8) / 520)); cam.x = f.x; cam.y = f.y - 90; cam.clamp();
    ren = new NC.Renderer($('view'), game, cam);
    ui = new NC.UI(game, cam, { pause: pause });
    if (!input) input = new NC.Input($('view'), cam, ui); else { input.cam = cam; input.ui = ui; }
    $('minimap').onpointerdown = function (e) { var r = this.getBoundingClientRect(); cam.x = (e.clientX - r.left) / r.width * NC.WORLD.w; cam.y = (e.clientY - r.top) / r.height * NC.WORLD.h; cam.clamp(); };
    ui.toast('Build on the ＋ plots. Start with a Crypt and a Blood Farm.', 'hero');
    running = true; paused = false; acc = 0; last = performance.now();
    window.NC_GAME = game; window.NC_BOT = bot; window.NC_CAM = cam; // handy for debugging/tests
    ui.refresh(true);
  }

  function overlay(html) { $('overlay-box').innerHTML = html; $('overlay').classList.remove('hidden'); }
  function pause() {
    paused = true;
    overlay('<h2>Paused</h2><p>' + NC.MAPS[state.map].name + ' - ' + NC.DIFFICULTY[state.diff].name + '</p><button id="o-res">▶ Resume</button><button id="o-restart">↻ Restart</button><button id="o-menu">☰ Main menu</button>');
    $('o-res').onclick = function () { paused = false; $('overlay').classList.add('hidden'); last = performance.now(); };
    $('o-restart').onclick = start; $('o-menu').onclick = toMenu;
  }
  function toMenu() { running = false; $('overlay').classList.add('hidden'); $('game').classList.add('hidden'); $('menu').classList.remove('hidden'); menu(); }
  function endScreen() {
    var won = game.winner === game.player, s = game.sides[game.player], m = Math.floor(game.t / 60), sec = Math.floor(game.t % 60);
    overlay('<h2>' + (won ? '🏆 Victory!' : '💀 Defeat') + '</h2><p>' + (won ? 'The Dawn Order\'s Keep has fallen.' : 'Your Fortress was destroyed.') + '</p><p>Time ' + m + 'm ' + sec + 's<br>Enemies slain: ' + s.stats.kills + '<br>Units lost: ' + s.stats.lost + '<br>' + NC.FACTIONS[s.faction].res + ' earned: ' + Math.floor(s.stats.earned) + '</p><button id="o-again">↻ Play again</button><button id="o-menu">☰ Main menu</button>');
    $('o-again').onclick = start; $('o-menu').onclick = toMenu;
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
    mmT -= dt; if (mmT <= 0) { mmT = 0.2; ren.drawMinimap($('minimap')); }
    uiT -= dt; if (uiT <= 0) { uiT = 0.15; ui.hud(); ui.refresh(); }
  }

  menu();
  NC.Assets.load(function () {
    if (ren) ren.bgArt = false;
    var P = NC.Assets.portraits;
    $('banner').innerHTML = ['vael', 'grimfang'].filter(function (k) { return P[k]; }).map(function (k) { return '<img src="' + P[k] + '" alt="">'; }).join('');
  });
  requestAnimationFrame(frame);
  NC.start = start; // for automated tests
})(globalThis.NC = globalThis.NC || {});
